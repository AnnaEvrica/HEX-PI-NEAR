// ===========================================================================
// CER — the graph. G_t = (V, E, W): every channel a node, every ordered pair
// its measured relations on a trailing window. Three descriptive kinds are
// measured here (rank cross-correlation, the same with the shared driver
// removed, coherence by band). The fourth kind, 'predictive', comes from
// inference.ts and is added by the caller. The kinds answer different
// questions and are kept as separate edges. None of them is a claim of cause.
// ===========================================================================
import { asof, pair } from './align.ts';
import { bartlett, residual, surrogate, zrank } from './coupling.ts';
import { coherence } from './spectrum.ts';
import { CER_VERSION, Channel, Edge, Graph } from './types.ts';

/** Trailing aligned observations an edge is measured on, and the fewest it will read. */
export const WINDOW = 750, MINOBS = 200;

/** The shared driver on the given ticks: the mean of the other channels' ranked changes (each read as of the tick; absent where stale). Null when there is none. */
export function driver(days: number[], others: Channel[]): Float64Array | null {
  const n = days.length - 1;
  if (!others.length || n < 1) return null;
  const acc = new Float64Array(n), cnt = new Float64Array(n);
  for (const ch of others) {
    const k = asof(days, ch.days), idx: number[] = [], c: number[] = [];
    for (let t = 0; t < n; t++) if (k[t] >= 0 && k[t + 1] >= 0) { idx.push(t); c.push(ch.level[k[t + 1]] - ch.level[k[t]]); }
    if (idx.length < MINOBS / 2) continue;
    const z = zrank(c); idx.forEach((t, m) => { acc[t] += z[m]; cnt[t] += 1; });
  }
  if (!cnt.some((x) => x > 0)) return null;
  let mean = 0; const g = acc.map((x, t) => (cnt[t] > 0 ? x / cnt[t] : 0)); for (const x of g) mean += x; mean /= n;
  return g.map((x) => x - mean);
}

const distinct = (v: number[]) => new Set(v.map((x) => x.toFixed(12))).size;
const peak = (rho: number[]) => rho.reduce((b, x, l) => (Math.abs(x) > Math.abs(rho[b]) ? l : b), 0);

/** Every measured relation of one ordered pair (target <- neighbour) on the trailing window. */
export function edges(target: Channel, neighbour: Channel, others: Channel[], upto: number, window = WINDOW): Edge[] {
  const { d, a, b } = pair(target, neighbour, upto, window);
  const base = { target: target.id, source: neighbour.id, method: CER_VERSION, samples: a.length, window: (d.length ? [d[0], d[d.length - 1]] : null) as [number, number] | null };
  if (a.length < MINOBS) return [{ ...base, type: 'rank-xcorr', status: 'insufficient data' }];
  if (distinct(a) < 3 || distinct(b) < 3) return [{ ...base, type: 'rank-xcorr', status: 'insufficient variation' }];
  const full = { ...base, coverage: Math.round(1e4 * d.length / (d[d.length - 1] - d[0] + 1)) / 1e4 };
  const u = zrank(a), v = zrank(b), out: Edge[] = [];
  const s = surrogate(u, v), l = peak(s.rho);
  out.push({ ...full, type: 'rank-xcorr', status: 'ok', strength: s.rho[l], lag: l, by_lag: s.rho, standard_error: bartlett(u, v), threshold: s.threshold, p_value: s.p_value, related: s.stat > s.threshold });
  const g = driver(d, others);
  if (!g) out.push({ ...full, type: 'partial-rank-xcorr', status: 'no other channel' });
  else {
    const ru = residual(u, g), rv = residual(v, g), p = surrogate(ru, rv), lp = peak(p.rho);
    out.push({ ...full, type: 'partial-rank-xcorr', status: 'ok', strength: p.rho[lp], lag: lp, by_lag: p.rho, standard_error: bartlett(ru, rv), threshold: p.threshold, p_value: p.p_value, related: p.stat > p.threshold, controls: others.map((o) => o.id) });
  }
  for (const e of coherence(Array.from(u), Array.from(v))) out.push({ ...full, type: 'coherence', ...e } as Edge);
  return out;
}

/** The graph as of a tick. */
export function graph(channels: Channel[], upto: number, window = WINDOW): Graph {
  const E: Edge[] = [];
  for (const t of channels) for (const n of channels) if (t !== n) E.push(...edges(t, n, channels.filter((c) => c !== t && c !== n), upto, window));
  return {
    method: CER_VERSION, as_of: upto, edges: E,
    nodes: channels.map((c) => ({ id: c.id, environment: c.env, unit: c.unit, source: c.source, observations: c.days.filter((x) => x <= upto).length })),
  };
}
