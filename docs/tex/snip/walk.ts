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
