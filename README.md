# HEX [PI] — app and engine (version 6.3)

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
| Engines | `base44/shared/engines.ts` | The one place the two versions of HEX meet; the only source of any probability shown to a user |
| HEX | `stateProbability.ts`, `pretrainedTables.ts` | The 64-state engine. It makes every call. Version 6.2 is the control; 6.3 measures its evidence against the observer's baseline |
| Observer | `observer.ts` | Watches the series and reports its baseline. Never makes a call |
| The loop | `ledger.ts`, `universe.ts`, `isotonic.ts`, `functions/calibrateCognition/` | Ledger of every call, nightly scoring, pooled calibration, promotion |
| Read and wording | `base44/shared/probabilityRead.ts` | Turns a series into the two probabilities and the rules for stating them |
| Pipeline and description | `hex6Pipeline.ts`, `chartContext.ts`, `marketStory.ts` | Runs the read; describes what the chart is doing; never changes a probability |
| Routing | `triage.ts`, `stakes.ts`, `tickers.ts` | Does the message need data; how much care it needs; the one list of symbols |
| Persona and voice | `persona.ts`, `piusEngine.ts`, `piusResonance.ts`, `novelty.ts` | The language-model prompt: identity, locks, register. `persona.ts` also holds the three lines every other function shares |
| Audit chain | `asiSpine.ts` | Tamper-evident record of reads given in chat |
| Outside services | `marketDataClient.ts`, `discord.ts`, `chatHelpers.ts` | Daily bars, Discord posts, source-link checks and memory |
| Models | `base44/shared/modelRouter.ts` | The one place model IDs are named |
| Version | `base44/shared/version.ts` | The one version string |

### HEX and its observer

HEX answers two questions about the next step of any series: is it up, and is
it larger than usual. Each answer is a probability beside its baseline ("its
usual odds"). There is no confidence, conviction or exposure anywhere in the
output.

**HEX makes every call.** It reads the last six steps as one of 64 states and
keeps decayed evidence per state, shared between related states by a symmetry
field, with pre-trained tables as a starting point.

**The observer never makes a call.** It watches the series and reports one
thing: the baseline, meaning what the series' recent behaviour and present
position already imply. It holds base rates at dyadic memories (32 to 1,024
steps, and no forgetting) and weights them by how well each has predicted the
series; for direction it also holds the rank of the present value among
earlier ones.

Two versions of HEX run on every read. In **6.2** each state's evidence is
measured against one decayed base rate. In **6.3** it is measured against the
observer's baseline, and the stated probability is calibrated by a map fitted
from the ledger. Nothing else differs.

### The learning loop

1. **Ledger.** Every call from both versions on a tracked series is written
   to `CallLedger` before its outcome exists: baseline, probability, and what
   counts as the event.
2. **Nightly update** (`calibrateCognition`). Scores yesterday's calls on the
   bar that has now finished, logs today's, and refits the calibration map,
   pooled across every tracked series.
3. **Promotion.** For each read, 6.3 is shown once it has at least 300 calls
   over 60 days scored beside 6.2, its probabilities beat 6.2's by a margin
   whose 95% interval excludes zero, and it is right at least as often. It is
   taken back down when the margin the other way excludes zero. The result is
   one `EngineStatus` row per read, which every function loads before showing
   a number.

Replayed on 17 market series, 2016–2026 (`validation/loop_replay_adaptive.py`):
the loop promoted 6.3 for move size after 191 days and never demoted it. Share
of move-size calls right: 58.8% for 6.2, 60.0% for 6.3. Next-day direction
stays at chance for both.

### Backend functions

| Function | Called by | Purpose |
|---|---|---|
| `think` | chat screen | The chat |
| `stripeCheckout`, `stripeWebhook` | subscription gate, Stripe | Billing |
| `contactInquiry`, `landingComparison` | public pages | Contact form, live demo answer |
| `discordMorningSignal` | workflow, 3 times a day | Kalshi signal post |
| `xEngagement` | workflow, every 30 minutes | X replies and Discord notes |
| `calibrateCognition` | workflow, nightly | The nightly update: scores, logs, calibrates, promotes |
| `spineAlert` | workflow, on a flagged read | Discord alert |
| `asiSpine` | admin, by hand | Verifies the audit chain |
| `walkForwardAccuracy` | signed-in user, by hand | Runs the walk-forward test of both versions on any tickers |

## Checks to run before deploying

```
npm install
npm run lint
npx vite build
npx tsc -p tests/tsconfig.check.json          # backend type check
node tests/backend-smoke/build.mjs && node tests/backend-smoke/run.mjs
node tests/parity.mjs                         # HEX (both versions) and the observer against the Python references
node tests/loop.mjs                           # the loop, night by night, on real BTC bars
node tests/render-prompt.mjs                  # regenerate docs/PROMPT.md after changing the prompt
```

The smoke test runs every backend function locally against real BTC daily
bars, with Base44, the language model and outside services stubbed. It must
print `ALL PASSED`. It also fails if `docs/PROMPT.md` does not match the
prompt the code builds.

The prompt has one source: `base44/shared/persona.ts` and
`base44/functions/think/entry.ts`. `docs/PROMPT.md` is generated from them.

The experiments behind the accuracy figures are in `validation/`.

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
