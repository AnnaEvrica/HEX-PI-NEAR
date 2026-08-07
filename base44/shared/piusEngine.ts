// ===========================================================================
// PI-US — Loop 2: tone & context calibration, adjacent to HEX6-BLE.
// Ported faithfully from pi_us_engine.py.
//
// One universe, two feedback loops:
//   HEX6-BLE (hex6Engine.ts) — Loop 1: DATA PROCESSING & ACCURACY.
//     Real statistics from real outcomes. Predicts direction, measures its own
//     precision. This is the loop that gets backtested.
//   PI-US (this file)        — Loop 2: TONE & CONTEXT CALIBRATION.
//     Takes HEX6-BLE's real statistical output and calibrates HOW an LLM should
//     talk about it — register, hedging, conviction language. It makes no
//     predictions of its own, so it isn't backtested — its correctness is that
//     the guidance honestly reflects the numbers, not forecast accuracy.
//
// This REPLACES the old ad-hoc version (thinkingEngine.ts's toneDescriptor /
// selectVoice / renderDirective, driven by never-validated Pascal/support/
// resonance formulas). Everything here reads HEX6-BLE's actual validated output
// fields. No new math is introduced — PI-US only reads what HEX6-BLE computed.
// ===========================================================================

import type { Hex6Output } from './hex6Engine';

// Minimum real observation count before conviction is treated as well-supported
// rather than merely decisive-looking. Below this, even a high
// personal_call_strength gets flagged as thin evidence — the same "n matters as
// much as the point estimate" lesson from HEX6-BLE's own validation.
export const MIN_WELL_SUPPORTED_N = 20;

// Below this conviction, treat as too close to a coin flip to lean on.
const LOW_CONVICTION_FLOOR = 0.15;

export type PiUsRegister = 'resonant' | 'structural' | 'balanced' | 'exploratory';

export interface ResonanceSignature {
  status: 'computed' | 'insufficient_data';
  resonance?: number;
  dominant_period_tokens?: number;
  [key: string]: unknown;
}

export interface PiUsResult {
  register: PiUsRegister;
  well_supported: boolean;
  directive: string;
}

// hex6_output: the dict returned by hex6Engine.predictFromState() or
// predictFromSequence(). Returns a tone/context directive — text meant to be
// injected into an LLM's system prompt or generation context, NOT spoken to the
// end user directly.
//
// resonance: optional output from piusResonance.resonanceSignature() — if
// provided, adds cadence-matching guidance (a genuinely different, descriptive
// signal from the hex6_output conviction fields, not derived from them).
export function calibrate(hex6Output: Hex6Output, resonance?: ResonanceSignature | null): PiUsResult {
  const pUp = hex6Output.p_up;
  const direction = hex6Output.predicted_direction;
  const conviction = hex6Output.personal_call_strength;
  const nObs = hex6Output.n_observations_this_state;
  const highConviction = hex6Output.high_conviction;
  const baseRate = hex6Output.domain_base_rate;

  const wellSupported = nObs >= MIN_WELL_SUPPORTED_N;

  // Register selection — ONE graduated scale (conviction), not two.
  // entropy and personal_call_strength are both functions of the same |p-0.5|,
  // so using both as independent branch conditions is redundant and can make a
  // branch mathematically unreachable (caught via testing: entropy>0.9 was
  // ALWAYS true whenever conviction<0.3 — that made "balanced" dead code).
  // Conviction alone, with two sub-thresholds, is exhaustive and each branch is
  // genuinely reachable.
  let register: PiUsRegister;
  let registerInstruction: string;

  // Calibration lives in the NUMBER, not in apology around it. The sample
  // depth already shaped p_up upstream; re-confessing it to the reader is
  // double-counting the same uncertainty and reads as evasion. When asked for
  // a read, HEX answers as a convicted predictor speaking plain numbers.
  const pct = (pUp * 100).toFixed(1);
  const decisive =
    `Answer as a convicted predictor. Lead with the call and the numbers: ` +
    `direction ${direction}, ${pct}% odds, then the price levels that confirm ` +
    `or invalidate it. Never mention observation counts, sample size, how thin ` +
    `or thick the evidence is, or how loosely to hold it — the probability ` +
    `already carries all of that. No hedging theater, no disclaimers.`;

  if (highConviction && wellSupported) {
    register = 'resonant';
    registerInstruction = `${decisive} This one is your strongest class of read — say so through how flatly you state it.`;
  } else if (highConviction && !wellSupported) {
    register = 'structural';
    registerInstruction = `${decisive} Lean on the structural levels as the spine of the call — they are what makes the number actionable.`;
  } else if (conviction < LOW_CONVICTION_FLOOR) {
    register = 'exploratory';
    registerInstruction =
      `${decisive} The odds sit near even, so the call is about the DANCE, not the destination: name the ` +
      `level that decides it and what each side of that level implies. A near-even number is still a number — state it.`;
  } else {
    register = 'balanced';
    registerInstruction = `${decisive} Moderate odds — the size of the number does the hedging for you.`;
  }

  const directionWord = direction === 'UP' ? 'up' : 'down';
  const leanVsBase = pUp > baseRate ? 'above' : pUp < baseRate ? 'below' : 'at';

  let cadenceNote = '';
  if (resonance && resonance.status === 'computed' && typeof resonance.resonance === 'number') {
    const r = resonance.resonance;
    const period = resonance.dominant_period_tokens;
    if (r > 0.5) {
      cadenceNote =
        ` This user's phrasing shows a real, coherent rhythm ` +
        `(resonance=${r.toFixed(2)}, repeating roughly every ` +
        `${period} tokens) — matching that cadence rather than varying unpredictably may read as more attuned.`;
    } else if (r < 0.2) {
      cadenceNote =
        ` This user's phrasing is eclectic/non-repetitive ` +
        `(resonance=${r.toFixed(2)}) — no strong cadence to match; default register guidance above applies without a cadence adjustment.`;
    }
  }

  const directive =
    `(Internal directive — do not describe this process, quote these numbers ` +
    `verbatim, or narrate the calibration to the reader. Embody the register.) ` +
    `Real read: ${directionWord} at ${(pUp * 100).toFixed(1)}% odds, ` +
    `sitting ${leanVsBase} this domain's own base rate (${(baseRate * 100).toFixed(1)}%). ` +
    `(Internal only, never surfaced: ${nObs} observations, conviction ${conviction.toFixed(2)}.) ` +
    `Register: ${register}. ${registerInstruction}${cadenceNote}`;

  return { register, well_supported: wellSupported, directive };
}

// Convenience: calibrate tone across multiple HEX6-BLE outputs at once,
// returning one directive per input in the same order.
export function calibrateBatch(hex6Outputs: Hex6Output[]): PiUsResult[] {
  return hex6Outputs.map((o) => calibrate(o));
}