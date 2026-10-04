# Changelog

## 6.3 — 4 October 2026: the learning loop

### What changed

- **HEX makes every call.** An observer (`observer.ts`) watches the series
  and reports its baseline; it never makes a call. Two versions of HEX run on
  every read: 6.2 (the control, shown) and 6.3, which measures each state's
  evidence against the observer's baseline. `engines.ts` is the one place
  they meet.
- **A ledger.** Every call from both versions on a tracked series is written
  to `CallLedger` before its outcome exists, and scored on the next finished
  daily bar. It replaces the prediction journal and the calibration scores.
- **A nightly update** (`calibrateCognition`): scores, logs, refits the
  calibration map pooled across every tracked series, and applies the
  promotion rule. One `EngineStatus` row per read holds the result.
- **A promotion rule fixed in advance.** At least 300 calls over 60 days
  scored beside 6.2, a 95% interval for the log-loss gain that excludes zero,
  and a hit rate at least as high. Demotion when the interval the other way
  excludes zero.
- **One source for the prompt.** `src/docs/HEX6_BLE_COMPLETE_PROMPT.md` is
  gone. `docs/PROMPT.md` is generated from the code and the tests fail when it
  is stale.
- `validation/` (scripts, predictions and results; not the data) is now in
  the repository.

An earlier commit the same day (`b31d0ed`) let a separate rank model make
calls once promoted. That was withdrawn: the rank model is kept only in
`validation/` as a benchmark.

### Measured (17 market series, 2016–2026, 46,954 calls per read)

| | HEX 6.2 | HEX 6.3 | Rank model (benchmark, not shipped) |
|---|---|---|---|
| Move-size calls right | 58.8% | 60.0% | 60.1% |
| Strongest tenth of calls: stated / right | 71.2% / 66.9% | 74.6% / 72.0% | 75.1% / 72.9% |
| Next-day direction calls right | 51.5% | 51.0% | 51.3% |

In the replay 6.3 was promoted for move size after 191 days and never
demoted. The gain is a step, not a climb: accuracy does not keep rising year
after year.

Other series, share of direction calls right: racing 64.9% (6.2) to 75.0%
(6.3), which is the rank rule's own level; weather 56.4% for both, where the
rank model reaches 62.5%. That gap is the one place the rank model sees
something HEX's six binary lines do not.

### Predictions scored

`validation/prereg_core4.md` (the rank model and calibration):

| # | Prediction | Outcome |
|---|---|---|
| 1 | Dyadic base-rate memories match the single drift term | Better on markets (+1.9), worse on weather (-3.2) |
| 2 | The rank model beats 6.2 on market move size, at least 60.0% right | Held (60.1%) |
| 3 | Per-series calibration narrows the gap on the strongest calls | Held for the gap; it does not lower log loss |
| 4 | Pooled calibration is no better than per-series | Failed: pooled is better (+1.5) |
| 5 | Market direction stays at chance | Held |
| 6 | A three-way gate is within 0.5 of the better two-way model | Held |
| 7 | Pooled calibration still wins with series aligned by date | Held (+1.3) |

`validation/prereg_core5.md` (HEX calls, the rank model only observes):

| # | Prediction | Outcome |
|---|---|---|
| 1 | Pooled calibration alone moves the hit rate under 0.3 points and narrows the overstatement under 3 | Held (58.8% to 59.1%; gap 1.0) |
| 2 | Observer-calibrated HEX reaches 59.7% and does not beat the rank model | Held (59.8%) |
| 3 | Keeping HEX's side leaves the hit rate at exactly 58.8% | Mis-specified: per-series calibration itself moves sides; 59.5% |
| 4 | Putting the baseline inside HEX's own formula recovers at least half the gap | Held: 60.0%, nine tenths of it |
| 5 | Direction stays at chance | Held |

### Entities no code uses

`PredictionJournal` and `CalibrationScore` join the twelve already unused.
None was removed: removing an entity can delete its stored rows.

## 6.2.2 — 3 October 2026: backend clean-up (engine unchanged)

The engine and every probability it produces are the same as 6.2 (parity test
unchanged). This release removes dead code and makes the backend say one
thing in one place. There is no EGTS or smart-contract code in the backend.

### Removed

