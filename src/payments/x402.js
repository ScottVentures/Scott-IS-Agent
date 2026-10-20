// Pay-per-call ledger following the x402 pattern:
//   1. agent calls provider -> provider answers 402 Payment Required with a price
//   2. agent pays, attaching an idempotency key for that exact step
//   3. agent retries the call with the payment receipt
// The idempotency key guarantees a step is never paid twice, even if the
// provider times out and the call has to be retried.
//
// PAYMENT_MODE=mock records payments in memory. When Metal testnet access
// arrives, implement `settleOnMetal()` with the Metal SDK / RPC and set
// PAYMENT_MODE=metal.
const crypto = require('crypto');
const config = require('../config');

const receipts = new Map(); // idempotencyKey -> receipt
const log = [];

async function settleOnMetal(/* { to, amountUsd, memo } */) {
  throw new Error('Metal settlement not wired yet: add Metal testnet SDK call here.');
}

async function pay({ idempotencyKey, providerId, amountUsd, memo }) {
  const existing = receipts.get(idempotencyKey);
  if (existing) {
    const dup = { ...existing, duplicateBlocked: true };
    log.push({ at: Date.now(), type: 'duplicate_blocked', idempotencyKey, providerId, amountUsd });
    return dup;
  }

  let txId;
  if (config.paymentMode === 'metal') {
    txId = await settleOnMetal({ to: providerId, amountUsd, memo });
  } else {
    txId = 'mock_' + crypto.randomBytes(6).toString('hex');
  }

  const receipt = { idempotencyKey, providerId, amountUsd, txId, paidAt: Date.now(), mode: config.paymentMode };
  receipts.set(idempotencyKey, receipt);
  log.push({ at: Date.now(), type: 'paid', ...receipt });
  return receipt;
}

function totalPaid() { return [...receipts.values()].reduce((s, r) => s + r.amountUsd, 0); }
function history() { return log.slice(-100); }
function reset() { receipts.clear(); log.length = 0; }

module.exports = { pay, totalPaid, history, reset };
