// ===========================================================================
// CER — how two aligned channels move together in time. Everything is done
// on ranks, so a spike or a change of units moves nothing. A relation is
// called real only against the same statistic computed with the neighbour
// shifted in time, which keeps the neighbour's own rhythm and breaks only
// its alignment with the target.
// ===========================================================================

export const MAXLAG = 5, NSUR = 200, ACF = 20;
const ALPHA = 0.05;
const rnd = (x: number) => Math.floor(x + 0.5);

/** Midranks, centred and scaled to unit variance. A constant gives zeros. */
export function zrank(v: number[]): Float64Array {
  const n = v.length, idx = Array.from({ length: n }, (_, i) => i).sort((p, q) => v[p] - v[q]), r = new Float64Array(n);
  for (let i = 0; i < n;) { let j = i; while (j + 1 < n && v[idx[j + 1]] === v[idx[i]]) j++; const rank = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[idx[k]] = rank; i = j + 1; }
  let m = 0; for (const x of r) m += x; m /= n || 1;
  let s = 0; for (let i = 0; i < n; i++) { r[i] -= m; s += r[i] * r[i]; }
  s = Math.sqrt(s / (n || 1));
  for (let i = 0; i < n; i++) r[i] = s > 0 ? r[i] / s : 0;
  return r;
}

/** rho[l]: correlation of the target u at t with the neighbour v at t - l (the neighbour leads by l). `off` shifts v circularly first. */
export function lagcorr(u: ArrayLike<number>, v: ArrayLike<number>, maxlag = MAXLAG, off = 0): number[] {
  const n = u.length, out: number[] = [], at = (t: number) => v[(((t - off) % n) + n) % n];
  for (let l = 0; l <= maxlag; l++) {
    const m = n - l; let ma = 0, mb = 0;
    for (let t = 0; t < m; t++) { ma += u[t + l]; mb += at(t); }
    ma /= m; mb /= m;
    let ab = 0, aa = 0, bb = 0;
    for (let t = 0; t < m; t++) { const x = u[t + l] - ma, y = at(t) - mb; ab += x * y; aa += x * x; bb += y * y; }
    const d = Math.sqrt(aa * bb); out.push(d > 0 ? ab / d : 0);
  }
  return out;
}

/** Standard error of a cross-correlation between two autocorrelated series (Bartlett, 1946). */
export function bartlett(u: ArrayLike<number>, v: ArrayLike<number>, m = ACF): number {
  const n = u.length; let su = 0, sv = 0;
  for (let t = 0; t < n; t++) { su += u[t] * u[t]; sv += v[t] * v[t]; }
  if (su <= 0 || sv <= 0) return NaN;
  let acc = 0;
  for (let k = 1; k <= m; k++) { let a = 0, b = 0; for (let t = k; t < n; t++) { a += u[t] * u[t - k]; b += v[t] * v[t - k]; } acc += (a / su) * (b / sv); }
  return Math.sqrt(Math.max(1e-12, 1 + 2 * acc) / n);
}

/**
 * The largest |rho| over the lags, against the same statistic with the
 * neighbour circularly shifted B ways (evenly from a tenth to nine tenths of
 * the window). One statistic over all lags, so six lags are not six chances.
 */
export function surrogate(u: ArrayLike<number>, v: ArrayLike<number>, maxlag = MAXLAG, B = NSUR) {
  const big = (r: number[]) => r.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
  const rho = lagcorr(u, v, maxlag), stat = big(rho), n = u.length, sur: number[] = [];
  for (let b = 0; b < B; b++) sur.push(big(lagcorr(u, v, maxlag, rnd(n * (0.1 + 0.8 * b / (B - 1))))));
  sur.sort((x, y) => x - y);
  return { rho, stat, threshold: sur[Math.ceil((1 - ALPHA) * B) - 1], p_value: (1 + sur.filter((s) => s >= stat).length) / (B + 1) };
}

/** u with the shared driver g taken out (least squares; both centred). */
export function residual(u: ArrayLike<number>, g: ArrayLike<number>): Float64Array {
  let ug = 0, gg = 0; for (let t = 0; t < u.length; t++) { ug += u[t] * g[t]; gg += g[t] * g[t]; }
  const k = gg > 0 ? ug / gg : 0; return Float64Array.from({ length: u.length }, (_, t) => u[t] - k * g[t]);
}
