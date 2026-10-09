# CER: Cross-Environment Resonance

Anna Maria Sarkisyan · Evrica Technologies Inc. · experimental module `cer-0.3`, beside HEX [PI] 7.0

HEX reads one series. CER reads across series. It measures how the channels of
different environments move together, and tests whether those relations say
anything about a series' next step that the series' own record, and HEX, do
not already say.

CER is in shadow. It is not imported by `observer.ts`, `hex7.ts`, `cycle.ts`,
`ledger.ts`, `isotonic.ts` or any function, it writes to no production
entity, and no call shown to a user depends on it. What it has measured so far
is in `validation/cer_results.md`.

Every step below is given twice, as in `MODEL.md`: in plain words, then
exactly, with the file and function that computes it.

| Stage | Plain words | Code |
|---|---|---|
| Ingest | Raw samples become a channel. Units are kept, nothing is converted | `cer/normalize.ts: toChannel` |
| Coordinates | Each channel is read the way HEX reads a series | `cer/align.ts: coordinates` |
| Align | Which value of a neighbour a call is allowed to see | `cer/align.ts: asof, features, pair` |
| Measure | Three ways two channels can be related, kept apart | `cer/coupling.ts`, `cer/spectrum.ts`, `cer/graph.ts` |
| Infer | Do the neighbours say anything about the next step? | `cer/inference.ts: walkCer` |
| Weigh | How much each edge is heard, from present measurement | `cer/graph.ts: edgeWeight`, `cer/inference.ts: interpretations, temperatures` |
| Replay | HEX's calls and CER's beside them, scored on the same outcome | `cer/replay.ts: shadowReplay` |

Reference implementation: `validation/cercore.py`. The TypeScript must match
it to rounding (`tests/cer.mjs`).

---

## 1. Channels

**In plain words.** A channel is one thing measured in one place: the voltage
across a mycelium sample on server B, the room temperature, the price of
oil. Each sample arrives with its time, the time it became available, its
unit, what the sensor said about its quality, the experimental condition, and
any deliberate intervention. A sample that is missing, not a number, or
carries an excluded quality flag is dropped and counted. Nothing is filled in.

**Exactly.** `types.ts: SignalObservation` is the input record. `toChannel`
sorts by time, keeps the sample acquired last when several share a tick,
and returns ticks `d_1 < d_2 < …`, the change at each tick
`r_k = v_k − v_{k−1}` (or `ln(v_k / v_{k−1})` for a quantity that moves in
proportion), the level `x_k = Σ r`, and the counts of what was dropped. A tick
is a day for daily series and can be any length for sensors.

## 2. Coordinates

**In plain words.** CER uses HEX's own language. A channel's coordinates say
where its present level, and the size of its latest change, sit among their
recent surroundings. They are ranks, so they have no unit: a temperature in
Fahrenheit, one in Celsius, a price and a voltage are directly comparable, and
a spike a thousand times too large moves a rank by one place.

**Exactly.** `Z_j(k) ∈ (−1, 1)^14`: the midrank of `x_k`, and of `|r_k|`,
among the last 2, 4, 8, 16, 32, 64 values and among all values so far, as
`2(rank − ½)/w − 1` (`hex7.ts: ranks`, imported, not copied).

## 3. Alignment: what a call may see

**In plain words.** A call made on day `d` may use a neighbour's latest value
dated `d − lag` or earlier, and only if that value is at most 7 days old.
Otherwise the neighbour is absent for that call and says nothing. `lag = 0`
allows a value of the same date; `lag = 1` allows only earlier dates. Use 1
unless every channel is known to be complete before the target's call is
made. Daily closes of different markets are fixed at different times of day,
and a neighbour that closes later has already seen part of the target's next
move (Lo and MacKinlay, 1990).

**Exactly.** `asof(tdays, jdays, lag, shift)` returns
`k = max{k : d^j_k ≤ d − lag}`, or −1 when there is none or
`d − lag − d^j_k > 7`. `shift ≠ 0` displaces the neighbour's record
circularly within its own span; that is the control. `pair` puts two channels
on the ticks they share and takes changes between consecutive shared ticks, so
channels on different calendars are compared over the same intervals.

