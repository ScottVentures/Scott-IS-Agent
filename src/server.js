const http = require('http');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const agent = require('./agent');
const providers = require('./providers');
const x402 = require('./payments/x402');
const airwallex = require('./payments/airwallex');

const clients = new Set();
agent.bus.on('event', ev => { for (const res of clients) res.write(`data: ${JSON.stringify(ev)}\n\n`); });

// Push provider prices to the dashboard every 2s.
setInterval(() => {
  providers.drift();
  const msg = `data: ${JSON.stringify({ type: 'market', providers: providers.snapshot() })}\n\n`;
  for (const res of clients) res.write(msg);
}, 2000);

function json(res, code, body) { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); }
function readBody(req) {
  return new Promise(resolve => { let b = ''; req.on('data', c => (b += c)); req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch { resolve({}); } }); });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html')));
    }
    if (req.method === 'GET' && url.pathname === '/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
      res.write(`data: ${JSON.stringify({ type: 'market', providers: providers.snapshot() })}\n\n`);
      clients.add(res); req.on('close', () => clients.delete(res));
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/state') {
      return json(res, 200, {
        providers: providers.snapshot(), jobs: agent.jobs.slice(0, 10),
        balance: await airwallex.getBalance(), report: airwallex.spendReport(), payments: x402.history(),
      });
    }
    if (req.method === 'POST' && url.pathname === '/api/jobs') {
      const body = await readBody(req);
      if (!body.task) return json(res, 400, { error: 'task is required' });
      agent.runJob(body.task, { budgetUsd: Number(body.budgetUsd) || config.jobBudgetUsd, scenario: body.scenario || null })
        .catch(err => console.error('job failed', err));
      return json(res, 202, { ok: true });
    }
    if (req.method === 'POST' && url.pathname === '/api/spike') {
      const body = await readBody(req);
      providers.spike(body.provider, { priceMult: Number(body.priceMult) || 5, latencyMult: Number(body.latencyMult) || 1, seconds: 60 });
      return json(res, 200, { ok: true, providers: providers.snapshot() });
    }
    if (req.method === 'POST' && url.pathname === '/api/topup') {
      const body = await readBody(req);
      return json(res, 200, await airwallex.topUp(Number(body.amountUsd) || 10, 'manual top-up'));
    }
    json(res, 404, { error: 'not found' });
  } catch (err) {
    json(res, 500, { error: err.message });
  }
});

if (require.main === module) {
  server.listen(config.port, () => {
    console.log(`Scott IS Agent running at http://localhost:${config.port}`);
    console.log(`Planner: ${config.anthropicKey ? 'Claude (' + config.claudeModel + ')' : 'built-in (set ANTHROPIC_API_KEY for Claude)'}`);
    console.log(`Payments: ${config.paymentMode} | Airwallex: ${config.airwallexMode}`);
  });
}
module.exports = server;
