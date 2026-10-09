# The Learning Module

Anna Maria Sarkisyan · Evrica Technologies Inc. · HEX [PI] 7.0 on HEX6-BLE

The Learning Module is HEX [PI]'s feedback loop. It has two parts.

- **Nightly Calibration** (`calibrateCognition`): five stages, once a night.
- **Memory Library**: every moment HEX [PI] has met, kept as it was met.

Stages 1 to 4 are where the engine is scored, learns to predict, and is
governed. They are described in [`MODEL.md`](MODEL.md) and
[`OPERATIONS.md`](OPERATIONS.md) and are not changed by anything here. This
document is stage 5, **Experiential Integration**, and the Memory Library it
writes. It is in `main` since 9 October 2026 and reaches the live app when
Publish is pressed in Base44.

| Stage | What it does | Code |
|---|---|---|
| 1 Reveal and score | Scores the open calls against the bar that has finished | `ledger.ts: scoreOpenCalls` |
| 2 Learn and predict | Each version walks each series | `engines.ts: runEngines` |
| 3 Commit | Writes tonight's calls before their outcomes exist | `ledger.ts: logCalls` |
| 4 Govern | Strength maps, version rule, verified flag | `ledger.ts: foldDays, decide, pooledCalibration` |
| 5 Experiential Integration | Perceives tonight's moment of every series, compares it with the moments already met, appends it | `memory.ts`, `experience.ts` |

Stage 5 predicts nothing. Nothing reads what it writes: not the engine, not
CER's weights, not governance, not a screen. It is where HEX [PI] keeps what
it has met, so that a later stage can be built on a record instead of on a
definition chosen in advance.

## 1. The moment that is remembered

For each tracked series, on its last finished bar, with every other tracked
series as a neighbour, CER perceives the moment (`docs/CER.md`, section 6).
Its signature is

    Sigma = (X, G, Phi, U)

| Part | Holds |
|---|---|
| `X` state | The normal score of each present channel's latest change against its own history |
| `G` relations | Harmony with each measurable neighbour; leadership at lags 1 to 3 |
| `Phi` time | The series' own persistence at lags 1 to 5; coherence in three bands with each neighbour, and phase where the band is coherent |
| `U` precision | Samples, the channels that could be measured, and the standard error of every number above |

Novelty is not in the signature. The moment's intrinsic tail, joint tail and
relational surprisal are stored beside it. A signature is kept to six
decimals, hashed, and never changed.

## 2. Distance, as calibrated precision

Two moments of the same series are compared on the channels they share.
Every difference is multiplied by the precision with which it can be
resolved, so the unit is one resolvable step and there is no other unit. A
distance is never an error: it says how far apart two moments are, not how
wrong anything was.

With `n` the samples in a window, `o` the share of observations the two
windows have in common, and `w = max(1 - o, 1/n)`:

