# Seventh experiment: the traditional casting. Predictions written before the run

Written 4 October 2026, before `core7.py` was first executed.

Casting under test. Each of the six lines is cast with four values, as in the
coin method: a line is "old" (changing) with probability one quarter. Here a
line is old when the size of that step's change is in the top quarter of all
earlier changes. The primary hexagram is the six directions. The resulting
hexagram flips the old lines ("the extreme turns into its opposite").
Models, MOVE read, same estimator and mixture as state-6.4:
  P    primary hexagram only (state-6.4)
  R    resulting hexagram only
  PR   Bayesian mixture of the P and R candidates (192)
  T    trigram kernel: sharing rho_lower^d_lower * rho_upper^d_upper, the two
       trigrams allowed different sharing (16 kernels x K x half-life)
  KW   King Wen pairing: evidence shared with the paired hexagram (its
       reversal, or its complement when the reversal is itself)

1. Weather MOVE: PR beats P with an interval clear of zero (the changing
   lines carry the mean reversion the primary hexagram misses).
2. Markets MOVE: nothing beats P; all stay at chance.
3. T and KW are within 1 of P everywhere.
