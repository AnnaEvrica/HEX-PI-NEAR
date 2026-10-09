# Compositional memory in the learning loop: results

Anna Maria Sarkisyan · Evrica Technologies Inc. · 9 October 2026

Predictions: `prereg_memory.md`, committed before the run. Local research
only. No product file, entity, ledger value or governance rule was changed;
HEX [PI] 7.0's committed ledger has the same checksum before and after.

## What was run

All 43 series of the 7.0 replay, both reads: 280,252 calls, one pass, each
call made before its outcome. HEX's own calls were taken from its ledger.
Fourteen memory voices were computed causally for every call and given to
HEX's own learner as experts beside HEX's call. Gain is `log2` loss of HEX
minus `log2` loss of the arm, in bits per call, with a 95% interval from a
bootstrap over 20-day blocks. Controls: the same memory with what followed
each recalled moment taken from 250, 211 and 293 calls earlier.

## The answer

| Class, read | Calls | HEX over the null | Memory added to HEX (FULL) | Controls | FULL minus controls |
|---|---|---|---|---|---|
| Markets, direction | 73,018 | +0.0004 | -0.0002 (-0.0006 to +0.0003) | -0.0004 | +0.0003 (-0.0002 to +0.0007) |
| Markets, size | 73,018 | +0.0057 | +0.0007 (+0.0000 to +0.0013) | -0.0001 | +0.0008 (+0.0002 to +0.0013) |
| Temperature, direction | 54,086 | +0.0547 | +0.0034 (+0.0025 to +0.0044) | +0.0002 | +0.0032 (+0.0023 to +0.0041) |
| Temperature, size | 54,086 | +0.0123 | +0.0007 (+0.0003 to +0.0011) | +0.0005 | +0.0002 (-0.0002 to +0.0006) |
| Racing, direction | 13,022 | -0.0017 | -0.0008 (-0.0014 to -0.0001) | -0.0007 | -0.0001 (-0.0008 to +0.0005) |
| Racing, size | 13,022 | +0.0123 | -0.0005 (-0.0014 to +0.0005) | -0.0006 | +0.0001 (-0.0009 to +0.0011) |

