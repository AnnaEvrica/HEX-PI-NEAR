// ===========================================================================
// CER — the graph. G_t = (V, E, W): every channel a node, every ordered pair
// its measured relations on a trailing window. Three descriptive kinds are
// measured here (rank cross-correlation, the same with the shared driver
// removed, coherence by band). The fourth kind, 'predictive', comes from
// inference.ts and is added by the caller. The kinds answer different
// questions and are kept as separate edges. None of them is a claim of cause.
// ===========================================================================
import { NZ, ranks } from '../hex7.ts';
import { asof, coordinates, countUpTo, NC, pair } from './align.ts';
import { channel } from './normalize.ts';
import { bartlett, lagcorr, MAXLAG, NSUR, residual, surrogate, zrank } from './coupling.ts';
import { coherence } from './spectrum.ts';
import { HORIZON } from './inference.ts';
import { CER_VERSION, Channel, Counterpoint, Edge, EdgeWeight, Graph, MomentSignature, RhythmBand } from './types.ts';

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

// ===========================================================================
// The moment (cer-0.4). CER's primary object is the relational moment
//     M_t = (X_t, G_t, Phi_t)   with its signature   (X, G, Phi, U, N).
// Perception is complete before prediction is considered, and no outcome and
// no past forecasting success enters it. Predictive eligibility is a separate
// calculation on the same panel, controlled for the target's own past, the
// calendar, the other neighbours and the arm's timestamp availability.
// The edge weight above (A.L.C.Q) is kept unchanged as a comparator.
// ===========================================================================

/** The target's own past steps controlled for; lags tried per neighbour; shrinkage of the harmony matrix; days in a year. */
export const PERSIST = 5, LEADS = 3, SHRINK = 0.1, YEAR = 365.2425;

/** Inverse of the standard normal distribution function (Acklam's rational approximation, relative error under 1.2e-9). */
export function ndtri(p: number): number {
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
  const tailv = (q: number) => (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  if (p < 0.02425) return tailv(Math.sqrt(-2 * Math.log(p)));
  if (p > 1 - 0.02425) return -tailv(Math.sqrt(-2 * Math.log(1 - p)));
  const q = p - 0.5, r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}
/** ln Gamma(x), x > 0 (Lanczos). */
function lgamma(x: number): number {
  const g = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
  const y = x - 1; let s = g[0]; for (let i = 1; i < 9; i++) s += g[i] / (y + i);
  const t = y + 7.5; return 0.5 * Math.log(2 * Math.PI) + (y + 0.5) * Math.log(t) - t + Math.log(s);
}
/** The regularised upper incomplete gamma function Q(a, x). */
export function gammq(a: number, x: number): number {
  if (x <= 0) return 1;
  if (x < a + 1) {
    let ap = a, term = 1 / a, tot = term;
    for (let i = 0; i < 500; i++) { ap += 1; term *= x / ap; tot += term; if (Math.abs(term) < Math.abs(tot) * 1e-15) break; }
    return Math.max(0, 1 - tot * Math.exp(-x + a * Math.log(x) - lgamma(a)));
  }
  let b = x + 1 - a, c = 1e300, d = 1 / b, h = d;
  for (let i = 1; i < 500; i++) {
    const an = -i * (i - a); b += 2; d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300; c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; const de = d * c; h *= de;
    if (Math.abs(de - 1) < 1e-15) break;
  }
  return Math.exp(-x + a * Math.log(x) - lgamma(a)) * h;
}
/** P(chi-square with k degrees of freedom >= x), and P(|standard normal| >= |z|). */
export const chi2sf = (x: number, k: number) => gammq(k / 2, x / 2);
const normSf2 = (z: number) => chi2sf(z * z, 1);

/** What each observation of a channel is against the channel's own past: the normal score of its change, and the tail probability of its size. */
export function prepare(ch: Channel): Channel {
  const Z = ch.Z ?? coordinates(ch);
  ch.ns = ranks(ch.changes).map((z) => ndtri(Math.min(1 - 1e-6, Math.max(1e-6, (z[NZ - 1] + 1) / 2))));
  ch.tail = Z.map((z) => 1 - (z[NC - 1] + 1) / 2);
  return ch;
}

/** Correlation of x[x0 .. x0 + m) with y[y0 .. y0 + m); zero when either has no variation. */
function seg(x: ArrayLike<number>, x0: number, y: ArrayLike<number>, y0: number, m: number): number {
  let mx = 0, my = 0; for (let i = 0; i < m; i++) { mx += x[x0 + i]; my += y[y0 + i]; } mx /= m; my /= m;
  let xy = 0, xx = 0, yy = 0; for (let i = 0; i < m; i++) { const a = x[x0 + i] - mx, b = y[y0 + i] - my; xy += a * b; xx += a * a; yy += b * b; }
  const den = Math.sqrt(xx * yy); return den > 0 ? xy / den : 0;
}
/** Inverse of a small square matrix (Gauss-Jordan with partial pivoting). */
function inverse(A: number[][]): number[][] {
  const n = A.length, M = A.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]]; const d = M[c][c];
    for (let j = 0; j < 2 * n; j++) M[c][j] /= d;
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c]; if (f !== 0) for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[c][j]; }
  }
  return M.map((r) => r.slice(n));
}

