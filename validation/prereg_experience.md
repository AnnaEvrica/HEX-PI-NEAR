# The Learning Module: Experiential Integration and the Memory Library

Specification and predictions, written 9 October 2026 before any of this was
run on a real series.

## Names

- **Learning Module**: HEX's whole feedback loop. It has two parts.
- **Nightly Calibration** (`calibrateCognition`): five stages. Reveal and
  score; learn and predict; commit; govern; and, new, **Experiential
  Integration**.
- **Memory Library**: the append-only record of every moment HEX has met
  (`MomentMemory`), with one summary per night (`NightlyCalibration`).

The name fits because the module as a whole is where HEX learns: stage 2 is
where the engine learns to predict, and stage 5 is where it remembers what it
has met. Stage 5 changes no prediction, no CER weight and no governance
decision.

## Where the present code stands

| Stage | Today | After |
|---|---|---|
| 1 Reveal and score | `scoreOpenCalls` | unchanged |
| 2 Learn and predict | `runEngines` | unchanged |
| 3 Commit | `logCalls` | unchanged |
| 4 Govern | `foldDays`, `decide`, `pooledCalibration`, `EngineStatus` | unchanged |
| 5 Experiential Integration | nothing; CER is not run at night | runs after the status rows are stored, inside its own guard: a failure in it cannot touch stages 1 to 4 |

Stage 5 needs moments, so it runs CER's perception (`moment`, `novelty`) on
the series the night has already fetched. It runs no CER forecast.

## The moment that is remembered

For each tracked series, as it stands on its last finished bar, with every
other tracked series as a neighbour (values of the same date, all complete
when the job runs):

    Sigma_t = (X_t, G_t, Phi_t, U_t)

- `X`: the normal score of each present channel's latest change against its
  own history.
- `G`: harmony with each measurable neighbour; leadership at lags 1 to 3.
- `Phi`: the target's own persistence at lags 1 to 5; coherence in three
  bands with each neighbour, and phase where coherent.
- `U`: samples, the channels measurable, and the precision of every number
  above (Bartlett for correlations, `2 K C / (1 - C)` for a phase).

Novelty is not part of `Sigma`. Intrinsic tail, joint tail and relational
surprisal are stored beside it. Every moment keeps its own identifier
(`series | date | versions`), its bar time, its step in the series and a hash
of its signature. Moments are never merged, overwritten or relabelled.

## Distance, as calibrated precision

Two moments of the same series are compared on the channels they share. Each
difference is multiplied by the precision with which it can be resolved, so
one unit is one resolvable step and the distance has no other unit.

With `n` the samples, `o` the share of the two windows' observations that are
the same, and `w = max(1 - o, 1/n)`:

| Component | Term, for each shared item | Precision |
|---|---|---|
| State | `(z_i - z_j)^2` per shared channel | `1/2` |
| Harmony | `(atanh r_i - atanh r_j)^2` per shared neighbour | `1 / ((se_i^2 + se_j^2) w)` |
| Leadership | the same, per shared neighbour and lag 1 to 3 | the same |
| Persistence | `(atanh a_i - atanh a_j)^2` per lag 1 to 5 | `1 / ((1/(n_i-3) + 1/(n_j-3)) w)` |
| Rhythm | `(atanh sqrt(C_i) - atanh sqrt(C_j))^2` per shared neighbour and band coherent in at least one | `K / w`, `K` the effective segments |
| Phase | `wrap(phi_i - phi_j)^2`, per band coherent in both; `wrap` to `(-pi, pi]` | `1 / ((s_i^2 + s_j^2) w)` |

`w` is what makes overlapping windows comparable: two windows that share
most of their observations can differ only through the few they do not
share, so a small difference between them is resolved more finely.

    d_c = sqrt(mean of the component's terms)        one distance per component, kept
    d   = sqrt(sum of all terms / number of terms)   the moment's distance

Under "the same configuration, seen twice through measurement noise", every
term has expectation near 1, so `d` is near 1 and
`P(chi2_m >= m d^2)` is the chance of a distance this large from noise alone
(`m` terms). A distance is never an error. It is how many resolvable steps
apart two moments are.

**Comparability.** Two moments are comparable when they share at least half
of the smaller one's channels and at least three terms. Otherwise the
comparison is recorded as incomparable and no number is produced. A channel
missing from one of them contributes nothing.

**Affinity.** `a = exp(-d^2 / 2)`: bandwidth one resolvable step. Continuous,
never thresholded into classes. Versions: signature `sig-1`, distance
`dist-1`, bandwidth `bw-1`, metrics `exp-1`. A changed definition gets a new
version and old records keep theirs.

## What is measured for each moment

Against a reference of fixed size, the 250 most recent comparable earlier
moments of the same series, so that the measure does not shrink merely
because the library grows:

- **Individuality** `I_t = min d`, with the count of the reference, the
  identifier of the nearest moment, and its noise tail. Unavailable when
  there is no comparable earlier moment.
- **Affinity** `A_t`: nearest, median and quartiles over the reference.
- **Transition** `T_t = d(Sigma_t, Sigma_prev)` to the previous moment of the
  series, by component, with the days elapsed and `T_t / days`. Unavailable
  when the previous moment is missing or incomparable.

## What is recorded for the night

One `NightlyCalibration` row, numbers only: distributions of individuality,
transition and affinity over the night's moments; dispersion (the median
pairwise distance among each series' last 30 moments, every pair, with the
count); continuity (how often the nearest earlier moment is the previous
night, and how often it changed); coverage (moments, unavailable,
incomparable, channels); the versions; a reference to the governance
decision and HEX's precision figures, not copies of the ledger; and a hash
that chains this night's signature hashes to the previous night's.

The run identifier is the date. A second run on the same date writes
nothing.

## Predictions

E1. **Determinism.** The same observations give the same signatures,
    distances, affinities and summaries, to the bit, in the reference and in
    the product code (parity to 1e-9).
E2. **Causality.** A moment's record does not change when later
    observations are appended.
E3. **Calibration under noise.** For moments of independent noise, white and
    autocorrelated, the mean distance between two moments is between 0.85
    and 1.15, both for windows that do not overlap and for consecutive
    nights; each component's mean is between 0.7 and 1.3.
E4. **Structural distinction.** Two regimes with identical marginals and
    different relations (a lead reversed; a correlation reversed) are more
    than 3 resolvable steps apart, and moments within a regime are not.
E5. **Phase.** A phase of `+3.1` and one of `-3.1` radians are 0.08 apart,
    not 6.2. Without a coherent band there is no phase term.
E6. **Missing data.** Removing a channel from one moment removes its terms
    and leaves the others unchanged; below the comparability rule no
    distance is produced.
E7. **Recurrence without labels.** When a configuration returns after an
    interval in another, the returning moments' nearest earlier moment lies
    in the first interval, with affinity above 0.5, and no class is created.
E8. **Individuality does not shrink mechanically.** On stationary noise the
    median individuality over the second half of a long history is within
    10% of the first half's once the reference is full.
E9. **Idempotency.** A second run on the same date writes no row.
E10. **HEX and governance unchanged.** With stage 5 on, the nightly response
    for stages 1 to 4 and the `EngineStatus` rows are identical; engine
    parity tests pass unchanged.
E11. **Cost.** Stage 5 for 27 series of 3,900 bars takes under 10 seconds;
    a moment's row is under 20 kB.
E12. **On the real market series** (replayed night by night over the last
    400 nights): the mean consecutive-night transition is above 1, because
    markets move by more than measurement noise; the state component is the
    largest; fewer than 5% of comparisons are incomparable.
