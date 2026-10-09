# Changelog

## 9 October 2026: the Learning Module, with Experiential Integration and the Memory Library (merged to `main`; live on the next Publish)

- **Names.** HEX's feedback loop is the **Learning Module**: the **Nightly
  Calibration** (`calibrateCognition`) and the **Memory Library**.
- **One new stage in the nightly calibration, the fifth: Experiential
  Integration.** After the status rows are stored it perceives tonight's
  moment of every tracked series (CER's perception, no forecast), compares
  it with the moments already met, and appends it. Stages 1 to 4 read,
  write and return exactly what they did before (`tests/experience.mjs`).
- **The Memory Library**: `MomentMemory`, one row per series per finished
  bar, and `NightlyCalibration`, one row per night. Appended, never changed,
  hashed and chained, admin only, no personal data.
- **Measurements** (`base44/shared/experience.ts`, `docs/LEARNING.md`): the
  signature `(X, G, Phi, U)`; a distance in resolvable steps, by component;
  continuous affinity; individuality against a fixed-size reference spread
  over the series' whole past; transition from the previous moment; the
  night's dispersion and continuity. No classes, no labels, no prose.
- **CER 0.4.1.** The precision of a phase now comes from the coherence in
  excess of its threshold. Perception test 2 passes (29 of 30, from 23).
  No forecast uses this number; CER's replay calls are unchanged.
- **Nothing reads the Memory Library.** No prediction, strength map,
  version rule, verified flag or shown read changes. In `main`; it runs
  live from the next Publish in Base44.

## 9 October 2026: unused entities removed

- Removed fourteen entities that no function, shared module, workflow or
  screen used: `ArchetypeLedger`, `Asset`, `Brain`, `CalibrationScore`,
  `CoreNode`, `CoreRelationship`, `HEX6Memory`, `Manager`,
  `MarkovTickerMemory`, `Output`, `PredictionJournal`, `Routing`, `Series`,
  `SyncState`. Their rows go with them when Base44 syncs.

## 9 October 2026: CER 0.4, the moment as the primary object (merged to `main`)

- **CER's governing inference is replaced.** The primary object is the
  relational moment `M_t = (X_t, G_t, Phi_t)` with its signature
  `(X, G, Phi, U, N)`: harmony, leadership, counterpoint, rhythm with phase
  and its uncertainty, and intrinsic, relational and temporal novelty at
  every call. Perception uses no outcome and no past forecasting success.
- **Predictive eligibility is a separate, controlled calculation**: what a
  neighbour adds given the target's own past, the calendar, every other
  neighbour and the arm's timestamp availability. The call is maximum
  entropy at T = 1 over that evidence.
- **`A.L.C.Q`, the original weighting and `cer-0.3` are frozen comparators**
  (`validation/cer/frozen_manifest.json`) and reproduce their committed
  calls. HEX 7.0 reproduces its ledger on all 43 series.
- **Perception is tested on its own** (`validation/cer_perception.py`).
- No function, entity, screen or shown call uses CER. Nothing is merged.

## 9 October 2026: CER, an experimental module in shadow

- **New, separate module** `base44/shared/cer/` (Cross-Environment
  Resonance): ingestion with units and quality kept, alignment by what a call
  may see, three descriptive relations per pair of channels, and prediction
  from neighbours as one voice per edge. Nothing imports it; no engine file,
  function, entity or shown call changed. `docs/CER.md`.
- **Three ways of hearing an edge, compared on identical causal data**
  (`cer-0.3`): by past predictive success; by present measurement,
  `w = A.L.C.Q`, with no outcome in it; and by maximum entropy over
  interpretations, with a temperature validated without the prediction
  target. Descriptive association is kept apart from predictive influence: a
  relation with no measured lead is recorded and not put into the forecast.
- **Tested the way 7.0 was**: predictions written first
  (`validation/prereg_cer.md`), one pass, controls displaced in time, results
  beside them (`validation/cer_results.md`). Where one environment physically
  leads another it adds to 7.0 (New York temperature direction +0.073 bits
  per call over 7.0 under maximum entropy, 64.5% to 67.8% right); it reports no relationship where
  there is none; on markets the relations are real and simultaneous and do
  not forecast.
- **Checks**: `tests/cer.mjs` (TypeScript against the reference),
  `validation/cer_synthetic.py` (twelve tests).
- `ARCHITECTURE.md`: the structure of the whole system in one file.

## 7.0 — 5 October 2026: HEX as a residual on the null

### What changed

- **A new engine** (`base44/shared/hex7.ts`): `logit p = logit q0 + beta . Z`.
  `q0` is the null, unchanged. `Z` is where the present value sits among its
  surroundings: its midrank in windows of 2 to 64 values and in all history,
  for the level and for the size of the change. `beta` is learned online, one
  outcome at a time, at nine prior scales mixed by likelihood. It starts at
  zero, so a new series starts at the null. The null and two residual models
  are mixed with reversible influence (fixed share at five rates).
- **6.5 is frozen** (`hex.ts`) and runs beside 7.0 on every call as the
  comparator. **6.2 is retired** (`stateProbability.ts` and
  `pretrainedTables.ts` are removed).
- **One measure.** Information gain over the null, `ln p(y) - ln q0(y)`, in
  bits per call, with days as the unit of uncertainty (`cycle.ts`). Which
  version is shown is decided on it, and a read has a verified edge only when
  the shown version's gain over the null is clear of zero. A read without one
  is presented as having no verified edge.
- **The loop is stated in its order**: reveal, score, learn, predict, commit
  (`functions/calibrateCognition`). The nightly response carries timings.
- **Ledger.** `CallLedger` gains `log_score`, `info_gain`, `learned`;
  `part_state` becomes `part_structure`; `engine` is `state-6.5` or
  `hex-7.0`. `EngineStatus` gains `verified`, the bits-per-call fields with
  their intervals, `closeness_*` and `calibration_control`.
- **Reasons for a miss** now read `structure`, `change`, `blip`, `outvoted`,
  `unseen`.
- **Docs.** `README.md`, `docs/MODEL.md` (the mathematics with plain-word
  reasoning and the code beside every equation), `docs/OPERATIONS.md` (cost,
  scaling, what to watch), `validation/README.md`.

### Measured (`validation/replay.py`, predictions in `prereg_replay.md`)

One pass, every call before its outcome, every series from nothing: 280,252
calls on 43 series. Bits per call over the null, 95% interval:

| | 7.0 right | Expected | Bits per call |
|---|---|---|---|
| Markets, move size (17 series) | 57.9% | 57.2% | +0.0043 [0.0030, 0.0056] |
| Markets, direction | 51.4% | 51.2% | 0.0000 [−0.0007, 0.0006] |
| Never used before: 10 currencies, move size | 62.1% | 61.2% | +0.0082 [0.0060, 0.0106] |
| Never used before: 3 temperature stations, direction | 61.0% | 54.6% | +0.0466 [0.0430, 0.0499] |
| Chicago temperature, direction | 62.9% | 50.7% | +0.0644 [0.0598, 0.0689] |
| Racing, direction | 74.8% | 75.0% | −0.0017 [−0.0020, −0.0014] |

Over 6.5 on market move size: +0.0037 [0.0025, 0.0050]. Learning against the
same engine frozen after 500 calls: +0.0036 [0.0025, 0.0048].

| # | Prediction | Outcome |
|---|---|---|
| 1 | Market move size: 0.002 to 0.006 bits per call, clear of zero | Held (0.0043) |
| 2 | Market direction: under 0.0015 | Held (0.0000) |
| 3 | 7.0 over 6.5 on market move size: positive, clear of zero | Held |
| 4 | Learning gain positive on move size; within 0.001 of zero on direction | Held (0.0036; 0.0006) |
| 5 | Unused currencies: move size positive, direction not clear | Held |
| 6 | Temperature replication: direction gain positive and at least 58% right at each station | Held (63.1%, 64.5%, 60.5%) |
| 7 | The strength map does not lower information gain on move size | Neither way: −0.0001 [−0.0010, 0.0007]. It brings the strongest tenth from stated 74.0% / right 69.6% to 69.8% / 68.7% |

### Found and fixed while checking the product code against the reference

When a price returned exactly to an earlier price, the rank of that tie was
being decided by the last binary digit of a sum of log changes. Levels are
now rounded to nine decimals before they are ranked, in the engine and in the
null's position rule. With that, the product's 92,888 calls on the 17 market
series match the reference replay's to 10⁻¹⁴. The racing null improved as a
side effect (it has many exact ties), which is why racing direction now
shows HEX slightly behind the null instead of level with it.

### Found and fixed in an independent check of the documents

- **Rounding could move a call across one half.** With no strength map in
  force, a probability between 0.49995 and 0.5 was stored as 0.5000 and read
  as the other side. `stated` (`hex7.ts`) now keeps the side; `tests/loop.mjs`
  checks it. No replay number changes: the replay scores the unrounded
  probability.
- **Last digits.** Four interval bounds had been rounded twice (racing move
  size, and three "over 6.5" bounds); the strongest tenth after the strength
  map is right 68.7% of the time, not 68.8%; the strength map's effect is
  −0.0001 bits per call, not −0.0002.
- **Seattle.** The temperature file ends in 2015, not 2017.
- **The adapter.** Positive levels give log changes; levels that can be zero
  or negative give differences; a series already given as changes is used as
  it is. The earlier wording merged the last two.

### Tested and left out (`validation/hex7.py`)

Products of coordinates admitted on prospective evidence, calibration allowed
to change a call, and an amplitude (interference) mixture: none added
information. The text, letter-number and ontology layers are not part of
7.0; there is no frozen text source or question stream to score them on.

### Needs a decision

- A licence. The repository is public and has none yet.
- Whether to remove the fourteen entities the backend does not use.

## 6.5 — 5 October 2026: one cycle for every call; the two reads coupled

- `cycle.ts`: every call goes through call, outcome, score, reason, learn.
  Each engine writes down what every part of its memory said before the
  outcome, and the reason for a miss is found from that.
- The two reads see each other's lines: three six-line patterns (own, other,
  three of each), 288 settings mixed (`hex.ts`, `validation/hexcoupled.py`).
  Tested with predictions first (`core10.py`, `core10b.py`): direction on the
  Chicago temperature series 56.2% to 57.9% right, a control with the read's
  own three lines gained nothing, markets unchanged.
