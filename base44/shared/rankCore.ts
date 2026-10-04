// ===========================================================================
// rank-1 — the rank core. Reference: validation/rankcore.py (parity test:
// tests/parity.mjs).
//
// For one read of one series, at every step:
//   null   what the series' recent history and present position already
//          imply: a likelihood-weighted mixture of base rates at dyadic
//          memories (half-lives 32..1024 steps, and none). MOVE adds the
//          exchangeable rank rule (g+1)/(n+1).
//   core   logit p = logit null + beta . z, where z holds twelve centred
//          ranks of the present value: within its last 2..64 values and all
//          of them, and of block means over 2..32 steps against all history.
//          beta is learned online; nine prior scales run side by side and are
//          weighted by how well each has predicted this series.
//   gate   three candidates compete, weighted the same way: the null, the
//          core offset by the null, and the same core offset by the plain
//          (no-forgetting) base rate. A core that has earned nothing returns
//          the null.
// Every quantity at step i uses the series up to step i only, and learning
// happens only after the outcome is known.
//
// Reads:  MOVE   the next value is higher than this one
//         RANGE  the next change is larger than the median of earlier changes
// ===========================================================================

import { applyKnots, Knots } from './isotonic.ts';

export type RankRead = 'MOVE' | 'RANGE';
export interface RankStep { i: number; y: number; base: number; null: number; core: number; p: number }
export interface RankFinal { base: number; null: number; core: number; p: number }

const WINS = [2, 4, 8, 16, 32, 64];
const BLOCKS = [1, 2, 3, 4, 5];
const ND = WINS.length + 1 + BLOCKS.length;
const TAUS = [-4, -3, -2, -1, 0, 1, 2, 3, 4].map((k) => 2 ** k);
const NT = TAUS.length;
const HALF_LIVES: (number | null)[] = [32, 64, 128, 256, 512, 1024, null];
const FIRST = 26;
const MIN_MEDIAN = 20;

const clip = (p: number) => Math.min(0.99, Math.max(0.01, p));
const logit = (p: number) => { const q = Math.min(Math.max(p, 1e-6), 1 - 1e-6); return Math.log(q / (1 - q)); };

/** Average rank of v among xs[from..to] (inclusive), ties sharing the mean rank. */
function avgRank(xs: Float64Array | number[], from: number, to: number, v: number): number {
  let less = 0, equal = 0;
  for (let j = from; j <= to; j++) { if (xs[j] < v) less++; else if (xs[j] === v) equal++; }
  return less + (equal + 1) / 2;
}

/** A sorted list supporting "insert v and return its average rank among everything inserted so far". */
class Ranker {
  private s: number[] = [];
  /** Returns { avg, max }: average rank (ties share) and the count of values <= v, both after inserting v. */
  push(v: number): { avg: number; max: number } {
    const s = this.s;
    let lo = 0, hi = s.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (s[m] < v) lo = m + 1; else hi = m; }
    let up = lo, top = s.length;
    while (up < top) { const m = (up + top) >> 1; if (s[m] <= v) up = m + 1; else top = m; }
    s.splice(lo, 0, v);
    const equal = up - lo + 1; // including v
    return { avg: lo + (equal + 1) / 2, max: lo + equal };
  }
  get size() { return this.s.length; }
  median(): number { const s = this.s, m = s.length; return m % 2 ? s[(m - 1) / 2] : (s[m / 2 - 1] + s[m / 2]) / 2; }
}

