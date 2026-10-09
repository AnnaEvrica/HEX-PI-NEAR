// ===========================================================================
// The Learning Module, stage 5: EXPERIENTIAL INTEGRATION.
// Reference: validation/experience.py (parity test: tests/experience.mjs).
// Specification: validation/prereg_experience.md. Mathematics: docs/LEARNING.md.
//
//   signature   the moment that is remembered: Sigma = (X, G, Phi, U). Novelty
//               is derived from it and stored beside it, never inside it.
//   distance    how many resolvable steps apart two moments of a series are:
//               every difference multiplied by the precision with which it
//               can be resolved. A distance is never an error.
//   affinity    exp(-d^2 / 2). Continuous. Never a class.
//   experience  one moment against the Memory Library: individuality,
//               affinity, transition
//   nightly     the night's summary, numbers only
//
// Pure functions: no network, no database, no clock. Nothing here predicts,
// and nothing here feeds HEX's parameters, CER's weights or governance.
// ===========================================================================
import { asof, countUpTo } from './cer/align.ts';
import { chi2sf, moment, novelty } from './cer/graph.ts';
import { SEG } from './cer/spectrum.ts';
import type { Channel, MomentSignature } from './cer/types.ts';

export const SIGNATURE_VERSION = 'sig-1', DISTANCE_VERSION = 'dist-1', BANDWIDTH_VERSION = 'bw-1', METRIC_VERSION = 'exp-1';
/** Size of the reference a moment is compared with; moments per series in the dispersion; leadership lags kept; fewest terms for a comparison. */
export const REFERENCE = 250, DISPERSION_WINDOW = 30, LEAD_LAGS = 3, MIN_TERMS = 3, TIERS = 20;

/** The compact, comparable form of a moment. */
export interface Signature {
  v: string; cer: string; target: string; as_of: number; step: number; samples: number; lag: number; segments: number; channels: string[];
  /** Normal score of each present channel's latest change against its own history. */
  x: Record<string, number>;
  /** Harmony with each measurable neighbour, and the standard error it is known to. */
  harmony: Record<string, number>; se: Record<string, number>;
  /** Leadership at lags 1..3, per neighbour; the target's own persistence at lags 1..5. */
  lead: Record<string, number[]>; own: number[];
  /** Per neighbour and band: [coherence, phase or null, phase standard error or null]. */
  rhythm: Record<string, ([number, number | null, number | null] | null)[]>;
}
export interface Distance { version: string; comparable: boolean; d: number | null; terms: number; shared: number; overlap: number | null; components: Record<string, [number, number]>; tail: number | null }
/** An earlier moment. seq: its ordinal in its series (1 for the first); defaults to its place in the list. */
export interface Remembered { id: string; as_of: number; signature: Signature; seq?: number }
export interface Experience {
  metric: string; distance: string; bandwidth: string;
  individuality: number | null; individuality_tail: number | null; nearest_prior: string | null; nearest_components: Record<string, [number, number]> | null;
  reference_count: number; reference_full: boolean; incomparable: number;
  affinity_nearest: number | null; affinity_median: number | null; affinity_quartiles: [number, number] | null;
  transition: number | null; transition_tail: number | null; transition_components: Record<string, [number, number]> | null; transition_days: number | null; transition_rate: number | null; previous: string | null;
}

const fz = (r: number) => Math.atanh(Math.min(0.999, Math.max(-0.999, r)));
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
/** Six decimals: far finer than any of these can be resolved, and half the storage. */
const r6 = (v: number) => Math.floor(v * 1e6 + 0.5) / 1e6;
/** How many times a moment's ordinal in its series divides by two. Tier >= j keeps one moment in 2^j, evenly, for ever. */
export function tier(seq: number): number { let t = 0; while (seq > 0 && seq % 2 === 0 && t < TIERS) { seq /= 2; t++; } return t; }
/** The tier from which a series with n earlier moments draws its reference: the largest that still holds REFERENCE of them. */
export function referenceTier(n: number): number { let j = 0; while (Math.floor(n / 2 ** (j + 1)) >= REFERENCE) j++; return j; }

