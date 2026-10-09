# Two checks on the memory results: what came out

Anna Maria Sarkisyan · Evrica Technologies Inc. · 9 October 2026

Predictions: `prereg_memory_checks.md`, committed before the run. Local
only. 254,208 dated calls (markets and temperature; racing has no
neighbours). Bits per call, net of controls, 95% interval over 20-day
blocks. "Chord" is mem-0.1's cross-subject recall; "addresses" is mem-0.2.

## Check 1: was the other subjects' information available?

Gain over HEX alone, net of controls:

| | Chord, same day | Chord, previous day only | Addresses, same day | Addresses, previous day only |
|---|---|---|---|---|
| Temperature, direction | +0.0025 (+0.0018 to +0.0033) | +0.0008 (+0.0005 to +0.0012) | +0.0017 (+0.0010 to +0.0023) | +0.0010 (+0.0006 to +0.0014) |
| Temperature, size | 0.0000 | 0.0000 | +0.0001 | +0.0001 |
| Markets, direction | +0.0010 (+0.0003 to +0.0017) | 0.0000 (-0.0004 to +0.0003) | +0.0007 (+0.0003 to +0.0011) | 0.0000 (-0.0002 to +0.0002) |
| Markets, size | +0.0001 | +0.0001 | +0.0001 | +0.0002 |

By station, temperature direction:

| Station | Calls | Chord, same day | Chord, previous day | Addresses, same day | Addresses, previous day | CER, same day | CER, previous day |
|---|---|---|---|---|---|---|---|
| New York | 1,433 | +0.0352 | +0.0006 (-0.0014 to +0.0026) | +0.0164 | +0.0008 (-0.0022 to +0.0038) | +0.0728 | +0.0072 |
| Chicago | 24,678 | +0.0029 | +0.0013 (+0.0007 to +0.0020) | +0.0008 | +0.0002 (-0.0001 to +0.0005) | +0.0040 | +0.0004 |
| Seattle | 24,353 | +0.0003 | +0.0005 (+0.0001 to +0.0008) | +0.0019 | +0.0019 (+0.0010 to +0.0028) | 0.0000 | +0.0001 |
| Melbourne | 3,622 | +0.0009 | +0.0001 | -0.0002 | 0.0000 | +0.0003 | +0.0001 |

By asset class, direction (size is within its interval of zero everywhere):

| Asset class | Calls | Chord, same day | Chord, previous day | Addresses, same day | Addresses, previous day |
|---|---|---|---|---|---|
| Currencies | 58,388 | +0.0013 (+0.0005 to +0.0021) | 0.0000 | +0.0009 (+0.0004 to +0.0014) | 0.0000 |
| Energy | 8,032 | -0.0003 | 0.0000 | 0.0000 | 0.0000 |
| Crypto | 3,898 | +0.0001 | -0.0001 | -0.0003 | -0.0002 |
| Volatility | 2,700 | -0.0001 | -0.0002 | +0.0007 (-0.0009 to +0.0023) | +0.0005 (-0.0010 to +0.0021) |

What it shows:

- **New York's gain depended entirely on same-day readings from other
  cities.** With the previous day only it is +0.0006 with an interval that
  includes zero. The same is true of CER there: +0.073 falls to +0.007.
- **Chicago keeps about half** (+0.0013, interval above zero). That is a
  real cross-station relation that survives the strict rule.
- **Seattle is unchanged** because its gain never came from other stations:
  it is the slow time scale, which is the season.
- **Currencies show a same-day gain that vanishes the day before.** That is
  the fixing-time effect found in the CER work: rates stamped with one date
  but fixed at different hours. Under the strict rule every asset class is
  at zero.

Whether a same-day reading counts as available depends on when the call is
made. A call made after every station's afternoon has passed may use it.
A call made earlier may not. The table gives both.

## Check 2: what does memory add to HEX plus CER?

Net of controls, over CER's primary fusion call at the same rule:

| | Chord, same day | Chord, previous day | Addresses, same day | Addresses, previous day |
|---|---|---|---|---|
| Temperature, direction | +0.0012 (+0.0007 to +0.0017) | +0.0008 (+0.0005 to +0.0011) | +0.0012 (+0.0008 to +0.0017) | +0.0010 (+0.0006 to +0.0015) |
| Temperature, size | 0.0000 | 0.0000 | +0.0001 | +0.0001 |
| Markets, direction | -0.0001 | 0.0000 | 0.0000 | 0.0000 |
| Markets, size | +0.0001 | +0.0001 | 0.0000 | +0.0001 |

- **With CER present, memory adds about +0.001 on temperature direction**
  and nothing anywhere else. For comparison CER itself adds +0.0038 there
  on the same day and +0.0005 on the previous day.
- **What memory adds beyond CER is Chicago's chord (+0.0020 same day,
  +0.0013 previous day) and Seattle's slow scale (+0.0019).** At New York,
  CER already holds what memory found.
- **Markets: zero in every asset class**, both reads, both rules.

## Predictions

| | Prediction | Result |
|---|---|---|
| K1 | Temperature direction, previous day: chord falls below half its same-day value; New York below half; stays above zero | **Held.** +0.0025 to +0.0008; New York +0.035 to +0.0006 |
| K2 | Markets, same day: a gain in currencies and none elsewhere; previous day: nothing in any asset class | **Held.** Currencies +0.0013 and +0.0009, both gone the day before |
| K3 | On HEX plus CER, same day, memory adds less than half of what it adds to HEX alone, both memories | **Held for the chord** (+0.0012 of +0.0025). **Failed for addresses** (+0.0012 of +0.0017): most of its gain is Seattle's season, which CER does not have |
| K4 | On HEX plus CER, previous day: under +0.0010 on temperature direction | **Held for the chord** (+0.0008). **Failed for addresses, by 0.00004** (+0.00104) |
| K5 | On HEX plus CER, markets within 0.0010 of zero in every asset class | **Held** |
| K6 | Controls between -0.0015 and +0.0006 | **Held** (largest +0.0006) |

## What stands after both checks

1. Under the strict rule and with CER present, memory's whole contribution
   is about +0.001 bits per call on temperature direction, from two things:
   one cross-station relation (Chicago) and the season (Seattle).
2. The large New York number was real information, but only for a call
   made after the other cities' same-day readings exist.
3. On markets, in every asset class, memory adds nothing to HEX, with or
   without CER, under the rule that matters.
4. The season is something a time coordinate gives directly.

Files: `memory_checks.py`, `memory_checks_report.py`, `memory/checks.json`.