## 4. Measurement: the descriptive graph

**In plain words.** For every ordered pair, on the latest 750 shared
observations, CER asks three separate questions and keeps the three answers
apart.

1. *Do they move together, and with what delay?* The correlation of their
   ranked changes at delays 0 to 5.
2. *Do they still, once what everything shares is taken out?* The same, after
   removing the common movement of all the other channels from both. Two
   channels driven by the same room temperature are related in the first
   sense and not in the second.
3. *Do they share a rhythm?* Coherence in three bands. A phase, and the delay
   it implies, is reported only where the band is coherent. Otherwise the
   field says `not supported`. Fewer than four segments gives
   `insufficient data`, and a stuck sensor gives `insufficient variation`.

A relation is called real only against the same number computed with the
neighbour shifted in time, which keeps the neighbour's own rhythm and breaks
only its alignment with the target. A high value is a measured association.
It is never a claim that one channel causes the other.

**Exactly.** With `u, v` the centred, unit-variance midranks of the two
change series (`zrank`):

- `ρ(ℓ) = corr(u_t, v_{t−ℓ})`, `ℓ = 0…5` (`lagcorr`). Statistic
  `max_ℓ |ρ(ℓ)|`. Threshold: its 95th percentile over 200 circular shifts of
  `v`, evenly spaced from a tenth to nine tenths of the window (`surrogate`;
  time-shifted surrogates, Theiler et al., 1992; Quian Quiroga et al., 2002).
  One statistic over all lags, so six lags are not six chances. Standard
  error: `√((1 + 2 Σ_{k=1}^{20} ρ_u(k) ρ_v(k)) / n)` (Bartlett, 1946).
- Shared driver `g_t`: the mean over the other channels of their ranked
  changes on the same ticks. `u ← u − (u·g / g·g) g`, likewise `v`, then the
  same test (`residual`, `graph.ts: driver`).
- Coherence: Welch, Hann segments of 128 with half overlap (Welch, 1967):
  `C(f) = |P_uv(f)|² / (P_uu(f) P_vv(f))`. Per band (periods 2–5, 5–20, 20–64)
  the statistic is the largest `C(f)` among its `m` frequencies, against
  `1 − (0.05/m)^{1/(K−1)}` with `K = 0.947 ×` the number of segments (the null
  distribution of Carter, Knapp and Nuttall, 1973, with the level divided by
  `m`). Phase `φ = arg P_uv(f*)`, and the neighbour leads by `−φ / (2π f*)`.

An edge record (`types.ts: Edge`) carries source, target, type, strength,
lag or band, validity window, sample count, coverage, uncertainty (standard
error, threshold, p-value) and the method version.

## 5. Inference: the predictive graph

**In plain words.** Measuring that two channels move together does not show
that one tells you where the other goes next. So CER makes calls and has them
scored. Each neighbour gets one voice: a small model that starts from an
*offset* and may move away from it using only that neighbour's coordinates.
One more voice reads the average of all neighbours. The call is a mixture of
the offset and the voices, each weighted by how well it has predicted so far.

Everything starts at zero. With nothing learned, CER's call *is* the offset,
and an edge that carries nothing stays there. That is how CER concludes "no
relationship", and what it costs to be wrong for a while is bounded.

The offset is either the null (*standalone*: what do the neighbours alone
say?) or HEX's own call (*fusion candidate*: what do the neighbours add to
HEX?).

**Exactly.** For target `i` at call `t`, with `K` neighbours:

    edge j:   logit p_j   = logit(offset_t) + γ_j · Z_j
    pool:     logit p_all = logit(offset_t) + γ   · mean_{j present} Z_j
    call:     p = Σ_e w_e V_e,   V = [offset, p_all, p_1 … p_K]

