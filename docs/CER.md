# CER: Cross-Environment Resonance

Anna Maria Sarkisyan · Evrica Technologies Inc. · experimental module `cer-0.4.1`, beside HEX [PI] 7.0

HEX reads one series. CER reads across series. Its first job is to perceive
each moment: what is observable now, how the channels relate, how that is
organised in time, and what about it is new. Its second job, kept separate,
is to test whether anything in that moment says something about a series'
next step that the series' own record, and HEX, do not already say.
Prediction never decides whether a relation is perceived.

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
| Perceive | The moment: its signature and its novelty, at every call | `cer/graph.ts: panel, moment, novelty, moments` |
| Decide | What in the moment may enter a forecast, under controls, and with what weight | `cer/graph.ts: moment` (evidence), `cer/inference.ts: interpretations` |
| Compare | Three earlier ways of hearing an edge, frozen | `cer/graph.ts: edgeWeight`, `cer/inference.ts: temperatures` |
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

## 6. The moment: perception

**In plain words.** At every call CER builds one picture of the moment as the
target meets it. It has five parts, and none of them is reduced to a single
score.

- *What is observable now* (X). Each channel's latest change, placed against
  that channel's own history.
- *How the channels relate* (G). Three kinds, in musical terms used as an
  analogy and nothing more: **harmony**, which channels move together at the
  same step; **leadership**, which moves before which, and by how many steps;
  **counterpoint**, what two neighbours carry together that neither carries
  alone.
- *How it is organised in time* (Phi). The target's own persistence, and
  rhythm: whether the target and a neighbour share an oscillation, and at
  what phase. Phase is given only where the rhythm is real, and with its own
  uncertainty. No frequency is assumed.
- *What limits the measurement* (U). How many observations, how much of the
  window each neighbour was actually seen in, and a standard error for every
  relation that allows for each series' own persistence.
- *What is new* (N). Three separate things. **Intrinsic**: is any channel's
  move unusual for that channel? **Relational**: is the combination unusual
  given how the channels normally move together, even if every part is
  ordinary? **Temporal**: has the relational structure itself changed since
  a window ago?

Every relation is in the picture whether it is strong, weak, new,
contradictory or ordinary, and whether or not it has ever helped a forecast.
Novelty is measured against a stated reference. It is never rewarded, and a
moment with nothing new is recorded as exactly that.

**Exactly** (`graph.ts: panel, moment, novelty`; window statistics remeasured
every 25 calls and held; intrinsic and relational novelty at every call).

*Panel.* On the target's last 750 steps: the target's change at each step,
and beside it each neighbour's change between the values available at
consecutive target steps, as of the step's tick minus the arm's lag. Every
column is replaced by its centred, unit-variance midranks. A neighbour seen
on fewer than 200 steps, or without variation, is "not measurable" and its
column is zero. Coverage is the share of steps on which it was seen.

*Harmony.* `H = P'P / n`, the correlation matrix of the panel at the same
step, target first.

*Leadership.* `rho_j(l) = corr(target_t, v_{j,t-l})` and the reverse,
`l = 1..5`. Standard error of each target-edge: Bartlett (1946).

*Counterpoint.* For every pair of measurable neighbours,
`corr(target_t, v_j v_k)` at the same step and one step earlier; the largest
is reported with its Bartlett standard error and a tail probability
multiplied by the number of pairs tried.

*Rhythm.* The target's autocorrelation at lags 1 to 5. Welch coherence by
band with each neighbour (section 4). Where a band is coherent, the phase,
its standard error `sqrt((1 - C') / (2 K C'))` radians with
`C' = (C - thr) / (1 - thr)` the coherence in excess of the band's
threshold, and the lead and lead error they imply. Until `cer-0.4.1` the
standard error used `C` itself and was optimistic for a band that only just
cleared the threshold; with the excess, the built-in lead lies inside two
standard errors in 30 of 30 trials (`validation/cer_results.md`). No
forecast uses this number.

*Intrinsic novelty.* For channel `j`, `p_j = 1 -` the midrank of the size of
its latest change among all its own history. For the moment,
`min(1, k min_j p_j)` over the `k` channels present. Reference: each channel
exchangeable with its own past.

