// ===========================================================================
// CER — do the neighbours say anything about the target's next step?
//
//     edge j:   logit p_j   = logit(offset) + gamma_j . Z_j
//     pool:     logit p_all = logit(offset) + gamma . mean_j(Z_j)
//
// One expert per edge and one for the pool, each an online logistic
// regression at nine prior scales mixed by likelihood; the call is the
// mixture of the offset, the pool and every edge with reversible influence.
// These are HEX 7.0's two learning rules (hex7.ts: Residual, Share), written
// again here for any number of experts so that hex7.ts is not touched.
//
// The offset is where CER starts and what it returns to: the null
// (standalone) or HEX's call (fusion candidate). Every coefficient starts at
// zero and every expert with an equal share, so with nothing learned the
// call IS the offset. An edge that carries nothing stays at the offset and
// costs almost nothing; that is CER concluding "no relationship".
//
// Order at every step: predict, then the outcome arrives, then learn.
// ===========================================================================
import { PRIOR_SCALES, SHARE_RATES } from '../hex7.ts';
import { NC } from './align.ts';

const T = PRIOR_SCALES.length;
const clip = (p: number) => Math.min(0.99, Math.max(0.01, p));
const logit = (p: number) => { const q = Math.min(Math.max(p, 1e-6), 1 - 1e-6); return Math.log(q / (1 - q)); };

/** One online logistic regression on d coordinates at nine prior scales, mixed by likelihood. */
class Residual {
  P: Float64Array[]; th: Float64Array[]; ll = new Float64Array(T); q = new Float64Array(T); x: ArrayLike<number>;
  constructor(private d: number) {
    this.P = PRIOR_SCALES.map((t) => { const m = new Float64Array(d * d); for (let i = 0; i < d; i++) m[i * d + i] = t; return m; });
    this.th = PRIOR_SCALES.map(() => new Float64Array(d)); this.x = new Float64Array(d);
  }
  predict(x: ArrayLike<number>, offset: number): number {
    this.x = x; let m = -Infinity; for (const v of this.ll) if (v > m) m = v;
    let z = 0, p = 0; const w = new Float64Array(T); for (let t = 0; t < T; t++) { w[t] = Math.exp(this.ll[t] - m); z += w[t]; }
    for (let t = 0; t < T; t++) { let s = offset; const th = this.th[t]; for (let i = 0; i < this.d; i++) s += th[i] * x[i]; this.q[t] = clip(1 / (1 + Math.exp(-s))); p += (w[t] / z) * this.q[t]; }
    return p;
  }
  update(y: number) {
    const d = this.d, x = this.x, Px = new Float64Array(d);
    for (let t = 0; t < T; t++) {
      const q = this.q[t], P = this.P[t], th = this.th[t];
      this.ll[t] += Math.log(y ? q : 1 - q);
      const wt = q * (1 - q); let xPx = 0;
      for (let i = 0; i < d; i++) { let s = 0; for (let j = 0; j < d; j++) s += P[i * d + j] * x[j]; Px[i] = s; }
      for (let i = 0; i < d; i++) xPx += Px[i] * x[i];
      const k = wt / (1 + wt * xPx);
      for (let i = 0; i < d; i++) for (let j = 0; j < d; j++) P[i * d + j] -= k * Px[i] * Px[j];
      for (let i = 0; i < d; i++) { let s = 0; for (let j = 0; j < d; j++) s += P[i * d + j] * x[j]; th[i] += s * (y - q); }
    }
  }
}

/** A mixture with reversible influence: one fixed-share mixture per rate, the rates mixed by likelihood. */
class Share {
  w: Float64Array[]; ll = new Float64Array(SHARE_RATES.length); q = new Float64Array(SHARE_RATES.length); o = new Float64Array(SHARE_RATES.length);
  constructor(private n: number) { this.w = SHARE_RATES.map(() => new Float64Array(n).fill(1 / n)); }
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
  influence(): number[] { this.outer(); return Array.from({ length: this.n }, (_, e) => this.w.reduce((s, w, a) => s + this.o[a] * w[e], 0)); }
}

export interface CerStep {
  /** CER's call. */
  p: number;
  /** What each expert said on its own: [offset, pool, edge 1..K]. Kept when detail is asked for. */
  experts?: number[];
  /** The share of the call each held. */
  share?: number[];
}

/**
 * One target, one read, one pass over its calls.
 * @param offset  offset[t]: the probability CER starts from (the null, or HEX's call)
 * @param y       y[t]: what happened; y.length may be offset.length - 1, in which case the last call is made and not learned from
 * @param F, M    from features(): each neighbour's coordinates at each call, and who was present
 */
export function walkCer(offset: number[], y: number[], F: Float64Array[][], M: boolean[][], detail = false): { steps: CerStep[]; share: number[] } {
  const n = offset.length, K = n ? F[0].length : 0, R = Array.from({ length: K + 1 }, () => new Residual(NC)), A = new Share(K + 2), steps: CerStep[] = [], pool = new Float64Array(NC);
  for (let t = 0; t < n; t++) {
    pool.fill(0); let present = 0;
    for (let j = 0; j < K; j++) if (M[t][j]) { present++; for (let d = 0; d < NC; d++) pool[d] += F[t][j][d]; }
    if (present) for (let d = 0; d < NC; d++) pool[d] /= present;
    const off = logit(offset[t]), V = [offset[t], R[0].predict(pool, off)];
    for (let j = 0; j < K; j++) V.push(R[j + 1].predict(F[t][j], off));
    const p = A.predict(V);
    steps.push(detail ? { p, experts: V, share: A.influence() } : { p });
    if (t >= y.length) break;
    for (const r of R) r.update(y[t]);
    A.update(V, y[t]);
  }
  return { steps, share: A.influence() };
}
