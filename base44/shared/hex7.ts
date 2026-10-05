// ===========================================================================
// HEX — version 7.0. Reference: validation/hex7core.py (parity test:
// tests/parity.mjs). The mathematics is written out in docs/MODEL.md.
//
//     logit p = logit q0 + beta . Z
//
//   q0     the null: what the series' own record already implies. It is the
//          observer's baseline (observer.ts): seven memories mixed by how well
//          each has predicted, plus the position rule for MOVE.
//   Z      where the present value sits among its surroundings: its midrank
//          among the last 2, 4, 8, 16, 32 and 64 values and among all values
//          so far, each mapped to (-1, 1). Two observables are ranked: the
//          level of the series and the size of its latest change. A read's
//          own observable gives 7 coordinates; the other gives 7 more.
//   beta   what HEX learns, online. Two residual models: own ranks (7
//          coefficients), and own with the other observable's ranks (14).
//          Each is a logistic regression updated one outcome at a time, run
//          at nine prior scales that are mixed by likelihood, so no learning
//          rate is set by hand. beta starts at zero: a new series starts at
//          the null.
//   call   the null and the two residual models are mixed. Influence is
//          reversible: after each outcome every expert's share is multiplied
//          by the probability it gave to what happened, and a small part of
//          all shares is then redistributed equally (fixed share), so an
//          expert that has fallen behind can come back. Five redistribution
//          rates run side by side (0 is the plain Bayesian mixture) and are
//          themselves mixed by likelihood.
//
// Order at every step: predict, then the outcome arrives, then learn. Nothing
// computed at step i uses anything after i.
// HEX makes the call. The null never does.
// ===========================================================================

import { observe, ReadName, View } from './observer.ts';
import { applyStrength, Knots } from './isotonic.ts';
import type { Views } from './cycle.ts';

export const WINDOWS = [2, 4, 8, 16, 32, 64];
/** Coordinates per observable: one per window, and one for all history. */
export const NZ = WINDOWS.length + 1;
const D = 2 * NZ;
/** Prior scales of the residual models: 1/16 ... 16. */
export const PRIOR_SCALES = [-4, -3, -2, -1, 0, 1, 2, 3, 4].map((k) => 2 ** k);
/** Share of influence redistributed after each outcome. 0 is the plain Bayesian mixture. */
export const SHARE_RATES = [0, 0.001, 0.005, 0.02, 0.05];
const FIRST = 26, MIN_MEDIAN = 20;
const T = PRIOR_SCALES.length;

const clip = (p: number) => Math.min(0.99, Math.max(0.01, p));
const logit = (p: number) => { const q = Math.min(Math.max(p, 1e-6), 1 - 1e-6); return Math.log(q / (1 - q)); };

/**
 * Z for every step: the midrank of v[i] among the last w values (w = 2 ... 64)
 * and among all values so far, as 2(rank - 1/2)/w - 1. A window that is not
 * full yet gives 0. Ties share the average of their positions. Values are
 * rounded to nine decimals first, so that a level returning exactly to an
 * earlier level ranks as a tie whatever the arithmetic that produced it.
 */
export function ranks(values: number[]): Float64Array[] {
  const v = values.map((x) => Math.floor(x * 1e9 + 0.5) / 1e9);
  const n = v.length, out: Float64Array[] = [];
  const sorted: number[] = [];
  for (let i = 0; i < n; i++) {
    const z = new Float64Array(NZ), x = v[i];
    for (let k = 0; k < WINDOWS.length; k++) {
      const w = WINDOWS[k];
      if (i < w - 1) continue;
      let less = 0, equal = 0;
      for (let j = i - w + 1; j <= i; j++) { if (v[j] < x) less++; else if (v[j] === x) equal++; }
      z[k] = 2 * (less + (equal + 1) / 2 - 0.5) / w - 1;
    }
    // all history: insert x, count values below it and equal to it
    let lo = 0, hi = sorted.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] < x) lo = m + 1; else hi = m; }
    let up = lo; while (up < sorted.length && sorted[up] === x) up++;
    sorted.splice(lo, 0, x);
    z[NZ - 1] = 2 * (lo + (up - lo + 2) / 2 - 0.5) / (i + 1) - 1;
    out.push(z);
  }
  return out;
}

