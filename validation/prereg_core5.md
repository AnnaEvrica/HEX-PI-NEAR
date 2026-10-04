# Fifth experiment: HEX calls, the rank core only observes. Predictions written before the run

Written 4 October 2026, before `core5.py` was first executed.

Design under test: the 64-state engine (6.2) makes every call. The rank core
never issues a call of its own. It supplies one observation, the baseline its
dyadic memories imply, and that observation is used only to calibrate HEX.

Variants, market series 2016-2026:
  H    6.2 as shipped (per-series calibration)
  HP   6.2 raw, calibrated by one map pooled across series from past calls
  HO   6.2 raw, calibrated online with the observer: starts exactly at HEX,
       learns how far to move toward the observer's baseline; gated against HEX
  HS   as HO, but HEX's side is never changed: only the stated probability is
  H+   6.2 with the dyadic-memory baseline inside its own formula
       (state evidence measured against an adaptive base rate)

1. HP changes the hit rate by under 0.3 points and narrows the strongest-tenth
   overstatement to under 3 points.
2. HO reaches at least 59.7% on move size (the observer baseline alone) and
   does not beat rank-1 alone (60.1%).
3. HS leaves the hit rate at 58.8% exactly and has better log loss than H.
4. H+ recovers at least half of the gap between 58.8% and 60.1% with no
   observer at all: most of the rank core's gain is already expressible
   inside HEX's own formula.
5. Direction stays at chance for every variant.
