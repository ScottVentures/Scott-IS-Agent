// Splits a job into steps. Uses Claude when ANTHROPIC_API_KEY is set,
// otherwise a simple built-in planner so the demo always runs.
const config = require('./config');

const FALLBACK = [
  { kind: 'plan',      description: 'Break the request into a structure', estTokens: 1500, maxLatencyMs: 3000, minQuality: 0.9 },
  { kind: 'code',      description: 'Produce the main output',            estTokens: 6000, maxLatencyMs: 2000, minQuality: 0.85 },
  { kind: 'review',    description: 'Check the output for errors',        estTokens: 3000, maxLatencyMs: 2500, minQuality: 0.85 },
  { kind: 'summarize', description: 'Write a short summary for the user', estTokens: 800,  maxLatencyMs: 4000, minQuality: 0.8 },
];

async function plan(task) {
  if (!config.anthropicKey) return { source: 'built-in', steps: FALLBACK.map(s => ({ ...s })) };

  const prompt = `Split this AI job into 3-6 steps. Reply with ONLY a JSON array.
Each item: {"kind": one of plan|code|review|summarize|write, "description": string,
"estTokens": integer, "maxLatencyMs": integer, "minQuality": number 0-1}.
Job: ${task}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': config.anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model: config.claudeModel, max_tokens: 1024, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const text = data.content.map(c => c.text || '').join('');
    const steps = JSON.parse(text.slice(text.indexOf('['), text.lastIndexOf(']') + 1));
    return { source: 'claude', steps };
  } catch (err) {
    return { source: `built-in (Claude failed: ${err.message.slice(0, 120)})`, steps: FALLBACK.map(s => ({ ...s })) };
  }
}

module.exports = { plan };
