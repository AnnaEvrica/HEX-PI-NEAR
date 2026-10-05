// Calibration. HEX makes the call; calibration never changes it.
//
// A call has a side (the event, or not) and a strength (the probability stated
// for that side, 50% to 99%). The side is HEX's own and is fixed. The map
// here is fitted, on calls made earlier, from the strength HEX stated to how
// often calls of that strength were right, and is applied to the strength
// only. It cannot state less than 50% for the side called, so it can never
// turn a call round.
//
// The fit is isotonic regression (pool adjacent violators): among all
// non-decreasing maps it is the one that would have earned the most reward
// on the record, under every proper score at once.
const clip = (p: number) => Math.min(0.99, Math.max(0.01, p));

function fitBlocks(ps: number[], ys: number[]) {
  const idx = ps.map((_, i) => i).sort((a, b) => ps[a] - ps[b]);
  const blocks: { x0: number; x1: number; sum: number; n: number }[] = [];
  for (const i of idx) {
    blocks.push({ x0: ps[i], x1: ps[i], sum: ys[i], n: 1 });
    while (blocks.length > 1) {
      const b = blocks[blocks.length - 1], a = blocks[blocks.length - 2];
      if (a.sum / a.n <= b.sum / b.n) break;
      blocks.splice(blocks.length - 2, 2, { x0: a.x0, x1: b.x1, sum: a.sum + b.sum, n: a.n + b.n });
    }
  }
  return blocks;
}

export function fitIsotonic(ps: number[], ys: number[]): (p: number) => number {
  const blocks = fitBlocks(ps, ys);
  return (p: number) => {
    if (p <= blocks[0].x1) return clip(blocks[0].sum / blocks[0].n);
    for (let k = 1; k < blocks.length; k++) {
      const prev = blocks[k - 1], cur = blocks[k];
      if (p < cur.x0) { // between blocks: linear interpolation
        const v0 = prev.sum / prev.n, v1 = cur.sum / cur.n;
        return clip(v0 + (v1 - v0) * (p - prev.x1) / Math.max(1e-12, cur.x0 - prev.x1));
      }
      if (p <= cur.x1) return clip(cur.sum / cur.n);
    }
    const last = blocks[blocks.length - 1];
    return clip(last.sum / last.n);
  };
}

/** A stored calibration map: knots of a monotone curve, linear between them. */
export interface Knots { x: number[]; y: number[]; n: number }

/** Fit the map and return it as knots, so it can be stored and applied later. */
export function isotonicKnots(ps: number[], ys: number[]): Knots {
  const x: number[] = [], y: number[] = [];
  const add = (px: number, v: number) => {
    if (x.length && px <= x[x.length - 1]) return;
    x.push(px); y.push(clip(v));
  };
  for (const b of fitBlocks(ps, ys)) { add(b.x0, b.sum / b.n); if (b.x1 > b.x0) add(b.x1, b.sum / b.n); }
  return { x, y, n: ps.length };
}

/** The least and most that can be stated for the side called. */
export const STRENGTH_FLOOR = 0.5001, STRENGTH_CEIL = 0.99;
const strength = (p: number) => Math.max(p, 1 - p);
const isUp = (p: number) => p >= 0.5;

/** Strength map from past calls: stated strength -> share of such calls that were right. */
export function fitStrength(ps: number[], ys: number[]): (s: number) => number {
  return fitIsotonic(ps.map(strength), ps.map((p, i) => ((isUp(p) ? 1 : 0) === ys[i] ? 1 : 0)));
}
/** The same map as knots, to store. */
export function strengthKnots(ps: number[], ys: number[]): Knots {
  return isotonicKnots(ps.map(strength), ps.map((p, i) => ((isUp(p) ? 1 : 0) === ys[i] ? 1 : 0)));
}
/** Restate the strength of a call; the side stays where HEX put it. */
export function restate(p: number, map: (s: number) => number): number {
  const s = Math.min(STRENGTH_CEIL, Math.max(STRENGTH_FLOOR, map(strength(p))));
  return isUp(p) ? s : 1 - s;
}
export function applyStrength(k: Knots | null | undefined, p: number): number {
  return !k || !k.x?.length ? p : restate(p, (s) => applyKnots(k, s));
}

export function applyKnots(k: Knots | null | undefined, p: number): number {
  if (!k || !k.x?.length) return p;
  const { x, y } = k, n = x.length;
  if (p <= x[0]) return y[0];
  if (p >= x[n - 1]) return y[n - 1];
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (x[m] <= p) lo = m; else hi = m; }
  return x[hi] === x[lo] ? y[lo] : clip(y[lo] + (y[hi] - y[lo]) * (p - x[lo]) / (x[hi] - x[lo]));
}
