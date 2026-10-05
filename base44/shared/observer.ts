// ===========================================================================
// OBSERVER — watches a series and reports one thing: the baseline, meaning
// what the series' recent behaviour and present position already imply for
// the next step. It never makes a call.
//
// The baseline is a likelihood-weighted mixture of base rates at dyadic
// memories (half-lives 32, 64, ... 1024 steps, and no forgetting). Whichever
// memory has predicted this series best carries the weight, so a series that
// drifts is followed and one that does not is left alone. For MOVE the
// mixture also holds the exchangeable rank rule (g+1)/(n+1): where the
// present value ranks among everything before it.
//
// HEX measures each state's evidence against this baseline (hex.ts).
// Reference: validation/rankcore.py ('null'); parity test in tests/parity.mjs.
//
// Reads:  MOVE   the next value is higher than this one
//         RANGE  the next change is larger than the median of earlier changes
// ===========================================================================

export type ReadName = 'MOVE' | 'RANGE';

const HALF_LIVES: (number | null)[] = [32, 64, 128, 256, 512, 1024, null];
const FIRST = 26;
const MIN_MEDIAN = 20;
const clip = (p: number) => Math.min(0.99, Math.max(0.01, p));

/** A sorted list: insert a value and learn how many values so far are <= it. */
class Sorted {
  private s: number[] = [];
  /** Inserts v; returns the count of values <= v, including v. */
  push(v: number): number {
    const s = this.s;
    let lo = 0, hi = s.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (s[m] <= v) lo = m + 1; else hi = m; }
    s.splice(lo, 0, v);
    return lo + 1;
  }
  get size() { return this.s.length; }
  median(): number { const s = this.s, m = s.length; return m % 2 ? s[(m - 1) / 2] : (s[m / 2 - 1] + s[m / 2]) / 2; }
}

/**
 * The baseline at every step of a series of step-to-step changes, NaN where
 * there is none yet. Entry i uses the series up to step i only; the last
 * entry is the baseline for the step that has not happened.
 */
export function observeBaseline(returns: number[], read: ReadName): Float64Array {
  const n = returns.length;
  const out = new Float64Array(n).fill(NaN);
  const a = returns.map(Math.abs);
  // MOVE: rank of the present level among all levels so far
  const rankMax = new Float64Array(n);
  // RANGE: median of |change| through step i
  const med = new Float64Array(n).fill(NaN);
  if (read === 'MOVE') { const s = new Sorted(); let x = 0; for (let i = 0; i < n; i++) { x += returns[i]; rankMax[i] = s.push(x); } }
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
    if (i === n - 1) break;
    const y = read === 'MOVE' ? (returns[i + 1] > 0 ? 1 : 0) : (a[i + 1] > med[i] ? 1 : 0);
    for (let k = 0; k < ne; k++) ll[k] += Math.log(y ? ex[k] : 1 - ex[k]);
    for (let h = 0; h < H; h++) { U[h] = rho[h] * U[h] + y; N[h] = rho[h] * N[h] + 1; }
  }
  return out;
}