/**
 * The moment's observations on the target's own clock: the target's last
 * `window` changes up to `upto`, and beside each the change in every
 * neighbour between the values available at consecutive target steps (as of
 * the step's tick minus lag). Each column is ranked; a neighbour that cannot
 * be measured is a column of zeros.
 */
export function panel(target: Channel, neighbours: Channel[], upto: number, lag = 0, read: 'MOVE' | 'RANGE' = 'MOVE', window = WINDOW) {
  const hi = countUpTo(target.days, upto), lo = Math.max(0, hi - (window + 1)), d = target.days.slice(lo, hi), K = neighbours.length;
  const f = read === 'RANGE' ? Math.abs : (x: number) => x, cover = new Array(K).fill(0);
  if (d.length < 2) return { d, u: new Float64Array(0), V: neighbours.map(() => new Float64Array(0)), cover };
  const n = d.length - 1, a: number[] = []; for (let i = 0; i < n; i++) a.push(f(target.level[lo + i + 1] - target.level[lo + i]));
  const V = neighbours.map((nb, j) => {
    const k = asof(d, nb.days, lag), col = new Float64Array(n), idx: number[] = [], c: number[] = [];
    for (let i = 0; i < n; i++) if (k[i] >= 0 && k[i + 1] >= 0) { idx.push(i); c.push(f(nb.level[k[i + 1]] - nb.level[k[i]])); }
    cover[j] = idx.length / n;
    if (idx.length >= MINOBS && distinct(c) >= 3) { const z = zrank(c); idx.forEach((i, q) => { col[i] = z[q]; }); }
    return col;
  });
  return { d, u: distinct(a) >= 3 ? zrank(a) : new Float64Array(n), V, cover };
}

/**
 * The signature of the moment at `upto` as the target meets it, and,
 * separately, the controlled evidence that anything in it bears on the
 * target's next step. `previous` is the signature one full window earlier,
 * for temporal novelty.
 */