| Component | Term, for each shared item | Divided by |
|---|---|---|
| State | `(z_i - z_j)^2`, per shared channel | `2` |
| Harmony | `(atanh r_i - atanh r_j)^2`, per shared neighbour | `(se_i^2 + se_j^2) w` |
| Leadership | the same, per shared neighbour and lag | the same |
| Persistence | `(atanh a_i - atanh a_j)^2`, per lag | `(1/(n_i - 3) + 1/(n_j - 3)) w` |
| Rhythm | `(atanh sqrt(C_i) - atanh sqrt(C_j))^2`, per shared neighbour and band coherent in at least one | `w / K`, `K` the effective segments |
| Phase | `wrap(phi_i - phi_j)^2`, per band coherent in both | `(s_i^2 + s_j^2) w` |

    d_c = sqrt(mean of the component's terms)        kept, one per component
    d   = sqrt(sum of all terms / number of terms)   the distance

`w` is what lets two nights be compared at all: windows that share most of
their observations can differ only through the few they do not share, so a
small difference between them is resolved more finely. Rhythm and phase are
compared only between windows that share nothing, because a spectral
estimate moves with where its segments fall. Phase is circular: `+3.1` and
`-3.1` radians are 0.08 apart.

**Comparability.** Two moments are compared when they share at least half of
the smaller one's channels and at least three terms. A channel present in
only one of them contributes nothing. Otherwise the comparison is counted as
incomparable and no number is produced.

**What one step means.** For the same configuration seen twice through
measurement noise, `d` averages 1 (measured: 0.97 between separate windows,
0.98 between consecutive nights). Its spread under noise is wider than a
chi-square's, because a moment's terms share the same observations, so no
probability is attached to a single distance
(`validation/experience_results.md`).

**What it resolves on real series.** On 27 daily market series, one night to
the next is one step: the same as with the days in a random order. Moments
about three years apart are 1.27 steps apart at the median against 0.92 to
1.06 in that control, and the difference is in harmony (2.5 steps): who
moves with whom.

## 3. Affinity, individuality, transition

    affinity       a = exp(-d^2 / 2)                 continuous; never a class
    individuality  I = min d over the reference      how far the nearest earlier moment is
    transition     T = d(tonight, previous moment)   with the days elapsed, and T / days

**The reference** is 250 earlier moments of the same series spread evenly
over its whole past. Its size is fixed, so individuality does not shrink
merely because the library grows; it covers the whole past, so a
configuration that returns after years can be recognised. Each moment
carries its ordinal `seq` and its `tier` (how many times `seq` divides by
two); the reference is drawn from the tiers that hold at least 250 moments,
so a night never reads more than 499 rows of a series however old its
library is.

No moment is assigned to a class, a regime or a label, tonight or later.
Affinity to the nearest moment, the median and the quartiles are stored as
numbers.

Each measure is empty, not zero, when nothing supports it: the first moment
of a series has no individuality and no transition.

## 4. The Memory Library

| Entity | One row per | Holds |
|---|---|---|
| `MomentMemory` | series per finished bar | Identifier, run, date, bar time, ordinal, tier, step; the signature and its hash; novelty; individuality with the nearest earlier moment; affinity; transition with days and rate; the distance by component; the versions of CER, signature, distance, bandwidth and metrics |
| `NightlyCalibration` | night | Run and date; counts; the distributions of individuality, transition and affinity over the night's moments; dispersion (the median distance among each series' last 30 moments, every pair); continuity; coverage; references to HEX [PI]'s precision figures and the governance decision; whether a moment perceived again from the raw bars reproduced its hash; a hash chained to the night before |

Rules the code keeps and a test checks (`tests/experience.mjs`):

- **Appended, never changed.** The stage calls `create` and nothing else.
- **One row per night.** The run identifier is the date; a second run on the
  same date writes nothing. A run that stopped half way is completed by the
  next one without writing a moment twice.
- **One row per bar.** A series with no new bar (a stock at the weekend)
  gets no new moment, and is listed.
- **Numbers and references only.** No prose, no summary written by a
  language model, no score of how good a night was.
- **Versions.** A changed definition gets a new version and starts its own
  sequence. Old rows keep theirs.
- **No personal data.** Both entities are admin only.

## 5. What it costs

At 27 series of 3,900 bars the stage takes about 2.5 seconds and writes
rows of about 8 kB; at the 7 series tracked today, well under a second and
about 2 kB. It adds one key, `experiential`, to the nightly response.

## 6. What it does not do yet

- **Nothing learns from the library.** That is the next stage of work and
  needs its own specification and tests.
- **No probability for a single distance** (section 2).
- **Fast change.** With daily bars and a 750-observation window,
  consecutive nights are nearly the same window, and the transition between
  them is at its noise floor.
- **Time, space and geography of a channel.** The bar time is stored. The
  acquisition clock, time zone and place of each channel are not yet part
  of a moment.
- **Seven series is a small panel.** A moment of a series is perceived
  through its neighbours, and with six of them, five of which are crypto or
  two equity indices, most of what can be seen is one shared movement.
- **The library starts empty.** Individuality is measured against however
  much has been met; it settles as the reference fills (about a year).

Results of every test, including the ones that did not hold:
`validation/experience_results.md`.
