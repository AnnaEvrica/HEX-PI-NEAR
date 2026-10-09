# CER in shadow beside HEX [PI] 7.0: results

Run 9 October 2026. Specification and predictions: `prereg_cer.md`, each part
committed before its run. Every number here is in `cer/report.json` and can
be recomputed from `cer/cer_ledger.parquet` (303,722 calls) and
`cer/cer_controls.parquet` with `cer_report.py`.

All gains are information gain in bits per call, with a 95% interval from a
bootstrap over 20-day blocks. "Fusion" is the fusion candidate: CER started
from HEX's call, so its gain over HEX is what the other channels added.
"Net of controls" is the real record minus the mean of the same run on the
three records displaced in time.

Three experiments are reported:

1. CER as first built: an edge is heard according to its past predictive
   success (`cer-0.1`).
2. An edge is heard according to present measurement, `w = A.L.C.Q`
   (`cer-0.2`).
3. Maximum entropy over interpretations, at `T = 1` and at a temperature
   validated without the prediction target (`cer-0.3`).

All three are computed in the same pass from the same edge experts, on
identical causal data. HEX 7.0 is unchanged throughout.

---

## The comparison in one table

Fusion over HEX 7.0, on the arm that counts in each universe.

| Where | Calls | By past success (0.1) | By measured weight (0.2) | Maximum entropy, T = 1 (0.3) | Maximum entropy, validated T (0.3) |
|---|---|---|---|---|---|
| New York temperature, direction | 1,433 | +0.0701 | +0.0357 | **+0.0727** | +0.0727 |
| Chicago temperature, direction | 24,320 | **+0.0078** (net +0.0063) | +0.0012 | +0.0047 | +0.0038 |
| Seattle temperature, direction | 24,344 | +0.0031 (net +0.0005) | +0.0001 | +0.0002 | +0.0002 |
| Melbourne temperature, direction | 3,622 | +0.0010 | +0.0001 | +0.0002 | +0.0002 |
| Four stations, direction | 53,719 | +0.0069 (net +0.0049) | +0.0015 | +0.0042 | +0.0038 |
| 17 markets, move size, strict | 46,517 | −0.0003 | **0.0000** | −0.0003 | −0.0001 |
| 17 markets, direction, strict | 46,517 | −0.0015 | **0.0000** | −0.0001 | −0.0001 |
| 10 unused currencies, move size, strict | 26,570 | +0.0002 | +0.0001 | −0.0001 | −0.0001 |
| 10 unused currencies, direction, strict | 26,570 | −0.0006 | −0.0001 | −0.0001 | 0.0000 |
| Energy from temperature, direction | 11,363 | +0.0001 | 0.0000 | −0.0003 | −0.0002 |
| Temperature from energy, direction | 13,319 | −0.0006 | 0.0000 | −0.0001 | −0.0001 |
| **All calls, total bits over HEX** | 302,976 | +288 | +82 | +213 | +200 |

"Net" is shown for the original where its controls were not zero. The
measurement-based modes' controls are zero to the fourth decimal in every
universe (largest for any group: 0.0003).

**Reading it.**