`γ` is learned by HEX 7.0's own rule: an online Bayesian logistic regression
(assumed-density step; Opper, 1998) at nine prior scales `2^−4 … 2^4` mixed by
likelihood, so there is no learning rate. `w` is HEX 7.0's reversible
influence: after each outcome every share is multiplied by the probability
its voice gave to what happened, and a part `α` is redistributed equally
(fixed share; Herbster and Warmuth, 1998), with `α ∈ {0, 0.001, 0.005, 0.02,
0.05}` mixed by likelihood. With `α = 0` this is the Bayesian mixture, whose
total log loss is within `ln(K + 2)` of the best single voice (Vovk, 1990).
Both rules are written again in `inference.ts` for any number of voices so
that `hex7.ts` is not touched.

Two numbers describe edge `i ← j`:

- **Its evidence**: the information gain of the edge's voice scored alone,
  `Σ_t [log₂ p_j(y_t) − log₂ offset_t(y_t)]` over the calls where `j` was
  present, with a block-bootstrap interval. The edge is *predictive* when the
  interval is above zero.
- **Its share** `w_j` of the call. A share near its starting value
  `1/(K + 2)` means nothing by itself: a voice that has learned nothing agrees
  with the offset and keeps its share.

This is predictive dependence in Granger's sense (1969): the neighbour's past
improves the forecast. It is not a causal claim. A causal claim needs an
intervention, which is what the `intervention` field of an observation is for.

## 6. How much an edge is heard: three ways, compared

Section 5 says how each edge's voice forms its own probability. That part
is the same in every mode, and it is the only part that learns from
outcomes. What differs is how the voices are combined into CER's call.

**In plain words.**

- *By past success* (`cer-0.1`, `'reliability'`). An edge is heard in
  proportion to how well its voice has predicted. It has to earn its place
  over many calls, and a relationship that appears today is heard late.
- *By present measurement* (`cer-0.2`, `'measurement'`). An edge is heard in
  proportion to what the current window measures: how strongly the two
  channels move together (A), how much of that is the neighbour moving first
  (L), how much survives once what everything shares is removed (C), and how
  well the pair was observed (Q). Its past forecasting record is not
  consulted. A relation that is only simultaneous has L = 0: it is recorded in
  the descriptive graph and is not put into the forecast.
- *By relaxation* (`cer-0.3`, `'relaxation'`). CER holds a distribution over
  interpretations, "nothing here relates to the target" and "this edge does",
  and commits no further than the measured evidence supports. A temperature
  sets how much is committed; it is chosen by checking past measurements
  against later measurements, never against the target's outcomes.

