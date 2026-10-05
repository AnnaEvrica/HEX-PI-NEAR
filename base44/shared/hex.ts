// ===========================================================================
// HEX — state-6.4. The engine as an explicit model, with no hand-set numbers.
// Reference: validation/hexmodel.py (parity test: tests/parity.mjs).
// The mathematics is written out in docs/MODEL.md.
//
//   state     s: the six-line pattern of the last six steps, one of 64.
//             MOVE lines: did the value rise. RANGE lines: was the change
//             larger than the median of all earlier changes.
//   model     the next outcome is Bernoulli with probability b + delta_s,
//             where b is the observer's baseline (observer.ts).
//   estimate  a Beta-Bernoulli posterior mean under a local likelihood on the
//             6-cube: evidence seen in state j counts toward state s with
//             weight k(s,j), and older evidence is discounted.
//               p = b + sum_j k(s,j) D_j / ( sum_j |k(s,j)| N_j + K )
//             D_j: discounted sum of (y - b) seen in state j. N_j: discounted
//             count. K: strength of the prior that delta_s is zero.
//   kernel    the diffusion kernel of the cube, rho^d, where d is the number
//             of lines in which s and j differ; or its odd part
//             rho^d - rho^(6-d), under which evidence in the mirror state
//             counts as opposite evidence.
//   mixture   every choice is a family, not a number: rho in {0, 1/8, 1/4,
//             1/2}, kernel plain or odd, K in {16, 64, 256}, half-life in
//             {64, 256, 1024, none}. The 96 candidates are averaged with
//             Bayesian weights from a uniform start, so the cumulative log
//             loss is within ln 96 of the best single candidate on any series.
// HEX makes the call. The observer only supplies b.
// ===========================================================================

import { observeBaseline, ReadName } from './observer.ts';
import { applyStrength, Knots } from './isotonic.ts';

const S = 64;
const RHOS = [0, 0.125, 0.25, 0.5];
const SYMMETRIES = ['plain', 'odd'] as const;
const STRENGTHS = [16, 64, 256];
const HALF_LIVES: (number | null)[] = [64, 256, 1024, null];
const NKER = RHOS.length * SYMMETRIES.length, NH = HALF_LIVES.length, NK = STRENGTHS.length;
export const CANDIDATES = NKER * NH * NK;
const MIN_MEDIAN = 20;

const clip = (p: number) => Math.min(0.99, Math.max(0.01, p));
const bits = (v: number) => { let c = 0; while (v) { c += v & 1; v >>= 1; } return c; };

// KERNEL[ker][s][j], ker = rho index * 2 + (odd ? 1 : 0)
const KERNEL: Float64Array[][] = [];
for (const rho of RHOS) for (const sym of SYMMETRIES) {
  const rows: Float64Array[] = [];
  for (let s = 0; s < S; s++) {
    const row = new Float64Array(S);
    for (let j = 0; j < S; j++) {
      const d = bits(s ^ j);
      let k = d === 0 ? 1 : (rho > 0 ? rho ** d : 0);
      if (sym === 'odd') k -= d === 6 ? 1 : (rho > 0 ? rho ** (6 - d) : 0);
      row[j] = k;
    }
    rows.push(row);
  }
  KERNEL.push(rows);
}
const DISCOUNT = HALF_LIVES.map((h) => (h === null ? 1 : 0.5 ** (1 / h)));

export interface HexStep { i: number; p: number; b: number; y: number }

/**
 * Walk one read forward. `baseline[i]` is the observer's baseline at step i
 * (NaN where it has none). steps: every call that already has an outcome.
 * final: the call for the step that has not happened.
 */