| Removed | Why |
|---|---|
| `shared/hex6Engine.ts` | Frozen NFL, BTC, racing and weather tables with confidence and conviction fields. Nothing shown to a user came from it |
| `shared/iChing.ts`, `shared/hybridArchetypes.ts` | Built state and archetype labels that were filtered out before reaching the prompt or the user |
| Model-based triage and the learned triage profile | The local classifier always answered first, so the model call never ran, and nothing wrote the profile |
| The `BOUNDARY_SIGNAL:` text marker | Two mechanisms did one job. The structured field and the code-side detector remain |
| `selectSynthesisModel`, `adaptVoiceForModel`, `INTERPRETATION_MODEL` | Every one returned Claude |
| Three ticker lists, two copies of the call-scoring loop, three Discord posters, four copies of the stored-field block in `xEngagement` | Each now exists once (`tickers.ts`, `scoreDueCalls`, `discord.ts`, `statsOf`) |

### Made consistent

- **Probability and statistics only, in storage too.** Stored fields named
  `confidence`, `conviction` and `value` are replaced by `edge` (distance of
  P(up) from its usual odds). Existing rows keep their old fields; new rows
  write `edge`.
- **Claude writes everything.** The landing-page answer was written by the
  web model. It now retrieves and Claude writes, as in chat.
- **One identity and confidentiality wording** for chat, X, Discord and the
  landing page (`IDENTITY_LINE`, `CONFIDENTIALITY_LINE`, `STATISTICS_LINE` in
  `persona.ts`). The X prompts no longer describe engine internals.
- **Answer first.** The prompt told the model both to ask a clarifying
  question before answering and never to do so. It now answers first and may
  add one question after.
- **One SDK version** (0.8.52) across all functions; they had four.
- **Entity schemas match what the code writes.** `CognitiveState`,
  `XEngagement`, `PredictionJournal`, `CalibrationScore` and
  `UserConversationMemory` lost fields nothing writes.
- **`PredictionJournal` and `CalibrationScore` are readable by admins only.**
  They were readable by anyone, and the journal holds the asking user's email.
- The nightly score no longer writes `INSUFFICIENT_DATA` once there are
  enough reads, and no longer writes a zero `exposure_correlation`.

### Left as it was

- The persona text itself, apart from the three edits above.
- Handler style (`Deno.serve` and `export default`) and secret access
  (`Deno.env.get` and `secrets.get`): both forms came from Base44 and both
  work there; changing them could not be tested off the platform.
- Function names bound to workflows (`discordMorningSignal`).
- Twelve entities that no code reads or writes: `ArchetypeLedger`, `Asset`,
  `Brain`, `CoreNode`, `CoreRelationship`, `HEX6Memory`, `Manager`,
  `MarkovTickerMemory`, `Output`, `Routing`, `Series`, `SyncState`. Removing
  an entity can delete its stored rows, so this needs a decision.

## Validation — 2 October 2026: rank-core experiments (no change to the shipped engine)

The engine in this package is still 6.2. These experiments are in `validation/`
with predictions written before each run (`prereg_core*.md`). They test a
simpler core: continuous ranks of the current value at dyadic windows, added
to a null that already contains what the value's rank implies.

| Read | Domain | Structure beyond the null | Hit rate, all calls (null rule) |
|---|---|---|---|
| Next change larger than usual | Markets | 3.0% skill; ties 6.2 | 59.9% (54.8%) |
| Next change larger than usual | Weather | 1.7% skill | 56.8% (54.5%) |
| Next value higher than this one | Weather | 6.1% skill | 62.5% (51.2%) |
| Next value higher than this one | Racing | none: the rank rule alone is right 75.0% | 74.7% (75.0%) |
| Next value higher than this one | Markets | 0.16% skill, no gain in hit rate | 51.2% (51.4%) |

What 6.2 has that the rank core lacked on market move size is tracking of a
slowly drifting base rate (its decay). Given one drift term the rank core
reaches 3.8% and beats 6.2 (interval clear of zero). The pre-trained tables
contribute 0.4 thousandths of a nat and the symmetry field 2.1, against 10.1
for the decay.

Against a null that itself tracks that drift, market move size keeps
structure: rank core 60.4% of all calls right against 57.5% for the drift
rule (72.4% against 68.7% on its strongest 10%); 6.2 scores 59.1% and 66.5%.

## Correction — 2 October 2026: racing and weather direction figures superseded

**Superseded validation: inappropriate baseline.** The 6.2 figures below for
horse-racing direction (5.3% to 10.3%) and weather direction (1.3% to 2.2%)
were scored against each series' unconditional usual odds. A later test
(`validation/core2.py`, results frozen in `validation/checkpoints/core2/`)
showed that a rule using only where the current level ranks among earlier
levels scores 27.2% on racing and 6.1% on weather, well above the engine. If
results were independent draws, that rank rule would be right 75% of the
time; on racing it was right 74.7%. So the racing figure measured regression
to the mean, not predictive structure, and is no longer reported as such. The
figures are kept below for the record. Direction is now tested against the
rank-based baseline. The racing row has been removed from the Discover page
and a dated note added there.