*Relational novelty.* With `z` the normal scores of the channels' latest
changes (each against its own history) and `H_s = 0.9 H + 0.1 I`:

    joint tail        P(chi2_k >= z' H_s^-1 z)
    relational        max(0, ln P(chi2_k >= z'z) - ln P(chi2_k >= z' H_s^-1 z))   nats

Reference: a Gaussian copula with the window's harmony. It is an
approximation. On markets it understates how often configurations are
unusual, and that understatement is itself reported.

*Temporal novelty.* Against the signature 30 measurements earlier (one full
window, no shared observation): for each target-edge, the change in Fisher-z
of harmony and of lag-1 leadership divided by the combined Bartlett error;
the largest in absolute value, with a tail probability multiplied by the
number compared; and how many interpretations became or ceased to be
eligible. Reference: the relational structure has not changed.

## 7. From the moment to a call

**In plain words.** Perceiving a relation and letting it move a forecast are
different decisions. A neighbour may enter the forecast only if it adds
something once four ordinary explanations are accounted for: the target's
own recent past, the time of year, what the other neighbours already say,
and whether its value was actually available when the call was made. A
neighbour that fails this is still in the picture. It is simply not asked.

Then CER holds a distribution over interpretations, "nothing here bears on
the target", "the common movement of the neighbours does", "this neighbour
does", and commits to each exactly as far as its evidence goes.

**Exactly** (`graph.ts: moment`, `inference.ts: interpretations, walkCer`).
On the panel, with `y_t` the target at step `t`:

1. Controls `C_t`: a constant, `y_{t-1} ... y_{t-5}`, and
   `sin(2 pi d / 365.2425)`, `cos(2 pi d / 365.2425)` of the date. Every
   series below is replaced by its residual on `C` (ridge 1e-9 n).
2. Each neighbour's candidate is `v_{j, t-l_j}` with `l_j` the lag in 1..3 of
   largest absolute partial correlation with `y`.
3. One regression of `y` on all candidates together. For edge `j`, with
   `t_j` its t-statistic, `m` rows and `q` regressors in all:

       LR_j = (m / 2) ln(1 + t_j^2 / (m - q))
       E_j  = coverage_j . max(0, LR_j - (1/2) ln m - ln 3)

   `LR_j` is the log-likelihood ratio for adding `j` to everything else.
   `(1/2) ln m` is the Schwarz (1978) penalty for one parameter; `ln 3` is
   for the three lags tried.
4. The pool, the mean of the measurable neighbours one step earlier:
   `E_pool = max(0, -(m/2) ln(1 - r^2) - (1/2) ln m)`, `r` its partial
   correlation with `y` given `C`.
5. With `K` neighbours present, the weights are

       P(nothing) = K / Z,   P(pool) = exp(E_pool) / Z,   P(edge j) = exp(E_j) / Z   where E > 0,   else 0
       Z = K + sum of the exponentials

   and the call is `P(nothing) . offset + P(pool) . p_pool + sum_j P(edge j) . p_j`,
   with `p_pool` and `p_j` the experts of section 5.

Timestamp availability is the arm's lag, already inside the panel.

**What this is, and when it is maximum entropy.** Maximising
the relative entropy `-sum_z P(z) ln(P(z) / m(z))` against the
base measure `m = (K, 1, ..., 1)` subject to one constraint
`E_P[E] = e` gives `P(z) ~ m(z) exp(lambda E_z)` (Jaynes, 1957). CER uses
this form with `lambda = 1 / T = 1` fixed. Two conditions are needed before
calling the result "the" maximum-entropy answer: the constraint level `e`
has to be the one that `lambda = 1` implies, which is not measured
separately here; and the base measure has to be accepted. Under a different
reading it is exact: if each `E_z` is the log Bayes factor of interpretation
`z` against "nothing", and exactly one interpretation or none is true with
prior odds `m`, then `P` is the Bayes posterior. The Schwarz term makes
`E_z` an approximation to that log Bayes factor, not the thing itself. So
the weights are a Gibbs distribution at temperature 1, exactly Bayesian only
in that limit. Temperature is not tuned, and novelty does not enter the
weights.

## 8. Comparators, frozen: three earlier ways of hearing an edge

These were CER's inference before `cer-0.4`. They are kept unchanged
(`validation/cer/frozen_manifest.json`), selected by one argument, and
reproduce their committed calls. Section 5 says how each edge's voice forms
its own probability; that part is the same in every mode. What differs is
how the voices are combined into CER's call.

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

## 9. Scoring

Exactly as HEX is scored (`MODEL.md`, section 7). Information gain of a call
in bits, `g = log₂ p(y) − log₂ q(y)`, against the null and against HEX, on the
same targets, timestamps and outcomes. Uncertainty by block bootstrap over
20-day blocks. CER is scored only on calls where at least one neighbour was
present; on the others it equals its offset exactly.

## 10. Using it

```ts
import { toChannel, shadowReplay, graph, moments } from './base44/shared/cer/index.ts';

const voltage = toChannel(voltageSamples, { tick_ms: 60_000, excluded: ['saturated'] });
const room    = toChannel(roomSamples,    { tick_ms: 60_000 });
const heat    = toChannel(heatSamples,    { tick_ms: 60_000 });

const g = graph([voltage, room, heat], lastTick);          // the descriptive graph
const s = moments(ticks, heat, [voltage, room], 1, 'MOVE', 0, 25, true);   // perception: s.last is the signature, s.novelty the novelty at every call
const r = shadowReplay(heat, [voltage, room], 'MOVE', 1);  // HEX's calls on heat, CER's beside them (the moment is the default)
r.gain.fusion_over_hex;                                    // bits per call the neighbours added to HEX
```

Run the tests and the replay:

```
python3 validation/cer_perception.py   # eight tests of perception on built configurations, kept apart from forecasting
python3 validation/cer_synthetic.py    # twelve tests on signals with known relationships; writes tests/cer_reference.json
node tests/cer.mjs                     # the TypeScript against the reference
python3 validation/cer_replay.py       # the one-pass replay with CER in shadow, every mode in one pass
python3 validation/cer_report.py       # validation/cer/report.json and the charts
```

## 11. What is not built yet

- `collectSignals`, `evaluateResonance` and the entities `SignalObservation`,
  `ResonanceSnapshot`, `ResonanceCall`. They are deployed code and database
  tables, and belong after there is a sensor feed to collect.
- A store for high-rate waveforms. The module takes summarised features per
  tick; raw waveforms should be reduced near the sensor.
- Interventions. The schema records them; no analysis uses them yet.

## Sources

- M. S. Bartlett (1946). On the theoretical specification and sampling properties of autocorrelated time-series. *Supplement to the Journal of the Royal Statistical Society* 8, 27–41.
- G. C. Carter, C. H. Knapp, A. H. Nuttall (1973). Estimation of the magnitude-squared coherence function via overlapped fast Fourier transform processing. *IEEE Transactions on Audio and Electroacoustics* 21, 337–344.
- G. Schwarz (1978). Estimating the dimension of a model. *Annals of Statistics* 6, 461–464.
- E. T. Jaynes (1957). Information theory and statistical mechanics. *Physical Review* 106, 620–630.
- C. W. J. Granger (1969). Investigating causal relations by econometric models and cross-spectral methods. *Econometrica* 37, 424–438.
- M. Herbster, M. K. Warmuth (1998). Tracking the best expert. *Machine Learning* 32, 151–178.
- A. W. Lo, A. C. MacKinlay (1990). An econometric analysis of nonsynchronous trading. *Journal of Econometrics* 45, 181–211.
- M. Opper (1998). A Bayesian approach to on-line learning. In *On-Line Learning in Neural Networks*, Cambridge University Press.
- R. Quian Quiroga, A. Kraskov, T. Kreuz, P. Grassberger (2002). Performance of different synchronization measures in real data. *Physical Review E* 65, 041903.
- J. Theiler, S. Eubank, A. Longtin, B. Galdrikian, J. D. Farmer (1992). Testing for nonlinearity in time series: the method of surrogate data. *Physica D* 58, 77–94.
- V. Vovk (1990). Aggregating strategies. *Proceedings of the Third Workshop on Computational Learning Theory*, 371–383.
- P. D. Welch (1967). The use of fast Fourier transform for the estimation of power spectra. *IEEE Transactions on Audio and Electroacoustics* 15, 70–73.
