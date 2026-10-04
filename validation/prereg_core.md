# Core experiment: predictions written before the run

Written 2 October 2026, before `core.py` was first executed.

Setup: every model predicts the next line from the last six lines of the same
lens, walk-forward, with no isotonic step. Scored by log loss on the scored
periods (markets 2016-2026, weather 1991-2015, racing held-out jockeys).

Predictions:

1. Racing direction: Context Tree Weighting (depth 6) beats order-1 Walsh,
   because the structure is the newest line alone.
2. Weather direction: Context Tree Weighting is competitive with order-1 Walsh
   (within the bootstrap interval, or ahead).
3. Market size: order-1 Walsh beats Context Tree Weighting, because all six
   lines contribute about equally and additively.
4. Incremental information by order: the gain from order 1 is much larger than
   the gain from any higher order; orders 3 to 6 add nothing measurable.
5. Market direction: no model beats the running base rate.
6. Cold start: order-1 Walsh from nothing matches the pre-trained 6.2 engine
   by 250 steps in racing and weather.
7. Shuffled data: no model beats the running base rate.