## 6.2 — 2 October 2026

### The engine comes pre-trained and is domain-agnostic

Until now the engine learned every series from nothing, so a new or short
series had no evidence and every read sat at its usual odds. In 6.2 it ships
with pre-trained state tables learned on three families of real data:
markets (185,449 steps), weather (24,024) and horse racing (24,216).

It is never told what kind of series it is reading. Every family's table, and
"no table", compete on each series and are weighted by how well each has
explained that series' own outcomes. A family that does not fit is weighted
out. "No table" starts with half the weight.

Tested from a cold start (each test series begins with no history of its
own), on data the tables never saw. Figures are Brier skill over the usual
odds; higher is better.

| Test series | Read | From nothing | Pre-trained |
|---|---|---|---|
| Horse racing, 12 jockeys not in training | direction | 5.3% | 10.3% |
| Horse racing, first 250 steps only | direction | 2.0% | 9.9% |
| Weather, Chicago 1991–2015 | direction | 1.3% | 2.2% |
| Weather, first 250 steps only | direction | 0.1% | 1.3% |
| Markets, 17 series 2016–2026 | move size | 1.06% | 1.23% |
| Markets | direction | at chance | at chance |

On the standard market test (series walked from their start, calibrated,
scored on 2016–2026) move-size skill goes from 3.57% to 3.67% and its
calibration error from 0.8% to 0.5%. The 95% intervals of those gains exclude
zero, except market direction, which is unchanged.

Three things the test also showed:

- **It recognises the family without being told.** On Chicago temperatures
  the weight on the weather table reached 0.90; on a jockey's results the
  racing table reached 1.00; on Bitcoin, direction stayed split between "no
  table" and the market table, because market direction carries no lean.
- **It transfers across domains, modestly.** With a family's own table
  withheld, the other two still helped: racing 5.3% to 6.0%, weather 1.3% to
  1.5%.
- **It has a small cost on random data.** On shuffled series the pre-trained
  engine is about 0.1% worse than starting from nothing, and up to 0.3% worse
  in the first 250 steps, until the wrong tables are weighted out.

The market tables do not help in the first 250 steps of a market series. They
help once the series has enough history for "larger than usual" to be stable.

Files: `base44/shared/pretrainedTables.ts` (generated),
`validation/pretrain.py`, `pretrain_standard.py`, `export_tables.py`,
`parity.py`, and `tests/parity.mjs`. The TypeScript engine matches the Python
reference to 1.3e-15 on three real series.

### Names

- The software is **HEX [PI]** everywhere a person sees it: the persona, page
  titles, the public pages, the subscription screen, the legal and consent
  text, the Discord and X posts.
- The engine is **HEX6-BLE**. The persona says "running on the HEX6-BLE
  engine".
- Not renamed: the workflow file names (renaming them on Base44 would create
  duplicates) and internal identifiers.
- The legal and consent text now names the product HEX [PI]. Counsel should
  confirm that reads correctly.

### Billing

- Checkout starts a **7-day free trial, then the monthly price**. The card is
  collected at checkout and first charged when the trial ends.
- **One trial per person.** Someone who has subscribed before goes straight to
  the paid plan and sees "Subscribe", not "Start free trial".
- The webhook records a trial as `trialing` and handles the
  subscription-created event.
- Copy now reads "7 days free, then $19.99 a month". The "No credit card
  required" line is gone, because checkout collects a card.
- The $19.99 amount lives on the Stripe price (`STRIPE_PRICE_ID`). The code
  does not set it; confirm the price in Stripe is $19.99 a month with no trial
  of its own (the code adds the trial).

### OAuth

Base44 documents the app's MCP server as a dashboard setting, not a file in
the project, so no config file was added. To turn it on: app dashboard →
**MCP** → **Set up access** → follow the steps → **Publish**. Base44 sets up
OAuth itself. This project supplies the consent page at `/oauth/consent` (and
`/OAuthConsent`).

### Also in 6.2

- The prompt now tells the model, in plain words, how the series behaves
  (for example "after a run one way it tends to swing back"), worked out from
  the series itself. No internal category is named to the user.
- `walkForwardAccuracy` reports which family each ticker behaves like.
- The Discover results table has the pre-training result added.

## 6.1 — 2 October 2026

### The main fix

