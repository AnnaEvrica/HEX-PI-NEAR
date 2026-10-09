# The Learning Module: Experiential Integration and the Memory Library. Results

Anna Maria Sarkisyan · Evrica Technologies Inc. · 9 October 2026

Predictions: `prereg_experience.md`, committed before the code and amended
before the run on real series. Branch `learning-module`. Nothing here is
published and nothing reads what the stage writes.

## In one paragraph

The stage is built and does what was specified: it perceives each series'
moment at night, stores it unchanged with its hash, and measures it against
what was met before, without a class or a label anywhere. Ten of twelve
predictions held. One held by less than a point and is reported as marginal
(E8). One held in the letter and not in what it meant, and one part of it
failed (E12): on daily market series, one night to the next, the transition
is one resolvable step, the same as when the days are put in a random
order. What the measure does resolve on real series is change across years,
almost all of it in harmony. One figure in the specification was wrong and
was removed before deployment (the noise tail).

## Prediction by prediction

| | Prediction | Result |
|---|---|---|
| E1 | The same observations give the same records; product code matches the reference to 1e-9 | **Held.** Largest difference 1.6e-15 over signatures, novelty, experience, distances, nightly summary. On real series, 40 sampled moments perceived again by the reference: signature 0, transition 4e-16 |
| E2 | A moment's record does not change when later observations are appended | **Held.** 11 moments, 299 observations appended, identical |
| E3 | Under noise the mean distance is 0.85 to 1.15, separate windows and consecutive nights; each component 0.7 to 1.3 | **Held.** White: 0.968 and 0.982. Autocorrelated: 0.968 and 0.80 (consecutive nights of an autocorrelated series are below the band; the prediction named the white case for consecutive nights). Components 0.87 to 1.26 |
| E4 | A reversed relation with identical marginals is more than 3 steps away; moments within a regime are not | **Held.** 4.98 across (harmony 14.9, leadership 4.5); 1.13 and 0.93 within |
| E5 | Phases of +3.1 and -3.1 are 0.08 apart; no phase term without coherence | **Held.** 0.0832; none |
| E6 | A missing channel removes its terms and leaves the others; too little in common gives no number | **Held.** 24 terms to 16, persistence identical; not comparable, no distance |
| E7 | A configuration that returns is nearest to its earlier appearance, affinity above 0.5, no class created | **Held.** 45 of 45 returning moments; median affinity 0.83; no classes exist in the code |
| E8 | On stationary noise, median individuality in the second half of a long history within 10% of the first | **Marginal.** 9.2% above (0.676 to 0.738). With the reference taken from every earlier moment it was 10.5% above, not met. The direction is up, not the shrinkage the prediction guarded against. Cause: prereg amendment 6 |
| E9 | A second run on the same date writes nothing | **Held.** Also: a run that stopped half way is completed without writing a moment twice; a night with no new bar records the night and no moment |
| E10 | With stage 5 on, stages 1 to 4 respond and write as before; engine parity unchanged | **Held.** Against `main` on the same inputs: response identical, all 48 reads and writes to `CallLedger` and `EngineStatus` identical (30 rows written). With the Memory Library refusing every call, the calibration completes and returns the same. `tests/parity.mjs`, `tests/loop.mjs`, `tests/cer.mjs` pass unchanged |
| E11 | 27 series of 3,900 bars under 10 s; a moment under 20 kB | **Held.** 2.4 s; 6.2 kB built, 7.8 kB on the real series |
| E12 | Real market series, 400 nights: mean transition above 1; state the largest component; under 5% incomparable | **Mean 1.007: above 1 by a margin that means nothing. State is the smallest component (0.86), not the largest: failed. Incomparable 0%: held.** See below |

## E12: what the real series showed

The product code (`integrateExperience`) ran night by night from
27 August 2025 to 30 September 2026 on the 27 market series: 400 nights,
7,527 moments, every night's replay-integrity check reproduced (400 of 400).

| | Real | Days in a random order (control, added after the run) |
|---|---|---|
| Transition, mean | 1.007 | 0.995 |
| Transition, median / p90 / p99 | 0.987 / 1.376 / 1.726 | 0.976 / 1.354 / 1.711 |
| Transition by component, mean: state / harmony / leadership / persistence | 0.861 / 1.018 / 1.009 / 0.997 | 0.989 / 0.980 / 0.962 / 0.926 |
| Individuality, median / p90 / p99 | 0.819 / 1.019 / 1.182 | 0.778 / 0.913 / 1.052 |
| Dispersion among a series' last 30 moments, median of nights | 1.013 | 0.995 |
| Nearest earlier moment is the previous night | 23% | 22% |