- **Maximum entropy at T = 1 keeps what is real and drops what is not.** It
  matches the original on New York (+0.0727 against +0.0701; 64.5% right
  under HEX, 67.8% with it; strongest tenth 76.4% to 88.9%), keeps most of
  Chicago, and costs almost nothing where nothing is there (markets
  direction −0.0001 against the original's −0.0015). It does this from the
  day the window fills, with no record of success to wait for.
- **The original's larger total is partly the calendar.** About 120 of its
  288 bits come from temperature targets where its displaced controls gain
  as much: the season, a shared driver, not one station informing another
  (see "what the controls caught"). The measurement-based modes do not pick
  this up, by construction: a displaced record shows no lead.
- **The measured weight `w = A.L.C.Q` is the safest and gives up the most.**
  It is exactly zero-cost where there is nothing (markets 0.0000 on both
  reads) and it finds New York, but hears it at half strength (+0.0357):
  `w` there averages 0.29, because `w` is the *size of an association*, not
  the probability that the edge's voice is right. A rank correlation of 0.35
  is strong evidence of a relationship, and `w` treats it as a 0.35 share.
  Maximum entropy converts the same measurement into evidence and commits
  accordingly.
- **The validated temperature changes little.** It chose T = 1 on most
  market calls and higher temperatures on temperature targets, and moved the
  result by under 0.001 everywhere. Where it differed (Chicago, +0.0038
  against +0.0047) it gave up gain: the relationship there is steady, and
  holding back from it costs.
- **No mode finds a market forecast.** On markets the relations are real
  and simultaneous. `L` measures exactly that: across the 702 market edges
  the mean `A` on direction is 0.26 and the mean usable lead `L` is 0.03.

**Which to use.** On this evidence, maximum entropy at T = 1
(`'relaxation'`). The module's default is the measured weight
(`'measurement'`), as specified for the second experiment; the others are
selected by one argument of `shadowReplay`.

---

## Experiment 1: CER as first built

Rerun on the corrected bitcoin file (see "Checks"). No conclusion changed
from the first run; market figures moved in the fourth decimal.

**Where one environment physically leads another, CER finds it and it adds
to HEX.** Temperature direction, same-date arm:

| Target | Calls | HEX 7.0 over the null | Fusion over HEX 7.0 | Net of controls | Right %: HEX → fusion | Strongest tenth right %: HEX → fusion |
|---|---|---|---|---|---|---|
| New York | 1,433 | +0.0749 | **+0.0701** [+0.0503, +0.0909] | +0.0713 [+0.0507, +0.0924] | 64.5 → 67.6 | 76.4 → 87.5 |
| Chicago | 24,320 | +0.0643 | **+0.0078** [+0.0061, +0.0097] | +0.0063 [+0.0047, +0.0079] | 62.9 → 63.5 | 75.3 → 77.3 |
| Seattle | 24,344 | +0.0421 | +0.0031 [+0.0019, +0.0043] | +0.0005 [−0.0003, +0.0013] | 60.5 → 60.8 | 76.8 → 76.8 |
| Melbourne | 3,622 | +0.0651 | +0.0010 [−0.0004, +0.0025] | −0.0003 [−0.0018, +0.0013] | 63.1 → 63.3 | 76.0 → 76.9 |
| All four | 53,719 | +0.0546 | **+0.0069** [+0.0058, +0.0081] | +0.0049 [+0.0039, +0.0060] | 61.9 → 62.4 | 76.4 → 77.6 |

The edge that carries New York is `New York <- Chicago` (+0.0730 scored
alone; it ends holding 99% of the call). Weather moves west to east, and
Chicago is a day upstream. The descriptive graph reads the same thing with no
prediction involved: rank correlation 0.45 with Chicago leading by one day,
and coherence in two bands whose phase implies a lead of 1.2 to 1.3 days.
`Chicago <- Seattle` is the second real edge (+0.0080 alone).

**CER reports no relationship where there is none.** Melbourne gains nothing
from the three American stations. Seattle, the upstream end, gains nothing
from the stations downstream once the controls are subtracted. Energy prices
say nothing about temperature (fusion net of controls −0.0002 [−0.0008,
+0.0004] on direction, 0.0000 on move size), and temperature says nothing
verifiable about the next day's energy prices (direction +0.0010 [−0.0003,
+0.0024], move size +0.0005 [−0.0007, +0.0016]). Natural gas and Chicago
temperature do move together on the same day (rank correlation −0.11, above
its surrogate threshold): a real association that carries no forecast.

**On markets the relationships are real and almost all simultaneous.** As of
the last day, 539 of the 702 ordered pairs move together above the surrogate
threshold, 520 of them most strongly on the same day, and 219 still do once
the shared driver is removed. Read strictly before the call, none of the 702
edges is predictive on either read.