- **Markets, direction: nothing.** As predicted.
- **Markets, size: a small real gain**, about an eighth of what HEX itself
  holds there. The conventional memory (the series' own last 8 notes) gets
  the same, so the compositional structure adds nothing to it.
- **Temperature, direction: a real gain**, about 6% on top of HEX's own.
  It is not the season: with a calendar voice added first, memory adds as
  much again (+0.0035; checked after the run, `memory_calendar.py`).
- **Temperature, size, and racing: nothing beyond the controls.** On
  racing, memory costs a little while the learner finds out it is useless,
  and the cost falls to zero by the last third of each record.

## Where the temperature gain comes from

| Arm, added to HEX | Markets, direction | Markets, size | Temperature, direction | Temperature, size |
|---|---|---|---|---|
| Conventional (own last 8 notes) | -0.0001 | +0.0007 | +0.0003 | -0.0000 |
| Cube (six-line states, three scales) | -0.0001 | +0.0004 | +0.0012 | +0.0008 |
| Melody, transformations, silence | -0.0001 | +0.0008 | +0.0003 | +0.0001 |
| Chord (other subjects at the same moment) | -0.0003 | -0.0002 | +0.0024 | +0.0001 |
| All (FULL) | -0.0002 | +0.0007 | +0.0034 | +0.0007 |

- **The chord carries it**: what the other stations were doing when earlier
  moments like this one occurred. New York +0.035 (1,433 calls), Chicago
  +0.0029. This is the same cross-station relation CER found, reached by
  recall instead of by regression.
- **The deepest cube scale carries some**: Seattle +0.0024. A line there
  summarises 36 days, so six of them say roughly where in the year it is.
  With the calendar voice present Seattle's gain falls to +0.0018.
- **Phrases, inversion, half-speed recall and silence carry almost
  nothing** on any class beyond what the plain 8-note window does.

## Memory without HEX

Gain over the null, bits per call:

| Class, read | HEX 7.0 | Memory alone | 6.5 |
|---|---|---|---|
| Markets, direction | +0.0004 | +0.0004 | +0.0004 |
| Markets, size | +0.0057 | +0.0036 | +0.0021 |
| Temperature, direction | +0.0547 | +0.0409 | +0.0188 |
| Temperature, size | +0.0123 | +0.0037 | +0.0035 |
| Racing, direction | -0.0017 | -0.0008 | -0.0008 |
| Racing, size | +0.0123 | +0.0030 | +0.0055 |

Memory alone learns about three quarters of what HEX knows about
temperature direction and about twice what 6.5 knew. It does not reach HEX
on any class where HEX holds something.

## How it learned through time

FULL's gain over HEX in each third of every series' record:

| Class, read | First | Middle | Last |
|---|---|---|---|
| Temperature, direction | +0.0025 | +0.0042 | +0.0035 |
| Temperature, size | -0.0000 | +0.0009 | +0.0012 |
| Markets, size | +0.0008 | +0.0008 | +0.0004 |
| Markets, direction | -0.0007 | +0.0001 | +0.0001 |
| Racing, direction | -0.0015 | -0.0008 | -0.0000 |
| Racing, size | -0.0009 | -0.0006 | -0.0001 |

## Prediction by prediction

| | Prediction | Result |
|---|---|---|
| M1 | HEX recomputed equals its ledger | **Held.** Difference 0 on four series-reads; ledger checksum unchanged |
| M2 | Truncated history gives the same voices and calls | **Held.** 4,015 calls, none differ |
| M3 | Controls between -0.0015 and +0.0005 everywhere | **Failed on one of six, by 0.00001.** Temperature size control +0.00051, with an interval above zero: a sequel displaced by most of a year still carries a little of the season |
| M4 | Markets FULL within 0.0010 of zero | **Held.** -0.0002 and +0.0007. The size gain is small but its interval excludes zero |
| M5 | Temperature direction above zero and above controls | **Held.** +0.0034; +0.0032 net |
| M6 | FULL minus conventional: above zero on temperature direction, within 0.0010 on markets | **Held.** +0.0031; -0.0001 and -0.0001 |
| M7 | Cube within 0.0010 of zero in every class | **Failed on temperature direction** (+0.0012). Held elsewhere. The deeper scales do carry something there: the season |
| M8 | Market direction states occupied alike at every scale; temperature not; size states not | **Failed for markets**: scale 1 differs from scale 0 by 0.048 against 0.035 of sampling noise, scale 2 by 0.135 against 0.090. Temperature and size states differ, as predicted. Only racing direction is alike across scales, and it has no structure at any scale. **No series here is self-similar across these scales** |
| M9 | Memory alone gains on temperature and racing, and less than HEX everywhere | **Failed on racing direction**: memory alone loses there (-0.0008), and loses less than HEX does (-0.0017). Held elsewhere |
| M10 | Racing FULL within 0.0010 of zero | **Held.** -0.0008 and -0.0005 |

## Transformations, as measured

At 6 notes, an earlier phrase is nearer when inverted on 47% of calls and
nearer at half speed on 47%, in every class. Phrases are about as close to
their past upside down or slowed as they are upright. Recall under either
transformation predicted nothing that upright recall did not.

## What this supports and what it does not

Supported by this run:
- Recall across subjects (the chord) holds information on temperature that
  HEX 7.0 does not have, beyond the season and beyond the controls.
- The recursion is a valid construction, and its deepest scale picks up
  slow structure where there is some.
- Adding memory voices to HEX's learner is safe: where they hold nothing,
  the cost is under 0.001 bits per call and falls to zero.

Not supported:
- That phrases, inversion, augmentation or silence add forecasting
  information on these series.
- That the compositional memory beats a plain window on markets.
- That any of these series is self-similar across the three scales.
- Anything about music, sensors or human interaction: none was run.

## Limits of this experiment

1. **Four temperature stations, and one of them (New York, 1,433 of the
   54,086 calls) holds a quarter of the pooled gain on its own.** Chicago
   and Seattle are long and their gains per call are a tenth the size;
   Melbourne's is near zero.
2. **Markets use the neighbours' previous day; temperature the same day**,
   as in CER. A same-day reading from another city is only usable if it
   exists when the call is made.
3. **Choices fixed in advance and not tuned**: 64 neighbours, phrases of 6
   and 36, `rho = 1/4`, `K = 64`, one doubling of a run as one step. Other
   values were not tried, so a voice that added nothing here is not shown
   to be empty at every setting.
4. **The season check and the per-station table were added after the run.**
5. **Cost**: 37 minutes on two cores for 280,252 calls with three controls.
   The nearest-neighbour recall grows with the square of a series' length
   (17 minutes for one 24,678-step series). A nightly version would need an
   index, which was not built.

## Files

`memory_core.py` (the memory and the learner), `memory_replay.py`,
`memory_report.py`, `memory_calendar.py`; `memory/ledger.parquet` (every
call, every arm, every voice), `memory/report.json`, `memory/calendar.json`.