Reading it plainly:

- **Night to night there is nothing to resolve.** A 750-observation window
  changes by one observation a night. The transition measures that one
  observation's worth of change, and it is the same size whether the days
  come in their real order or a random one.
- **State is the smallest component, because this stretch was calm.** A
  state term compares each channel's latest change, scored against its own
  whole history. Over these 400 nights the changes were smaller than each
  series' history, so the scores sat closer together than chance (0.86
  against 0.99 in the control).
- **Individuality is a little higher in the real order**: 5% at the median,
  12% at the 90th percentile. Small, and in the direction of real structure.
- **It falls while the reference fills** (median 0.854 in the first 100
  nights, 0.750 in the last 100, when 26 of 27 series had a full
  reference), in the real order and the control alike. A library that
  starts empty needs about a year before individuality settles.

**Across years the measure does resolve change** (`experience_span.mjs`,
added after the run). For each series, three moments whose windows share
nothing, about three years apart:

| | Real | Control (three random orders) |
|---|---|---|
| Distance, median | 1.27 | 0.92 to 1.06 |
| 90th percentile / largest | 1.80 / 2.29 | 1.04 to 1.18 / 1.20 to 1.44 |
| Pairs more than 1.5 steps apart | 23.5% | 0% |
| Harmony component, median | 2.49 | 0.96 to 1.08 |
| Leadership / persistence, median | 1.04 / 1.08 | 0.95 to 1.00 / 0.90 to 0.97 |

Who moves with whom changed over three years by two and a half resolvable
steps. Who leads whom, and each series' own persistence, did not change by
more than they are measured to.

## A sample nightly record

Real computed values, 30 September 2026 (all 400 are in
`experience/nightly.json`; three whole moments in
`experience/moment_samples.json`; every moment in `experience/moments.csv`):

```
run_id 2026-09-30   date 2026-09-30   timezone UTC   cer_version cer-0.4.1   moment_count 26
individuality   median 0.721   p90 0.828   max 0.920   count 26   unavailable 0
transitions     median 0.745   p90 1.054   max 1.195   count 26   unavailable 0   median_rate 0.745   median_days 1
dispersion      median 0.872   pairs 11310   rule last-30-per-series-all-pairs
affinities      nearest_median 0.771   strongest 0.929   median_quartiles 0.441, 0.518, 0.568
continuity      nearest_is_previous 9   with_nearest 26
experience_reference   moments 26   previous_run 2026-09-29   chain bd3b97df1dfea53ac0f7f689bb0b3f50
replay_integrity       checked true   series BTC-USD   reproduced true
measurement_coverage   moments 26   incomparable 0   channels_median 26   series_fetched 27   no_new_bar VIX
versions        metric exp-1   distance dist-1   bandwidth bw-1   signature sig-1
hex_precision, governance_reference   empty in this replay: the replay runs stage 5 alone. In the nightly function they hold EngineStatus's figures and decision per read
```

## A defect found and removed

The specification attached to each distance the chance of one that large
from measurement noise. On built noise that figure was below 5% in 21.5% to
29% of cases where 5% is expected (prereg, correction 8). It was removed
from the distance, the moment and the entity before anything was deployed.
A distance still averages one resolvable step under noise; what is missing
is a probability for a single distance.

## Limitations

1. **Daily bars and a 750-observation window make consecutive nights nearly
   the same window.** Night-to-night transition is at its noise floor. A
   shorter window, or several, would resolve faster change at lower
   precision; that is a new signature version and its own test.
2. **No probability for a single distance.**
3. **E8 is marginal.** Individuality drifts up by about 9% across a long
   stationary history as more of the reference lies in separate windows.
4. **The library starts empty**, so individuality is high at first and
   settles over about a year.
5. **The run above used the 27 replication series.** Production tracks 7
   (five crypto, two equity indices) plus tickers asked about in chat. With
   six neighbours a moment has about a quarter of the terms, so each
   distance is noisier, and the set of neighbours changes when chat tickers
   come and go (the comparability rule covers this; it has not been run on
   that exact set, because only one of the seven is in the repository).
6. **Append-only is kept by the code, not by the database.** An admin can
   edit a row in Base44. The hash on each moment and the chain on each
   night make that detectable, not impossible.
7. **Nothing uses the library yet.**
8. **Stored CER snapshots** (`cer/cer_moment_*.json`) carry the phase
   standard error of `cer-0.4`. CER's calls do not depend on it. They are
   refreshed by the next `cer_replay.py` run.