export function moment(target: Channel, neighbours: Channel[], upto: number, lag = 0, read: 'MOVE' | 'RANGE' = 'MOVE', previous?: MomentSignature | null, window = WINDOW): MomentSignature {
  const { d, u, V, cover } = panel(target, neighbours, upto, lag, read, window), n = u.length, K = neighbours.length, ids = neighbours.map((c) => c.id);
  const S: MomentSignature = { method: CER_VERSION, target: target.id, as_of: upto, lag, read, samples: n, status: 'ok', evidence: new Array(K + 1).fill(0), coverage: cover, measurable: new Array(K).fill(false) };
  if (n < MINOBS || !u.some((x) => x !== 0)) { S.status = 'insufficient data'; return S; }
  const meas = V.map((c) => c.some((x) => x !== 0)), J: number[] = []; meas.forEach((m, j) => { if (m) J.push(j); });
  S.measurable = meas;
  const cols: ArrayLike<number>[] = [u, ...V], H = cols.map((x) => cols.map((y) => { let s = 0; for (let i = 0; i < n; i++) s += x[i] * y[i]; return s / n; }));
  const lead = V.map(() => new Array(MAXLAG).fill(0)), follow = V.map(() => new Array(MAXLAG).fill(0)), own = new Array(MAXLAG).fill(0);
  for (let l = 1; l <= MAXLAG; l++) { V.forEach((c, j) => { lead[j][l - 1] = seg(u, l, c, 0, n - l); follow[j][l - 1] = seg(u, 0, c, l, n - l); }); own[l - 1] = seg(u, l, u, 0, n - l); }
  const se = V.map((c, j) => (meas[j] ? bartlett(u, c) : NaN));
  Object.assign(S, { H, harmony: H[0].slice(1), leadership: lead, following: follow, persistence: own, standard_error: 1 / Math.sqrt(n), edge_standard_error: se });
  // counterpoint: two neighbours together against the target, at the same step and one step earlier
  const tri: { same_step: Counterpoint | null; one_step_earlier: Counterpoint | null } = { same_step: null, one_step_earlier: null };
  if (J.length >= 2) {
    const prs: [number, number][] = []; for (let x = 0; x < J.length; x++) for (let y = x + 1; y < J.length; y++) prs.push([J[x], J[y]]);
    const prod = (q: [number, number]) => Float64Array.from({ length: n }, (_, i) => V[q[0]][i] * V[q[1]][i]);
    for (const key of ['same_step', 'one_step_earlier'] as const) {
      let k = 0, rk = 0;
      prs.forEach((q, i) => { const P = prod(q), r = key === 'same_step' ? seg(u, 0, P, 0, n) : seg(u, 1, P, 0, n - 1); if (i === 0 || Math.abs(r) > Math.abs(rk)) { k = i; rk = r; } });
      const P = prod(prs[k]), sb = key === 'same_step' ? bartlett(u, P) : bartlett(u.subarray(1), P.subarray(0, n - 1)), z = sb === sb && sb > 0 ? rk / sb : 0;
      tri[key] = { pair: [ids[prs[k][0]], ids[prs[k][1]]], strength: rk, standard_error: sb, z, pairs_tried: prs.length, tail: Math.min(1, prs.length * normSf2(z)) };
    }
  }
  S.counterpoint = tri;
  // rhythm: coherence by band with the target; a phase is only as sure as the coherence behind it
  const U = Array.from(u); S.rhythm = {};
  for (const j of J) S.rhythm[ids[j]] = coherence(U, Array.from(V[j])).map((e) => {
    const o: RhythmBand = { band: e.band!, status: e.status, coherence: e.coherence, coherent: e.coherent ?? false, phase: e.phase ?? 'not supported', neighbour_leads_by: e.neighbour_leads_by ?? 'not supported' };
    if (o.coherent) {   // a phase is only as sure as the coherence behind it, and coherence at the threshold is no evidence of a phase at all
      const cx = (e.coherence! - e.threshold!) / (1 - e.threshold!), sp = Math.sqrt((1 - cx) / (2 * 0.947 * e.segments! * cx)); o.phase_standard_error = sp; o.lead_standard_error = sp * e.period! / (2 * Math.PI); o.period = e.period;
    }
    return o;
  });
  // predictive eligibility: what each neighbour adds, given the target's own past, the calendar and every other neighbour
  const p = PERSIST, m = n - p, y = Float64Array.from({ length: m }, (_, i) => u[p + i]);
  const B: Float64Array[] = [new Float64Array(m).fill(1)];
  for (let k = 0; k < p; k++) B.push(Float64Array.from({ length: m }, (_, i) => u[p - 1 - k + i]));
  B.push(Float64Array.from({ length: m }, (_, i) => Math.sin(2 * Math.PI * d[1 + p + i] / YEAR)), Float64Array.from({ length: m }, (_, i) => Math.cos(2 * Math.PI * d[1 + p + i] / YEAR)));
  const dot = (x: ArrayLike<number>, w: ArrayLike<number>) => { let s = 0; for (let i = 0; i < m; i++) s += x[i] * w[i]; return s; };
  const G = inverse(B.map((x, i) => B.map((w, j) => dot(x, w) + (i === j ? 1e-9 * m : 0))));
  const res = (x: ArrayLike<number>) => { const bx = B.map((w) => dot(w, x)), co = G.map((r) => r.reduce((s, g, j) => s + g * bx[j], 0)); return Float64Array.from({ length: m }, (_, i) => { let s = x[i]; for (let j = 0; j < B.length; j++) s -= B[j][i] * co[j]; return s; }); };
  const ry = res(y), shifted = (j: number, l: number) => Float64Array.from({ length: m }, (_, i) => V[j][p - l + i]);
  const pc = V.map((_, j) => Array.from({ length: LEADS }, (_, l) => seg(ry, 0, res(shifted(j, l + 1)), 0, m)));
  const best = pc.map((r) => 1 + r.reduce((b, x, l) => (Math.abs(x) > Math.abs(r[b]) ? l : b), 0));
  S.partial_leadership = pc; S.chosen_lag = best;
  const E = new Array(K + 1).fill(0);
  if (J.length) {
    const X = J.map((j) => res(shifted(j, best[j]))), Ai = inverse(X.map((x, i) => X.map((w, j) => dot(x, w) + (i === j ? 1e-9 * m : 0)))), xy = X.map((x) => dot(x, ry));
    const b = Ai.map((r) => r.reduce((s, g, j) => s + g * xy[j], 0)), q = B.length + J.length;
    let rss = 0; for (let i = 0; i < m; i++) { let f = ry[i]; for (let j = 0; j < J.length; j++) f -= X[j][i] * b[j]; rss += f * f; }
    const LR = b.map((bj, j) => (m / 2) * Math.log1p(bj * bj / (rss / (m - q) * Ai[j][j]) / (m - q)));
    J.forEach((j, a) => { E[1 + j] = cover[j] * Math.max(0, LR[a] - 0.5 * Math.log(m) - Math.log(LEADS)); });
    const pool = res(Float64Array.from({ length: m }, (_, i) => { let s = 0; for (const j of J) s += V[j][p - 1 + i]; return s / J.length; })), r = seg(ry, 0, pool, 0, m);
    E[0] = Math.max(0, -(m / 2) * Math.log(Math.max(1e-12, 1 - r * r)) - 0.5 * Math.log(m));
    S.log_likelihood_ratio = LR; S.pool_partial = r;
  }
  S.evidence = E; S.eligible = []; E.forEach((e, k) => { if (e > 0) S.eligible!.push(k === 0 ? '(pool)' : ids[k - 1]); });
  // temporal novelty: against the signature one full window earlier
  if (previous && previous.status === 'ok') {
    const both: number[] = []; meas.forEach((mm, j) => { if (mm && previous.measurable[j]) both.push(j); });
    const fz = (r: number) => Math.atanh(Math.min(0.999, Math.max(-0.999, r))), sd = (j: number) => Math.sqrt(se[j] ** 2 + previous.edge_standard_error![j] ** 2);
    const zz = [...both.map((j) => (fz(S.harmony![j]) - fz(previous.harmony![j])) / sd(j)), ...both.map((j) => (fz(lead[j][0]) - fz(previous.leadership![j][0])) / sd(j))];
    if (zz.length) {
      const k = zz.reduce((b, x, i) => (Math.abs(x) > Math.abs(zz[b]) ? i : b), 0);
      let became = 0, ceased = 0; E.forEach((e, i) => { if (e > 0 && previous.evidence[i] <= 0) became++; if (e <= 0 && previous.evidence[i] > 0) ceased++; });
      S.temporal_novelty = { largest_change_z: zz[k], edge: ids[both[k % both.length]], kind: k < both.length ? 'harmony' : 'leadership', tail: Math.min(1, zz.length * normSf2(zz[k])), became_eligible: became, ceased_to_be_eligible: ceased, compared_with: previous.as_of };
    }
  }
  return S;
}

