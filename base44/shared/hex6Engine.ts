// ===========================================================================
// HEX6-BLE ENGINE — Loop 1: data processing & accuracy.
// Pre-trained, self-contained, market-agnostic. Ported faithfully from
// hex6_ble_engine.py. Four frozen TRAINED_TABLES (NFL / BTC / HORSE_RACING /
// WEATHER) trained on full real history — no external data, no training step.
//
// This is the loop that gets backtested. It makes real predictions from real
// outcome counts via Bayesian shrinkage. PI-US (piusEngine.ts) reads only the
// fields this file emits — two adjacent feedback loops, not one merged loop.
//
// Full methodology in the README. This file is code; the README is the record.
// ===========================================================================

// Frozen, pre-trained state tables. up[s]/down[s] = real observed outcome
// counts for hexagram state s (0-63), from each domain's real event history.
export const TRAINED_TABLES: Record<string, { up: number[]; down: number[] }> = {
  NFL: {
    up:   [18, 19, 0, 16, 4, 1, 4, 16, 3, 5, 0, 1, 4, 4, 2, 21, 2, 3, 0, 3, 0, 0, 0, 1, 3, 4, 0, 3, 4, 3, 1, 21, 5, 9, 1, 8, 3, 0, 2, 8, 0, 2, 0, 0, 1, 2, 0, 8, 11, 10, 0, 8, 2, 0, 2, 9, 11, 7, 0, 7, 7, 7, 8, 58],
    down: [43, 5, 9, 12, 8, 0, 11, 8, 8, 2, 0, 0, 12, 0, 9, 4, 8, 0, 2, 2, 0, 0, 0, 0, 11, 1, 0, 3, 8, 1, 6, 10, 21, 4, 3, 5, 5, 0, 6, 3, 1, 0, 0, 0, 2, 0, 2, 2, 18, 4, 6, 4, 0, 0, 3, 2, 18, 3, 2, 3, 20, 1, 23, 21],
  },
  BTC: {
    up:   [4, 7, 2, 7, 5, 6, 5, 5, 2, 5, 0, 5, 7, 4, 3, 11, 2, 2, 1, 4, 0, 0, 0, 3, 3, 11, 0, 3, 5, 3, 4, 11, 7, 7, 4, 4, 1, 1, 5, 12, 4, 4, 0, 0, 5, 1, 3, 7, 6, 6, 0, 14, 5, 0, 1, 8, 9, 12, 1, 8, 8, 10, 9, 91],
    down: [3, 4, 3, 7, 4, 0, 6, 6, 4, 1, 0, 2, 7, 6, 9, 6, 5, 4, 1, 5, 1, 0, 2, 2, 7, 1, 6, 2, 6, 3, 6, 7, 4, 1, 6, 4, 2, 0, 8, 6, 3, 1, 1, 0, 3, 0, 2, 4, 6, 6, 2, 8, 6, 1, 6, 3, 5, 1, 5, 5, 8, 3, 10, 12],
  },
  HORSE_RACING: {
    up:   [44, 32, 5, 25, 14, 6, 10, 24, 10, 8, 1, 4, 10, 13, 3, 45, 10, 6, 1, 8, 3, 1, 1, 2, 12, 11, 0, 12, 10, 9, 3, 49, 17, 19, 2, 10, 7, 2, 4, 30, 2, 2, 0, 2, 4, 4, 4, 20, 15, 15, 2, 36, 0, 1, 3, 23, 14, 34, 3, 21, 32, 21, 22, 258],
    down: [220, 29, 30, 27, 31, 1, 27, 10, 34, 12, 1, 3, 24, 2, 22, 8, 24, 6, 12, 3, 0, 0, 3, 4, 24, 3, 2, 5, 22, 0, 11, 19, 48, 6, 15, 9, 15, 1, 8, 14, 1, 1, 2, 0, 12, 0, 9, 6, 39, 11, 9, 8, 3, 2, 12, 9, 33, 8, 1, 10, 23, 4, 44, 49],
  },
  WEATHER: {
    up:   [45, 43, 11, 24, 24, 6, 27, 29, 27, 36, 2, 4, 43, 42, 25, 51, 29, 20, 2, 26, 6, 2, 11, 9, 31, 48, 6, 47, 33, 37, 35, 54, 28, 37, 4, 29, 31, 8, 30, 58, 8, 14, 1, 7, 25, 37, 23, 46, 30, 37, 9, 63, 18, 14, 34, 73, 26, 73, 11, 68, 57, 62, 43, 107],
    down: [73, 30, 41, 56, 48, 9, 56, 24, 45, 19, 10, 10, 65, 15, 31, 36, 30, 15, 27, 24, 7, 1, 8, 2, 46, 20, 17, 32, 19, 11, 37, 43, 45, 22, 31, 28, 24, 3, 52, 32, 14, 10, 3, 9, 12, 8, 21, 36, 43, 20, 28, 58, 15, 3, 29, 42, 27, 17, 16, 31, 34, 16, 54, 54],
  },
};

