// Picks the best provider for a step given live prices, latency, quality and budget.
const providers = require('./providers');

function choose(step, budgetLeft, exclude = []) {
  const candidates = providers.providers
    .filter(p => p.skills.includes(step.kind) && !exclude.includes(p.id))
    .map(p => ({
      id: p.id, name: p.name,
      cost: providers.quote(p.id, step.estTokens),
      latencyMs: p.latencyMs, quality: p.quality,
    }));

  const fits = candidates.filter(c => c.latencyMs <= step.maxLatencyMs && c.quality >= step.minQuality && c.cost <= budgetLeft);

  if (fits.length) {
    fits.sort((a, b) => a.cost - b.cost || a.latencyMs - b.latencyMs);
    const pick = fits[0];
    const others = candidates.filter(c => c.id !== pick.id)
      .map(c => `${c.name} $${c.cost.toFixed(4)}/${c.latencyMs}ms`).join(', ');
    return { decision: 'buy', pick, reason: `Cheapest provider meeting speed (≤${step.maxLatencyMs}ms) and quality (≥${step.minQuality}). Others: ${others || 'none'}.` };
  }

  // Nothing meets every target: relax latency, keep quality and budget.
  const relaxed = candidates.filter(c => c.quality >= step.minQuality && c.cost <= budgetLeft)
    .sort((a, b) => a.cost - b.cost);
  if (relaxed.length) {
    return { decision: 'buy', pick: relaxed[0], reason: `No provider met the ${step.maxLatencyMs}ms speed target, so took the cheapest one that meets quality.` };
  }

  const cheapest = candidates.sort((a, b) => a.cost - b.cost)[0];
  return { decision: 'escalate', pick: null, reason: cheapest
    ? `Cheapest option ($${cheapest.cost.toFixed(4)}) exceeds remaining budget ($${budgetLeft.toFixed(4)}). Needs owner approval.`
    : 'No provider offers this skill.' };
}

module.exports = { choose };