- Run night by night with the product code on ten years of 17 markets
  (`validation/timesim/`). 6.5 was superseded by 7.0 the same day and is kept
  as its comparator.

## 6.4.4 — 4 October 2026: reward is progress, never negative

- A scored call's progress is its closeness minus the average closeness of
  the same version's earlier calls on the same series and read (a coin flip,
  0.75, before the first). When positive it is the call's **reward**. When
  negative the reward is zero and the distance is kept as a **lesson**, for
  analysis only. Every call enters the record and the engine's memory either
  way.
- `CallLedger` stores `closeness`, `closeness_baseline`, `reward`, `lesson`,
  `record_calls`, `record_closeness`. `EngineStatus` adds `progress_control`,
  `progress_candidate`, `lesson_control`, `lesson_candidate`.
- No decision is taken on reward. Which version is shown is still decided on
  closeness: with no negatives, a bolder version collects more reward without
  being nearer.
- Simulated (`validation/progress_sim.py`): 6.4 is rewarded on 55.9% of its
  move-size calls, 6.2 on 53.1%.

## 6.4.3 — 4 October 2026: move size is shown from 6.4 from day one

- `DEFAULT_LIVE` now shows 6.4 for move size before the ledger has a record
  of its own. The promotion rule already chose it on ten years of replayed
  market history and never took it down, and it is right at least as often
  as 6.2 in every domain measured. Direction still starts on 6.2. The ledger
  scores both from the first night and can change either.

