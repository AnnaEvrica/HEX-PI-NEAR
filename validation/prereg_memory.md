# Compositional memory in the learning loop: specification and predictions

Anna Maria Sarkisyan · Evrica Technologies Inc. · written 9 October 2026,
before any of this was run. Local research only: nothing is deployed,
merged or pushed, and no production file changes.

## The question

Had a compositional memory been one of the voices HEX [PI] 7.0 learns from,
would its calls have carried more information? Measured the way 7.0 was:
one pass, every call made before its outcome, information gain in bits per
call, against controls.

## What was found in the code first

- **The 64 states.** In the frozen 6.5 engine each step leaves one binary
  line per read; the last six lines are one of 64 states: the vertices of
  the six-dimensional binary cube, with the number of differing lines as
  distance, a kernel `rho^d` between states, and the mirror state (all six
  lines reversed) counting as opposite evidence under the odd kernel. In 7.0
  the same doubling appears as rank windows of 2 to 64 values.
- **6.5 is already a memory over that cube at one scale**: evidence about
  what followed is filed under the state and shared with neighbouring
  states. 7.0 replaced it and carries more information on every class. So
  the one-scale cube memory has been tested; what has not is the recursion,
  the cross-subject chord, transformations, phrases and silence.
- **Stage 5** stores moments and compares them; it predicts nothing.

## The unfolding operator, as far as it is a valid operation

A phrase of `k` states is a vertex of the cube of dimension `6k`: distances
add, the mirror extends, and appending a state embeds the smaller cube in
the larger as a face without changing any distance. The union over `k` is
the cube of finitely supported binary sequences. That is a direct limit in
the exact sense, and it is the only one claimed.

Recursion across scale, as implemented: a line at scale `k` summarises a
block of `6^k` steps (the sign of the block's summed change for the
direction line; the block's mean size against the series' running median
for the size line), so that one line at scale `k+1` summarises exactly the
six steps of one state at scale `k`. Scales 0, 1, 2 span 6, 36 and 216
steps. Whether real series are self-similar across these scales is a
separate, empirical question (M8).

Hypotheses, not operations: that this recursion "unfolds" anything beyond
coarser summaries; that deeper scales carry structure the shallower do not.

## The memory, per series and read

All of it is causal: a call at step `i` may recall a moment `j` only if what
followed `j` was already known at `i`.

**Notes.** `z_t`: the normal score of the read's own variable (the change
for MOVE, its size for RANGE) against the series' own history so far.

**Voices** (each gives, for the call, the share of "up" (MOVE) or "larger
than the median" (RANGE) among what followed the recalled moments, as
log-odds against the running base rate):

| Group | Voice | Recall |
|---|---|---|
| Cube | scale 0, 1, 2 × plain, odd | The 6.5 estimator on the six-line own state: `sum_j k(s,j) D_j / (sum_j abs(k(s,j)) N_j + K)`, `rho = 1/4`, `K = 64`, no forgetting, no mixture |
| Melody | phrases of 6 and 36 notes | The 64 nearest earlier phrases; distance `mean((z - z')^2 / 2)`, in resolvable steps |
| Transformation | inversion at 6 and 36; augmentation ×2 at 6 (MOVE only) | The same recall on the inverted phrase, what followed inverted; and the present phrase against earlier phrases at half speed, what followed taken over two steps |
| Chord | one chord; a progression of 6 chords | The simultaneous notes of every channel of the universe that is present (markets: the neighbours' previous day; temperature: the same day, as in CER), compared on shared channels, at least two and at least half |
| Silence | one voice | Length of the present quiet or active run (size at or below, or above, the running median), in doublings, and the share of neighbours that are quiet; a calendar gap of more than 5 days is unknown, not silence |

No voice is rewarded or preferred. Recall under inversion is recorded
beside recall without it; neither replaces the other.

**The conventional memory it is compared with**: the 64 nearest earlier
windows of the series' own last 8 notes, one voice.

## How HEX would have learned with it

HEX 7.0's own learner, unchanged in form: online logistic regressions at
nine prior scales mixed by likelihood, mixed in turn by the fixed-share
mixture. The offset is HEX's own call from its committed ledger; the
experts are that call alone and one regression per group of voices plus one
on all voices together. With nothing to learn, the mixture stays on HEX.

| Arm | Experts beside HEX's own call |
|---|---|
| CONV | the conventional voice |
| CUBE | cube voices |
| MEL | melody, transformations, silence |
| CHORD | chord voices |
| FULL | all four groups and all voices together |
| ALONE | FULL's voices on the null instead of on HEX: what memory knows without HEX |

Data: all 43 series of the 7.0 replay (27 markets, 4 temperature stations,
12 racing series), both reads, the calls and outcomes of the committed
ledger. Racing has no neighbours, so no chord.

**Controls.** FULL again with what followed each recalled moment taken
from 250, 211 and 293 calls earlier in the same series: recall is intact,
its link to what followed is broken. A real effect must exceed these.

**Measure.** `log2` loss of HEX minus `log2` loss of the arm, per call;
mean by class and read with a 95% interval from a bootstrap over 20-day
blocks.

## Predictions

M1. HEX's calls recomputed on two series equal the ledger exactly; no
    ledger value is changed by this experiment.
M2. Voices and fused calls on a history truncated at 60% equal the same
    calls from the full history, on two series (no future data).
M3. Controls: FULL with displaced sequels is between -0.0015 and +0.0005
    bits per call in every class and read.
M4. Markets: FULL is within 0.0010 of zero on both reads. Memory of this
    kind adds nothing to 7.0 on daily market series.
M5. Temperature: FULL is above zero on MOVE with an interval excluding
    zero, and above its controls.
M6. FULL minus CONV: above zero on temperature MOVE, within 0.0010 of zero
    on markets.
M7. CUBE alone is within 0.0010 of zero in every class: the one-scale
    memory was already superseded, and the deeper scales add nothing.
M8. Self-similarity, tested on its own: the occupancy of the 64 direction
    states at scales 0, 1 and 2 differs by no more than sampling noise on
    markets, and by more than sampling noise on temperature. Size states
    differ across scales on both.
M9. ALONE (memory without HEX) gains over the null on temperature and
    racing, and less than HEX does in every class.
M10. Racing: FULL within 0.0010 of zero.

Thresholds are fixed here and are not moved after the run. Not in this
experiment: actual music, sensor data, human-interaction data, product code
or entities.