/** A mixture with reversible influence: one fixed-share mixture per rate, the rates mixed by likelihood. */
class Share {
  w: Float64Array[]; ll: Float64Array; q: Float64Array; o: Float64Array;
  constructor(private n: number) {
    this.w = SHARE_RATES.map(() => new Float64Array(n).fill(1 / n));
    this.ll = new Float64Array(SHARE_RATES.length); this.q = new Float64Array(SHARE_RATES.length); this.o = new Float64Array(SHARE_RATES.length);
  }
  private outer() { let m = -Infinity; for (const v of this.ll) if (v > m) m = v; let z = 0; for (let a = 0; a < this.o.length; a++) { this.o[a] = Math.exp(this.ll[a] - m); z += this.o[a]; } for (let a = 0; a < this.o.length; a++) this.o[a] /= z; }
  predict(P: number[]): number {
    this.outer(); let p = 0;
    for (let a = 0; a < this.w.length; a++) { let q = 0; for (let e = 0; e < this.n; e++) q += this.w[a][e] * P[e]; this.q[a] = q; p += this.o[a] * q; }
    return p;
  }
  update(P: number[], y: number) {
    for (let a = 0; a < this.w.length; a++) {
      this.ll[a] += Math.log(y ? this.q[a] : 1 - this.q[a]);
      const w = this.w[a]; let z = 0;
      for (let e = 0; e < this.n; e++) { w[e] *= y ? P[e] : 1 - P[e]; z += w[e]; }
      for (let e = 0; e < this.n; e++) w[e] = (1 - SHARE_RATES[a]) * (w[e] / z) + SHARE_RATES[a] / this.n;
    }
  }
  /** Each expert's present share of the call. */
  influence(): number[] { this.outer(); return Array.from({ length: this.n }, (_, e) => this.w.reduce((s, w, a) => s + this.o[a] * w[e], 0)); }
}

/** One online logistic regression at nine prior scales, mixed by likelihood. */
class Residual {
  P: Float64Array[]; th: Float64Array[]; ll: Float64Array = new Float64Array(T); q: Float64Array = new Float64Array(T); x: Float64Array = new Float64Array(D);
  constructor() {
    this.P = PRIOR_SCALES.map((t) => { const m = new Float64Array(D * D); for (let i = 0; i < D; i++) m[i * D + i] = t; return m; });
    this.th = PRIOR_SCALES.map(() => new Float64Array(D));
  }
  mix(): Float64Array { let m = -Infinity; for (const v of this.ll) if (v > m) m = v; const w = new Float64Array(T); let z = 0; for (let t = 0; t < T; t++) { w[t] = Math.exp(this.ll[t] - m); z += w[t]; } for (let t = 0; t < T; t++) w[t] /= z; return w; }
  predict(x: Float64Array, offset: number): number {
    this.x = x; const w = this.mix(); let p = 0;
    for (let t = 0; t < T; t++) { let s = offset; const th = this.th[t]; for (let d = 0; d < D; d++) s += th[d] * x[d]; this.q[t] = clip(1 / (1 + Math.exp(-s))); p += w[t] * this.q[t]; }
    return p;
  }
  update(y: number) {
    const x = this.x, Px = new Float64Array(D);
    for (let t = 0; t < T; t++) {
      const q = this.q[t], P = this.P[t], th = this.th[t];
      this.ll[t] += Math.log(y ? q : 1 - q);
      const wt = q * (1 - q); let xPx = 0;
      for (let i = 0; i < D; i++) { let s = 0; for (let j = 0; j < D; j++) s += P[i * D + j] * x[j]; Px[i] = s; }
      for (let i = 0; i < D; i++) xPx += Px[i] * x[i];
      const k = wt / (1 + wt * xPx);
      for (let i = 0; i < D; i++) for (let j = 0; j < D; j++) P[i * D + j] -= k * Px[i] * Px[j];
      for (let i = 0; i < D; i++) { let s = 0; for (let j = 0; j < D; j++) s += P[i * D + j] * x[j]; th[i] += s * (y - q); }
    }
  }
  /** The coefficients in force: the prior scales' coefficients averaged by their weights. */
  beta(): number[] { const w = this.mix(); return Array.from({ length: D }, (_, d) => this.th.reduce((s, th, t) => s + w[t] * th[d], 0)); }
}

export interface Hex7Step { i: number; p: number; b: number; y: number; rank?: number; cross?: number; beta?: number[]; influence?: number[] }
export interface Hex7Final {
  p: number; b: number;
  /** The two residual models on their own. */
  rank: number; cross: number;
  /** beta of the second model: 7 own coefficients, then 7 for the other observable. */
  beta: number[];
  /** Present share of the call held by the null, the rank model and the rank + other model. */
  influence: number[];
}

/**
 * Walk one read forward, one pass. `baseline[i]` is the null at step i (NaN
 * where there is none). steps: every call that already has an outcome.
 * final: the call for the step that has not happened. `detail = true` keeps,
 * on every step, what the final call carries (the two models, the
 * coefficients, the influences), for replaying the cycle through time.
 */