| Development markets, 17 series, strict arm, 46,517 calls | Move size | Direction |
|---|---|---|
| HEX 7.0 over the null | +0.0043 [+0.0029, +0.0057] | 0.0000 [−0.0007, +0.0007] |
| CER standalone over the null | +0.0011 [−0.0001, +0.0023] | −0.0014 [−0.0023, −0.0006] |
| Fusion over HEX 7.0 | −0.0003 [−0.0014, +0.0007] | −0.0015 [−0.0024, −0.0006] |
| The three controls, fusion over HEX 7.0 | −0.0015, −0.0013, −0.0014 | −0.0019, −0.0021, −0.0020 |
| Fusion, net of controls | +0.0010 [0.0000, +0.0022] | +0.0005 [−0.0004, +0.0015] |
| Right %: null, HEX, fusion | 57.2, 57.9, 58.0 | 51.2, 51.4, 51.3 |

There is a cross-market signal in move size (+0.0010 net of controls), about
a quarter of what HEX already finds in each series' own record. Carrying 27
voices by past success costs about 0.0015 bits per call, more than they
bring, and the cost is paid mostly in the first year
(`cer/chart_cer_markets.png`). After the first 500 calls on each series (not
pre-registered) fusion over HEX on move size is +0.0005 [−0.0003, +0.0013]
against −0.0002 to −0.0006 for the controls. Without bitcoin: −0.0003 and
−0.0015, net +0.0012 on move size.

Unused currencies, strict arm: fusion over HEX +0.0002 [−0.0013, +0.0015] on
move size and −0.0006 [−0.0016, +0.0003] on direction.

**What the controls caught.**

- *The calendar.* On temperature the displaced records still gained about
  +0.002 bits per call over HEX on direction. A follow-up (`cer_diagnostic.py`)
  replaced the neighbour with a random walk (−0.0002, nothing) and with a bare
  annual sine (+0.0034 at Chicago, +0.0055 at Seattle). That part is the
  season. All of Seattle's apparent gain is this. It is also a direct lead
  for HEX itself: 7.0 has no coordinate for time of year.
- *Fixing times.* With same-date values allowed, the unused currencies showed
  +0.0026 [+0.0011, +0.0042] on direction over HEX. Read strictly, it is gone
  (−0.0006). It sits almost entirely in the Malaysian ringgit (+0.0290 same
  date, −0.0012 strict): its rate is set while other markets are still open.

### Predictions of experiment 1

| # | Prediction | Outcome |
|---|---|---|
| 1 | Markets, strict, standalone, direction: within 0.001 of zero | Not met on the development series: −0.0014 [−0.0023, −0.0006], the cost of the voices. Met on the unused currencies: 0.0000 [−0.0011, +0.0011] |
| 2 | Markets, strict, standalone, move size: +0.001 to +0.006, clear of zero, below HEX | Size and order as predicted (+0.0011, HEX +0.0043), but the interval reaches zero. Not met. Unused currencies +0.0022 [+0.0006, +0.0037], of which the controls alone give +0.0010 to +0.0014 |
| 3 | Markets, strict, fusion over HEX: move size positive and clear of zero; direction within 0.001 | Failed. Move size −0.0003 [−0.0014, +0.0007]; direction −0.0015 |
| 4 | Same-date arm shows more direction gain on currencies than the strict arm | Held. 22 currencies: +0.0004 same date, −0.0011 strict; concentrated in Malaysia, then South Korea |
| 5 | Temperature: New York above +0.01 with the Chicago edge largest; Chicago positive; Seattle less than Chicago; nothing into Melbourne | Held on every part, reading "predictive" as amended before the run. On the original wording one part fails: `Melbourne <- Chicago` ends holding 0.50 of the call against a starting 0.20 while carrying nothing |
| 6 | Every control between −0.001 and +0.0005, none positive and clear of zero | Failed both ways. Markets: −0.0013 to −0.0021. Temperature: positive and clear of zero (the calendar) |
| 7 | Energy x temperature: not clear of zero either way | Conclusion held (net of controls every interval includes zero). As worded, not met for temperature targets: fusion −0.0006 [−0.0010, −0.0001], equal to its controls |
| 8 | Markets: more than half of pairs related on the same day, fewer than one edge in ten predictive | Held: 77% related; 0 of 702 predictive in the strict arm. On the original "share" wording it fails (161 to 169 edges end above their starting share) |

