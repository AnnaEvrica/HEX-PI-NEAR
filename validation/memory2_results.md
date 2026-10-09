# Addressed memory with floating pooling (mem-0.2): how it works and what it did

Anna Maria Sarkisyan · Evrica Technologies Inc. · 9 October 2026

Predictions: `prereg_memory2.md`, committed before the run. Local research
only. No product file, entity or ledger value changed. Same 280,252 calls
and outcomes as mem-0.1, from HEX [PI] 7.0's committed ledger.

## How it works

1. **A line** is one yes-or-no observation. For direction: did it go up.
   For size: was the move larger than usual.
2. **Six lines make a state**, one of 64. The state is an address. Two
   addresses are close when few of their lines differ.
3. **The same six lines can be read along different axes.**
   - Through time: the subject's own last six lines (address T0). The same
     with each line summarising 6 steps (T1) or 36 steps (T2).
   - Across subjects: one line from each of the subject's nearest kin at
     the same moment (address S). Kin are chosen by how closely their
     notes have moved with this subject's so far, and that floats.
   - Both together (T0+S).
4. **Under each address memory keeps a tally** of what followed the calls
   made there, relative to the usual odds. Nearby addresses share evidence,
   a quarter as much for each line that differs.
5. **Three levels float.** The tally is kept for the tree (one series), its
   forest (markets, temperature) and the world. A tree with little history
   leans on its forest; with more of its own it floats free.
6. **Each address gives one voice.** HEX's own learner decides how much
   each voice is heard. Nothing is rewarded for being harmonious, novel or
   quiet.
7. **Order of events, every night**: read the addresses, hear the voices,
   make the call, and only when the outcome is dated add it to the tallies.

## Precision table: HEX alone, and HEX with this memory

| Class, read | Calls | Bits over the null: HEX | with memory | Share right: null | HEX | with memory |
|---|---|---|---|---|---|---|
| Markets, direction | 73,018 | 0.0004 | 0.0002 | 52.22% | 52.40% | 52.58% |
| Markets, size | 73,018 | 0.0057 | 0.0061 | 58.64% | 59.40% | 59.58% |
| Temperature, direction | 54,086 | 0.0547 | 0.0567 | 52.81% | 61.91% | 62.00% |
| Temperature, size | 54,086 | 0.0123 | 0.0130 | 58.20% | 59.46% | 59.51% |
| Racing, direction | 13,022 | -0.0017 | -0.0018 | 74.96% | 74.79% | 74.81% |
| Racing, size | 13,022 | 0.0123 | 0.0119 | 49.69% | 52.90% | 52.90% |

Gain from memory, with its controls (bits per call, 95% interval):

| Class, read | Memory added | Controls | Net of controls |
|---|---|---|---|
| Markets, direction | -0.0002 (-0.0004 to +0.0000) | -0.0002 | 0.0000 (-0.0002 to +0.0002) |
| Markets, size | +0.0004 (+0.0000 to +0.0008) | +0.0002 | +0.0002 (-0.0001 to +0.0005) |
| Temperature, direction | +0.0020 (+0.0014 to +0.0027) | +0.0003 | +0.0017 (+0.0011 to +0.0023) |
| Temperature, size | +0.0007 (+0.0004 to +0.0010) | +0.0006 | +0.0002 (-0.0002 to +0.0005) |
| Racing, direction | -0.0001 (-0.0005 to +0.0003) | -0.0006 | +0.0005 (-0.0000 to +0.0010) |
| Racing, size | -0.0004 (-0.0006 to -0.0001) | -0.0002 | -0.0002 (-0.0005 to +0.0002) |

**One real effect**: temperature direction. Everything else is inside its
controls.

## Its effect on individual calls

| Class, read | Calls whose side changed | Of those, right with memory | Right before | Probability moved, mean | 90th percentile | Largest |
|---|---|---|---|---|---|---|
| Markets, direction | 3,103 (4.3%) | 52.1% | 47.9% | 0.4 points | 0.9 | 20.7 |
| Markets, size | 1,189 (1.6%) | 55.4% | 44.6% | 0.6 | 1.3 | 19.1 |
| Temperature, direction | 1,881 (3.5%) | 51.4% | 48.6% | 1.5 | 3.6 | 26.5 |
| Temperature, size | 1,125 (2.1%) | 51.2% | 48.8% | 0.8 | 1.8 | 15.3 |
| Racing, direction | 37 (0.3%) | 54.1% | 45.9% | 0.3 | 0.8 | 12.2 |
| Racing, size | 500 (3.8%) | 50.0% | 50.0% | 0.3 | 0.7 | 6.6 |

By how far HEX itself leaned from even:

| HEX leaned by | Markets direction: side changed | Temperature direction: side changed | Temperature direction: share right, HEX to with memory |
|---|---|---|---|
| Under 2 points | 9.0% | 27.1% | 51.6% to 52.7% |
| 2 to 5 | 0.4% | 7.0% | 54.7% to 54.7% |
| 5 to 10 | 0.1% | 0.8% | 56.7% to 56.7% |
| Over 10 | 0.0% | 0.1% | 67.2% to 67.2% |

