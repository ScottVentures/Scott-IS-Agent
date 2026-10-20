# Scott IS Agent

**An inference sourcing agent that treats AI compute like a market.**

Scott IS Agent splits an AI job into steps and buys each step from whichever model provider has the best live price and speed. It pays per call using the x402 pattern on Metal, and reroutes as soon as a provider gets expensive or slow. Funding and spend reporting run through Airwallex, so a business gets one controlled AI budget instead of a pile of separate API bills.

Built for the **Airwallex Agentic Banking Hackathon 2026**: Kit 12 (Inference Sourcing), targeting the Metal Award.

## What it does

1. **Plan.** Claude splits the job into steps (plan → code → review → summarize). Each step has a token estimate, a speed target and a quality floor.
2. **Scout.** Live prices and latency are read from each provider.
3. **Route.** For each step, pick the cheapest provider that meets the speed and quality targets within the remaining budget. If nothing fits, escalate to the owner.
4. **Pay.** Pay per call (x402). Each payment carries an idempotency key, so a retried step is **never paid twice**.
5. **Adapt.** If a provider's price spikes or a call times out, reroute or retry without paying again, and log why.
6. **Report.** Spend by provider is recorded against the Airwallex-funded budget wallet.

## Quick start

Requires Node.js 20 or newer. There's nothing to install.

```bash
cp .env.example .env     # optional: works with no keys in mock mode
npm start                # dashboard at http://localhost:3000
npm run demo             # same scenario in the terminal
npm test
```

On Windows, use `copy .env.example .env` instead of `cp`.

Click **Run job** with "Demo crisis" ticked. The agent will:
- see the provider it planned to use for step 2 spike 6× and reroute,
- have a paid provider time out on step 3, retry it, and block the second payment,
- finish within budget and show spend by provider.

## Configuration (`.env`)

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY`, `CLAUDE_MODEL` | Use Claude as the planner (falls back to a built-in planner) |
| `JOB_BUDGET_USD` | Default budget per job |
| `PAYMENT_MODE` | `mock` now, `metal` once Metal testnet settlement is wired in |
| `AIRWALLEX_MODE`, `AIRWALLEX_CLIENT_ID`, `AIRWALLEX_API_KEY` | `sandbox` reads real balances from the Airwallex sandbox |

## Project layout

```
src/
  server.js              HTTP API + live event stream for the dashboard
  agent.js               Orchestrator: plan -> route -> pay -> call -> adapt
  planner.js             Claude planner with built-in fallback
  router.js              Provider choice by price, latency, quality, budget
  providers.js           Mock provider market (live price drift and spikes)
  payments/x402.js       Pay-per-call ledger with idempotency (Metal hook)
  payments/airwallex.js  Budget wallet, top-ups, spend report (sandbox hook)
  cli.js                 Terminal demo
public/index.html        Dashboard
test/agent.test.js       Tests (node --test)
```

## Roadmap

- [x] Routing, budget, escalation, reroute on price spike
- [x] x402-style ledger that blocks double payment on retries
- [x] Live dashboard with reasoning log
- [ ] Claude planner on hackathon credits
- [ ] Real x402 settlement on Metal testnet (`settleOnMetal` in `src/payments/x402.js`)
- [ ] Airwallex sandbox top-up and spend reporting
- [ ] Real provider endpoints behind x402 paywalls

## API

| Method | Path | Body |
|---|---|---|
| POST | `/api/jobs` | `{ "task": "...", "budgetUsd": 0.5, "scenario": "spike" }` |
| POST | `/api/spike` | `{ "provider": "nova", "priceMult": 6 }` |
| POST | `/api/topup` | `{ "amountUsd": 10 }` |
| GET | `/api/state` | Providers, recent jobs, balance, spend report, payments |
| GET | `/events` | Server-sent events stream |

## Author

John Scott (Mwadime), [ScottVentures](https://scottventures.pages.dev) · Mombasa, Kenya
