// Mock inference providers with live-changing prices and latency.
// Replace `call()` with real HTTP calls (each behind an x402 paywall) later.

const SKILLS = ['plan', 'code', 'review', 'summarize', 'write'];

const providers = [
  { id: 'nova',   name: 'Nova Compute',  pricePer1k: 0.0030, latencyMs: 900,  quality: 0.92, skills: SKILLS },
  { id: 'kilima', name: 'Kilima AI',     pricePer1k: 0.0012, latencyMs: 1600, quality: 0.84, skills: SKILLS },
  { id: 'swift',  name: 'SwiftInfer',    pricePer1k: 0.0020, latencyMs: 450,  quality: 0.88, skills: ['code', 'summarize', 'write', 'review'] },
];

// Each provider's baseline, so random drift stays in a sensible band.
const base = Object.fromEntries(providers.map(p => [p.id, { price: p.pricePer1k, latency: p.latencyMs }]));
const spikes = {}; // id -> { priceMult, latencyMult, until }

function drift() {
  for (const p of providers) {
    const b = base[p.id];
    const s = spikes[p.id] && spikes[p.id].until > Date.now() ? spikes[p.id] : null;
    const jitter = () => 1 + (Math.random() - 0.5) * 0.2; // ±10%
    p.pricePer1k = +(b.price * jitter() * (s ? s.priceMult : 1)).toFixed(5);
    p.latencyMs = Math.round(b.latency * jitter() * (s ? s.latencyMult : 1));
    p.spiking = !!s;
  }
}

function spike(id, { priceMult = 5, latencyMult = 1, seconds = 60 } = {}) {
  if (!base[id]) throw new Error(`unknown provider ${id}`);
  spikes[id] = { priceMult, latencyMult, until: Date.now() + seconds * 1000 };
  drift();
}

function clearSpikes() { for (const k of Object.keys(spikes)) delete spikes[k]; drift(); }

function quote(providerId, tokens) {
  const p = providers.find(x => x.id === providerId);
  return +((p.pricePer1k * tokens) / 1000).toFixed(6);
}

async function call(providerId, step) {
  const p = providers.find(x => x.id === providerId);
  // Simulate latency (scaled down so demos stay snappy).
  await new Promise(r => setTimeout(r, Math.min(p.latencyMs / 3, 1500)));
  return { output: `[${p.name}] ${step.kind}: ${step.description}`, tokens: step.estTokens };
}

function snapshot() { return providers.map(p => ({ ...p })); }

drift();
module.exports = { providers, drift, spike, clearSpikes, quote, call, snapshot };
