const fs = require('fs');
const path = require('path');

// Tiny .env loader so the project needs no dependencies.
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

module.exports = {
  port: Number(process.env.PORT || 3000),
  anthropicKey: process.env.ANTHROPIC_API_KEY || '',
  claudeModel: process.env.CLAUDE_MODEL || 'claude-sonnet-5-5',
  jobBudgetUsd: Number(process.env.JOB_BUDGET_USD || 0.5),
  paymentMode: process.env.PAYMENT_MODE || 'mock',
  airwallexMode: process.env.AIRWALLEX_MODE || 'mock',
  airwallex: {
    clientId: process.env.AIRWALLEX_CLIENT_ID || '',
    apiKey: process.env.AIRWALLEX_API_KEY || '',
    baseUrl: process.env.AIRWALLEX_BASE_URL || 'https://api-demo.airwallex.com',
  },
};
