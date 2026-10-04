# Third core experiment: predictions written before the run

Written 2 October 2026, before `core3.py` and `core3_ablate.py` were first
executed. `core2` is frozen in `checkpoints/core2/`.

Reads: MOVE (next value above the present one), RANGE (next change larger
than the usual change), LEVEL (next value above the series' running median).
Nulls: MOVE = running base rate mixed with the exchangeable rank rule
(g+1)/(n+1); RANGE = running base rate; LEVEL = running base rate mixed with
side persistence. M1 = null + continuous dyadic ranks (window ranks 2..64 and
all; all-history ranks of block means 2..32). M2 = M1 + three scales of binary
lines. Structure = L(M0) - L(M1).

1. Racing MOVE: structure beyond the rank null is small: under one tenth of
   the null's own gain over the base rate.
2. Weather MOVE: clear positive structure beyond the null (the all-history
   rank is a poor null for a seasonal series; local ranks matter). Lines add
   little on top of the ranks.
3. Markets MOVE: the null settles on the base rate and M1 adds nothing.
4. Markets RANGE: the continuous-rank core beats the three-scale line model
   and at least ties the 6.2 engine.
5. LEVEL: side persistence dominates in markets and weather; M1 adds beyond
   it in weather only. Racing LEVEL shows small positive structure.
6. Magnitude (one squashed feature) adds nothing with an interval clear of
   zero in any read.
7. Ablation, market RANGE: 6.2's remaining lead is in the pre-trained tables
   at cold start and in interactions between size lines; the symmetry field
   and the decay contribute little.
8. Controls: with changes shuffled, and with levels shuffled, structure
   beyond the null is zero or negative everywhere.

## Addendum, written after `core3_ablate.py` part A and before `core3_ablate2.py`

Part A showed that removing the decay costs 6.2 the most (10.1), and that the
field-smoothed 64-state cell adds 3.8 to the rank core.

9. That addition is slow-drift tracking, not state structure: once the rank
   core is given a drift term (decayed base rate), or longer blocks (64, 128,
   256), or dyadic forgetting, the cell with field adds less than 1.

## Addendum 2, written after `core3.py` and before `core3b.py`

The weather MOVE result (+42) is measured against a null that contains only
the all-history rank rule, which is a poor null for a seasonal series. A
windowed rank rule (exchangeable within the last w values) is just as
parameter-free. And the rank core is expensive at a cold start.

10. With windowed rank rules (w = 2..64) added to the MOVE null family,
    weather MOVE structure falls by more than half but stays above zero.
    Racing stays at zero. Markets stay at or below +1.
11. Letting the core compete against its own null (a two-way likelihood
    mixture) holds the cold-start cost at 25 steps under 10 and costs under
    0.5 once warm.

## Addendum 3, written before `core3_drift.py`

The RANGE null is a static base rate, but "usual" is the all-history median,
so the base rate drifts with volatility regimes. A null that tracks the drift
is the stricter one.

12. Market RANGE: against a null that includes the drift term, the rank core
    keeps less than half of its +20.7, but stays above zero.