/** The signature of a moment S at a call: z and present are the target first, then each neighbour. */
export function signature(S: MomentSignature, step: number, z: number[], present: boolean[], ids: string[]): Signature | null {
  if (S.status !== 'ok') return null;
  const m = S.measurable, n = S.samples, sig: Signature = {
    v: SIGNATURE_VERSION, cer: S.method, target: S.target, as_of: S.as_of, step, samples: n, lag: S.lag, segments: n >= SEG ? Math.floor((n - SEG) / (SEG / 2)) + 1 : 0,
    channels: ids.filter((_, j) => m[j]), x: {}, harmony: {}, se: {}, lead: {}, own: Array.from(S.persistence!, r6), rhythm: {},
  };
  [S.target, ...ids].forEach((k, i) => { if (present[i]) sig.x[k] = r6(z[i]); });
  ids.forEach((k, j) => { if (m[j]) { sig.harmony[k] = r6(S.harmony![j]); sig.se[k] = r6(S.edge_standard_error![j]); sig.lead[k] = Array.from(S.leadership![j].slice(0, LEAD_LAGS), r6); } });
  for (const [k, bands] of Object.entries(S.rhythm ?? {})) sig.rhythm[k] = bands.map((b) => (b.status === 'ok' ? [r6(b.coherence!), b.coherent ? r6(b.phase as number) : null, b.coherent ? r6(b.phase_standard_error!) : null] : null));
  return sig;
}

