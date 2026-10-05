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
// 6.5 — the second version is HEX written as an explicit model with no
//       hand-set numbers (hex.ts, docs/MODEL.md).
export const ENGINE_VERSION = '6.5';
/** The software people use. */
export const PRODUCT_NAME = 'HEX [PI]';
/** The engine it runs on (and the name of the hardware server). */
export const ENGINE_NAME = 'HEX6-BLE';