The calibrated engine (walk-forward, symmetry field, calibration) was added
in 5.5 and 5.6 to a function called `hex6Chat`. The chat screen never called
that function; it calls `think`, which was still using the older frozen
tables and "conviction" wording. So the calibrated engine reached no user.

In 6.1, `think` and both scheduled posts take every probability from the
calibrated engine, through one module (`base44/shared/probabilityRead.ts`).

| Walk-forward, market series, 2016–2026 | Frozen tables at the core of the old live path | 6.1 |
|---|---|---|
| Direction, Brier score (0.25 is a coin flip; lower is better) | 0.290 | 0.2496 |
| Calibration error on direction | 17% | 0.3% |
| Move size, Brier skill over the usual odds | not offered | 3.56% (0.0% on shuffled data) |

The old figures are for the frozen tables alone, tested on 16 of the 17 series
(Bitcoin excluded); the layers the old path stacked on top were not tested
separately. Next-day market direction tests at chance in both versions. What changed is
that 6.1 says so, instead of stating a miscalibrated number as a call.

### Engine and prompt

- **One engine.** Six different implementations carried the HEX6 name. The
  calibrated engine is now the only source of a stated probability. The
  64-state tables are kept as a descriptor of recent movement only.
- **Probability and statistics only.** Every instruction to express
  confidence, conviction or strength of call was removed from `think`,
  `persona.ts`, `piusEngine.ts`, `hex6Pipeline.ts`, `marketStory.ts`,
  `chartContext.ts`, the Discord signal and the X posts. Each probability is
  stated beside its base rate, called "its usual odds".
- **A read at its usual odds is reported as such**, not as a direction call.
- **Contradictions in the prompt removed:**
  - the model was told to invert a number that had already been inverted;
  - one block said "always give entries, stops and targets" and another said
    "only when asked" (now a single switch, see Decisions);
  - the persona banned the words "base rate" while the engine rule required
    the base rate to be stated (it is now always "its usual odds");
  - the persona told the model to produce its own percentage ("around 70%")
    when no data existed, against its own rule that numbers come only from
    data or the engine. A read in words is still always given; a percentage
    only comes from data or the engine.
- **Pasted numbers are handled correctly.** Prices and changes are told
  apart; a date, a range or a thousands separator no longer corrupts the
  list; seven stray numbers in a sentence no longer trigger the engine; a
  list under 60 changes gets "too short for a probability" instead of a
  placeholder number.
- **Unfinished bars are excluded.** Yahoo's last daily bar is usually the day
  in progress. The engine now learns from, and scores against, finished bars
  only.
- **In-sample figures removed from the prompt.** The "held-out hit rate" lines
  came from tables trained on the same period they were tested on.
- **The new message is no longer sent to the model twice.**
- **Models.** Claude writes and interprets everywhere. The model names that
  were hard-coded outside the router were moved into it. Web retrieval stays on Gemini
  because Base44 only supports web context there.
- **One version string** (`base44/shared/version.ts`), where there were several
  different ones.

### Persona edits (`base44/shared/persona.ts`)

The persona is otherwise unchanged. These lines were edited, in both the full
persona and the refresher:

| Line | Was | Now |
|---|---|---|
| Opening | "real probability, real conviction, real sample depth" | "real probability beside its real usual odds" |
| Numbers lock | "real probability, real direction, real conviction" | "real probabilities, each with its usual odds" |
| "You always have a prediction" | give a percentage of your own and "a confidence you're willing to hold it at" | "You always have a read": always give a read in words; a percentage only from data or the engine; never adjust the engine's number |
| Confidentiality | "conviction, base rate" in the banned-terms list | the base rate is called "its usual odds" |
| Translate lock | "how likely, how strong, and how sure" | how likely; an engine number is given with its usual odds and no statement of how sure |
| "When the engine has run" | high / low conviction, thin sample | away from its usual odds / at its usual odds / short record |
| Numbers only when asked | "this one I'd size up", hide the percentage | state the number with its usual odds when asked; no sizing language |
| Truth | "with the confidence of someone who has done the math" | "with the steadiness of…" |
| Spelling | "Binaureal" | "Binaural" |

### Sign-in and OAuth

- **Spinner.** A signed-out visitor waited 5.6 seconds (9 requests) on the
  landing page, and about 10 seconds on `/app`. Now one request settles it.
  Retrying happens only on `/app` right after a sign-in or checkout redirect,
  for up to about 14 seconds, with one check at a time.
- **"Not registered" detection** was inverted and could never fire. It now
  reads the server's own reason.