/** A stable serialisation (keys sorted at every depth), and its SHA-256, for the record's integrity hash. */
export function canonical(o: unknown): string {
  if (Array.isArray(o)) return `[${o.map(canonical).join(',')}]`;
  if (o && typeof o === 'object') return `{${Object.keys(o as object).sort().map((k) => `${JSON.stringify(k)}:${canonical((o as Record<string, unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(o ?? null);
}
export async function sha256hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

/**
 * How many resolvable steps apart two moments of one series are, by component
 * and in all. Compared on the channels they share; a channel missing from one
 * contributes nothing. Not comparable (and no number) when they share fewer
 * than half of the smaller one's channels or fewer than MIN_TERMS terms.
 * `tail` is the chance of a distance this large from measurement noise alone.
 */
export function distance(si: Signature | null, sj: Signature | null): Distance {
  const out: Distance = { version: DISTANCE_VERSION, comparable: false, d: null, terms: 0, shared: 0, overlap: null, components: {}, tail: null };
  if (!si || !sj || si.target !== sj.target || si.v !== sj.v) return out;
  const shared = si.channels.filter((c) => c in sj.harmony), n = Math.min(si.samples, sj.samples), o = Math.max(0, n - Math.abs(si.step - sj.step)) / n, w = Math.max(1 - o, 1 / n);
  out.shared = shared.length; out.overlap = o;
  if (shared.length * 2 < Math.min(si.channels.length, sj.channels.length)) return out;
  const T: Record<string, number[]> = { state: [], harmony: [], leadership: [], persistence: [], rhythm: [], phase: [] };
  for (const c of Object.keys(si.x)) if (c in sj.x) T.state.push((si.x[c] - sj.x[c]) ** 2 / 2);
  for (const c of shared) {
    const v = (si.se[c] ** 2 + sj.se[c] ** 2) * w;
    T.harmony.push((fz(si.harmony[c]) - fz(sj.harmony[c])) ** 2 / v);
    for (let l = 0; l < Math.min(si.lead[c].length, sj.lead[c].length); l++) T.leadership.push((fz(si.lead[c][l]) - fz(sj.lead[c][l])) ** 2 / v);
  }
  for (let l = 0; l < Math.min(si.own.length, sj.own.length); l++) T.persistence.push((fz(si.own[l]) - fz(sj.own[l])) ** 2 / ((1 / (si.samples - 3) + 1 / (sj.samples - 3)) * w));
  const K = 0.947 * Math.min(si.segments, sj.segments);
  // a spectral estimate moves with where its segments fall, so it is compared only between windows that share nothing
  if (o === 0) for (const c of shared) {
    const ra = si.rhythm[c] ?? [], rb = sj.rhythm[c] ?? [];
    for (let k = 0; k < Math.min(ra.length, rb.length); k++) {
      const a = ra[k], b = rb[k];
      if (!a || !b || K <= 0) continue;
      if (a[1] !== null || b[1] !== null) T.rhythm.push((fz(Math.sqrt(a[0])) - fz(Math.sqrt(b[0]))) ** 2 * K / w);
      if (a[1] !== null && b[1] !== null) T.phase.push(wrap(a[1] - b[1]) ** 2 / ((a[2]! ** 2 + b[2]! ** 2) * w));
    }
  }
  let tot = 0, m = 0;
  for (const v of Object.values(T)) { for (const x of v) tot += x; m += v.length; }
  if (m < MIN_TERMS) return out;
  for (const [k, v] of Object.entries(T)) if (v.length) out.components[k] = [Math.sqrt(v.reduce((s, x) => s + x, 0) / v.length), v.length];
  out.comparable = true; out.terms = m; out.d = Math.sqrt(tot / m); out.tail = chi2sf(tot, m);
  return out;
}

/** Continuous affinity: one resolvable step is the bandwidth. */
export const affinity = (d: number) => Math.exp(-d * d / 2);

export function quantile(values: number[], q: number): number {
  const v = [...values].sort((a, b) => a - b), k = (v.length - 1) * q, lo = Math.floor(k), hi = Math.min(lo + 1, v.length - 1);
  return v[lo] + (v[hi] - v[lo]) * (k - lo);
}

/**
 * One moment against the library. `history`: earlier moments of the same
 * series, most recent first; history[0] is the previous moment. Individuality
 * and affinity are taken against a reference of fixed size spread evenly over
 * all of that past, so they do not shrink merely because the library grows
 * and a configuration that returns after years can still be recognised. The
 * reference is drawn from the moments of tier >= referenceTier(n), so the
 * library never has to be read whole: the result is the same whether
 * `history` holds every earlier moment or only those tiers and the previous
 * one. Transition is to the previous moment. Each is null where no comparison
 * supports it.
 */
export function experience(sig: Signature, history: Remembered[]): Experience {
  const E: Experience = {
    metric: METRIC_VERSION, distance: DISTANCE_VERSION, bandwidth: BANDWIDTH_VERSION, individuality: null, individuality_tail: null, nearest_prior: null, nearest_components: null,
    reference_count: 0, reference_full: false, incomparable: 0, affinity_nearest: null, affinity_median: null, affinity_quartiles: null,
    transition: null, transition_tail: null, transition_components: null, transition_days: null, transition_rate: null, previous: null,
  };
  const seqs = history.map((h, i) => h.seq ?? history.length - i), n = history.length ? seqs[0] : 0, j = referenceTier(n);
  const cand = history.filter((_, i) => tier(seqs[i]) >= j), c = cand.length, pick = c <= REFERENCE ? cand : Array.from({ length: REFERENCE }, (_, k) => cand[Math.floor(k * (c - 1) / (REFERENCE - 1) + 0.5)]);
  const ref: { D: Distance; h: Remembered }[] = [];
  for (const h of pick) { const D = distance(sig, h.signature); if (D.comparable) ref.push({ D, h }); else E.incomparable++; }
  if (ref.length) {
    let best = ref[0]; for (const r of ref) if (r.D.d! < best.D.d!) best = r;
    const aff = ref.map((r) => affinity(r.D.d!));
    Object.assign(E, { individuality: best.D.d, individuality_tail: best.D.tail, nearest_prior: best.h.id, nearest_components: best.D.components, reference_count: ref.length, reference_full: n >= REFERENCE,
      affinity_nearest: affinity(best.D.d!), affinity_median: quantile(aff, 0.5), affinity_quartiles: [quantile(aff, 0.25), quantile(aff, 0.75)] });
  }
  if (history.length) {
    const D = distance(sig, history[0].signature), days = sig.as_of - history[0].as_of;
    E.previous = history[0].id; E.transition_days = days;
    if (D.comparable) Object.assign(E, { transition: D.d, transition_tail: D.tail, transition_components: D.components, transition_rate: days > 0 ? D.d! / days : null });
  }
  return E;
}

/** The night's summary. rows: tonight's moments. recent: per series, its last moments' signatures, tonight's first. Numbers only. */
export function nightly(rows: { E: Experience; channels: string[] }[], recent: Record<string, Signature[]>) {
  const dist = (v: number[]) => (v.length ? { median: quantile(v, 0.5), p90: quantile(v, 0.9), max: Math.max(...v), count: v.length } : {});
  const num = (f: (e: Experience) => number | null) => rows.map((r) => f(r.E)).filter((x): x is number => x !== null);
  const I = num((e) => e.individuality), T = num((e) => e.transition), V = num((e) => e.transition_rate), A = num((e) => e.affinity_nearest), Am = num((e) => e.affinity_median), days = num((e) => e.transition_days);
  const pairs: number[] = [];
  for (const sigs of Object.values(recent)) {
    const s = sigs.slice(0, DISPERSION_WINDOW);
    for (let a = 0; a < s.length; a++) for (let b = a + 1; b < s.length; b++) { const D = distance(s[a], s[b]); if (D.comparable) pairs.push(D.d!); }
  }
  return {
    moment_count: rows.length,
    individuality: { ...dist(I), unavailable: rows.length - I.length },
    transitions: { ...dist(T), unavailable: rows.length - T.length, median_rate: V.length ? quantile(V, 0.5) : null, median_days: days.length ? quantile(days, 0.5) : null },
    affinities: { nearest_median: A.length ? quantile(A, 0.5) : null, strongest: A.length ? Math.max(...A) : null, median_quartiles: Am.length ? [quantile(Am, 0.25), quantile(Am, 0.5), quantile(Am, 0.75)] : null },
    dispersion: { median: pairs.length ? quantile(pairs, 0.5) : null, pairs: pairs.length, rule: `last-${DISPERSION_WINDOW}-per-series-all-pairs` },
    continuity: { nearest_is_previous: rows.filter((r) => r.E.nearest_prior !== null && r.E.nearest_prior === r.E.previous).length, with_nearest: I.length },
    measurement_coverage: { moments: rows.length, incomparable: rows.reduce((s, r) => s + r.E.incomparable, 0), channels_median: rows.length ? quantile(rows.map((r) => r.channels.length), 0.5) : null },
    metric_version: METRIC_VERSION, distance_version: DISTANCE_VERSION, bandwidth_version: BANDWIDTH_VERSION, signature_version: SIGNATURE_VERSION,
  };
}

/** Perceive the moment of `target` at `upto` (values of the same tick) and return its signature and its novelty. Channels must be prepared. */
export function momentOf(target: Channel, neighbours: Channel[], upto: number): { signature: Signature; novelty: { intrinsic_tail: number; joint_tail: number; relational_surprisal: number } } | null {
  const S = moment(target, neighbours, upto, 0, 'MOVE');
  if (S.status !== 'ok') return null;
  const ti = countUpTo(target.days, upto) - 1, kid = neighbours.map((c) => asof([upto], c.days, 0)[0]), pr = [true, ...kid.map((k) => k >= 0)];
  const z = [target.ns![ti], ...neighbours.map((c, j) => (kid[j] >= 0 ? c.ns![kid[j]] : 0))], tl = [target.tail![ti], ...neighbours.map((c, j) => (kid[j] >= 0 ? c.tail![kid[j]] : 1))];
  const nv = novelty(S, z, tl, pr), sig = signature(S, ti, z, pr, neighbours.map((c) => c.id));
  return sig ? { signature: sig, novelty: { intrinsic_tail: nv[0], joint_tail: nv[1], relational_surprisal: nv[2] } } : null;
}