// k_ratio: shrinkage strength as a RATIO (not a fixed constant), scaled to the
// average per-state sample count in that domain's own training data.
export const K_RATIO = 0.15;
export const CONFIDENCE_CUTOFF_DEFAULT = 0.3; // matches the validated "+confidence" setting

export interface Hex6Output {
  domain: string;
  state: number;
  p_up: number;
  predicted_direction: 'UP' | 'DOWN';
  entropy: number;
  personal_call_strength: number;
  n_observations_this_state: number;
  high_conviction: boolean;
  domain_base_rate: number;
  encoded_from_bits?: number[];
}

// --- Core math — domain-agnostic. Same functions regardless of the domain. ---

export function binaryEntropy(p: number): number {
  if (p <= 0 || p >= 1) return 0;
  return -(p * Math.log2(p) + (1 - p) * Math.log2(1 - p));
}

// Bayesian shrinkage: pull toward the domain base rate in proportion to how
// little data a state has. No state is ever thrown away — thin states default
// toward the population prior.
export function shrunkPUp(up: number, down: number, baseRate: number, k: number): number {
  return (up + k * baseRate) / (up + down + k);
}

// bits6: 6 values of 0/1, oldest to newest -> integer state 0-63.
export function encodeState(bits6: number[]): number {
  return parseInt(bits6.map((b) => String(b)).join(''), 2);
}

// Turns a sequence of raw numeric values into up/down bits (1 if this value is
// higher than the previous one, 0 otherwise) — the same momentum-bit logic used
// to build the trained tables. Needs at least 7 values (6 transitions).
export function valuesToBits(recentValues: number[]): number[] {
  const vals = recentValues.slice(-7);
  if (vals.length < 7) throw new Error('Need at least 7 recent values to encode a 6-bit state.');
  const bits: number[] = [];
  for (let i = 1; i < 7; i++) bits.push(vals[i] > vals[i - 1] ? 1 : 0);
  return bits;
}

function domainStats(domain: string) {
  const table = TRAINED_TABLES[domain];
  if (!table) throw new Error(`Unknown domain '${domain}'. Available: ${Object.keys(TRAINED_TABLES).join(', ')}`);
  const up = table.up;
  const down = table.down;
  const upSum = up.reduce((s, x) => s + x, 0);
  const downSum = down.reduce((s, x) => s + x, 0);
  const baseRate = upSum / (upSum + downSum);
  let nStatesSeen = 0;
  for (let i = 0; i < 64; i++) if (up[i] + down[i] > 0) nStatesSeen++;
  nStatesSeen = Math.max(1, nStatesSeen);
  const totalN = upSum + downSum;
  const k = Math.max(1, K_RATIO * (totalN / nStatesSeen));
  return { up, down, baseRate, k };
}

// Core prediction call. state: int 0-63.
export function predictFromState(
  domain: string,
  state: number,
  confidenceCutoff: number = CONFIDENCE_CUTOFF_DEFAULT
): Hex6Output {
  const { up, down, baseRate, k } = domainStats(domain);
  const nObs = up[state] + down[state];
  const p = shrunkPUp(up[state], down[state], baseRate, k);
  const entropy = binaryEntropy(p);
  const personalCall = Math.abs(p - 0.5) * 2; // conviction, embedding entropy implicitly
  // NOTE: without a live calibration pass (streaming outcome data to check
  // precision against), confidence here uses personal_call alone — the
  // validated version additionally balances this against a causally-tracked
  // precision record. The live-precision half accumulates over time via the
  // existing CognitiveState outcome-resolution flow; not meaningful to freeze.
  return {
    domain,
    state,
    p_up: round(p),
    predicted_direction: p > 0.5 ? 'UP' : 'DOWN',
    entropy: round(entropy),
    personal_call_strength: round(personalCall),
    n_observations_this_state: nObs,
    high_conviction: personalCall >= confidenceCutoff,
    domain_base_rate: round(baseRate),
  };
}

// Convenience wrapper: raw recent values -> state -> prediction.
export function predictFromSequence(
  domain: string,
  recentValues: number[],
  confidenceCutoff: number = CONFIDENCE_CUTOFF_DEFAULT
): Hex6Output {
  const bits6 = valuesToBits(recentValues);
  const state = encodeState(bits6);
  const result = predictFromState(domain, state, confidenceCutoff);
  result.encoded_from_bits = bits6;
  return result;
}

function round(x: number): number {
  return Math.round(x * 10000) / 10000;
}