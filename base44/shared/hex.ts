// ===========================================================================
// HEX — state-6.5. The engine as an explicit model, with no hand-set numbers.
// Reference: validation/hexcoupled.py, built on validation/hexmodel.py
// (parity test: tests/parity.mjs). The mathematics is in docs/MODEL.md.
//
//   lines     each step leaves one line per read. MOVE: did the value rise.
//             RANGE: was the change larger than the median of all earlier
//             changes.
//   pattern   the six-line state the evidence is filed under. Three are
//             read, because the two reads are coupled:
//               own    the read's own last six lines
//               other  the other read's last six lines
//               both   the last three lines of each
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
//   mixture   every choice is a family, not a number: the pattern, rho in
//             {0, 1/8, 1/4, 1/2}, kernel plain or odd, K in {16, 64, 256},
//             half-life in {64, 256, 1024, none}. The 288 candidates are
//             averaged with Bayesian weights from a uniform start, so the
//             cumulative log loss is within ln 288 of the best single
//             candidate on any series.
// HEX makes the call. The observer only supplies b.
// ===========================================================================

import { observe, ReadName, View } from './observer.ts';
import { applyStrength, Knots } from './isotonic.ts';
import type { Views } from './cycle.ts';

const S = 64;
const RHOS = [0, 0.125, 0.25, 0.5];
const SYMMETRIES = ['plain', 'odd'] as const;
const STRENGTHS = [16, 64, 256];
const HALF_LIVES: (number | null)[] = [64, 256, 1024, null];
const NKER = RHOS.length * SYMMETRIES.length, NH = HALF_LIVES.length, NK = STRENGTHS.length;
/** Candidates per pattern, patterns, and candidates in all. */
export const PER_PATTERN = NKER * NH * NK;
export const PATTERNS = ['own', 'other', 'both'] as const;
export const CANDIDATES = PER_PATTERN * PATTERNS.length;
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
 * What each reading of the state said on its own: the candidates grouped by
 * one choice at a time (how long state evidence is kept, how far it is shared
 * with neighbouring states, whether the mirror state counts as opposite, how
 * strongly a state is held to the baseline), each group's own weighted
 * probability and the share of trust it holds.
 */
const fraction = (v: number) => (v === 0 ? '0' : `1/${1 / v}`);
function readingsOf(P: Float64Array, w: Float64Array, patterns: number): View[] {
  const groups: { label: string; has: (g: number, ker: number, h: number, q: number) => boolean }[] = [
    ...(patterns > 1 ? PATTERNS.map((name, k) => ({ label: `pattern:${name}`, has: (g: number) => g === k })) : []),
    ...HALF_LIVES.map((hl, k) => ({ label: `evidence:${hl ?? 'all'}`, has: (_g: number, _ker: number, h: number) => h === k })),
    ...RHOS.map((rho, k) => ({ label: `sharing:${fraction(rho)}`, has: (_g: number, ker: number) => (ker >> 1) === k })),
    ...SYMMETRIES.map((sym, k) => ({ label: `mirror:${sym === 'odd' ? 'on' : 'off'}`, has: (_g: number, ker: number) => (ker & 1) === k })),
    ...STRENGTHS.map((K, k) => ({ label: `prior:${K}`, has: (_g: number, _ker: number, _h: number, q: number) => q === k })),
  ];
  return groups.map((grp) => {
    let num = 0, den = 0;
    for (let g = 0; g < patterns; g++) for (let ker = 0; ker < NKER; ker++) for (let h = 0; h < NH; h++) for (let q = 0; q < NK; q++) {
      if (!grp.has(g, ker, h, q)) continue;
      const e = g * PER_PATTERN + (ker * NH + h) * NK + q; num += w[e] * P[e]; den += w[e];
    }
    return { label: grp.label, p: den > 0 ? num / den : 0.5, w: den };
  });
}

/**
 * Walk one read forward. `baseline[i]` is the observer's baseline at step i
 * (NaN where it has none). steps: every call that already has an outcome.
 * final: the call for the step that has not happened.
 * `coupled = false` reads the read's own pattern only: state-6.4, kept so the
 * estimator can still be checked against its first reference.
 */
