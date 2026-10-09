# Addressed memory with floating pooling (mem-0.2): specification and predictions

Anna Maria Sarkisyan · Evrica Technologies Inc. · written 9 October 2026,
before any of this was run. Local research only: nothing is deployed, merged
or pushed, and no product file changes. Same data, calls and outcomes as
`prereg_memory.md` (mem-0.1), read from the committed 7.0 ledger.

## The question

mem-0.1 recalled by comparing each moment with everything before it. The
only voice that added real information was the chord (other subjects at the
same moment), and the cost grew with the square of a series' length.

mem-0.2 asks whether one world built from addresses does as well or
better: the six-line state as the address of a moment, read through time or
across subjects; what followed filed under the address; and every tree
borrowing from its forest and the world in proportion to how little it has
seen itself.

## Definitions

**A line** is one binary observation. **Six lines along one axis are a
state**: one of 64 addresses, with the number of differing lines as
distance.

| Address | Its lines |
|---|---|
| T0, T1, T2 | The subject's own last six lines through time, each line summarising 1, 6 or 36 steps (as in mem-0.1) |
| S | Across subjects at one moment: up to six lines, one per kin subject, taken in order of kinship. For direction: whether the kin moved the way it usually moves with this subject. For size: whether the kin's move was larger than its own running median. Fewer than six kin present gives fewer lines; an absent subject is not given a line |
| T0+S | Both together: up to twelve lines, distances add |

**Kinship** between two subjects is the running mean product of their notes
on the dates both have (at least 50), using nothing later than the call.
The kin are the six present subjects with the largest absolute kinship.
Kinship is recomputed at every step, so the links float. Markets use the
kin's previous day and temperature the same day, as before.

**The tally.** Under each address `j`, `D_j` is the running sum of
(outcome minus the null's probability) for the calls made there, and `N_j`
their count. For a call at address `s`, with `k(s,j) = (1/4)^d(s,j)`:

    num = sum_j k(s,j) D_j        den = sum_j k(s,j) N_j

**Three levels, floating.** Tallies are kept for the tree (this series),
its forest (markets; temperature) and the world (both). With `kappa = 64`:

    world    d_w = num_w / (den_w + kappa)
    forest   d_f = (num_f + kappa d_w) / (den_f + kappa)
    tree     d_t = (num_t + kappa d_f) / (den_t + kappa)

A tree with little of its own leans on its forest, the forest on the world;
as evidence gathers, each floats free. The voice is the log-odds of
`null + d_t` against the null.

**Causality.** A tree's own evidence is used as soon as its next bar
exists. Evidence from another tree is used only when its outcome is dated
strictly before the day of the call. Racing series have no dates, so they
cannot be placed on the world's clock: they get tree tallies only.

**No reward.** Tallies record what followed, whatever it was. How much any
voice is heard in a call is decided only by HEX's own learner.

## Arms

HEX's learner as in mem-0.1 (HEX's call as offset; one regression on the
arm's voices; the fixed-share mixture between that and HEX alone).

| Arm | Voices |
|---|---|
| TREE | The five addresses, tree tallies only |
| FOREST | The five addresses, tree leaning on forest |
| WORLD | The five addresses, tree leaning on forest leaning on world |
| each address alone | One WORLD voice at a time |
| BOTH | mem-0.1's voices and WORLD's together |

Controls for WORLD: every tally built from what followed 250, 211 and 293
calls earlier in the same tree.

Measure: as before, `log2` loss of HEX minus that of the arm, bits per
call, 95% interval from a bootstrap over 20-day blocks. Beside it: the
share of calls right, the calls whose side changed, and how those did.

## Predictions

N1. No future data: the whole pass run on records cut off at a date gives
    the same voices before that date. Difference 0.
N2. Controls between -0.0015 and +0.0005 in at least five of the six
    class-and-read cells (temperature size may again sit just above).
N3. Temperature direction: WORLD at least +0.0015, interval excluding zero,
    above its controls.
N4. On temperature direction, S alone or T0+S alone adds more than T0
    alone: the across-subject state carries it.
N5. Pooling helps: WORLD minus TREE is above zero on temperature direction;
    and over the first 250 calls of every dated tree, WORLD minus TREE is
    not below zero in either forest.
N6. Across forests: WORLD minus FOREST is within 0.0005 of zero on markets,
    both reads. Temperature's past does not help markets.
N7. Markets: WORLD within 0.0010 of zero on direction; between 0 and
    +0.0010 on size.
N8. Racing: WORLD within 0.0010 of zero on both reads.
N9. BOTH minus mem-0.1's FULL is within 0.0010 of zero everywhere: the two
    memories see the same things.
N10. Cost: one pass over all 280,252 calls in under 10 minutes on one
    core, and the time per call in the last third no more than 1.5 times
    the first third.

Thresholds are fixed here and not moved after the run.