Three held as written (4, 5, 8) and one more in its conclusion (7).

---

## Experiment 2: edge weight from present measurement

`w = A.L.C.Q`, from the current window, no outcome in it.

**What the weights were.**

| Universe, read, arm | Edges | Edge-calls carrying weight | Mean A | Mean L | Heaviest edge (mean w) |
|---|---|---|---|---|---|
| Temperature, direction, same date | 10 | 24.5% | 0.08 | 0.17 | `New York <- Chicago` (0.29), then `Chicago <- Seattle` (0.07) |
| Markets, direction, strict | 702 | 6.9% | 0.26 | 0.03 | `FX-SouthAfrica <- WTI` (0.06) |
| Markets, move size, strict | 702 | 14.4% | 0.15 | 0.11 | `BRENT <- WTI` (0.11) |

The two heaviest temperature edges are the two that experiment 1 found
predictive, identified here without consulting any outcome. On market
direction, association is high and usable lead is almost absent, which is
the finding of experiment 1 stated as a measurement.

**Results**: the comparison table above. Controls under the measured weight
are within 0.0003 of zero in every group, so the calendar artefact is gone.

### Predictions of experiment 2

| # | Prediction | Outcome |
|---|---|---|
| R1 | Markets, strict: nearer zero than the original, within 0.0005 of HEX; under 5% of edge-calls carry weight | First part held (0.0000 on both reads). Second failed: 6.9% on direction, 14.4% on move size |
| R2 | New York: positive, clear of zero, smaller than the original | Held: +0.0357 [+0.0270, +0.0443] against +0.0701 |
| R3 | Chicago: smaller than the original | Held: +0.0012 [+0.0010, +0.0014] against +0.0078 |
| R4 | The calendar artefact goes | Held: temperature controls 0.0000 |
| R5 | The fixing-time artefact stays in the same-date arm | Held: Malaysian ringgit +0.0196 same date |
| R6 | Energy x temperature within 0.0005 of zero | Held |
| R7 | Gives up gain where real, saves cost where not | Held |

---

## Experiment 3: maximum entropy over interpretations

`P(z_j | G_t) ~ exp(E_j / T)` over "nothing relates" and "edge j does", with
the evidence `E_j` measured from the window.

**On signals with built-in relationships** (`cer_synthetic.py`, test 12): a
weak real lead among three decoys was named the most supported
interpretation in 12 of 12 trials; with four decoys and nothing real,
"nothing" held above 90% in 11 of 12. Gain on the weak lead: maximum entropy
+0.029, past success +0.027, measured weight +0.015 bits per call. With
nothing real: −0.0001. The temperature rule chose 32 on a relationship built
to keep switching between two neighbours and 1 on a steady one.

**On real data**: the comparison table. Precision and calibration on the two
real relationships:

| Target, direction | Mode | Right % | Strongest tenth: stated, right % | Calibration error |
|---|---|---|---|---|
| New York | HEX 7.0 alone | 64.5 | 74.6, 76.4 | 0.029 |
| | By past success | 67.6 | 81.9, 87.5 | 0.053 |
| | Measured weight | 67.1 | 76.2, 83.3 | 0.058 |
| | Maximum entropy, T = 1 | 67.8 | 82.9, 88.9 | 0.052 |
| Chicago | HEX 7.0 alone | 62.9 | 75.3, 75.3 | 0.010 |
| | By past success | 63.5 | 76.9, 77.3 | 0.008 |
| | Measured weight | 63.1 | 75.3, 75.8 | 0.008 |
| | Maximum entropy, T = 1 | 63.2 | 76.1, 76.9 | 0.009 |