## 6.4.2 — 4 October 2026: HEX makes the call, calibration only restates its strength

- **Calibration can no longer change a call.** In both versions the map was
  applied to the whole probability and the side was read off the result, so
  a call could be turned round. In the ten-year simulation it turned 5.6% of
  6.4's move-size calls and 20% of its direction calls (6.2: 9.4% and 17.5%),
  and those calls were right less often afterwards. The map is now fitted from
  the strength stated for the side called to how often such calls were right,
  and applied to the strength only, with a floor just above 50%
  (`isotonic.ts`: `fitStrength`, `strengthKnots`, `restate`, `applyStrength`).
  This changes what 6.2 states: its calls are its own again, and its
  per-series map only restates their strength.
- **Scoring is a reward for closeness.** Each scored call earns
  1 − (probability − outcome)², between 0 and 1, stored in `CallLedger` in
  place of the log-loss fields, and promotion compares
  mean closeness. The mixture inside HEX is unchanged.
- **Simulated** (`validation/loop_sim_side.py`): move size right 57.3% (57.1%
  before this change), strongest tenth stated 69.9% / right 67.7% (71.3% /
  67.1% before); one promotion for move size, none for direction.
- `validation/loop_sim.py` tests how far back the nightly update should look;
  the cold-start figures quoted in the README come from `loop_sim_side.py`.