export function walkHex(returns: number[], read: ReadName, baseline: Float64Array, coupled = true): { steps: HexStep[]; final: { p: number; b: number; readings: View[] } | null; weights: Float64Array } {
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
  const rose = (j: number) => (returns[j] > 0 ? 1 : 0);
  const large = (j: number) => (!Number.isNaN(medBefore[j]) && a[j] > medBefore[j] ? 1 : 0);
  const six = (i: number, line: (j: number) => number) => { let s = 0; for (let j = i - 5; j <= i; j++) s = (s << 1) | line(j); return s; };
  const ownLine = read === 'MOVE' ? rose : large, otherLine = read === 'MOVE' ? large : rose;
  const G = coupled ? PATTERNS.length : 1, total = G * PER_PATTERN;
  const firstStep = coupled || read === 'RANGE' ? 26 : 12;

  const D = Array.from({ length: G }, () => HALF_LIVES.map(() => new Float64Array(S)));
  const N = Array.from({ length: G }, () => HALF_LIVES.map(() => new Float64Array(S)));
  const L = new Float64Array(total), P = new Float64Array(total), w = new Float64Array(total);
  const st = new Int32Array(G);
  const steps: HexStep[] = [];
  let final: { p: number; b: number; readings: View[] } | null = null;

  const weigh = () => { let m = -Infinity; for (let e = 0; e < total; e++) if (L[e] > m) m = L[e];
    let z = 0; for (let e = 0; e < total; e++) { w[e] = Math.exp(L[e] - m); z += w[e]; } for (let e = 0; e < total; e++) w[e] /= z; };

  for (let i = firstStep; i < n; i++) {
    const b = baseline[i];
    if (!Number.isFinite(b)) continue;
    st[0] = six(i, ownLine);
    if (coupled) { const other = six(i, otherLine); st[1] = other; st[2] = ((st[0] & 7) << 3) | (other & 7); }
    for (let g = 0; g < G; g++) for (let ker = 0; ker < NKER; ker++) {
      const row = KERNEL[ker][st[g]];
      for (let h = 0; h < NH; h++) {
        let num = 0, den = 0; const Dh = D[g][h], Nh = N[g][h];
        for (let j = 0; j < S; j++) { const k = row[j]; if (k !== 0) { num += k * Dh[j]; den += Math.abs(k) * Nh[j]; } }
        for (let q = 0; q < NK; q++) P[g * PER_PATTERN + (ker * NH + h) * NK + q] = clip(b + num / (den + STRENGTHS[q]));
      }
    }
    weigh();
    let p = 0; for (let e = 0; e < total; e++) p += w[e] * P[e];
    if (i === n - 1) { final = { p, b, readings: readingsOf(P, w, G) }; break; }
    if (read === 'RANGE' && Number.isNaN(med[i])) continue;
    const y = read === 'MOVE' ? (returns[i + 1] > 0 ? 1 : 0) : (a[i + 1] > med[i] ? 1 : 0);
    steps.push({ i, p, b, y });
    // learn only now that the outcome is known
    for (let e = 0; e < total; e++) L[e] += Math.log(y ? P[e] : 1 - P[e]);
    for (let g = 0; g < G; g++) for (let h = 0; h < NH; h++) { const f = DISCOUNT[h], Dh = D[g][h], Nh = N[g][h]; for (let j = 0; j < S; j++) { Dh[j] *= f; Nh[j] *= f; } Dh[st[g]] += y - b; Nh[st[g]] += 1; }
  }
  weigh();
  return { steps, final, weights: w };
}

/** What is stated for a call: HEX's own probability with its strength restated from the record. The side never changes. */
export const stated = (raw: number, map?: Knots | null) => Number(applyStrength(map, raw).toFixed(4));

/** One scored step: the raw probability and what happened. */
export interface ScoredStep { p: number; y: number }

export interface HexProbability {
  p_up: number; base_up: number;
  p_big_move: number; base_big: number;
  /** HEX's own probability before its strength is restated, and what each part of memory said. */
  views: { MOVE: Views; RANGE: Views };
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
  const om = observe(r, 'MOVE'), og = observe(r, 'RANGE');
  const mv = walkHex(r, 'MOVE', om.baseline), rg = walkHex(r, 'RANGE', og.baseline);
  if (!mv.final || !rg.final) return null;
  return {
    views: {
      MOVE: { baseline: mv.final.b, raw: mv.final.p, memories: om.memories, readings: mv.final.readings },
      RANGE: { baseline: rg.final.b, raw: rg.final.p, memories: og.memories, readings: rg.final.readings },
    },
    p_up: stated(mv.final.p, calibration?.MOVE), base_up: Number(mv.final.b.toFixed(4)),
    p_big_move: stated(rg.final.p, calibration?.RANGE), base_big: Number(rg.final.b.toFixed(4)),
    history: mv.steps.length,
    steps: { MOVE: mv.steps.map((s) => ({ p: s.p, y: s.y })), RANGE: rg.steps.map((s) => ({ p: s.p, y: s.y })) },
  };
}