- **A network blip no longer signs a person out.**
- **An abandoned sign-in** no longer leaves a flag that slows later visits
  (the flag expires after two minutes).
- **OAuth consent page.** It was not mounted at any route, so an AI client
  sent to it got the 404 page. It is now served at `/oauth/consent` and
  `/OAuthConsent`, outside the app's loading gate, and only follows a login
  path on this site and a safe return address.
- **Consent flag** is now tied to the account, not the browser.
- **Chat errors are shown.** A failed request used to leave silence.

### Security and billing

- **The paywall is enforced on the server.** `think` now checks the
  subscription; before, any signed-in user could call it directly.
- **Stripe webhook:** events older than five minutes are rejected (replay),
  the signature comparison is constant-time, and a paused subscription no
  longer counts as active.
- **Stripe checkout:** the return address is no longer taken from an
  unverified request header.
- **Contact form** can no longer ping everyone in the Discord server.
- **Spine alert** no longer posts a user's email address to Discord, and no
  longer fires on most chat turns.
- **Landing demo answer** is cached for six hours instead of one model call
  per visitor.

### Scheduled posts

- **Kalshi signal:** five posts a day (two of them at 21:30 and 01:30 Pacific,
  labelled "pre-open") are back to three. It posts calibrated probabilities
  beside their usual odds, and no longer posts "Conviction".
- **X engagement:** it ran on a price history that a language model was asked
  to recall, and posted "Confidence N%" and an exposure figure labelled
  "Probability". It now uses real daily bars and the calibrated read, and no
  longer calls a read "validated".
- **Nightly scoring:** both nightly jobs scored nothing the live app produced.
  One job now scores the live forward record (each direction read given in
  chat, against the next finished daily close).

### Public page

- **Invented performance figures removed.** The Discover page showed a
  learning curve (accuracy 58% rising to 95%, an index up to 2.7) served by a
  function whose own comment said "simulate realistic performance", with
  different fallback numbers in the page. It now shows a table of measured
  results (`src/lib/measuredResults.js`).
- The radar chart is kept and labelled as illustrative positioning.

### Removed

Nothing below was reachable from the app. All of it is still in the 5.6 zip.

| Removed | Why |
|---|---|
| Functions `hex6Chat`, `hex6Process`, `hex6Learn` | Never called; duplicate engines |
| Functions `alpacaTrading`, `autoTrade`, `cryptoScanner`, `backtestEngine`, `egtsProxy`, `marketData`, `runEgtsMigration`, `migrateBrains` | Only called from pages that had no route. Any signed-in user could place orders on the company Alpaca account, and `autoTrade` traded on random numbers when a price fetch failed |
| Functions `marketNotifications`, `scheduledMarketNotifications`, `generateHEX6Notification` | Never called; the scheduled one emailed every user hard-coded figures with no caller check |
| Functions `nightlyCalibration`, `syncEngineRunsToPostgres`, `engineRuns`, `confluenceExperiment`, `generateLandingMetrics` | Scored or served data nothing live produced; `engineRuns` accepted any API key |
| 9 shared modules (`thinkingEngine`, `adaptiveGate`, `zeroScope`, `geneticRiskEngine`, `adaptivePolicy`, `archetypeLedger`, `archetypeWalkForward`, `onlineArchetypeLearner`, `confluenceExperiment`) | Dead, or used only by the removed code |
| 4 workflows (two duplicate Kalshi schedules, nightly scorer, 5-minute sync) | Duplicates, or ran the removed functions |
| 11 pages with no route, and the components only they used | Unreachable |
| Settings: "Analytical depth", "Output risk confidence", "Base currency" | The controls did nothing |
| Supabase client files in the front end | Imported by nothing |

No entity (database table) was removed, so no stored data is affected.

### Decisions for the owner (updated in 6.2)

1. **Trade levels.** `ALWAYS_GIVE_TRADE_LEVELS` in `think` is `false`: entries,
   stops and targets are given when a person asks. Set it to `true` to give
   them on every market reply.
2. **Scheduled functions have no caller check.** Accepted as is for now.
3. **"Model training" consent toggle** does nothing: no training pipeline
   exists.
4. **Self-service subscription field.** Confirm on Base44 that a user cannot
   set their own `subscription_status` through profile updates.
5. **Escalation email** is still `anna@evrica.app`, because Base44 only
   delivers to a registered app user.
6. **Public page copy.** The Discover page still has qualitative claims that
   no test here supports.
7. **Housekeeping left alone:** twelve unused npm packages, and different
   `@base44/sdk` versions pinned across functions.
