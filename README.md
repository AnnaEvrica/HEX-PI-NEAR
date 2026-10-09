# HEX [PI]

HEX [PI] is the software. HEX6-BLE is the engine it runs on. Engine version 7.0.

HEX watches one series of numbers at a time (a price, a temperature, a
finishing position). After each new value it states two probabilities about
the next one, each beside what the series' own record already implies. When
the next value arrives it scores itself, works out why it missed when it did,
and learns. Every call is written down before its outcome exists.

The engine is one equation,

```
logit p = logit q0 + beta . Z
```

where `q0` is the **null** (the series' usual odds), `Z` says where the
present value sits among its surroundings, and `beta` is what HEX has learned
on that series. HEX gets credit only for what it adds to the null. The
mathematics, with plain-word reasoning beside every equation and the code
that computes it, is in [`docs/MODEL.md`](docs/MODEL.md).

## What has been measured

One pass through history, every call made before its outcome, every series
started from nothing (`validation/replay.py`; 280,252 calls on 43 series).
The measure is information gain over the null in bits per call: positive when
HEX gave what happened more probability than the series' own record did.

| | Calls | HEX right | Expected | Bits per call over the null [95%] | Status |
|---|---|---|---|---|---|
| Markets, move size (17 series, 2016–2026) | 46,478 | 57.9% | 57.2% | +0.0043 [0.0030, 0.0056] | verified |
| Markets, direction | 46,478 | 51.4% | 51.2% | 0.0000 [−0.0007, 0.0006] | no verified edge |
| *Never used before:* 10 currencies, move size | 26,540 | 62.1% | 61.2% | +0.0082 [0.0060, 0.0106] | verified |
| *Never used before:* 10 currencies, direction | 26,540 | 54.2% | 54.0% | +0.0011 [−0.0002, 0.0025] | no verified edge |
| *Never used before:* 3 temperature stations, direction | 29,408 | 61.0% | 54.6% | +0.0466 [0.0430, 0.0499] | verified |
| *Never used before:* 3 temperature stations, move size | 29,408 | 63.1% | 61.6% | +0.0186 [0.0158, 0.0212] | verified |
| Chicago temperature, direction | 24,678 | 62.9% | 50.7% | +0.0644 [0.0598, 0.0689] | verified |
| Racing, direction | 13,022 | 74.8% | 75.0% | −0.0017 [−0.0020, −0.0014] | no verified edge |

"Expected" is the share right if the null alone had made every call.

- **Next-day market direction has no verified edge**, and the product says so.
- **Learning adds value.** The engine left to learn beats itself frozen after
  its first 500 calls by +0.0036 bits per call [0.0025, 0.0048] on market
  move size.
- **Experience matters.** On market move size HEX is behind the null in a
  series' first 100 calls (−0.011 bits per call), level by 500, and ahead by
  +0.006 after 1,000.
- **Against the previous engine (6.5):** +0.0037 bits per call [0.0025,
  0.0050] on market move size; level on market direction. On racing
  direction both are slightly behind the null, 7.0 by a little more.

The 17 market series were used while designing every version, so that run is
a development backtest. The currencies and temperature stations were never
used before, and the rule for including them was written before any run
(`validation/prereg_replay.md`). Live calls from the release of 7.0 are the
third test; the ledger collects them from the first night. History cannot
prove the future, and nothing here claims to.

Charts and every number: `validation/replay/` (`report.json`, the four
curves, the ledger of every call, the state every 25th call, and the final
state of every series). Typeset reports: `docs/HEX-PI-7.0-mathematics.pdf`
and `docs/HEX-PI-7.0-replay-and-operations.pdf`.

## How it fits together

The structure of the whole system, layer by layer, with its practices for
scaling, testing, privacy, recovery and versioning: [`ARCHITECTURE.md`](ARCHITECTURE.md).

A Base44 app: a React front end (`src/`) and Deno backend functions
(`base44/`). This repository is synced with Base44: a change pushed to `main`
appears in the Base44 Builder, and the live app changes when **Publish** is
pressed there.

| Part | Where | What it does |
|---|---|---|
| Chat screen | `src/components/chat/HEX6ChatInterface.jsx` | Sends each message to the `think` function |
| Chat function | `base44/functions/think/` | Builds the prompt, calls the engine and the language model |
| Engines | `base44/shared/engines.ts` | The one place the two versions of HEX meet; the only source of any probability shown |
| HEX 7.0 | `hex7.ts` | The engine: ranks, the online residual, the mixture with reversible influence |
| The null | `observer.ts` | The series' usual odds. Never makes a call |
| HEX 6.5 | `hex.ts` | The previous engine, frozen. Runs beside 7.0 on every call as the comparator |
| The cycle | `cycle.ts` | Call, outcome, score, reason, learn; information gain and its interval |
| The loop | `ledger.ts`, `universe.ts`, `isotonic.ts`, `functions/calibrateCognition/` | Ledger of every call, nightly scoring, strength maps, which version is shown, which reads are verified |
| Read and wording | `probabilityRead.ts` | Turns a series into the two probabilities and the rules for stating them |
| Pipeline and description | `hex6Pipeline.ts`, `chartContext.ts`, `marketStory.ts` | Runs the read; describes what the chart is doing; never changes a probability |
| Routing | `triage.ts`, `stakes.ts`, `tickers.ts` | Does the message need data; how much care it needs; the one list of symbols |
| Persona and voice | `persona.ts`, `piusEngine.ts`, `piusResonance.ts`, `novelty.ts` | The language-model prompt: identity, locks, register |
| Audit chain | `asiSpine.ts` | Tamper-evident record of reads given in chat |
| Outside services | `marketDataClient.ts`, `discord.ts`, `chatHelpers.ts` | Daily bars, Discord posts, source-link checks and memory |
| Models | `modelRouter.ts` | The one place model IDs are named |
| Version | `version.ts` | The one version string |

### The rules the engine keeps

- **Probability and statistics only.** Each probability is stated beside its
  usual odds. There is no confidence, conviction or exposure anywhere.
- **HEX makes every call.** The null supplies the usual odds and never calls.
- **The strength map never changes a call.** A call has a side and a
  strength. The side is HEX's. The strength shown is restated from how often
  past calls of that strength were right, and cannot go below 50%.
- **No credit for what the null already knew.** Every score is a gain over
  the null.
- **A read without a verified edge is said to have none.**
- **Written before the outcome.** Every call, with what each part of memory
  said, is in the ledger before its outcome exists. Nothing is back-filled.

### The learning loop

Every night, for every tracked series (`functions/calibrateCognition`):

1. **Reveal and score** the open calls of both versions: information gain
   over the null, closeness, reward, lesson, and the reason for each miss.
2. **Learn and predict.** Each version walks the series from its first bar,
   one step at a time: predict, take the outcome in, move on. What it knows
   tonight is exactly what one pass through that series' history teaches it.
   No engine state is stored between nights.
3. **Commit** tonight's calls to `CallLedger` before their outcomes exist.

Then across all series: refit each version's strength map; apply the version
rule (7.0 is shown for a read while its information gain over 6.5 on the same
calls is not clearly behind; it is switched in when clearly ahead and right
at least as often); and set whether each read has a verified edge. The
status starts from the replay, and the ledger changes it only when its own
record is decisive. All of it is one `EngineStatus` row per read.

A new series starts at the null: `beta` is zero until that series' own
history has taught it otherwise.

### Backend functions

| Function | Called by | Purpose |
|---|---|---|
| `think` | chat screen | The chat |
| `calibrateCognition` | workflow, nightly | The loop above. Returns timings |
| `walkForwardAccuracy` | signed-in user, by hand | The one-pass test of both versions on any tickers, live |
| `discordMorningSignal` | workflow, 3 times a day | Kalshi signal post |
| `xEngagement` | workflow, every 30 minutes | X replies and Discord notes |
| `stripeCheckout`, `stripeWebhook` | subscription gate, Stripe | Billing |
| `contactInquiry`, `landingComparison` | public pages | Contact form, live demo answer |
| `spineAlert` | workflow, on a flagged read | Discord alert |
| `asiSpine` | admin, by hand | Verifies the audit chain |

Running it, what it costs, and what to watch: [`docs/OPERATIONS.md`](docs/OPERATIONS.md).

## Checks to run before deploying

```
npm install
npm run lint
npx vite build
npx tsc -p tests/tsconfig.check.json          # backend type check
node tests/backend-smoke/build.mjs && node tests/backend-smoke/run.mjs
node tests/parity.mjs                         # both engines and the null against the Python references
node tests/loop.mjs                           # the loop, night by night, on real BTC bars
node tests/render-prompt.mjs                  # regenerate docs/PROMPT.md after changing the prompt
```

The smoke test runs every backend function locally against real BTC daily
bars, with Base44, the language model and outside services stubbed. It must
print `ALL PASSED`. It also fails if `docs/PROMPT.md` does not match the
prompt the code builds. The prompt has one source: `base44/shared/persona.ts`
and `base44/functions/think/entry.ts`.

`tests/parity.mjs` holds the tested mathematics and the deployed mathematics
to the same numbers: the largest difference between the TypeScript engine and
its Python reference is 10⁻¹³.

Reproducing the measurements: [`validation/README.md`](validation/README.md).

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

---

Anna Maria Sarkisyan · Evrica Technologies Inc. · anna@evrica.tech
© 2026 Evrica Technologies Inc.
