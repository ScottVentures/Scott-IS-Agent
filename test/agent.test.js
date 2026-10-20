const test = require('node:test');
const assert = require('node:assert');
const x402 = require('../src/payments/x402');
const router = require('../src/router');
const providers = require('../src/providers');
const agent = require('../src/agent');

test('x402 ledger never pays the same step twice', async () => {
  x402.reset();
  const a = await x402.pay({ idempotencyKey: 'j1:0:nova', providerId: 'nova', amountUsd: 0.01 });
  const b = await x402.pay({ idempotencyKey: 'j1:0:nova', providerId: 'nova', amountUsd: 0.01 });
  assert.equal(b.duplicateBlocked, true);
  assert.equal(a.txId, b.txId);
  assert.equal(x402.totalPaid(), 0.01);
});

test('router escalates when budget is too small', () => {
  const r = router.choose({ kind: 'code', estTokens: 6000, maxLatencyMs: 2000, minQuality: 0.8 }, 0.000001);
  assert.equal(r.decision, 'escalate');
});

test('router avoids a spiking provider', () => {
  providers.clearSpikes();
  const step = { kind: 'code', estTokens: 6000, maxLatencyMs: 5000, minQuality: 0.8 };
  const first = router.choose(step, 10).pick.id;
  providers.spike(first, { priceMult: 20, seconds: 5 });
  const second = router.choose(step, 10).pick.id;
  assert.notEqual(first, second);
  providers.clearSpikes();
});

test('demo job finishes within budget and blocks the duplicate payment', async () => {
  const events = [];
  const on = ev => events.push(ev);
  agent.bus.on('event', on);
  const job = await agent.runJob('test job', { budgetUsd: 1, scenario: 'spike' });
  agent.bus.off('event', on);
  assert.equal(job.status, 'done');
  assert.ok(job.spent <= 1);
  assert.ok(events.some(e => e.type === 'market_event'));
  assert.ok(events.some(e => e.type === 'paid' && e.duplicateBlocked));
  providers.clearSpikes();
});