- Five new checks in `tests/loop.mjs`, including that a map fitted to a record
  of all-wrong calls still leaves every side alone.

## 6.4.1 — 4 October 2026: decisions rest on the whole record

- **Ten-year cold start** (`validation/loop_sim.py`). The loop run from an
  empty ledger on 1 January 2016 on 17 market series, with calibration and
  promotion applied night by night (`validation/loop_sim_0.json`).
- **Defect found and fixed.** The nightly update decided from the most recent
  5,000 scored rows only. In the simulation that made the shown version flip:
  three changes for move size and five for direction over ten years
  (`validation/loop_sim_1250.json`). `EngineStatus` now keeps a running tally
  of every settled day (`foldDays`, `decide` in `ledger.ts`), a day is counted
  once, five days after its call, and the rule is applied to the whole record.
  With that, move size changes once and direction never.
- New `tally` field on `EngineStatus`. Three new checks in `tests/loop.mjs`.

## 6.4 — 4 October 2026: HEX as an explicit model

### What changed

- **`hex.ts` (state-6.4) replaces the hand-tuned second version.** The
  engine is now written as a model: the next outcome is Bernoulli with
  probability baseline + a per-state shift, estimated by a Beta-Bernoulli
  posterior mean under a kernel-weighted, discounted likelihood on the
  6-cube. The kernel is the cube's diffusion kernel, or its odd part.
- **No hand-set numbers.** The decay (0.999), shrinkage (100), four field
  strengths, the 1/d² neighbour weights, the consensus bit and the
  pre-trained tables are gone from this version. Sharing, symmetry, prior
  strength and half-life are families; 96 candidates are averaged with
  Bayesian weights from a uniform start.
- **A guarantee.** On any series the total log loss is within ln 96 of the
  best single candidate, and the observer's baseline within ln 8 of its best
  single memory.
- **`docs/MODEL.md`** states every definition, every result with its argument
  or citation, and every measured figure, and lists what is still a choice
  and what is not claimed.
- 6.2 is unchanged and stays the control. The intermediate 6.3 is removed.
- Demotion now also triggers when the promoted version is right less often
  by a margin that excludes zero.

### Measured (`validation/core6.py`, `prereg_core6.md`)

| Read, domain | 6.2 right | 6.4 right | 6.4 over its baseline (thousandths of a nat) |
|---|---|---|---|
| Move size, markets | 58.8% | 59.9% | −0.1 [−0.4, 0.2] |
| Direction, markets | 51.5% | 50.8% | +0.4 [0.2, 0.7] |
| Direction, weather | 56.4% | 56.2% | +11.1 [8.8, 13.3] |
| Move size, weather | 55.6% | 55.9% | +0.8 [0.2, 1.4] |
| Direction, racing | 64.9% | 75.0% | +2.2 [−0.1, 5.2] |

6.4 matches the hand-tuned 6.3 on every read (largest difference 0.7
thousandths of a nat, in 6.4's favour) and starts faster on a new series.

On market move size the 64 states add nothing measurable beyond the
observer's baseline. The gain over 6.2 there comes from the baseline.

| # | Prediction | Outcome |
|---|---|---|
| 1 | Market move size: within 1 of 6.3 and at least 59.8% right | Held (−0.1; 59.9%) |
| 2 | Weight goes to shared, plain kernels on market move size; to the odd kernel on racing direction | Failed: where the states add nothing the weights are spread; racing chose plain |
| 3 | Dropping the consensus bit and the tables costs under 1 anywhere | Held |
| 4 | Cold start within 2 of 6.3 | Held (better: 1.1 against 6.5 over the first 25 steps) |

## 6.3 — 4 October 2026: the learning loop

(The second version of HEX described here, 6.3, was replaced by 6.4 the same
day. The ledger, nightly update and promotion rule are unchanged.)

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
| Two label modules | Built state and archetype labels that were filtered out before reaching the prompt or the user |
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
