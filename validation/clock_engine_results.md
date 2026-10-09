# The clock in the engine: results

Anna Maria Sarkisyan · Evrica Technologies Inc. · 9 October 2026

Predictions: `prereg_clock_engine.md`, committed before the engine was
changed. Run: `python3 clock_engine.py` (84 seconds), `node tests/parity.mjs`,
`node tests/loop.mjs`. Report: `clock_engine/report.json`.

## What changed

Where a series carries dates, HEX [PI] 7.0 has a fourth voice in its
mixture: the second model's fourteen coordinates plus nine for the date of
the latest finished step (day of the week as seven indicators, sine and
cosine of the time of year). It is one more residual model of the kind
already there, and the mixture is over four voices. A series with no dates
is read exactly as before.

`validation/hex7core.py: walk(..., days=None)` and
`base44/shared/hex7.ts: walkHex7(..., days?)`. Dates come from the market
fetch (`marketDataClient.ts: returnDays`) and are passed by the nightly
calibration, the chat, the two scheduled posts and the walk-forward
function. A pasted series has none. The weekly horizon of the morning post
has none.

## What this run is

The same 43 series and 280,252 calls as the research run. It shows the
engine now does what the research copy did. It is not new evidence that
the clock helps; that comes only from calls made from here on, which the
ledger will score.

## Predictions

| | Prediction | Result |
|---|---|---|
| E1 | Without dates, the committed 7.0 ledger is reproduced exactly | **Held.** Largest difference 0 on 280,252 calls; the three-voice call inside a dated walk is also identical |
| E2 | With dates, the research copy's calls are reproduced | **Held.** Largest difference 0, clock and control |
| E3 | Racing (no dates) unchanged | **Held.** 0 on 26,044 calls |
| E4 | Control within ±0.0005 | **Held.** By class −0.0004 to 0.0000; by asset class −0.0005 to +0.0004 |
| E5 | Nothing from the future | **Held.** 13,812 calls on series cut at three points: difference 0 |
| E6 | Product code matches the reference on dated Bitcoin bars | **Held.** 5,359 steps a read, the final call, 14 + 23 coefficients, four influences: 5 × 10⁻¹⁴ |
| E7 | Gain above zero in both halves of the record for the three headline cells | **Held for two, failed for one.** See below |
| E8 | Existing suites pass as before | **Held**, with one expected edit: a loop check that counted two readings and three influences now counts three and four on a dated series |

## The table

Bits per call the clock adds, net of the control (dates dealt out in a
random order), 95% interval over 20-day blocks.

| Class or asset, read | Calls | HEX over the null | Clock adds | Share right: before | With clock | Sides changed |
|---|---|---|---|---|---|---|
| **Temperature, direction** | 54,086 | +0.0547 | **+0.0195 (+0.0178 to +0.0211)** | 61.91% | 63.20% | 6,925 |
| **Volatility index, direction** | 2,700 | +0.0108 | **+0.0120 (+0.0057 to +0.0185)** | 56.48% | 58.74% | 439 |
| **Bitcoin, size** | 3,898 | +0.0062 | **+0.0089 (+0.0060 to +0.0119)** | 60.39% | 61.49% | 295 |
| Energy, size | 8,032 | +0.0045 | +0.0020 (+0.0006 to +0.0032) | 59.30% | 59.74% | 287 |
| Energy, direction | 8,032 | −0.0003 | +0.0010 (+0.0002 to +0.0018) | 53.27% | 53.29% | 245 |
| Currencies, direction | 58,388 | 0.0000 | +0.0009 (+0.0004 to +0.0015) | 52.05% | 52.07% | 2,683 |
| Currencies, size | 58,388 | +0.0047 | +0.0009 (+0.0004 to +0.0014) | 59.38% | 59.39% | 1,279 |
| Temperature, size | 54,086 | +0.0123 | +0.0007 (+0.0003 to +0.0011) | 59.46% | 59.49% | 1,554 |
| Volatility index, size | 2,700 | +0.0318 | +0.0024 (−0.0008 to +0.0058) | 58.59% | 59.52% | 175 |
| Bitcoin, direction | 3,898 | +0.0010 | +0.0004 (−0.0004 to +0.0012) | 52.92% | 52.85% | 179 |
| Racing (no dates) | 26,044 | | exactly 0 | unchanged | unchanged | 0 |
| All markets, direction | 73,018 | +0.0004 | +0.0013 (+0.0008 to +0.0018) | 52.40% | 52.49% | 3,546 |
| All markets, size | 73,018 | +0.0057 | +0.0015 (+0.0010 to +0.0020) | 59.40% | 59.55% | 2,036 |

54 of the 62 dated series-and-read pairs are above zero net of control.

## E7: earlier and later half of each record

| | Earlier half | Later half |
|---|---|---|
| Temperature, direction | +0.0171 (+0.0149 to +0.0193) | +0.0220 (+0.0194 to +0.0245) |
| Volatility index, direction | +0.0069 (+0.0011 to +0.0123) | +0.0171 (+0.0063 to +0.0285) |
| Bitcoin, size | +0.0013 (−0.0005 to +0.0031) | +0.0165 (+0.0109 to +0.0217) |

**Bitcoin's size gain sits in the later half of its record.** In the
earlier half the interval includes zero. So the +0.0089 is an average of a
period where the calendar said little and a period where it said a lot.
That is what a learner should show if the pattern arrived part way through,
and it also means the figure is not a constant to expect. Temperature and
the volatility index hold in both halves.

## The most recent 330 nights of Bitcoin

`tests/loop.mjs` runs the nightly loop on the Bitcoin bars kept with the
tests (to 30 September 2026). On its last 330 nights, the same engine
without and with the clock:

| Read | Bits per call over the null: without | With | Share right: without | With |
|---|---|---|---|---|
| Move size | −0.0017 | +0.0208 | 53.0% | 57.6% |
| Direction | −0.0028 | −0.0034 | 49.4% | 47.6% |

330 calls is a short record: the size read's interval over the null runs
from −0.0003 to +0.0419, and the direction difference is six calls. With
the clock the version rule in that test shows 7.0 on move size.

## What to expect in the product

- The product tracks market series. For those the measured gain is small
  on average: about +0.001 bits per call on each read. The larger figures
  belong to Bitcoin's size read and the volatility index's direction read.
- On Bitcoin's size read the clock holds most of the influence at the end
  of the record (0.89 on the bars used by the parity test); on its
  direction read the four voices are near equal.
- Shown calls change once Publish is pressed in Base44, for dated series
  only. Probabilities moved by 0.5 to 4.3 points on average, by asset class, in
  the market replay, and the side changed on about 3 to 5% of calls.
- The ledger keeps one engine name, `hex-7.0`. A row made with the clock is
  recognisable by four influences in `learned` and a `clock` reading in
  `views`; rows made before it have three and none. The version rule
  compares 7.0 with 6.5 across both.
- Cost: both engines, both reads, 5,386 changes: 454 ms without dates,
  679 ms with.

## Limits

- Same data as the research run, so no new evidence of the gain itself.
- Day of week and time of year only. Holidays, month ends, expiry days and
  hours are not in it.
- Currencies carry the fixing-time effect found earlier; a day-of-week
  pattern there may partly be that.
- CER's shadow replay and `validation/replay/` still use and describe 7.0
  without the clock, as do the PDFs in `docs/`.
