# The clock in the engine: specification and predictions

Anna Maria Sarkisyan · Evrica Technologies Inc. · written 9 October 2026,
before the engine was changed and before the run.

## The change

HEX [PI] 7.0 mixes three voices: the null, the rank model and the cross
model. Where a series carries dates, a fourth voice is added: the cross
model's fourteen coordinates plus nine calendar coordinates for the date
of the latest finished step (day of the week as seven indicators; sine and
cosine of the time of year). Same regression, same nine prior scales, same
fixed-share mixture, now over four voices.

    logit p_clock = logit q0 + beta . (Z, C)

A series with no dates has no clock, and its call is the present one,
unchanged. The engine keeps its name and number (7.0). Nothing else in the
engine, the null, the Learning Module or governance changes.

Where: `validation/hex7core.py` (`walk(..., days=None)`), the reference,
and `base44/shared/hex7.ts` (`walkHex7(..., days?)`), the product. Dates
reach the engine from the market fetch; a pasted series has none.

## What this run is and is not

It is the same 43 series and 280,252 calls as the research run
(`clock_kelly_results.md` on branch `clock-kelly`). It tests that the
engine now does what the research copy did. It is not new evidence that
the clock helps: that would need calls made after today.

## Predictions

- **E1.** Without dates the reference reproduces the committed 7.0 ledger
  exactly (largest difference 0), and the existing parity test passes
  unchanged.
- **E2.** With dates the reference reproduces the research copy's calls
  (largest difference below 1e-12), so the research table stands: Bitcoin
  size about +0.0089 bits per call net of control, temperature direction
  about +0.0195, volatility index direction about +0.0120.
- **E3.** Racing (no dates) is unchanged exactly.
- **E4.** Control, dates dealt out in a random order (seed 11): within
  ±0.0005 of zero in every class and read.
- **E5.** Nothing from the future: cutting a series at any step leaves
  every earlier call identical, and the call at the cut equal to the final
  call of the cut series.
- **E6.** The product code matches the reference on a dated series
  (Bitcoin bars) to the parity test's tolerance, for every step, the final
  call, the coefficients and the influences.
- **E7 (new, not seen).** Splitting each series' calls into an earlier and
  a later half, the clock's gain net of control is above zero in both
  halves for Bitcoin size, temperature direction and volatility index
  direction. If the gain sits in one half only, that is reported.
- **E8.** Every existing suite passes as before (types, parity, loop, CER,
  experience, smoke apart from the known `docs/PROMPT.md` mismatch, lint).

Failures are reported as failures.
