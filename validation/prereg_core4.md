# Fourth experiment: the model to ship. Predictions written before the run

Written 4 October 2026, before `core4.py` was first executed.

Model ("rank-1"): null = likelihood mixture of base rates at dyadic memories
(half-lives 32..1024 and none), plus the rank rule for MOVE; core = twelve
continuous ranks offset by the null; gate = core against its null; then
forward isotonic calibration on the series' own earlier calls.

1. The dyadic family of base-rate memories matches the single drift term on
   market RANGE (within 1 thousandth of a nat) and costs nothing on weather
   and racing (within 1).
2. rank-1 beats 6.2 on market RANGE log loss with an interval clear of zero,
   and on all-call hit rate (at least 60.0% against 58.8%).
3. Forward isotonic calibration lowers log loss little (under 1) but brings
   the strongest-10% stated rate within 2 points of the observed rate.
4. A calibration map pooled across series (fitted on other series' earlier
   calls) does no better than the per-series map.
5. Market MOVE stays at chance in hit rate for every variant.

## Addendum, written after `core4.py` and before `core4b.py`

Results so far: the dyadic null helps market RANGE (+1.9 over the single
drift model) and costs weather RANGE (-3.2). Pooled calibration beat
per-series calibration on markets (+1.5), but series were aligned by position,
not by date.

6. A three-way gate (null, core offset by the dyadic null, core offset by the
   static base rate) is within 0.5 of the better of the two two-way models on
   every read.
7. With series aligned by calendar date, pooled calibration on markets still
   beats per-series calibration, by at least half of the +1.5.
