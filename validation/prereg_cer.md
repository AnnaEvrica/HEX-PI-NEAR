# CER (Cross-Environment Resonance): specification and predictions, written before the run

Written 9 October 2026, before `cer_replay.py` was first executed on any real
series. The only thing run on real data before this file was written is the
frozen 7.0 engine itself (`hex7core.py`), to check that the re-downloaded
data reproduce the committed replay ledger (see "Data").

## What is being tested

HEX [PI] 7.0 reads one series at a time. CER is a separate module that reads
*across* series: it measures how the channels of different environments relate
to each other, and asks whether those relations say anything about the next
step of a series that the series' own record, and HEX, do not already say.

CER runs in shadow. It changes nothing in `observer.ts`, `hex7.ts`,
`cycle.ts`, `ledger.ts`, `isotonic.ts` or `calibrateCognition`, and no call
shown to a user. It makes its own calls on the same targets, at the same
timestamps, scored on the same outcomes.

## The module, frozen here

**Channels and coordinates.** Every channel is read exactly as HEX reads a
series: the midrank of its level, and of the size of its latest change, among
the last 2, 4, 8, 16, 32, 64 values and among all values so far, mapped to
(-1, 1). That is 14 coordinates per channel, `Z_j`. Ranks carry no units, so
a temperature in Fahrenheit, a temperature in Celsius, a price and a voltage
are comparable without rescaling. Units and source stay in the metadata.

**Alignment.** For a call on target `i` dated `d`, a neighbour `j` contributes
its coordinates at its latest observation dated no later than `d - lag`
calendar days. If that observation is more than 7 calendar days old, or the
neighbour has not started or has ended, the neighbour is absent for that call
(coordinates zero, flagged). Two arms:

- *same date* (`lag = 0`): a neighbour's value dated `d` may be used.
- *strict* (`lag = 1`): only values dated before `d`.

**Inference.** One expert per edge, and one for the pool:

    edge j:   logit p_j   = logit(offset) + gamma_j . Z_j
    pool:     logit p_all = logit(offset) + gamma . mean_j(Z_j)   (present neighbours)

Each is an online Bayesian logistic regression at nine prior scales mixed by
likelihood: the same update HEX 7.0 uses, with no learning rate. The call is
the mixture of the offset, the pool and every edge, with reversible influence
(fixed share at rates 0, 0.001, 0.005, 0.02, 0.05, the rates mixed by
likelihood). Every coefficient starts at zero and every expert starts with an
equal share, so CER starts *at its offset* and leaves it only as evidence
arrives. An edge whose share falls toward nothing is CER concluding that the
two channels are unrelated for this purpose.

Two offsets:

- *standalone*: the offset is the null `q0`. CER has no access to the
  target's own coordinates. This measures what the neighbours alone say.
- *fusion candidate*: the offset is HEX 7.0's call. This measures what the
  neighbours add to HEX. It is an experimental candidate, not a release.

**The predictive graph.** The weight of edge `i <- j` at time `t` is the share
of the call that edge `j`'s expert holds. It is a measured, prospective
quantity. It is not a claim of cause.

**The descriptive graph** (measurement only; it never enters a call). For each
ordered pair on a trailing window of 750 aligned observations:

- rank cross-correlation at lags 0 to 5, with a Bartlett standard error and a
  surrogate threshold from 200 circular time shifts of the neighbour (the
  statistic is the largest absolute value over the lags, so six lags are not
  six chances);
- the same after removing the shared driver (the mean of the other channels'
  ranked changes) from both sides;
- magnitude-squared coherence (Welch, segments of 128, half overlap) in three
  bands (periods of 2-5, 5-20 and 20-64 observations) against the
  no-relationship threshold `1 - 0.05^(1/(K-1))` for `K` segments. Phase, and
  the lag it implies, are reported only in a band whose coherence clears the
  threshold. Otherwise the field says "not supported".

The metrics are kept as separate edge types. They are not added into one
score.

## Order of operations, per timestamp

Reveal the outcome, score, learn, predict, commit. One pass, as in
`prereg_replay.md`. Checked by rerunning CER on truncated histories at sampled
points and comparing with the ledger.

## Controls

Every run is repeated three times with each neighbour's record displaced in
calendar time against the target (circularly, within the neighbour's own
span), which keeps each neighbour's own autocorrelation and the relations
among the neighbours, and breaks only their alignment with the target:

- C1: 1,096 days (three years; the season stays aligned)
- C2: 913 days (two and a half years; the season is reversed)
- C3: 1,279 days (three and a half years; the season is reversed)

A real relationship must beat its controls. The controls also measure what
carrying the extra experts costs when there is nothing to find.

## Universes

1. **Markets, 2016-2026.** The 27 market series of the 7.0 replay (17
   development, 10 currencies used for replication). Every other market
   series is a neighbour. The series differ in the time of day at which they
   are fixed, and those times are not in the data, so the *strict* arm is the
   one that counts here. The same-date arm is reported as a diagnostic of
   fixing-time artefacts.
2. **Temperature.** Chicago, Seattle, New York, Melbourne, each over its own
   record. A day's maximum is complete at the end of the local day, so the
   *same-date* arm is the one that counts. Melbourne is in the other
   hemisphere and is the negative control among the stations.
3. **Energy x temperature, 1997-2015.** Natural gas, WTI and Brent against
   Chicago and Seattle, cross-environment edges only, both directions. Strict
   arm. Energy prices before 2016 are not part of the 7.0 replay; the frozen
   engine is run on them here only to supply the offset. The direction
   prices -> temperature is a second negative control.

Racing has no timestamps. CER reports "cannot be aligned" and makes no call.

A call is scored for CER when at least one neighbour is present. Comparison
with HEX uses exactly those calls.

## Metric

As in the replay. Information gain of a call, in bits per call:
`g = log2 p(y) - log2 q(y)`, against the null, against HEX 7.0, and for the
fusion candidate against HEX 7.0. Uncertainty: block bootstrap over blocks of
20 calendar days, call-weighted and as a macro-average over series. Also
right %, Brier skill, calibration error, and the strongest tenth of calls
(stated, right). A result counts as verified only if its interval excludes
zero.

## Data

Re-downloaded on 9 October 2026 from the public sources in
`validation/README.md`. The frozen engine was run on them and compared, call
by call, with the committed ledger: 42 of the 43 series reproduce every call
exactly (largest difference 0); the downloaded files now run a few days past
the ledger's last date and those extra calls are scored.

Bitcoin is the exception. Its original price file is not in the repository
and its source is not reachable from this machine. A different public daily
series is used in its place (Coin Metrics community data, daily reference
price, to 23 May 2026). It agrees with the original on the direction of 96%
of days, so it is the same market on a different clock. HEX is rerun on it,
so every comparison is like for like, and the market figures are also
reported without bitcoin.

## Predictions

1. **Markets, strict, standalone, direction.** Within 0.001 bits per call of
   zero. Interval not clear of zero.
2. **Markets, strict, standalone, move size.** Positive, between 0.001 and
   0.006 bits per call over the null, interval clear of zero (the size of
   moves spreads between markets), and below HEX 7.0 on the same calls,
   because CER standalone cannot see the target's own coordinates.
3. **Markets, strict, fusion candidate over HEX 7.0.** Move size: positive,
   under 0.003 bits per call, interval clear of zero on the development
   series and positive on the macro-average of the unused currencies.
   Direction: within 0.001 of zero.
4. **Markets, same date against strict.** The same-date arm shows more
   direction gain than the strict arm on the currency series. This is the
   fixing-time artefact (currencies are fixed earlier in the day than the
   other series close). It is reported and not counted.
5. **Temperature, same date.** New York: the fusion candidate gains over HEX
   by more than 0.01 bits per call on direction, clear of zero, and the
   Chicago edge holds the largest share. Chicago: positive and clear of zero
   on direction. Seattle: less than Chicago's gain. Melbourne: not clear of
   zero, and no edge into Melbourne ends above its starting share.
6. **Controls.** Every control, in every universe and read, lies between
   -0.001 and +0.0005 bits per call, and none is positive with an interval
   clear of zero.
7. **Energy x temperature.** Not clear of zero in either direction, on
   either read. CER's conclusion here is expected to be "no relationship".
8. **Descriptive against predictive (markets).** More than half of the pairs
   show same-date coupling above the surrogate threshold, while fewer than
   one edge in ten ends the strict direction run holding more than its
   starting share. Coupling that is real and coupling that predicts are
   different things, and the module has to tell them apart.

Whatever comes out is written beside this file in `cer_results.md`, including
every prediction that fails.

## Amendment before the run (9 October 2026)