- Memory moves a probability by about one point. It changes the side of a
  call almost only where HEX was within two points of even.
- Where HEX leaned by more than five points, memory changed the side of
  fewer than 1 call in 100, and never where HEX leaned by more than ten in
  markets.
- On temperature direction the gain in bits is spread over every row, the
  strongly leaning calls included (+0.0023 where HEX leaned over ten
  points): memory mostly sharpens probabilities, it rarely flips them.
- On market direction the share right rose by 0.18 points while the bits
  fell. The two disagree, the net of controls is zero, and I do not count
  it as an effect.

## Which address carries it, and whether the world helps

Temperature direction, each voice alone on HEX:

| Address | Gain |
|---|---|
| T0, own last six lines | +0.0001 |
| T1, lines of 6 steps | -0.0000 |
| T2, lines of 36 steps | +0.0012 |
| S, across kin subjects | +0.0009 |
| T0+S | +0.0003 |

- **Across subjects**: New York +0.018 from two lines, Chicago +0.0010
  from about one. The six-line reading across subjects does carry the
  relation the continuous chord found, at about half its strength, with
  far fewer lines than six available (four stations).
- **The slowest time scale** carries the season, almost all of it at
  Seattle (+0.0023).

| Level | Markets, direction | Markets, size | Temperature, direction | Temperature, size |
|---|---|---|---|---|
| Tree only | -0.0001 | +0.0004 | +0.0021 | +0.0008 |
| Tree leaning on forest | -0.0002 | +0.0004 | +0.0021 | +0.0007 |
| Tree leaning on forest and world | -0.0002 | +0.0004 | +0.0020 | +0.0007 |

**Leaning on the forest or the world added nothing.** In a tree's first
250 calls, where it should help most, it was slightly worse in all four
cells (-0.0005 to -0.0008, each interval including zero). The reason is
visible in the arithmetic: 64 addresses fill from a tree's own calls
within a few hundred steps, and what follows an address in one tree did
not transfer to another.

## Against mem-0.1

| | mem-0.1 (recall by comparison) | mem-0.2 (addresses) |
|---|---|---|
| Temperature direction, added to HEX | +0.0034 | +0.0020 |
| Markets size, added to HEX | +0.0007 | +0.0004 |
| Both memories together, temperature direction | | +0.0035 |
| One pass over all calls | roughly 15 to 20 minutes of computing (37 minutes on two cores for four passes, fusing included) | 33 seconds |
| Cost per call as the library grows | grows with its size | flat (229 microseconds) |

Addresses keep about 60% of the gain at a few percent of the cost, and the
cost no longer grows. Using both together adds nothing over
mem-0.1 alone: they hear the same thing.

## Prediction by prediction

| | Prediction | Result |
|---|---|---|
| N1 | No future data | **Held.** Two cut-off dates, 108,151 dated calls, difference 0 |
| N2 | Controls inside the band in at least five of six cells | **Held, five of six.** Temperature size control +0.0006, as expected |
| N3 | Temperature direction at least +0.0015, above controls | **Held.** +0.0020; +0.0017 net |
| N4 | The across-subject address adds more than the own six lines | **Held.** +0.0009 against +0.0001. Not predicted: the 36-step scale adds more than either (+0.0012, the season) |
| N5 | Pooling helps | **Failed.** World minus tree is -0.0001 on temperature direction and below zero in the first 250 calls of all four cells |
| N6 | Temperature's past does not help markets | **Held.** World minus forest -0.00002 on both reads |
| N7 | Markets within 0.0010; size between 0 and +0.0010 | **Held.** -0.0002 and +0.0004 |
| N8 | Racing within 0.0010 | **Held.** -0.0001 and -0.0004 |
| N9 | Both memories together add under 0.0010 over mem-0.1 | **Held.** Largest +0.0002 |
| N10 | A pass under 10 minutes; flat cost per call | **Held.** 33 seconds; the last three tenths ran in half the time of the first three |

## What this says about the proposal

- **One grammar read along several axes works.** The across-subject state
  is the same object as the engine's own state and it carries real
  information where there is some.
- **Addresses make memory cheap enough to run every night.**
- **One world as shared evidence is not supported here.** Trees did not
  learn from their forest, and forests did not learn from each other. The
  world works as one geometry and one library; it did not work as one pool
  of experience.
- **Scale recursion found the season and nothing else.**
- **On markets there is still nothing for memory to add to 7.0.**

## Limits

1. Temperature has four stations, so the across-subject address had one or
   two lines, not six. Markets had all six and nothing to find.
2. `kappa = 64` and the quarter-per-line kernel were fixed in advance and
   not tuned. A smaller `kappa` would let a tree float free sooner; it was
   not tried.
3. Racing has no dates, so it has no forest or world level.
4. The table by how far HEX leaned was not pre-registered.
5. Kinship here is a running mean product. The link-growth rule (explore,
   thicken, thin) was not built.

Files: `memory2.py`, `memory2_report.py`, `memory/ledger2.parquet`,
`memory/report2.json`.