On New York every CER mode is right more often than it states (the strongest
tenth says 82.9% and is right 88.9%): the Chicago edge's expert is still
under-committed after 1,433 calls. That is in the experts, which all modes
share.

**Temperature chosen** (share of calls): markets, move size: T = 1 on 64%;
markets, direction: T = 1 on 52%, 32 on 46%; four stations, direction: T = 1
on 25%, 8 to 32 on the rest; New York: T = 1 throughout (too short for a
check to exist).

### Predictions of experiment 3

| # | Prediction | Outcome |
|---|---|---|
| M1 | Where real and steady, mode 2 within 10% of the original and above the measured weight | Held on New York (+0.0727 against +0.0701). Not on Chicago: +0.0047 against +0.0078, which is 75% of the original net of its calendar part. Above the measured weight on both |
| M2 | Markets, strict: within 0.0005 of HEX | Held: −0.0003 and −0.0001 |
| M3 | Controls within 0.0005 of zero in every universe | Held by universe. One station on one control is outside: Melbourne, +0.0008 |
| M4 | T = 1 on more than half of calls; within 0.0005 of mode 2 everywhere | Held on markets. Failed on temperature: T = 1 on 25% of calls, and Chicago differs by 0.0009 |
| M5 | Calibration no worse than the original's | Mixed: better on markets (0.015 against 0.017), equal on the four stations, worse at Seattle (0.011 against 0.008) |
| M6 | No mode beats the others everywhere | Held |

---

## Checks

- **No call saw its own future.** 144 reruns on truncated histories, every
  channel, weight and temperature rebuilt from its truncated record, all four
  calls compared: largest difference 0.
- **HEX is unchanged.** `git diff` on `observer.ts`, `hex7.ts`, `cycle.ts`,
  `ledger.ts`, `isotonic.ts` and `functions/` is empty; `tests/parity.mjs`
  passes; all 43 replay series reproduce the committed 7.0 ledger call for
  call (largest difference 0).
- **The module is the tested code.** `tests/cer.mjs`: the TypeScript against
  the Python reference on the synthetic signals, every mode, largest
  difference 4 × 10⁻¹³.
- **Twelve synthetic tests** (`cer_synthetic.py`), all pass.
- **Headline figures of experiment 1 recomputed** from the ledger with
  separate code: equal.

**Corrections and disclosures.**

- *Bitcoin.* The first run used a substitute price series because I
  reported the original file as missing. It is in the repository
  (`tests/backend-smoke/BTC_daily.csv`). Everything was rerun on it; the
  first run is in git history (`1bdf0ff`).
- Before each full run one or two targets were run to time the code. Nothing
  was changed afterwards.
- Added after the runs and marked above: the comparison net of controls, the
  calendar diagnostic, the after-500-calls figure, the total-bits row.
- CER's probabilities are stored to six decimals.

## What this means for the build

1. **The measurement, weighting and inference path works on real data**,
   including saying no. It is ready to be pointed at the two servers.
2. **Start where there is a physical path.** The result that held is the one
   with a mechanism. Server heat, room temperature, power draw and a
   mycelium sample on one bench are that kind of system.
3. **Hear an edge by its measured evidence.** Maximum entropy at T = 1 kept
   the real gain, removed the calendar artefact, and removed the cost of
   carrying voices that say nothing. A relationship is heard from the first
   full window instead of after it has earned a record.
4. **Two limits of the measured lead to fix next.** It does not condition on
   the target's own past, so persistence in the target can look like a lead
   (`BRENT <- WTI` on move size); and it inherits fixing-time artefacts in
   the same-date arm. Sensor data with acquisition times removes the second.
5. **A calendar coordinate for HEX** is worth its own pre-registered test:
   +0.003 to +0.006 bits per call on temperature direction from a bare
   annual sine.

No mode is proposed for the ledger's version rule yet. On temperature the
fusion candidate would pass that rule under every mode (by the product's own
day-clustered statistic: past success [+0.0058, +0.0080], maximum entropy
[+0.0034, +0.0050], measured weight [+0.0013, +0.0017]); on markets none
would.
