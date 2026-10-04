# Second core experiment: predictions written before the run

Written 2 October 2026, before `core2.py` was first executed.

1. Leakage: randomising every observation after step T leaves every feature
   and prediction up to step T unchanged.
2. Racing direction: a level-rank baseline (where the current level sits among
   earlier levels) matches or beats the three-scale line model.
3. Racing direction: the lines add little or nothing once the level rank is
   in the model.
4. Scale spectrum: gains shrink with scale and reach zero by scale 3 or 4
   (8 or 16 steps) in racing and weather.
5. Market size: adding dyadic memory closes most of the gap to the 6.2 engine.
6. Cold start: six line-effect priors per scale recover most of the early
   advantage of the 64-state pre-trained tables.
