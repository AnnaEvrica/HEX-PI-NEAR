# HEX PI 7.0: the one-pass replay. Specification and predictions, written before the run

Written 5 October 2026, before `replay.py` was first executed.

## The engine being replayed (frozen here)

    logit p = logit q0 + beta . Z

- q0, the null: the observer's mixture of seven memories (and the position rule for MOVE), unchanged from 6.5.
- Z: midranks of the present value among the last 2, 4, 8, 16, 32, 64 values and among all values, mapped to (-1, 1). Two observables: the level and the size of the change. A read's own observable gives 7 coordinates; the other observable gives 7 more.
- Two residual models, each an online logistic regression with nine prior scales mixed by likelihood: own ranks (7), and own with the other observable's ranks (14).
- HEX's call: the null and the two residual models mixed with reversible influence (fixed-share rates 0, 0.001, 0.005, 0.02, 0.05, the rates mixed by likelihood).
- Left out, because the first test (prereg_hex7.md) showed no gain: products of coordinates, calibration that may change a call, the amplitude model.
- Strength: the pooled strength map of 6.5 (never changes a call) is fitted night by night and scored beside the engine's own probability. It ships only if it does not lower information gain.

## Order of operations, per timestamp

reveal the outcome, score, learn, predict, commit. One pass. Checked by rerunning the engine on truncated histories at sampled dates and comparing with the ledger.

## Metric

Information gain of a call: g = ln p(y) - ln q(y), reported in bits per call (divide by ln 2), against the null and against 6.5. Uncertainty: block bootstrap over blocks of 20 calendar days. Reported per read, per series, per domain, and as a macro-average over series.
Learning gain: the same engine with its residual models and mixing weights frozen after its first 500 scored calls on a series (the null keeps updating), against the engine left to learn.

## Data

- Development replay: the 17 market series, 1 January 2016 to September 2026, starting with nothing. These series were used while designing every version, so this is a development backtest.
- Development, other domains: the Chicago temperature series and the racing series used before.
- Replication, never used in any earlier experiment:
  - currencies: every country in the exchange-rate file other than the twelve already used, from 2016, kept if it has at least 2,000 observations and a non-zero change on at least half its days (this removes pegged currencies). Rule applied before any HEX run.
  - temperature: every public daily temperature file reachable from this machine with at least 1,000 days, one series per station, daily maximum: Melbourne 1981-1990, Seattle 1948-2017, New York 2012-2015. Listed before any HEX run.

## Predictions

1. Market move size: information gain over the null between 0.002 and 0.006 bits per call, interval clear of zero.
2. Market direction: under 0.0015 bits per call. Whatever the interval says is reported as it is.
3. 7.0 over 6.5 on market move size: positive, interval clear of zero.
4. Learning gain: positive on market move size; within 0.001 bits of zero on market direction.
5. Unused currencies: move size positive on the macro-average; direction not clear of zero.
6. Temperature replication: direction gain over the null positive at all three stations, and right at least 58% of the time at each.
7. The strength map does not lower information gain on move size.

## Amendment after the first run (5 October 2026)

The first run stands as run; its numbers are in git history. One thing was changed and everything rerun.

Comparing the product code's calls with the reference's calls showed differences on currencies quoted to four decimals. Cause: when a price returns exactly to an earlier price, the two levels are equal, but the level is a sum of log changes and the sum differed in its last binary digit depending on how the change was computed (log of a ratio, or difference of logs). The rank of a tie was being decided by rounding error. Values are now rounded to nine decimals before ranking, in the reference and in the product, so a tie is a tie. No other part of the specification changed, and no prediction was changed.
The same rounding is applied where the null ranks the level for its position rule, for the same reason, and the reference now computes changes as the product does (the logarithm of the ratio of successive values). With both in place the product's calls and the reference's calls, each computed from prices independently, are compared in `validation/README.md`.
