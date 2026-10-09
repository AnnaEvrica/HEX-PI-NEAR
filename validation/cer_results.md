# CER in shadow beside HEX [PI] 7.0: results

Run 9 October 2026. Specification and predictions: `prereg_cer.md`, committed
before the run. Every number here is in `cer/report.json` and can be
recomputed from `cer/cer_ledger.parquet` (303,462 calls) and
`cer/cer_controls.parquet` with `cer_report.py`.

All gains are information gain in bits per call, with a 95% interval from a
bootstrap over 20-day blocks. "Fusion" is the fusion candidate: CER started
from HEX's call, so its gain over HEX is what the other channels added.
"Net of controls" is the real record minus the mean of the same run on the
three records displaced in time.

## What was found

**1. Where one environment physically leads another, CER finds it and it adds
to HEX.** Temperature direction, same-date arm:

| Target | Calls | HEX 7.0 over the null | Fusion over HEX 7.0 | Net of controls | Right %: HEX → fusion | Strongest tenth right %: HEX → fusion |
|---|---|---|---|---|---|---|
| New York | 1,433 | +0.0749 | **+0.0701** [+0.0498, +0.0908] | +0.0713 [+0.0507, +0.0930] | 64.5 → 67.6 | 76.4 → 87.5 |
| Chicago | 24,320 | +0.0643 | **+0.0078** [+0.0061, +0.0096] | +0.0063 [+0.0046, +0.0080] | 62.9 → 63.5 | 75.3 → 77.3 |
| Seattle | 24,344 | +0.0421 | +0.0031 [+0.0019, +0.0042] | +0.0005 [−0.0003, +0.0012] | 60.5 → 60.8 | 76.8 → 76.8 |
| Melbourne | 3,622 | +0.0651 | +0.0010 [−0.0004, +0.0025] | −0.0003 [−0.0018, +0.0012] | 63.1 → 63.3 | 76.0 → 76.9 |
| All four | 53,719 | +0.0546 | **+0.0069** [+0.0057, +0.0081] | +0.0049 [+0.0039, +0.0061] | 61.9 → 62.4 | 76.4 → 77.6 |

New York nearly doubles what HEX had found on its own, and the edge that
carries it is `New York <- Chicago` (+0.0730 scored alone; it ends holding
99% of the call). Weather moves west to east, and Chicago is a day upstream.
The descriptive graph reads the same thing with no prediction involved: rank
correlation 0.45 with Chicago leading by one day, and coherence in two bands
whose phase implies a lead of 1.2 to 1.3 days. `Chicago <- Seattle` is the
second real edge (+0.0080 alone).

**2. CER reports no relationship where there is none.** Melbourne, in the
other hemisphere, gains nothing from the three American stations. Seattle,
the upstream end, gains nothing from the stations downstream of it once the
controls are subtracted. Energy prices say nothing about temperature (fusion
net of controls −0.0002 [−0.0007, +0.0004] on direction, 0.0000 on move size),
and temperature says nothing verifiable about the next day's energy prices
(direction +0.0010 [−0.0002, +0.0024], move size +0.0005 [−0.0007, +0.0016]).
Natural gas and Chicago temperature do move together on the same day (rank
correlation −0.11, above its surrogate threshold): a real association that
carries no forecast.

**3. On markets, the relationships are real and almost all simultaneous, so
they do not forecast.** As of the last day, 533 of the 702 ordered pairs move
together above the surrogate threshold, 516 of them most strongly on the same
day, and 222 still do once the shared driver is removed. Read strictly before
the call, none of the 702 edges is predictive on either read.

| Development markets, 17 series, strict arm, 46,387 calls | Move size | Direction |
|---|---|---|
| HEX 7.0 over the null | +0.0043 [+0.0030, +0.0057] | +0.0000 [−0.0007, +0.0007] |
| CER standalone over the null | +0.0011 [−0.0001, +0.0022] | −0.0014 [−0.0023, −0.0006] |
| Fusion over HEX 7.0 | −0.0003 [−0.0014, +0.0007] | −0.0015 [−0.0023, −0.0007] |
| The three controls, fusion over HEX 7.0 | −0.0015, −0.0014, −0.0014 | −0.0019, −0.0020, −0.0020 |
| Fusion, net of controls | +0.0011 [+0.0001, +0.0023] | +0.0005 [−0.0005, +0.0015] |
| Right %: null, HEX, fusion | 57.1, 57.8, 57.9 | 51.3, 51.5, 51.4 |

There is a cross-market signal in move size (+0.0011 net of controls, the
size of moves spreading between markets), about a quarter of what HEX already
finds in each series' own record. As built, carrying 27 voices per target
costs about 0.0015 bits per call, which is more than they bring. The cost is
paid mostly in the first year (`cer/chart_cer_markets.png`). Looking only at
calls after the first 500 on each series (not pre-registered), fusion over
HEX on move size is +0.0005 [−0.0002, +0.0013] against −0.0002 to −0.0006 for
the controls. Without bitcoin the picture is the same: fusion over HEX −0.0003
on move size and −0.0015 on direction, +0.0012 on move size net of controls.

On the ten currencies never used before, strict arm: fusion over HEX +0.0002
[−0.0011, +0.0016] on move size and −0.0006 [−0.0017, +0.0004] on direction.

**4. The controls caught two things that would otherwise have been reported
as findings.**