export function walkHex7(returns: number[], read: ReadName, baseline: Float64Array, detail = false): { steps: Hex7Step[]; final: Hex7Final | null } {
  const n = returns.length, a = returns.map(Math.abs);
  const level: number[] = []; let acc = 0; for (let i = 0; i < n; i++) { acc += returns[i]; level.push(acc); }
  const med = new Float64Array(n).fill(NaN); const sorted: number[] = [];
  for (let j = 0; j < n; j++) {
    let lo = 0, hi = sorted.length; while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] < a[j]) lo = m + 1; else hi = m; }
    sorted.splice(lo, 0, a[j]);
    if (sorted.length >= MIN_MEDIAN) { const m = sorted.length; med[j] = m % 2 ? sorted[(m - 1) / 2] : (sorted[m / 2 - 1] + sorted[m / 2]) / 2; }
  }
  const Zown = ranks(read === 'MOVE' ? level : a), Zother = ranks(read === 'MOVE' ? a : level);
  const R = [new Residual(), new Residual()], A = new Share(3);
  const x0 = new Float64Array(D), x1 = new Float64Array(D);
  const steps: Hex7Step[] = []; let final: Hex7Final | null = null;
  for (let i = FIRST; i < n; i++) {
    if (read === 'RANGE' && Number.isNaN(med[i])) continue;
    const q0 = baseline[i];
    if (!Number.isFinite(q0)) continue;
    // predict
    for (let d = 0; d < NZ; d++) { x0[d] = Zown[i][d]; x1[d] = Zown[i][d]; x1[NZ + d] = Zother[i][d]; }
    const off = logit(q0), m0 = R[0].predict(x0, off), m1 = R[1].predict(x1, off), V = [q0, m0, m1], p = A.predict(V);
    if (i === n - 1) { final = { p, b: q0, rank: m0, cross: m1, beta: R[1].beta(), influence: A.influence() }; break; }
    // the outcome arrives; learn only now
    const y = read === 'MOVE' ? (returns[i + 1] > 0 ? 1 : 0) : (a[i + 1] > med[i] ? 1 : 0);
    steps.push(detail ? { i, p, b: q0, y, rank: m0, cross: m1, beta: R[1].beta(), influence: A.influence() } : { i, p, b: q0, y });
    R[0].update(y); R[1].update(y); A.update(V, y);
  }
  return { steps, final };
}

/** What is stated for a call: HEX's own probability with its strength restated from the record. The side never changes: rounding to four decimals may not carry a call across one half. */
export const stated = (raw: number, map?: Knots | null) => { const s = Number(applyStrength(map, raw).toFixed(4)); return raw < 0.5 && s >= 0.5 ? 0.4999 : s; };

/** One scored step: the engine's own probability and what happened. */
export interface ScoredStep { p: number; y: number }
export interface Hex7Probability {
  p_up: number; base_up: number;
  p_big_move: number; base_big: number;
  history: number;
  /** HEX's own probability before its strength is restated, and what each part of memory said. */
  views: { MOVE: Views; RANGE: Views };
  /** What was learned on this series: coefficients and present influence, per read. */
  learned: { MOVE: { beta: number[]; influence: number[] }; RANGE: { beta: number[]; influence: number[] } };
  /** Every scored step, for the nightly pooled strength map. */
  steps: { MOVE: ScoredStep[]; RANGE: ScoredStep[] };
}

/** Both reads for the next step. `calibration` is the strength map the nightly job fits across the tracked series (ledger.ts). */
export function hex7Probability(returns: number[], calibration?: { MOVE?: Knots | null; RANGE?: Knots | null }): Hex7Probability | null {
  const r = returns.filter((v) => Number.isFinite(v));
  if (r.length < 28) return null;
  const om = observe(r, 'MOVE'), og = observe(r, 'RANGE');
  const mv = walkHex7(r, 'MOVE', om.baseline), rg = walkHex7(r, 'RANGE', og.baseline);
  if (!mv.final || !rg.final) return null;
  const readings = (f: Hex7Final): View[] => [{ label: 'ranks', p: f.rank, w: f.influence[1] }, { label: 'ranks+other', p: f.cross, w: f.influence[2] }];
  return {
    p_up: stated(mv.final.p, calibration?.MOVE), base_up: Number(mv.final.b.toFixed(4)),
    p_big_move: stated(rg.final.p, calibration?.RANGE), base_big: Number(rg.final.b.toFixed(4)),
    history: mv.steps.length,
    views: {
      MOVE: { baseline: mv.final.b, raw: mv.final.p, memories: om.memories, readings: readings(mv.final) },
      RANGE: { baseline: rg.final.b, raw: rg.final.p, memories: og.memories, readings: readings(rg.final) },
    },
    learned: { MOVE: { beta: mv.final.beta, influence: mv.final.influence }, RANGE: { beta: rg.final.beta, influence: rg.final.influence } },
    steps: { MOVE: mv.steps.map((s) => ({ p: s.p, y: s.y })), RANGE: rg.steps.map((s) => ({ p: s.p, y: s.y })) },
  };
}
