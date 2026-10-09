# Contrapuntal memory: residual, counterpoint, composition (mem-0.4): specification and predictions

Anna Maria Sarkisyan · Evrica Technologies Inc. · written 9 October 2026,
before any of this was run. Local research only. Same 280,252 calls and
outcomes. Other subjects' lines use the previous day only.

## The question

Three roles for memory, run side by side:

- **A, residual**: memory learns what HEX missed.
- **B, counterpoint**: memory learns its own distribution, independently of
  HEX, and the two are heard together.
- **C, composition**: memory builds new addresses out of two existing ones
  and tests them forward.

Each against HEX, and against HEX plus CER.

## Definitions

The alignments, tallies, learned readings (`c` from -1 to +1) and weighted
ensemble are those of mem-0.3 (`prereg_memory3.md`).

**A, residual.** The same eight alignments, but the reference is the call
being improved (HEX's, or HEX plus CER's): tallies hold
`outcome - that call`, and each reading is `call + c d`. The ensemble's
output is the new call. There is no outside gate.

**B, counterpoint.** Memory's own distribution `p_M` (mem-0.3's ensemble,
learned against the usual odds, never shown HEX's call). The two voices
are combined as a mixture, `p = (1 - w) p_H + w p_M`, with `w` learned by
HEX's fixed-share mixture on the record. A mixture lets each voice keep its
own distribution; nothing is added twice.

**Tension.** `D = JS(p_M, p_H)`, the Jensen-Shannon divergence in bits.
**B with tension**: the same mixture, kept separately for calls whose
tension is above and below the tree's own running median so far.

**C, composition.** New addresses formed line by line from two that
already exist (`XOR`: a line is set where the two differ). Four, fixed
here:

| Composed address | Built from | Reads as |
|---|---|---|
| Interval | own lines and kin lines | where the subject and its kin disagree |
| Transition | this step's own lines and the previous step's | which lines just changed |
| Cross-scale | own lines and the same at half speed | where the fast and slow readings disagree |
| Symmetry | own lines and their reverse | how far the phrase is from a palindrome |

Each is a hypothesis: its tally starts empty and gathers evidence only
from its creation onward. Readings and ensemble as in mem-0.3, learned
against the usual odds, giving `p_C`; combined with HEX as a mixture, as
in B. One level of composition only (structural economy).

**Coverage.** A call has thin support when its tree has made fewer than 30
earlier calls from the same own six-line state. Coverage is each arm's
gain on those calls alone.

**Controls.** Every arm with its tallies built from what followed 250, 211
and 293 calls earlier in the same tree.

There is no untouched partition in this data: all of it has informed
earlier experiments. The last third of each tree's record is reported
separately as "later", and is not a held-out test.

## Predictions

J1. No future data: a history cut at 60% gives the same outputs.
J2. Controls between -0.0015 and +0.0006 in at least five of six cells,
    each arm.
J3. A no longer harms: within 0.0010 of zero on markets and racing, and on
    temperature direction between 0 and +0.0015 net, above mem-0.3's
    ungated arm (-0.0020).
J4. B: within 0.0005 of zero in every cell. Heard beside HEX, an
    independent memory that knows less adds nothing.
J5. Tension does not mark recoverable error: B with tension is within
    0.0005 of B in every cell, and on temperature direction memory alone
    does worse than HEX in the high-tension half.
J6. C: within 0.0010 of zero net in every cell. On markets every composed
    reading stays unresolved (average reading under 0.2 in size); on
    temperature direction at least one resolves (over 0.5 in size).
J7. Coverage: on thin-support calls no arm gains more than +0.0010 net in
    any class.
J8. On top of HEX plus CER, A on temperature direction is within 0.0005 of
    its value over HEX alone.
J9. Markets by asset class: every arm within 0.0010 of zero net.

Thresholds are fixed here and not moved after the run.
