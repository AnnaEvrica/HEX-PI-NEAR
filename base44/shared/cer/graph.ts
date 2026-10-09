// ===========================================================================
// CER — the graph. G_t = (V, E, W): every channel a node, every ordered pair
// its measured relations on a trailing window. Three descriptive kinds are
// measured here (rank cross-correlation, the same with the shared driver
// removed, coherence by band). The fourth kind, 'predictive', comes from
// inference.ts and is added by the caller. The kinds answer different
// questions and are kept as separate edges. None of them is a claim of cause.
// ===========================================================================
import { asof, pair } from './align.ts';
import { channel } from './normalize.ts';
import { bartlett, lagcorr, MAXLAG, NSUR, residual, surrogate, zrank } from './coupling.ts';
import { coherence } from './spectrum.ts';
import { CER_VERSION, Channel, Edge, EdgeWeight, Graph } from './types.ts';

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

// ---------------------------------------------------------------------------
// Edge weight from present measurement (cer-0.2):  w = A . L . C . Q
//
// How much an edge is heard in the forecast is measured from the current
// observation window. No outcome and no past forecasting success enters it,
// so a relationship can be detected the day it appears and dropped the day
// it goes, whatever its record. A relation that is only simultaneous has
// L = 0: it stays in the descriptive graph above and is not promoted.
// ---------------------------------------------------------------------------

/** Edge weights are measured again every this many calls. */
export const RECOMPUTE = 25;

/** The control: a channel with its record displaced by `shift` ticks, circularly within its own span (the same displacement asof() applies). */
export function displaced(ch: Channel, shift: number): Channel {
  const lo = ch.days[0], span = ch.days[ch.days.length - 1] - lo + 1;
  const nd = ch.days.map((d) => lo + ((((d - lo - shift) % span) + span) % span));
  const o = nd.map((_, i) => i).sort((p, q) => nd[p] - nd[q] || p - q);
  return channel(ch.id, ch.env, o.map((i) => nd[i]), o.map((i) => ch.changes[i]), ch.unit, ch.source);
}

/**
 * w = A . L . C . Q for the edge target <- neighbour, from the window ending at `upto`.
 * @param lead  the fewest steps by which the neighbour must lead for a call to be able to use it
 * @param read  'RANGE' measures the sizes of the changes instead of the changes
 */
export function edgeWeight(target: Channel, neighbour: Channel, others: Channel[], upto: number, lead = 1, read: 'MOVE' | 'RANGE' = 'MOVE', window = WINDOW): EdgeWeight {
  const p = pair(target, neighbour, upto, window), d = p.d;
  const e: EdgeWeight = { status: 'ok', A: 0, L: 0, C: 0, Q: 0, w: 0, evidence: 0, samples: p.a.length };
  if (p.a.length < MINOBS) return { ...e, status: 'insufficient data' };
  const a = read === 'RANGE' ? p.a.map(Math.abs) : p.a, b = read === 'RANGE' ? p.b.map(Math.abs) : p.b;
  if (distinct(a) < 3 || distinct(b) < 3) return { ...e, status: 'insufficient variation' };
  const u = zrank(a), v = zrank(b), n = u.length, rho = lagcorr(u, v);
  const A = rho.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
  let l = lead; for (let k = lead; k <= MAXLAG; k++) if (Math.abs(rho[k]) > Math.abs(rho[l])) l = k;
  const stat = Math.abs(rho[l]), sur: number[] = [];
  for (let k = 0; k < NSUR; k++) { const r = lagcorr(u, v, MAXLAG, Math.floor(n * (0.1 + 0.8 * k / (NSUR - 1)) + 0.5)); let m = 0; for (let j = lead; j <= MAXLAG; j++) m = Math.max(m, Math.abs(r[j])); sur.push(m); }
  sur.sort((x, y) => x - y);
  const thr = sur[Math.ceil(0.95 * NSUR) - 1];
  let nt = 0; for (const x of target.days) if (x >= d[0] && x <= d[d.length - 1]) nt++;
  const Q = (d.length / nt) * Math.min(1, n / window);
  e.A = A; e.Q = Q; e.lag = l; e.threshold = thr; e.lead_strength = rho[l];
  if (!(stat > thr && A > 0)) return e;
  const g = driver(d, others);
  e.L = stat / A;
  e.C = g ? Math.min(1, Math.abs(lagcorr(residual(u, g), residual(v, g))[l]) / stat) : 1;
  e.w = e.A * e.L * e.C * e.Q;
  const se = bartlett(u, v);
  e.evidence = Q * Math.max(0, (e.C * stat / se) ** 2 - (thr / se) ** 2) / 2;
  return e;
}

/**
 * W[t][j] and E[t][j]: the measured weight and the measured evidence of each
 * edge at each call, from observations dated no later than (call tick - lag),
 * held between measurements. `parts` is the mean of A, L, C, Q and w per edge.
 */
export function edgeWeights(tdays: number[], target: Channel, neighbours: Channel[], lag = 0, read: 'MOVE' | 'RANGE' = 'MOVE', shift = 0, every = RECOMPUTE): { W: number[][]; E: number[][]; parts: number[][] } {
  const N = shift ? neighbours.map((c) => displaced(c, shift)) : neighbours;
  const W = tdays.map(() => N.map(() => 0)), E = tdays.map(() => N.map(() => 0)), parts = N.map(() => [0, 0, 0, 0, 0]); let cnt = 0;
  for (let t0 = 0; t0 < tdays.length; t0 += every) {
    N.forEach((nb, j) => {
      const e = edgeWeight(target, nb, N.filter((c) => c !== nb), tdays[t0] - lag, 1 + lag, read);
      for (let t = t0; t < Math.min(t0 + every, tdays.length); t++) { W[t][j] = e.w; E[t][j] = e.evidence; }
      [e.A, e.L, e.C, e.Q, e.w].forEach((x, k) => { parts[j][k] += x; });
    });
    cnt++;
  }
  return { W, E, parts: parts.map((r) => r.map((x) => x / Math.max(cnt, 1))) };
}