Made after the synthetic tests (`cer_synthetic.py`) and before any CER run on
real series. No prediction about a real series had been scored.

1. **What counts as a predictive edge.** The share an edge holds does not by
   itself say the edge carries anything: on signals built to be independent,
   every expert stays near its offset and the shares stay near equal (test 1).
   So an edge is called *predictive* when its own expert, scored alone, gains
   over the offset with an interval clear of zero (bits per call on the calls
   where the neighbour is present, same block bootstrap). Shares are still
   recorded. Predictions 5 and 8 are judged on this: "ends above its starting
   share" is read as "is predictive", and "holds the largest share" as "has
   the largest gain scored alone". Both readings are reported.
2. **Coherence threshold.** A band holds several frequencies, and a narrow
   oscillation fills one of them, so averaging over the band hides it (test
   2). The band's statistic is its highest coherence, and the level is
   divided by the number of frequencies in the band:
   `1 - (0.05/m)^(1/(K-1))`, with `K` the effective number of independent
   segments (0.947 per half-overlapped Hann segment). On independent
   autocorrelated signals this passes 3% to 6.5% of bands.

## Correction after the first run (9 October 2026): bitcoin

The statement above that bitcoin's original price file is not in the
repository was wrong. It is `tests/backend-smoke/BTC_daily.csv`, and with it
the frozen engine reproduces all 43 series of the 7.0 ledger call for call
(largest difference 0). The first run, on the substitute series, stands in
git history (commit `1bdf0ff`). Everything was rerun on the original file
with no other change; `cer_results.md` gives the rerun's figures. No
conclusion changed; market figures moved in the fourth decimal.

## Second experiment: edge weight from present measurement, not past success

Written 9 October 2026, before the revised weighting was run on any real
series.

**What changes.** In `cer-0.1` an edge's share of the call is its expert's
past predictive success (reversible influence). In `cer-0.2` the share is
measured from the current observation window, with no outcome in it:

    w_ij(t) = A_ij(t) . L_ij(t) . C_ij(t) . Q_ij(t)

on the latest 750 shared observations dated no later than the call's day
minus the arm's lag, recomputed every 25 calls, on the read's own observable
(signed changes for direction, sizes of changes for move size):

- **A, associative coherence**: the largest absolute rank correlation over
  lags 0 to 5.
- **L, usable lead**: of that, the part that sits at lags the call can use
  (the neighbour leading by at least one step more than the arm's lag):
  `max over usable lags / max over all lags`, and zero unless the usable-lag
  statistic clears its own time-shift surrogate threshold. A relation that
  is only simultaneous has L = 0: it stays in the descriptive graph and is
  not promoted into the forecast.
- **C, compatibility with the configuration**: the share of the correlation
  at the chosen lag that survives removing the shared driver (the mean of the
  target's other neighbours), capped at 1.
- **Q, measurement quality**: the share of the target's ticks in the window
  on which the neighbour was also observed, times the fraction of the window
  that is filled, and zero when the neighbour is absent at the call.

The call is `p = (1 - sum_j e_j) . offset + sum_j e_j . p_j`, with
`e_j = w_j / max(1, sum_j w_j)`. The pool voice has no edge and takes no part.
Each edge's own expert still learns from outcomes exactly as before (the
coefficients `gamma_j`); what no longer depends on outcomes is whether, and
how much, an edge is heard. HEX 7.0, the governance and the scoring are
unchanged. Both weightings are computed in the same pass from the same
experts, so the comparison is on identical causal data.

Controls for the revised weighting are run on the arm that counts in each
universe.

**Predictions.**

R1. Markets, strict: the revised fusion candidate is nearer zero than the
    original on both reads and lies within 0.0005 bits per call of HEX. Under
    5% of edge-calls carry any weight.
R2. New York, direction, same date: revised positive and clear of zero, and
    smaller than the original, because the weight is the size of the
    association (about 0.4) and not near 1.
R3. Chicago, direction: revised smaller than the original; it may not be
    clear of zero.
R4. The calendar artefact goes: the revised controls on temperature lie
    within 0.0005 of zero.
R5. The fixing-time artefact stays in the same-date arm (it is a real lead in
    the published numbers): revised positive on the Malaysian ringgit.
R6. Energy x temperature: within 0.0005 of zero.
R7. Overall: the revised weighting gives up gain where a relationship is
    real and saves cost where there is none.
