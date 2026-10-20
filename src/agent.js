// Orchestrates one job: plan -> for each step choose provider -> pay -> call -> adapt.
const { EventEmitter } = require('events');
const crypto = require('crypto');
const config = require('./config');
const planner = require('./planner');
const router = require('./router');
const providers = require('./providers');
const x402 = require('./payments/x402');
const airwallex = require('./payments/airwallex');

const bus = new EventEmitter();
const jobs = [];
const failNext = new Set(); // provider ids whose next call should time out (demo)

function emit(job, type, data = {}) {
  const ev = { at: Date.now(), jobId: job.id, type, ...data };
  job.events.push(ev);
  bus.emit('event', ev);
}

async function runJob(task, { budgetUsd = config.jobBudgetUsd, scenario = null } = {}) {
  const job = { id: crypto.randomBytes(4).toString('hex'), task, budgetUsd, spent: 0, status: 'planning', steps: [], events: [] };
  jobs.unshift(job);
  emit(job, 'job_started', { task, budgetUsd });

  const { source, steps } = await planner.plan(task);
  job.steps = steps.map((s, i) => ({ ...s, index: i, status: 'pending' }));
  emit(job, 'planned', { source, steps: job.steps });
  job.status = 'running';

  for (const step of job.steps) {
    providers.drift();

    // Demo scenario: right before step 2, the provider that would win it spikes 6x.
    if (scenario === 'spike' && step.index === 1) {
      const wouldPick = router.choose(step, job.budgetUsd - job.spent).pick;
      if (wouldPick) {
        providers.spike(wouldPick.id, { priceMult: 6, seconds: 30 });
        emit(job, 'market_event', { provider: wouldPick.id, message: `${wouldPick.name} (planned pick for step 2) price spiked 6x, rerouting` });
      }
    }
    // Demo scenario: the provider chosen for step 3 times out after being paid.
    if (scenario === 'spike' && step.index === 2) {
      const wouldPick = router.choose(step, job.budgetUsd - job.spent).pick;
      if (wouldPick) failNext.add(wouldPick.id);
    }
    const tried = [];
    let done = false;

    while (!done) {
      const budgetLeft = +(job.budgetUsd - job.spent).toFixed(6);
      const choice = router.choose(step, budgetLeft, tried);

      if (choice.decision === 'escalate') {
        step.status = 'escalated';
        emit(job, 'escalated', { step: step.index, reason: choice.reason });
        job.status = 'needs_approval';
        return job;
      }

      const { pick } = choice;
      emit(job, 'routed', { step: step.index, kind: step.kind, provider: pick.id, cost: pick.cost, latencyMs: pick.latencyMs, reason: choice.reason });

      // x402: pay once per step+provider, keyed so retries can't double-pay.
      const key = `${job.id}:${step.index}:${pick.id}`;
      const receipt = await x402.pay({ idempotencyKey: key, providerId: pick.id, amountUsd: pick.cost, memo: `${step.kind} for job ${job.id}` });
      if (!receipt.duplicateBlocked) {
        job.spent = +(job.spent + pick.cost).toFixed(6);
        airwallex.recordSpend({ jobId: job.id, providerId: pick.id, amountUsd: pick.cost, step: step.kind });
      }
      emit(job, 'paid', { step: step.index, provider: pick.id, amountUsd: pick.cost, txId: receipt.txId, duplicateBlocked: !!receipt.duplicateBlocked, spent: job.spent });

      try {
        if (failNext.has(pick.id)) { failNext.delete(pick.id); throw new Error('provider timed out'); }
        const out = await providers.call(pick.id, step);
        step.status = 'done'; step.provider = pick.id; step.cost = pick.cost; step.output = out.output;
        emit(job, 'step_done', { step: step.index, provider: pick.id, output: out.output });
        done = true;
      } catch (err) {
        // Retry the SAME provider once with the same key: the ledger blocks a second payment.
        emit(job, 'call_failed', { step: step.index, provider: pick.id, error: err.message });
        const again = await x402.pay({ idempotencyKey: key, providerId: pick.id, amountUsd: pick.cost });
        emit(job, 'paid', { step: step.index, provider: pick.id, amountUsd: pick.cost, txId: again.txId, duplicateBlocked: true, spent: job.spent });
        const out = await providers.call(pick.id, step);
        step.status = 'done'; step.provider = pick.id; step.cost = pick.cost; step.output = out.output;
        emit(job, 'step_done', { step: step.index, provider: pick.id, output: out.output, retried: true });
        done = true;
      }
    }
  }

  job.status = 'done';
  emit(job, 'job_done', { spent: job.spent, budgetUsd: job.budgetUsd, report: airwallex.spendReport() });
  return job;
}

module.exports = { runJob, jobs, bus, failNext };
