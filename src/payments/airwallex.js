// Airwallex: funds the agent's AI budget and reports spend.
// AIRWALLEX_MODE=mock keeps an in-memory wallet.
// AIRWALLEX_MODE=sandbox reads real balances from the Airwallex sandbox
// (check endpoint details against the Airwallex docs / starter kit).
const config = require('../config');

const wallet = { currency: 'USD', balance: 25.0, topUps: [], spend: [] };
let token = null;

async function auth() {
  const res = await fetch(`${config.airwallex.baseUrl}/api/v1/authentication/login`, {
    method: 'POST',
    headers: { 'x-client-id': config.airwallex.clientId, 'x-api-key': config.airwallex.apiKey },
  });
  if (!res.ok) throw new Error(`Airwallex auth ${res.status}`);
  token = (await res.json()).token;
  return token;
}

async function getBalance() {
  if (config.airwallexMode !== 'sandbox') return { currency: wallet.currency, available: +wallet.balance.toFixed(4), mode: 'mock' };
  if (!token) await auth();
  const res = await fetch(`${config.airwallex.baseUrl}/api/v1/balances/current`, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Airwallex balances ${res.status}`);
  const rows = await res.json();
  const usd = rows.find(r => r.currency === 'USD') || rows[0] || {};
  return { currency: usd.currency, available: usd.available_amount, mode: 'sandbox' };
}

// Moves money from the business account into the agent's AI budget.
// TODO(sandbox): replace with a real Airwallex transfer once the flow is agreed with mentors.
async function topUp(amountUsd, reason) {
  wallet.balance += amountUsd;
  wallet.topUps.push({ at: Date.now(), amountUsd, reason });
  return { ok: true, balance: wallet.balance };
}

function recordSpend(entry) {
  wallet.balance -= entry.amountUsd;
  wallet.spend.push({ at: Date.now(), ...entry });
}

function spendReport() {
  const byProvider = {};
  for (const s of wallet.spend) byProvider[s.providerId] = +((byProvider[s.providerId] || 0) + s.amountUsd).toFixed(6);
  const total = +wallet.spend.reduce((a, s) => a + s.amountUsd, 0).toFixed(6);
  return { total, byProvider, calls: wallet.spend.length, topUps: wallet.topUps };
}

module.exports = { getBalance, topUp, recordSpend, spendReport };
