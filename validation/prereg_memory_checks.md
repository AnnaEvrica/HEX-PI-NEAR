# Two checks on the memory results: specification and predictions

Anna Maria Sarkisyan · Evrica Technologies Inc. · written 9 October 2026,
before either was run. Local only. Same calls, outcomes and data as
`prereg_memory.md` and `prereg_memory2.md`; the original reports are kept
as they are.

## Check 1: was the other subjects' information available at the call?

Every cross-subject voice is recomputed twice, for every dated series:

- **same day**: a neighbour's reading dated the day of the call;
- **previous day only**: nothing dated later than the day before the call.

Until now temperature used the same day and markets the previous day. Each
is now run both ways. The voices: mem-0.1's chord and chord progression;
mem-0.2's five addresses (the across-subject lines change with the rule,
the through-time lines do not). Racing has no neighbours and is not in
this check.

## Check 2: what does memory add to HEX plus CER?

The offset is CER's primary fusion call (`cer-0.4`, the moment) from its
committed ledger, at the same eligibility rule as the memory voices. Gain
is measured over that call, not over HEX alone.

## Reported

By class; within markets by asset class (currencies, energy, crypto,
volatility); within temperature by station; both reads; both eligibility
rules. Raw gain, controls (what followed each recalled moment taken from
earlier in the same series: 250 calls for mem-0.1's chord; 250, 211 and 293
for mem-0.2) and gain net of controls, bits per call with a 95% interval
over 20-day blocks.

## Predictions

K1. Temperature direction, previous day only: the chord's gain over HEX
    falls to less than half of its same-day value (+0.0024), and New York's
    to less than half of +0.035. It stays above zero.
K2. Markets, same day: a gain appears in currencies on at least one read
    (readings fixed at different hours of the same date), and none in
    crypto, energy or volatility beyond 0.0010. Previous day only: every
    asset class within 0.0010 of zero, both memories.
K3. On top of HEX plus CER, temperature direction, same day: memory adds
    less than half of what it adds to HEX alone, for both memories.
K4. On top of HEX plus CER, previous day only: memory adds less than
    +0.0010 on temperature direction.
K5. On top of HEX plus CER, markets: within 0.0010 of zero in every asset
    class, both reads, both rules.
K6. Controls stay between -0.0015 and +0.0006 in every class and read.