- *The calendar.* On temperature the displaced records still gained about
  +0.002 bits per call over HEX on direction. A follow-up after the run
  (`cer_diagnostic.py`) replaced the neighbour with a random walk (−0.0002,
  nothing) and with a bare annual sine (+0.0034 at Chicago, +0.0055 at
  Seattle). So that part is the season, a shared driver, and not one station
  informing another. All of Seattle's apparent gain is this. It is also a
  direct lead for HEX itself: 7.0 has no coordinate for time of year.
- *Fixing times.* With same-date values allowed, the unused currencies showed
  +0.0026 [+0.0010, +0.0041] on direction over HEX. Read strictly, it is gone
  (−0.0006). It sits almost entirely in the Malaysian ringgit (+0.0288 same
  date, −0.0012 strict): its rate is set while the other markets are still
  open, so the others have already seen part of its next move.

## The predictions, one by one

| # | Prediction | Outcome |
|---|---|---|
| 1 | Markets, strict, standalone, direction: within 0.001 of zero | Not met on the development series: −0.0014 [−0.0023, −0.0006], which is the cost of the voices. Met on the unused currencies: 0.0000 [−0.0011, +0.0010] |
| 2 | Markets, strict, standalone, move size: +0.001 to +0.006, clear of zero, below HEX | Size and order as predicted (+0.0011, HEX +0.0043), but the interval reaches zero [−0.0001, +0.0022]. Not met. On the unused currencies +0.0023 [+0.0007, +0.0038], of which the controls alone give +0.0010 to +0.0013 |
| 3 | Markets, strict, fusion over HEX: move size positive and clear of zero; direction within 0.001 | Failed. Move size −0.0003 [−0.0014, +0.0007]; direction −0.0015 |
| 4 | Same-date arm shows more direction gain on currencies than the strict arm (fixing times) | Held. 22 currencies: +0.0005 same date, −0.0011 strict; concentrated in Malaysia, then South Korea and Taiwan |
| 5 | Temperature: New York above +0.01 with the Chicago edge largest; Chicago positive; Seattle less than Chicago; nothing into Melbourne | Held on every part, reading "predictive" as amended before the run. On the original wording one part fails: `Melbourne <- Chicago` ends holding 0.50 of the call against a starting 0.20 while carrying nothing (+0.0003 [−0.0036, +0.0040]) |
| 6 | Every control between −0.001 and +0.0005, none positive and clear of zero | Failed in both directions. Markets: −0.0014 to −0.0021 (the cost was underestimated). Temperature: positive and clear of zero (the calendar) |
| 7 | Energy x temperature: not clear of zero either way | Conclusion held (no relationship; net of controls every interval includes zero). As worded it is not met for temperature targets, where fusion is −0.0006 [−0.0011, −0.0001]: clear of zero on the negative side, equal to its controls |
| 8 | Markets: more than half of pairs related on the same day, fewer than one edge in ten predictive | Held: 76% related; 0 of 702 predictive in the strict arm. On the original "share" wording it fails (162 to 176 edges end above their starting share), which is why the wording was amended |

Three of the eight held as written (4, 5, 8) and one more in its conclusion
(7). The others miss for the same two reasons: the cost of carrying voices
was larger than predicted, and on markets the cross-series signal is smaller
than that cost.

## Checks

- **No call saw its own future.** 144 reruns on truncated histories, every
  channel rebuilt from its truncated record: largest difference 0.
- **HEX is unchanged.** `git diff` on `observer.ts`, `hex7.ts`, `cycle.ts`,
  `ledger.ts`, `isotonic.ts` and `functions/` is empty; `tests/parity.mjs`
  passes; 42 of the 43 replay series reproduce the committed 7.0 ledger call
  for call (largest difference 0). Bitcoin runs on a substitute price series
  (see the pre-registration).
- **The module is the tested code.** `tests/cer.mjs`: the TypeScript against
  the Python reference on the synthetic signals, largest difference 7 × 10⁻¹⁵.
- **Ten synthetic tests** (`cer_synthetic.py`): independent signals, locked
  oscillators, a phase offset, a known delay, a shared driver, a relationship
  that stops, missing and asynchronous samples, spikes and a stuck sensor, no
  future data, exact repeatability. All pass.
- **Headline figures recomputed** from the ledger with separate code: equal.

One thing was run on real data before the full run: a single target, to time
it. Nothing was changed afterwards. Two things were added after the run and
are marked as such above: the comparison net of controls, and the calendar
diagnostic.

## What this means for the build

1. **The measurement and inference path works on real data**, including
   saying no. It is ready to be pointed at the two servers.
2. **Start where there is a physical path.** The result that held is the one
   with a mechanism (air moving from one city to the next). Server heat,
   room temperature, power draw and a mycelium sample on one bench are that
   kind of system, and the first question CER can answer there is the one in
   test 5: does the biological channel carry anything once the room is
   accounted for.
3. **Keep the neighbourhood small.** Two or three neighbours cost about
   0.0001 to 0.0006 bits per call; 26 cost about 0.0015. Voices should be
   admitted on evidence, not carried by default.
4. **The same-date arm needs acquisition times.** With real sensors every
   sample has one (`acquired_at`), so this becomes exact instead of a
   one-day rule.
5. **A calendar coordinate for HEX** is worth its own pre-registered test:
   +0.003 to +0.006 bits per call on temperature direction from a bare
   annual sine.

The fusion candidate is not proposed for the ledger's version rule. On
temperature it would pass that rule (interval by the product's own
day-clustered statistic: [+0.0058, +0.0080]); on markets it would not.
