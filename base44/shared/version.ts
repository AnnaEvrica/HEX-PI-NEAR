// One version string for the whole backend. Every function that reports a
// version reports this one.
//
// 6.1 — the calibrated probability read (walk-forward, decayed evidence,
//       symmetry field, isotonic calibration) is the only source of stated
//       probabilities, in chat and in every scheduled post.
// 6.2 — the engine comes pre-trained (markets, weather, horse racing) and is
//       domain-agnostic: a series is never told which family it is.
// 6.3 — HEX in two versions on every call (state-6.2 shown, state-6.3 with
//       the observer's baseline beside it), a ledger of every call, a nightly
//       update and a promotion rule.
// 6.4 — HEX written as an explicit model with no hand-set numbers.
// 6.5 — one cycle for every call (call, outcome, score, reason, learn);
//       calibration restates strength and never changes a call; the two
//       reads coupled. Now the frozen comparator.
// 7.0 — HEX as a residual on the null: logit p = logit q0 + beta . Z, with
//       continuous ranks for Z, learned online, influence reversible
//       (hex7.ts, docs/MODEL.md). Information gain over the null is the
//       measure every decision rests on.
//       Within 7.0: where a series carries dates, a fourth voice reads the
//       day of the week and the time of year (the clock). No dates, no clock.
export const ENGINE_VERSION = '7.0';
/** The software people use. */
export const PRODUCT_NAME = 'HEX [PI]';
/** The engine it runs on (and the name of the hardware server). */
export const ENGINE_NAME = 'HEX6-BLE';
