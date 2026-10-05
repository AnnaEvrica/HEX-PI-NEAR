# HEX [PI] — app and engine (version 6.4)

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
| HEX | `hex.ts` | The 64-state engine as an explicit model with no hand-set numbers (6.4). It makes every call. The mathematics is in `docs/MODEL.md` |
| HEX, control | `stateProbability.ts`, `pretrainedTables.ts` | Version 6.2. Shown for direction; the yardstick 6.4 is scored against |
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

**HEX makes every call.** It reads the last six steps as one of 64 states,
the corners of a six-dimensional cube, and estimates how far each state moves
the probability from the baseline. Evidence is shared between states that
differ in few lines and older evidence counts for less.

**The observer never makes a call.** It watches the series and reports one
thing: the baseline, meaning what the series' recent behaviour and present
position already imply. It holds base rates at dyadic memories (32 to 1,024
steps, and no forgetting) and weights them by how well each has predicted the
series; for direction it also holds the rank of the present value among
earlier ones.

Two versions of HEX run on every read. **6.2** is the control: the same idea
with numbers set by hand (a decay of 0.999, a shrinkage of 100, four field
strengths, pre-trained tables). **6.4** is HEX written as an explicit model
(`docs/MODEL.md`): each of those numbers is a family, and 96 candidates are
averaged with Bayesian weights. That gives a guarantee 6.2 never had: on any
series, its total log loss is within ln 96 of the best single setting chosen
in hindsight.

**HEX makes the call; calibration never changes it.** A call has a side and
a strength (the probability stated for that side). The side is HEX's own.
Calibration restates the strength only, from how often past calls of that
strength were right, and cannot state less than 50% for the side called. This
holds for both versions.

### The learning loop

1. **Ledger.** Every call from both versions on a tracked series is written
   to `CallLedger` before its outcome exists: baseline, probability, and what
   counts as the event.
2. **Nightly update** (`calibrateCognition`). Scores yesterday's calls on the
   bar that has now finished, logs today's, and refits the strength map,
   pooled across every tracked series.

   **Reward is progress, and never negative.** Each call has a closeness,
   1 − (probability − outcome)²: 1 when certain and right, 0.75 for a coin
   flip. When a call comes closer than the average of the same version's
   earlier calls on the same series, the difference is its reward. When it
   falls short, the reward is zero and the distance is kept as a lesson, for
   analysis only: it is never subtracted from anything. Either way the call
   goes into the record, the strength map and HEX's own memory, which is the
   learning. Reward is a record of the engine's progress; no decision is
   taken on it.
3. **Promotion.** For each read, 6.4 is shown once it has at least 300 calls
   over 60 days scored beside 6.2, it has come closer per call by a
   margin whose 95% interval excludes zero, and it is right at least as often.
   It is taken back down when the margin the other way excludes zero. Each
   night's decision rests on the whole record, kept as a running tally. The
   result is one `EngineStatus` row per read, which every function loads
   before showing a number.

**Starting point.** Move size is shown from 6.4 from the first day, because
the rule below already chose it on ten years of replayed history. Direction
is shown from 6.2. The ledger scores both versions from the first night and
can change either.

Started from nothing on 1 January 2016 on 17 market series
(`validation/loop_sim_side.py`: empty ledger, no history before that date,
the loop applied night by night), move size, 46,495 calls:

| | Right | Closeness per call | Strongest tenth: stated / right |
|---|---|---|---|
| Shown to users | 57.3% | 0.7579 | 69.9% / 67.7% |
| 6.2 alone | 55.9% | 0.7539 | 69.0% / 63.5% |
| Baseline rule alone | 57.2% | 0.7580 | 71.9% / 68.7% |

6.4 was promoted once, in August 2018, and never taken down. Closeness per call
rises with the age of a series: 0.742 in its first 100 steps, 0.753 from 100
to 250, 0.758 from 250 to 2,000, 0.761 beyond; over the same span the
strongest tenth goes from stated 70.7% / right 53.2% to 72.2% / 72.7%. It
does not rise year after year. Direction stays at chance (51.4%) and 6.4 is
never promoted for it. On market move size the gain comes from the observer's
baseline, not from the 64 states (`docs/MODEL.md`, section 10).

On that simulation (`validation/progress_sim.py`) 6.4 was rewarded on 55.9%
of its move-size calls and 6.2 on 53.1%. Which version is shown is decided on
closeness, not on reward: with no negatives a bolder version collects more
reward without being nearer (on direction 6.2 collects more than 6.4 at the
same closeness), and a steady version earns little progress however near it
is.

The same simulation is why calibration is confined to strength. Applied to
the whole probability, the map turned 5.6% of 6.4's move-size calls and 20%
of its direction calls round, and 9.4% and 17.5% of 6.2's; the calls it
turned were right less often afterwards (6.2 move size: 54.1% before, 45.9%
after).

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
                                              # (the mathematics: docs/MODEL.md)
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
