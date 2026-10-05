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