/** Twelve centred ranks per step, each in [-1, 1]; zero until its window is full. */
function rankFeatures(v: Float64Array): { F: Float64Array[]; rankMax: Float64Array } {
  const n = v.length;
  const F: Float64Array[] = Array.from({ length: n }, () => new Float64Array(ND));
  const rankMax = new Float64Array(n);
  const all = new Ranker();
  // sequential cumulative sum; block means are differences of it
  const c = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) c[i + 1] = c[i] + v[i];
  const blockRankers = BLOCKS.map(() => new Ranker());
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < WINS.length; k++) {
      const w = WINS[k];
      if (i >= w - 1) F[i][k] = 2 * (avgRank(v, i - w + 1, i, v[i]) - 0.5) / w - 1;
    }
    const r = all.push(v[i]);
    F[i][WINS.length] = 2 * (r.avg - 0.5) / (i + 1) - 1;
    rankMax[i] = r.max;
    for (let k = 0; k < BLOCKS.length; k++) {
      const w = 2 ** BLOCKS[k];
      if (i >= w - 1) {
        const m = (c[i + 1] - c[i + 1 - w]) / w;
        const rk = blockRankers[k].push(m);
        F[i][WINS.length + 1 + k] = 2 * (rk.avg - 0.5) / blockRankers[k].size - 1;
      }
    }
  }
  return { F, rankMax };
}

/** Online logistic regression: one copy per prior scale, mixed by likelihood. */
class Core {
  private P: Float64Array[] = [];   // NT matrices, d*d, row-major
  private th: Float64Array[] = [];
  private ll = new Float64Array(NT);
  private q = new Float64Array(NT);
  constructor(private d: number) {
    for (let t = 0; t < NT; t++) {
      const P = new Float64Array(d * d);
      for (let j = 0; j < d; j++) P[j * d + j] = TAUS[t];
      this.P.push(P); this.th.push(new Float64Array(d));
    }
  }
  predict(x: Float64Array, off: number): number {
    let m = -Infinity;
    for (let t = 0; t < NT; t++) {
      let z = off; const th = this.th[t];
      for (let j = 0; j < this.d; j++) z += th[j] * x[j];
      this.q[t] = clip(1 / (1 + Math.exp(-z)));
      if (this.ll[t] > m) m = this.ll[t];
    }
    let num = 0, den = 0;
    for (let t = 0; t < NT; t++) { const w = Math.exp(this.ll[t] - m); num += w * this.q[t]; den += w; }
    return num / den;
  }
  update(x: Float64Array, y: number): void {
    const d = this.d, Px = new Float64Array(d);
    for (let t = 0; t < NT; t++) {
      const q = this.q[t], P = this.P[t], th = this.th[t];
      this.ll[t] += Math.log(y ? q : 1 - q);
      const wt = q * (1 - q);
      let xPx = 0;
      for (let a = 0; a < d; a++) { let s = 0; for (let b = 0; b < d; b++) s += P[a * d + b] * x[b]; Px[a] = s; }
      for (let a = 0; a < d; a++) xPx += Px[a] * x[a];
      const f = wt / (1 + wt * xPx);
      for (let a = 0; a < d; a++) for (let b = 0; b < d; b++) P[a * d + b] -= f * Px[a] * Px[b];
      // theta += (P_new x) (y - q)
      for (let a = 0; a < d; a++) { let s = 0; for (let b = 0; b < d; b++) s += P[a * d + b] * x[b]; th[a] += s * (y - q); }
    }
  }
}

function mix(ll: Float64Array | number[], v: Float64Array | number[]): number {
  let m = -Infinity;
  for (let k = 0; k < ll.length; k++) if (ll[k] > m) m = ll[k];
  let num = 0, den = 0;
  for (let k = 0; k < ll.length; k++) { const w = Math.exp(ll[k] - m); num += w * v[k]; den += w; }
  return num / den;
}

/**
 * Walk one read forward over a series of step-to-step changes.
 * steps: every call that already has an outcome. final: the call for the
 * step after the last one (null when the series is too short).
 */
