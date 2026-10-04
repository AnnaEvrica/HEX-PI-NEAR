# HEX [PI] — app and engine (version 6.2, backend clean-up 6.2.2)

HEX [PI] is the software. HEX6-BLE is the engine it runs on.

A Base44 app: a React front end (`src/`) and Deno backend functions (`base44/`).
This repository is synced with Base44: a change pushed to `main` appears in
the Base44 Builder, and the live app changes when you press **Publish** there.
`CHANGELOG.md` lists what changed and what still needs a decision.

## How it fits together

| Part | Where | What it does |
|---|---|---|
| Chat screen | `src/components/chat/HEX6ChatInterface.jsx` | Sends each message to the `think` function |
| Chat function | `base44/functions/think/` | Builds the prompt, calls the engine and the language model |
| Engine | `base44/shared/stateProbability.ts` | The only source of any probability shown to a user |
| Pre-trained tables | `base44/shared/pretrainedTables.ts` | The engine's starting prior (generated; do not edit) |
| Read and wording | `base44/shared/probabilityRead.ts` | Turns a series into the two probabilities and the rules for stating them |
| Pipeline and description | `hex6Pipeline.ts`, `chartContext.ts`, `marketStory.ts` | Runs the read; describes what the chart is doing; never changes a probability |
| Routing | `triage.ts`, `stakes.ts`, `tickers.ts` | Does the message need data; how much care it needs; the one list of symbols |
| Persona and voice | `persona.ts`, `piusEngine.ts`, `piusResonance.ts`, `novelty.ts` | The language-model prompt: identity, locks, register. `persona.ts` also holds the three lines every other function shares |
| Records | `predictionJournal.ts`, `asiSpine.ts` | The live forward record and the audit chain |
| Outside services | `marketDataClient.ts`, `discord.ts`, `chatHelpers.ts` | Daily bars, Discord posts, source-link checks and memory |
| Models | `base44/shared/modelRouter.ts` | The one place model IDs are named |
| Version | `base44/shared/version.ts` | The one version string |

### The engine in one paragraph

For any series of step-to-step changes it walks forward and gives two
probabilities: that the next move is up, and that the next move is larger than
usual. Each is shown beside the series' own base rate ("its usual odds").
Evidence fades with age, related states share evidence (the symmetry field),
and the result is recalibrated on the series' own earlier calls. It comes
pre-trained on markets, weather and horse racing, and is never told which
kind of series it is reading: it works that out from the series. It learns
from an outcome only after the outcome is known. There is no confidence,
conviction or exposure anywhere in the output.

### Backend functions

| Function | Called by | Purpose |
|---|---|---|
| `think` | chat screen | The chat |
| `stripeCheckout`, `stripeWebhook` | subscription gate, Stripe | Billing |
| `contactInquiry`, `landingComparison` | public pages | Contact form, live demo answer |
| `discordMorningSignal` | workflow, 3 times a day | Kalshi signal post |
| `xEngagement` | workflow, every 30 minutes | X replies and Discord notes |
| `calibrateCognition` | workflow, nightly | Scores the live forward record |
| `spineAlert` | workflow, on a flagged read | Discord alert |
| `asiSpine` | admin, by hand | Verifies the audit chain |
| `walkForwardAccuracy` | signed-in user, by hand | Runs the engine's walk-forward test on any tickers |

## Checks to run before deploying

```
npm install
npm run lint
npx vite build
npx tsc -p tests/tsconfig.check.json          # backend type check
node tests/backend-smoke/build.mjs && node tests/backend-smoke/run.mjs
node tests/parity.mjs                         # TypeScript engine vs stored Python reference
```

The smoke test runs every backend function locally against real BTC daily
bars, with Base44, the language model and outside services stubbed. It must
print `ALL PASSED`.

The research code, data and results behind the accuracy figures are not in
this package. They are in the `validation` folder of the 6.2.1 package.
`tests/parity.mjs` checks the TypeScript engine against the Python reference
stored in `tests/parity_reference.json`.

## Settings the app needs on Base44

Secrets: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`,
`DISCORD_WEBHOOK_URL`, `DISCORD_SIGNALS_WEBHOOK_URL`, and for X:
`X_BEARER_TOKEN`, `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`,
`X_ACCESS_TOKEN_SECRET`.

OAuth (AI clients connecting to the app's MCP server): in the app dashboard
open **MCP**, choose **Set up access**, follow the steps, then **Publish**.
Base44 sets up OAuth itself. This project supplies the consent page at
`/oauth/consent` (and `/OAuthConsent`).

Stripe: `STRIPE_PRICE_ID` must be the $19.99 monthly price, with no trial set
on the price itself. The checkout code adds the 7-day trial.

Local development: create `.env.local` with `VITE_BASE44_APP_ID` and
`VITE_BASE44_APP_BASE_URL`, then `npm run dev`.