**Exactly.** On the latest 750 shared observations dated no later than the
call's day minus the lag, on the read's own observable (changes for
direction, sizes of changes for move size), remeasured every 25 calls
(`graph.ts: edgeWeight, edgeWeights`):

    w_ij = A . L . C . Q
    A = max over lags 0..5 of |rho(l)|
    L = max over usable lags of |rho(l)| / A,   and 0 unless that maximum clears its own time-shift surrogate threshold
    C = min(1, |rho after removing the shared driver, at the chosen lag| / |rho at that lag|)
    Q = (shared ticks / the target's ticks in the window) . min(1, samples / 750),   and 0 when the neighbour is absent at the call

A lag is usable when the neighbour leads by at least one step more than the
arm's lag. By measurement:

    p = (1 - sum_j e_j) . offset + sum_j e_j . p_j,     e_j = w_j / max(1, sum_j w_j)

By relaxation, with evidence in nats and `se` the Bartlett standard error:

    E_j = Q . max(0, z^2 - z0^2) / 2,    z = C |rho| / se,    z0 = threshold / se
    P(z_j | G_t) ~ exp(E_j / T)   for each edge with E_j > 0
    P(nothing | G_t) ~ K          one unit of prior mass per neighbour present
    p = P(nothing) . offset + sum_j P(z_j) . p_j

This is the maximum-entropy distribution over interpretations subject to the
expected evidence (Jaynes, 1957), a Gibbs distribution. `T = 1` is the plain
answer; larger `T` keeps more interpretations alive. The temperature at a
call is the one, among 1, 2, 4, 8, 16, 32, whose distribution formed 30
measurements earlier (one full window, so the two windows share no
observation) has best forecast which interpretation the present measurement
supports most, by log score over all past checks
(`inference.ts: temperatures`).

Two limits to keep in view. A weight is a measured association, not a
probability that the edge's voice is right, so mixing by `w` can under-commit
to a strong edge. And a lagged correlation does not condition on the
target's own past: a neighbour that only echoes the target can show a small
"lead" through the target's own persistence (synthetic test 11 reports it).

What each mode did on real data is in `validation/cer_results.md`.

## 7. Scoring

Exactly as HEX is scored (`MODEL.md`, section 7). Information gain of a call
in bits, `g = log₂ p(y) − log₂ q(y)`, against the null and against HEX, on the
same targets, timestamps and outcomes. Uncertainty by block bootstrap over
20-day blocks. CER is scored only on calls where at least one neighbour was
present; on the others it equals its offset exactly.

## 8. Using it

```ts
import { toChannel, shadowReplay, graph } from './base44/shared/cer/index.ts';

const voltage = toChannel(voltageSamples, { tick_ms: 60_000, excluded: ['saturated'] });
const room    = toChannel(roomSamples,    { tick_ms: 60_000 });
const heat    = toChannel(heatSamples,    { tick_ms: 60_000 });

const g = graph([voltage, room, heat], lastTick);          // the descriptive graph
const r = shadowReplay(heat, [voltage, room], 'MOVE', 1, 'relaxation');  // HEX's calls on heat, CER's beside them
r.gain.fusion_over_hex;                                    // bits per call the neighbours added to HEX
```

Run the tests and the replay:

```
python3 validation/cer_synthetic.py    # twelve tests on signals with known relationships; writes tests/cer_reference.json
node tests/cer.mjs                     # the TypeScript against the reference
python3 validation/cer_replay.py       # the one-pass replay with CER in shadow, every mode in one pass
python3 validation/cer_report.py       # validation/cer/report.json and the charts
```

## 9. What is not built yet

- `collectSignals`, `evaluateResonance` and the entities `SignalObservation`,
  `ResonanceSnapshot`, `ResonanceCall`. They are deployed code and database
  tables, and belong after there is a sensor feed to collect.
- A store for high-rate waveforms. The module takes summarised features per
  tick; raw waveforms should be reduced near the sensor.
- Interventions. The schema records them; no analysis uses them yet.

## Sources

- M. S. Bartlett (1946). On the theoretical specification and sampling properties of autocorrelated time-series. *Supplement to the Journal of the Royal Statistical Society* 8, 27–41.
- G. C. Carter, C. H. Knapp, A. H. Nuttall (1973). Estimation of the magnitude-squared coherence function via overlapped fast Fourier transform processing. *IEEE Transactions on Audio and Electroacoustics* 21, 337–344.
- E. T. Jaynes (1957). Information theory and statistical mechanics. *Physical Review* 106, 620–630.
- C. W. J. Granger (1969). Investigating causal relations by econometric models and cross-spectral methods. *Econometrica* 37, 424–438.
- M. Herbster, M. K. Warmuth (1998). Tracking the best expert. *Machine Learning* 32, 151–178.
- A. W. Lo, A. C. MacKinlay (1990). An econometric analysis of nonsynchronous trading. *Journal of Econometrics* 45, 181–211.
- M. Opper (1998). A Bayesian approach to on-line learning. In *On-Line Learning in Neural Networks*, Cambridge University Press.
- R. Quian Quiroga, A. Kraskov, T. Kreuz, P. Grassberger (2002). Performance of different synchronization measures in real data. *Physical Review E* 65, 041903.
- J. Theiler, S. Eubank, A. Longtin, B. Galdrikian, J. D. Farmer (1992). Testing for nonlinearity in time series: the method of surrogate data. *Physica D* 58, 77–94.
- V. Vovk (1990). Aggregating strategies. *Proceedings of the Third Workshop on Computational Learning Theory*, 371–383.
- P. D. Welch (1967). The use of fast Fourier transform for the estimation of power spectra. *IEEE Transactions on Audio and Electroacoustics* 15, 70–73.