/**
 * Intrinsic and relational novelty of one call against the moment S. z,
 * tails, present: the target first, then each neighbour. Returns the
 * intrinsic tail probability, the joint tail probability under a Gaussian
 * copula with the window's harmony, and the relational surprisal in nats:
 * how much more surprising the configuration is than its parts taken
 * separately. Surprise is measured here. Nothing rewards it.
 */
export function novelty(S: MomentSignature, z: number[], tails: number[], present: boolean[]): [number, number, number] {
  const use: number[] = []; present.forEach((p, i) => { if (p && (i === 0 || S.measurable[i - 1])) use.push(i); });
  const k = use.length, zz = use.map((i) => z[i]), Hi = inverse(use.map((a, i) => use.map((b, j) => (1 - SHRINK) * S.H![a][b] + (i === j ? SHRINK : 0))));
  let D2 = 0, ss = 0, tmin = Infinity; for (let i = 0; i < k; i++) { ss += zz[i] * zz[i]; tmin = Math.min(tmin, tails[use[i]]); for (let j = 0; j < k; j++) D2 += zz[i] * Hi[i][j] * zz[j]; }
  const pj = chi2sf(D2, k), pi = chi2sf(ss, k);
  return [Math.min(1, k * tmin), pj, Math.max(0, Math.log(Math.max(pi, 1e-300)) - Math.log(Math.max(pj, 1e-300)))];
}

