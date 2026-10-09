// ===========================================================================
// CER — time. Which observation of a neighbour a call is allowed to see, and
// how two channels on different clocks are put on the ticks they share.
// ===========================================================================
import { NZ, ranks } from '../hex7.ts';
import type { Channel } from './types.ts';

/** Coordinates per channel: 7 for the level, 7 for the size of the change. */
export const NC = 2 * NZ;
/** A neighbour's observation older than this many ticks is absent. */
export const STALE = 7;

const mod = (x: number, m: number) => ((x % m) + m) % m;
/** Number of entries of the increasing array `a` that are <= x. */
export function countUpTo(a: number[], x: number): number { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] <= x) lo = m + 1; else hi = m; } return lo; }

/** Z for every observation of a channel: exactly HEX's ranks, of the level and of the size of the change. */
export function coordinates(ch: Channel): Float64Array[] {
  const a = ranks(ch.level), b = ranks(ch.changes.map(Math.abs));
  ch.Z = a.map((z, i) => { const out = new Float64Array(NC); out.set(z, 0); out.set(b[i], NZ); return out; });
  return ch.Z;
}

/**
 * For each target tick, the index of the neighbour's latest observation
 * dated no later than (tick - lag); -1 when there is none within `stale`
 * ticks. shift != 0 is the control: the neighbour's record is displaced by
 * that many ticks, circularly within its own span.
 */
export function asof(tdays: number[], jdays: number[], lag = 0, shift = 0, stale = STALE): Int32Array {
  const out = new Int32Array(tdays.length).fill(-1);
  if (!jdays.length) return out;
  const lo = jdays[0], hi = jdays[jdays.length - 1];
  for (let t = 0; t < tdays.length; t++) {
    let q = tdays[t] - lag;
    if (q < lo || q > hi + (shift ? 0 : stale)) continue;
    if (shift) q = lo + mod(q - lo + shift, hi - lo + 1);
    const k = countUpTo(jdays, q) - 1;
    if (k >= 0 && q - jdays[k] <= stale) out[t] = k;
  }
  return out;
}

/** The coordinates of each neighbour as known at each call (zero where absent), and who was present. */
export function features(tdays: number[], neighbours: Channel[], lag = 0, shift = 0): { F: Float64Array[][]; M: boolean[][] } {
  const zero = new Float64Array(NC);
  const F: Float64Array[][] = tdays.map(() => neighbours.map(() => zero)), M: boolean[][] = tdays.map(() => neighbours.map(() => false));
  neighbours.forEach((ch, j) => {
    const Z = ch.Z ?? coordinates(ch), k = asof(tdays, ch.days, lag, shift);
    for (let t = 0; t < tdays.length; t++) if (k[t] >= 0) { F[t][j] = Z[k[t]]; M[t][j] = true; }
  });
  return { F, M };
}

/** Both channels on the ticks they share, up to and including `upto`: the shared ticks, and the changes between consecutive shared ticks. */
export function pair(ci: Channel, cj: Channel, upto: number, window: number): { d: number[]; a: number[]; b: number[] } {
  const d: number[] = []; let i = 0, j = 0;
  while (i < ci.days.length && j < cj.days.length && ci.days[i] <= upto && cj.days[j] <= upto) {
    if (ci.days[i] === cj.days[j]) { d.push(ci.days[i]); i++; j++; } else if (ci.days[i] < cj.days[j]) i++; else j++;
  }
  const dd = d.slice(-(window + 1));
  if (dd.length < 2) return { d: dd, a: [], b: [] };
  const at = (c: Channel) => dd.map((x) => c.level[countUpTo(c.days, x) - 1]);
  const la = at(ci), lb = at(cj), a: number[] = [], b: number[] = [];
  for (let k = 1; k < dd.length; k++) { a.push(la[k] - la[k - 1]); b.push(lb[k] - lb[k - 1]); }
  return { d: dd, a, b };
}
