# Self-tuning memory, harmonic matchmaking (mem-0.3): specification and predictions

Anna Maria Sarkisyan · Evrica Technologies Inc. · written 9 October 2026,
before any of this was run. Local research only. Same 280,252 calls and
outcomes as mem-0.1 and mem-0.2, from the committed 7.0 ledger.

## The question

Until now a memory voice that disagreed with outcomes was simply heard
less. The proposal: do not turn it down; retune it. Search a fixed set of
transformations for the alignment under which the present matches the
past, and learn, for each alignment, how what followed then relates to
what follows now (the same, the opposite, or nothing yet).

Does that add information over the same addresses without it, and does
memory then need an outside gate at all?

## Definitions

Addresses and tallies are those of mem-0.2, tree level only (pooling
across trees added nothing). Other subjects' lines use the previous day
only, for every dated series. Kernel `(1/4)^d`, `kappa = 64`.

**The bounded set of alignments** (fixed here; nothing is searched beyond
it):

| Alignment | The present is matched to the past |
|---|---|
| Unison | own six lines as they are |
| Inversion | own six lines, every line reversed |
| Retrograde | own six lines in reverse order |
| Delay | own six lines as they stood one step earlier (a phase shift of one) |
| Dilation | own six lines against past states whose lines each cover two steps |
| Kin unison | the kin subjects' lines as they are |
| Kin inversion | the kin subjects' lines, every line reversed |
| Modulation | own lines in the context of the kin lines (both together) |

Transposition needs no alignment of its own: notes and lines are already
measured against each series' own baseline.

For alignment `T`, the tally gives the shift `d_T` that followed the
matching past moments (`num / (den + kappa)`, as in mem-0.2). Nothing is
inverted by assumption.

**Resolution: the mapping from an alignment to what follows is learned.**
For each alignment, five readings of the same evidence,
`null + c d_T` with `c` in {-1, -1/2, 0, +1/2, +1}, mixed by HEX's
fixed-share mixture on their own record. `c = +1`: what followed then
follows now. `c = -1`: the opposite follows. `c = 0`: unresolved. The
mixture can move back, so an association is never deleted; its reading
changes.

**Matchmaking: a weighted ensemble of alignments, not one winner.** The
eight resolved readings are mixed by the same fixed-share mixture on their
record. That is `W(T) proportional to prior(T) x likelihood so far`.

**Memory's distribution** `p_M` is that ensemble.

## Arms

| Arm | The call |
|---|---|
| TUNED, direct | `logit p = logit p_HEX + (logit p_M - logit null)`. No outside gate: memory's shift is added whole |
| TUNED, gated | HEX's learner on the one voice `logit p_M - logit null` (a coefficient and the mixture with HEX alone), as in earlier versions |
| PLAIN, direct | The three untransformed alignments (unison, kin unison, modulation) averaged, `c = +1` fixed, added whole. No retuning |
| mem-0.2, mem-0.1 | As already run, for comparison |

Controls for the TUNED arms: tallies built from what followed 250, 211 and
293 calls earlier in the same tree; the mappings and the ensemble still
learn from the true outcomes. Measure and intervals as before. Beside the
bits: share right, calls whose side changed, and the learned mappings.

## Predictions

H1. No future data: a history cut at 60% gives the same `p_M`. Difference 0.
H2. Controls between -0.0015 and +0.0006 in at least five of six
    class-and-read cells, both TUNED arms.
H3. Without a gate memory costs more: TUNED direct is below TUNED gated in
    at least four of the six cells.
H4. Retuning protects: TUNED direct is at or above PLAIN direct in at
    least five of six cells. But it adds little where there is something:
    under +0.0010 over PLAIN on temperature direction.
H5. On temperature direction the learned mapping is positive on average
    for unison and negative on average for inversion: the same association,
    read the other way round.
H6. Markets: every arm within 0.0010 of zero net of controls, in every
    asset class.
H7. On temperature direction no mem-0.3 arm exceeds mem-0.2 under the same
    previous-day rule (+0.0010) by more than 0.0005.
H8. Cost: one pass in under 10 minutes on one core.

Thresholds are fixed here and not moved after the run.