export function walkRank(returns: number[], read: RankRead): { steps: RankStep[]; final: RankFinal | null } {
  const n = returns.length;
  const r = Float64Array.from(returns);
  const x = new Float64Array(n), a = new Float64Array(n);
  let acc = 0;
  for (let i = 0; i < n; i++) { acc += r[i]; x[i] = acc; a[i] = Math.abs(r[i]); }
  const { F, rankMax } = rankFeatures(read === 'MOVE' ? x : a);
  // expanding median of |change| through step i (needs MIN_MEDIAN values)
  const med = new Float64Array(n).fill(NaN);
  if (read === 'RANGE') { const s = new Ranker(); for (let i = 0; i < n; i++) { s.push(a[i]); if (s.size >= MIN_MEDIAN) med[i] = s.median(); } }

  const H = HALF_LIVES.length;
  const rho = HALF_LIVES.map((h) => (h === null ? 1 : 0.5 ** (1 / h)));
  const U = new Float64Array(H), N = new Float64Array(H);
  const ne = H + (read === 'MOVE' ? 1 : 0);
  const lln = new Float64Array(ne), ex = new Float64Array(ne), llg = new Float64Array(3);
  const core = new Core(ND), corePlain = new Core(ND);
  const steps: RankStep[] = [];
  let final: RankFinal | null = null;

  for (let i = FIRST; i < n; i++) {
    if (read === 'RANGE' && Number.isNaN(med[i])) continue;
    for (let h = 0; h < H; h++) ex[h] = clip((U[h] + 1) / (N[h] + 2));
    const base = ex[H - 1];
    if (read === 'MOVE') ex[H] = clip((i + 1 - rankMax[i] + 1) / (i + 2));
    const q0 = mix(lln, ex);
    const pc = core.predict(F[i], logit(q0));
    const pp = corePlain.predict(F[i], logit(base));
    const p = mix(llg, [q0, pc, pp]);
    if (i === n - 1) { final = { base, null: q0, core: pc, p }; break; }
    const y = read === 'MOVE' ? (r[i + 1] > 0 ? 1 : 0) : (a[i + 1] > med[i] ? 1 : 0);
    steps.push({ i, y, base, null: q0, core: pc, p });
    for (let k = 0; k < ne; k++) lln[k] += Math.log(y ? ex[k] : 1 - ex[k]);
    llg[0] += Math.log(y ? q0 : 1 - q0); llg[1] += Math.log(y ? pc : 1 - pc); llg[2] += Math.log(y ? pp : 1 - pp);
    core.update(F[i], y); corePlain.update(F[i], y);
    for (let h = 0; h < H; h++) { U[h] = rho[h] * U[h] + y; N[h] = rho[h] * N[h] + 1; }
  }
  return { steps, final };
}

export interface RankProbability {
  p_up: number; null_up: number;
  p_big_move: number; null_big: number;
  history: number;
  /** Log-loss gain of the gated core over its null on this series, per step (nats). Positive = structure found. */
  structure_up: number | null;
  structure_big: number | null;
  /** Every scored step, for the nightly pooled calibration. */
  steps: { MOVE: RankStep[]; RANGE: RankStep[] };
}

function structure(steps: RankStep[]): number | null {
  if (steps.length < 50) return null;
  let d = 0;
  for (const s of steps) d += Math.log(s.y ? s.p : 1 - s.p) - Math.log(s.y ? s.null : 1 - s.null);
  return Number((d / steps.length).toFixed(5));
}

/**
 * Both reads for the next step. `calibration` is the pooled map the nightly
 * job fits across every tracked series (shared/ledger.ts). In testing a map
 * pooled across series beat one fitted on the series alone, so no per-series
 * map is applied here.
 */
export function rankProbability(returns: number[], calibration?: { MOVE?: Knots | null; RANGE?: Knots | null }): RankProbability | null {
  const r = returns.filter((v) => Number.isFinite(v));
  if (r.length < FIRST + 2) return null;
  const mv = walkRank(r, 'MOVE'), rg = walkRank(r, 'RANGE');
  if (!mv.final || !rg.final) return null;
  return {
    p_up: Number(applyKnots(calibration?.MOVE, mv.final.p).toFixed(4)), null_up: Number(mv.final.null.toFixed(4)),
    p_big_move: Number(applyKnots(calibration?.RANGE, rg.final.p).toFixed(4)), null_big: Number(rg.final.null.toFixed(4)),
    history: mv.steps.length,
    structure_up: structure(mv.steps), structure_big: structure(rg.steps),
    steps: { MOVE: mv.steps, RANGE: rg.steps },
  };
}