/**
 * E[t][0..K]: the controlled evidence for the pool and for each edge at every
 * call (remeasured every `every` calls and held). With perceive, also novelty
 * at every call: [intrinsic tail, joint tail, relational surprisal, temporal
 * tail] (the last held between measurements, NaN until a window earlier
 * exists). `last` is the signature of the last moment measured.
 */
export function moments(tdays: number[], target: Channel, neighbours: Channel[], lag = 0, read: 'MOVE' | 'RANGE' = 'MOVE', shift = 0, every = RECOMPUTE, perceive = false): { E: number[][]; novelty: number[][] | null; last: MomentSignature | null } {
  const N = shift ? neighbours.map((c) => displaced(c, shift)) : neighbours, n = tdays.length, K = N.length;
  const E = tdays.map(() => new Array(K + 1).fill(0)), nov = perceive ? tdays.map(() => [NaN, NaN, NaN, NaN]) : null, hist: MomentSignature[] = [];
  if (perceive) { prepare(target); N.forEach(prepare); }
  const ti = perceive ? tdays.map((t) => countUpTo(target.days, t - 1)) : [], kid = perceive ? N.map((c) => asof(tdays, c.days, lag)) : [];
  let S: MomentSignature | null = null;
  for (let a = 0, t0 = 0; t0 < n; a++, t0 += every) {
    S = moment(target, N, tdays[t0], lag, read, a >= HORIZON ? hist[a - HORIZON] : null); hist.push(S);
    for (let t = t0; t < Math.min(t0 + every, n); t++) {
      E[t] = S.evidence;
      if (nov && S.status === 'ok') {
        const pr = [true, ...N.map((_, j) => kid[j][t] >= 0)];
        const z = [target.ns![ti[t]], ...N.map((c, j) => (pr[j + 1] ? c.ns![kid[j][t]] : 0))], tl = [target.tail![ti[t]], ...N.map((c, j) => (pr[j + 1] ? c.tail![kid[j][t]] : 1))];
        const [a1, a2, a3] = novelty(S, z, tl, pr); nov[t] = [a1, a2, a3, S.temporal_novelty ? S.temporal_novelty.tail : NaN];
      }
    }
  }
  return { E, novelty: nov, last: S };
}
