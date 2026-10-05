export function observe(returns: number[], read: ReadName, detail = false): { baseline: Float64Array; memories: View[]; history?: View[][] } {
  const n = returns.length;
  const memories: View[] = [];
  const history: View[][] | undefined = detail ? [] : undefined;
  const out = new Float64Array(n).fill(NaN);
  const a = returns.map(Math.abs);
  // MOVE: rank of the present level among all levels so far
  const rankMax = new Float64Array(n);
  // RANGE: median of |change| through step i
  const med = new Float64Array(n).fill(NaN);
  // The level is rounded to nine decimals before it is ranked, so that a level returning exactly to an
  // earlier level counts as a tie whatever arithmetic produced the changes.
  if (read === 'MOVE') { const s = new Sorted(); let x = 0; for (let i = 0; i < n; i++) { x += returns[i]; rankMax[i] = s.push(Math.floor(x * 1e9 + 0.5) / 1e9); } }
  else { const s = new Sorted(); for (let i = 0; i < n; i++) { s.push(a[i]); if (s.size >= MIN_MEDIAN) med[i] = s.median(); } }

  const H = HALF_LIVES.length;
  const rho = HALF_LIVES.map((h) => (h === null ? 1 : 0.5 ** (1 / h)));
  const U = new Float64Array(H), N = new Float64Array(H);
  const ne = H + (read === 'MOVE' ? 1 : 0);
  const ll = new Float64Array(ne), ex = new Float64Array(ne);
  for (let i = FIRST; i < n; i++) {
    if (read === 'RANGE' && Number.isNaN(med[i])) continue;
    for (let h = 0; h < H; h++) ex[h] = clip((U[h] + 1) / (N[h] + 2));
    if (read === 'MOVE') ex[H] = clip((i + 1 - rankMax[i] + 1) / (i + 2));
    let m = -Infinity;
    for (let k = 0; k < ne; k++) if (ll[k] > m) m = ll[k];
    let num = 0, den = 0;
    for (let k = 0; k < ne; k++) { const w = Math.exp(ll[k] - m); num += w * ex[k]; den += w; }
    out[i] = num / den;
    if (i === n - 1 || history) {
      const now: View[] = [];
      for (let k = 0; k < ne; k++) now.push({ label: k < H ? MEMORY_LABELS[k] : 'position', p: ex[k], w: Math.exp(ll[k] - m) / den });
      if (history) history[i] = now;
      if (i === n - 1) { memories.push(...now); break; }
    }
    const y = read === 'MOVE' ? (returns[i + 1] > 0 ? 1 : 0) : (a[i + 1] > med[i] ? 1 : 0);
    for (let k = 0; k < ne; k++) ll[k] += Math.log(y ? ex[k] : 1 - ex[k]);
    for (let h = 0; h < H; h++) { U[h] = rho[h] * U[h] + y; N[h] = rho[h] * N[h] + 1; }
  }
  return { baseline: out, memories, ...(history ? { history } : {}) };
}