export function walkHex(returns: number[], read: ReadName, baseline: Float64Array): { steps: HexStep[]; final: { p: number; b: number } | null; weights: Float64Array } {
  const n = returns.length;
  const a = returns.map(Math.abs);
  // median of |change| over steps before j, and through j
  const medBefore = new Float64Array(n).fill(NaN), med = new Float64Array(n).fill(NaN);
  const sorted: number[] = [];
  const median = () => { const m = sorted.length; return m % 2 ? sorted[(m - 1) / 2] : (sorted[m / 2 - 1] + sorted[m / 2]) / 2; };
  for (let j = 0; j < n; j++) {
    if (sorted.length >= MIN_MEDIAN) medBefore[j] = median();
    let lo = 0, hi = sorted.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid] < a[j]) lo = mid + 1; else hi = mid; }
    sorted.splice(lo, 0, a[j]);
    if (sorted.length >= MIN_MEDIAN) med[j] = median();
  }
  const line = read === 'MOVE'
    ? (j: number) => (returns[j] > 0 ? 1 : 0)
    : (j: number) => (!Number.isNaN(medBefore[j]) && a[j] > medBefore[j] ? 1 : 0);
  const stateAt = (i: number) => { let s = 0; for (let j = i - 5; j <= i; j++) s = (s << 1) | line(j); return s; };
  const firstStep = read === 'MOVE' ? 12 : 26;

  const D = HALF_LIVES.map(() => new Float64Array(S)), N = HALF_LIVES.map(() => new Float64Array(S));
  const L = new Float64Array(CANDIDATES), P = new Float64Array(CANDIDATES), w = new Float64Array(CANDIDATES);
  const steps: HexStep[] = [];
  let final: { p: number; b: number } | null = null;

  const weigh = () => { let m = -Infinity; for (let e = 0; e < CANDIDATES; e++) if (L[e] > m) m = L[e];
    let z = 0; for (let e = 0; e < CANDIDATES; e++) { w[e] = Math.exp(L[e] - m); z += w[e]; } for (let e = 0; e < CANDIDATES; e++) w[e] /= z; };

  for (let i = firstStep; i < n; i++) {
    const b = baseline[i];
    if (!Number.isFinite(b)) continue;
    const s = stateAt(i);
    for (let ker = 0; ker < NKER; ker++) {
      const row = KERNEL[ker][s];
      for (let h = 0; h < NH; h++) {
        let num = 0, den = 0; const Dh = D[h], Nh = N[h];
        for (let j = 0; j < S; j++) { const k = row[j]; if (k !== 0) { num += k * Dh[j]; den += Math.abs(k) * Nh[j]; } }
        for (let q = 0; q < NK; q++) P[(ker * NH + h) * NK + q] = clip(b + num / (den + STRENGTHS[q]));
      }
    }
    weigh();
    let p = 0; for (let e = 0; e < CANDIDATES; e++) p += w[e] * P[e];
    if (i === n - 1) { final = { p, b }; break; }
    if (read === 'RANGE' && Number.isNaN(med[i])) continue;
    const y = read === 'MOVE' ? (returns[i + 1] > 0 ? 1 : 0) : (a[i + 1] > med[i] ? 1 : 0);
    steps.push({ i, p, b, y });
    // learn only now that the outcome is known
    for (let e = 0; e < CANDIDATES; e++) L[e] += Math.log(y ? P[e] : 1 - P[e]);
    for (let h = 0; h < NH; h++) { const g = DISCOUNT[h], Dh = D[h], Nh = N[h]; for (let j = 0; j < S; j++) { Dh[j] *= g; Nh[j] *= g; } Dh[s] += y - b; Nh[s] += 1; }
  }
  weigh();
  return { steps, final, weights: w };
}

/** One scored step: the raw probability and what happened. */
export interface ScoredStep { p: number; y: number }

export interface HexProbability {
  p_up: number; base_up: number;
  p_big_move: number; base_big: number;
  history: number;
  /** Every scored step, for the nightly pooled calibration. */
  steps: { MOVE: ScoredStep[]; RANGE: ScoredStep[] };
}

/**
 * Both reads for the next step. `calibration` is the map the nightly job fits
 * across every tracked series (ledger.ts). A map pooled across series tested
 * better than one fitted on the series alone, so none is fitted here.
 */
export function hexProbability(returns: number[], calibration?: { MOVE?: Knots | null; RANGE?: Knots | null }): HexProbability | null {
  const r = returns.filter((v) => Number.isFinite(v));
  if (r.length < 28) return null;
  const mv = walkHex(r, 'MOVE', observeBaseline(r, 'MOVE')), rg = walkHex(r, 'RANGE', observeBaseline(r, 'RANGE'));
  if (!mv.final || !rg.final) return null;
  return {
    p_up: Number(applyStrength(calibration?.MOVE, mv.final.p).toFixed(4)), base_up: Number(mv.final.b.toFixed(4)),
    p_big_move: Number(applyStrength(calibration?.RANGE, rg.final.p).toFixed(4)), base_big: Number(rg.final.b.toFixed(4)),
    history: mv.steps.length,
    steps: { MOVE: mv.steps.map((s) => ({ p: s.p, y: s.y })), RANGE: rg.steps.map((s) => ({ p: s.p, y: s.y })) },
  };
}
