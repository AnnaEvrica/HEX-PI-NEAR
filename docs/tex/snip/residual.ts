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
