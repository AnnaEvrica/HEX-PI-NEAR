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
