# Self-tuning memory, harmonic matchmaking (mem-0.3): results

Anna Maria Sarkisyan · Evrica Technologies Inc. · 9 October 2026

Predictions: `prereg_memory3.md`, committed before the run. Local research
only. Same 280,252 calls. Other subjects' lines use the previous day only.
Bits per call; "net" is net of controls, with a 95% interval.

## What was built

Eight fixed alignments between the present state and memory: unison,
inversion, retrograde, delay, dilation, kin unison, kin inversion,
modulation. For each, memory learns how what followed then relates to what
follows now, on a scale from -1 (the opposite) through 0 (unresolved) to
+1 (the same). The eight are then combined as a weighted ensemble. No
association is deleted; its reading can change.

Two ways of using it were compared: added whole to HEX's call with no
outside gate ("direct"), and through HEX's learner as before ("gated").

## The retuning works as described

Learned reading of each alignment, averaged over all calls:

| Alignment | Temperature, direction | Temperature, size | Markets, direction | Markets, size |
|---|---|---|---|---|
| Unison | +0.93 | +0.35 | +0.08 | +0.05 |
| Inversion | -0.93 | -0.46 | -0.05 | -0.06 |
| Retrograde | +0.64 | +0.01 | +0.03 | +0.04 |
| Delay | +0.92 | +0.01 | +0.04 | +0.04 |
| Dilation | +0.90 | +0.39 | +0.05 | +0.08 |
| Kin unison | -0.01 | -0.13 | -0.05 | +0.04 |
| Kin inversion | -0.15 | -0.05 | -0.04 | -0.03 |
| Modulation | +0.90 | +0.28 | +0.04 | +0.06 |

On temperature direction memory taught itself that the inverted pattern
means the opposite outcome (-0.93), without being told. That is the
"correction in the relationship, not in the existence of the memory" the
proposal describes, and it happened. On markets every reading stayed near
zero: unresolved.

Memory on its own, over the null, learned +0.0103 on temperature direction
(HEX: +0.0547), +0.0011 on market size, and about zero elsewhere.

## It did not improve the calls

Gain over HEX:

| Class, read | Direct, net | Gated, net | Untuned, direct | mem-0.2, same rule | mem-0.1 as first run |
|---|---|---|---|---|---|
| Markets, direction | 0.0000 (-0.0001 to +0.0001) | 0.0000 | -0.0004 | -0.0002 | -0.0002 |
| Markets, size | 0.0000 (-0.0003 to +0.0002) | -0.0001 | -0.0004 | +0.0004 | +0.0007 |
| Temperature, direction | **-0.0020 (-0.0029 to -0.0012)** | 0.0000 (-0.0001 to +0.0001) | -0.0004 | +0.0012 | +0.0034 |
| Temperature, size | 0.0000 (-0.0001 to +0.0001) | 0.0000 | -0.0006 | +0.0007 | +0.0007 |
| Racing, direction | +0.0003 (+0.0001 to +0.0005) | 0.0000 | -0.0019 | -0.0001 | -0.0008 |
| Racing, size | -0.0003 (-0.0006 to -0.0000) | 0.0000 | -0.0014 | -0.0004 | -0.0005 |

On top of HEX plus CER the figures are the same to the fourth decimal.

Effect on calls (direct arm):

| Class, read | Share right: HEX | With memory | Side changed | Changed calls right | Probability moved, mean |
|---|---|---|---|---|---|
| Markets, direction | 52.40% | 52.49% | 916 (1.3%) | 53.5% | 0.2 points |
| Markets, size | 59.40% | 59.42% | 286 (0.4%) | 52.4% | 0.3 |
| Temperature, direction | 61.91% | 61.67% | 2,652 (4.9%) | 47.6% | 2.5 |
| Temperature, size | 59.46% | 59.39% | 593 (1.1%) | 46.7% | 0.4 |
| Racing, direction | 74.79% | 74.79% | 10 (0.1%) | 50.0% | 0.1 |
| Racing, size | 52.90% | 52.94% | 118 (0.9%) | 52.5% | 0.2 |

Three things explain it.

1. **Without a gate, memory counts the same evidence twice.** On
   temperature direction memory's strongest alignment is the series' own
   recent pattern. HEX already reads that pattern. Adding memory's shift
   whole pushes the probability further on evidence already used, and the
   call gets worse: -0.0020, with 4.9% of sides changed and those right
   only 47.6% of the time. The outside gate was not censoring dissonance;
   it was preventing double counting.
2. **The ensemble favours what is strongest alone, not what is new.** It
   put 72% of its weight on unison and 1.5% on the kin alignments. But what
   memory added to HEX in earlier versions came from the kin lines and the
   slow scale, exactly what the ensemble turned down. So the gated arm,
   which had only the ensemble's single voice to work with, found nothing
   (0.0000), below mem-0.2 under the same rule (+0.0012).
3. **Where there is nothing, tuning does protect.** Against the untuned
   memory added whole, the tuned one is better in five of six cells
   (+0.0004 to +0.0016), because an alignment with nothing to say settles
   at "unresolved" and adds nothing.

Markets by asset class: every arm within 0.0003 of zero net of controls in
currencies, energy, crypto and volatility.

## Predictions

| | Prediction | Result |
|---|---|---|
| H1 | No future data | **Held.** 17,228 calls, difference 0 |
| H2 | Controls inside the band in at least five of six cells | **Held, six of six** |
| H3 | Without a gate memory costs more: direct below gated in at least four of six | **Held, six of six** (by 0.0021 on temperature direction) |
| H4 | Tuning protects: tuned at or above untuned in at least five of six; under +0.0010 on temperature direction | **Held, five of six.** On temperature direction the tuned memory is worse than the untuned (-0.0017): it commits harder to evidence HEX already has |
| H5 | Temperature direction: unison read positive, inversion negative | **Held.** +0.93 and -0.93 |
| H6 | Markets within 0.0010 of zero in every asset class | **Held** |
| H7 | No mem-0.3 arm beats mem-0.2 under the same rule by more than 0.0005 | **Held.** Both arms are below it |
| H8 | A pass under 10 minutes | **Held.** 89 seconds |

All eight held. That means the experiment behaved as I expected, including
the part where it does not help.

## What this says about the proposal

- **Supported**: an association can be kept and re-read instead of turned
  down. Memory found the inverted reading by itself.
- **Not supported**: that this improves the probabilities, or that the
  outside gate can be dropped.
- **The real issue it exposed**: memory was tuned against the null, so it
  relearned what HEX already knows. For memory to be added without a gate
  it has to be tuned against HEX's own call, so that it stores only what
  HEX missed. That is a different reference, one line of the mathematics,
  and it has not been run.
- **Not tested**: the complex-valued phase field. Six binary lines do not
  support a phase, as the proposal itself notes.

Files: `memory3.py`, `memory3_report.py`, `memory/report3.json`.
