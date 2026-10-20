// Terminal demo: node src/cli.js "Build a landing page for a coffee shop"
const agent = require('./agent');

const task = process.argv.slice(2).join(' ') || 'Build a landing page for a Mombasa coffee shop';
agent.bus.on('event', ev => {
  const { type } = ev;
  if (type === 'planned') console.log(`\nPLAN (${ev.source}): ${ev.steps.map(s => s.kind).join(' -> ')}\n`);
  else if (type === 'market_event') console.log(`!! MARKET: ${ev.message}`);
  else if (type === 'routed') console.log(`step ${ev.step + 1} [${ev.kind}] -> ${ev.provider}  $${ev.cost.toFixed(4)}  ${ev.latencyMs}ms\n    why: ${ev.reason}`);
  else if (type === 'paid') console.log(ev.duplicateBlocked ? `    x402: second payment BLOCKED (already paid, tx ${ev.txId})` : `    x402: paid $${ev.amountUsd.toFixed(4)} tx ${ev.txId}  (spent $${ev.spent.toFixed(4)})`);
  else if (type === 'call_failed') console.log(`    !! ${ev.provider} failed: ${ev.error}. Retrying without paying again.`);
  else if (type === 'escalated') console.log(`ESCALATE: ${ev.reason}`);
  else if (type === 'job_done') console.log(`\nDONE: spent $${ev.spent.toFixed(4)} of $${ev.budgetUsd.toFixed(2)} budget\nSpend by provider: ${JSON.stringify(ev.report.byProvider)}`);
});

agent.runJob(task, { scenario: 'spike' }).then(() => process.exit(0));
