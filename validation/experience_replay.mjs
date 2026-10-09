// E12 (prereg_experience.md): the nightly stage itself, base44/shared/memory.ts,
// run night by night on the 27 real market series with an in-memory database.
//   python3 (see README) writes data/markets_channels.json; node experience_replay.mjs
// Writes experience/nightly.json (every nightly record), experience/moments.csv
// (every moment, without its signature), experience/moment_samples.json (whole
// rows) and experience/real_series.json (what E12 is judged on).
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)), tmp = path.join(here, '..', 'tests', 'backend-smoke', 'out'); fs.mkdirSync(tmp, { recursive: true });
fs.writeFileSync(path.join(tmp, '_replay_entry.ts'), `export * from '../../../base44/shared/experience.ts'; export * from '../../../base44/shared/memory.ts';`);
await build({ entryPoints: [path.join(tmp, '_replay_entry.ts')], bundle: true, format: 'esm', outfile: path.join(tmp, 'replay_experience.mjs'), logLevel: 'error' });
const X = await import(path.join(tmp, 'replay_experience.mjs'));
let S = JSON.parse(fs.readFileSync(path.join(here, 'data', 'markets_channels.json'), 'utf8')); const NIGHTS = Number(process.env.NIGHTS || 400), SURROGATE = Number(process.env.SURROGATE || 0);
if (SURROGATE) {    // control, added after the first run: the same series with their days put in a random order, the same order for every series. Each day's cross-section is kept whole; everything that unfolds in time is destroyed
  const U = [...new Set(S.flatMap((s) => s.days))].sort((a, b) => a - b), P = U.slice(); let seed = SURROGATE; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = P.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [P[i], P[j]] = [P[j], P[i]]; }
  const to = new Map(U.map((u, i) => [u, P[i]]));
  S = S.map((s) => { const o = s.days.map((d, i) => [to.get(d), s.returns[i]]).sort((a, b) => a[0] - b[0]); return { ticker: s.ticker, days: o.map((x) => x[0]), returns: o.map((x) => x[1]) }; });
}
const plain = (o) => JSON.parse(JSON.stringify(o));
const table = () => { const rows = []; let id = 0;
  const match = (r, q) => Object.entries(q || {}).every(([k, v]) => r[k] === v);
  const sorted = (v, s) => { if (!s) return v; const desc = s[0] === '-', k = desc ? s.slice(1) : s; return v.slice().sort((a, b) => (a[k] < b[k] ? -1 : a[k] > b[k] ? 1 : 0) * (desc ? -1 : 1)); };
  return { rows, create: async (o) => { const r = { id: String(++id), ...plain(o) }; rows.push(r); return r; }, update: async () => { throw new Error('append-only'); },
    filter: async (q, s, n) => { const v = sorted(rows.filter((r) => match(r, q)), s); return n ? v.slice(0, n) : v; }, list: async (s, n) => { const v = sorted(rows, s); return n ? v.slice(0, n) : v; } }; };
const db = { MomentMemory: table(), NightlyCalibration: table() }, base44 = { asServiceRole: { entities: db } };
const end = Math.max(...S.map((s) => s.days[s.days.length - 1])), iso = (d) => new Date(d * 86400000).toISOString().slice(0, 10), t0 = Date.now(); let ms = [];
for (let D = end - NIGHTS + 1; D <= end; D++) {
  const night = S.map((s) => { let k = 0; while (k < s.days.length && s.days[k] <= D) k++; return { ticker: s.ticker, returns: s.returns.slice(0, k), timestamps: [s.days[0] - 1, ...s.days.slice(0, k)].map((d) => d * 86400) }; });
  const r = await X.integrateExperience(base44, night, { date: iso(D), engine_version: 'replay', status: {}, failed: [] }); ms.push(r.elapsed_ms);
  if ((D - end + NIGHTS) % 50 === 0) console.log(iso(D), r.moments, 'moments', r.elapsed_ms, 'ms');
}
const M = db.MomentMemory.rows, N = db.NightlyCalibration.rows, W = SURROGATE ? () => {} : fs.writeFileSync, J = (r, keys) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, keys.includes(k) ? JSON.parse(v) : v]));
const NJ = ['hex_precision', 'individuality', 'transitions', 'dispersion', 'affinities', 'continuity', 'experience_reference', 'replay_integrity', 'measurement_coverage', 'governance_reference'];
W(path.join(here, 'experience', 'nightly.json'), JSON.stringify(N.map((r) => { const o = J(r, NJ); o.experience_reference = { ...o.experience_reference, moments: Object.keys(o.experience_reference.moments).length }; delete o.id; return o; })));
const cols = ['moment_id', 'run_id', 'series_id', 'as_of', 'seq', 'tier', 'step', 'samples', 'intrinsic_tail', 'joint_tail', 'relational_surprisal', 'individuality', 'nearest_prior', 'reference_count', 'reference_full', 'incomparable', 'affinity_nearest', 'affinity_median', 'transition', 'transition_days', 'transition_rate', 'signature_hash'];
W(path.join(here, 'experience', 'moments.csv'), [cols.join(','), ...M.map((r) => cols.map((c) => (typeof r[c] === 'number' && !Number.isInteger(r[c]) ? Number(r[c].toPrecision(7)) : r[c] ?? '')).join(','))].join('\n') + '\n');
const pickRows = [M.find((r) => r.series_id === 'BTC-USD' && r.seq === 2), M.filter((r) => r.series_id === 'FX-Euro').slice(-1)[0], M.filter((r) => r.series_id === 'WTI').slice(-1)[0]];
W(path.join(here, 'experience', 'moment_samples.json'), JSON.stringify(pickRows.map((r) => { const o = J(r, ['signature', 'components']); delete o.id; return o; }), null, 1));
// a spread of moments for the reference implementation to recompute
const idx = Array.from({ length: 40 }, (_, k) => Math.floor(k * (M.length - 1) / 39));
W(path.join(here, 'data', 'experience_check.json'), JSON.stringify(idx.map((i) => ({ series_id: M[i].series_id, as_of_day: M[i].as_of_day, step: M[i].step, signature: JSON.parse(M[i].signature), novelty: [M[i].intrinsic_tail, M[i].joint_tail, M[i].relational_surprisal], previous: M[i].previous ? JSON.parse(M.find((r) => r.moment_id === M[i].previous).signature) : null, transition: M[i].transition ?? null, individuality: M[i].individuality ?? null }))));
// E12
const mean = (v) => v.reduce((s, x) => s + x, 0) / v.length, med = (v) => X.quantile(v, 0.5), Q = (v) => ({ mean: Number(mean(v).toFixed(4)), median: Number(med(v).toFixed(4)), p90: Number(X.quantile(v, 0.9).toFixed(4)), p99: Number(X.quantile(v, 0.99).toFixed(4)), max: Number(Math.max(...v).toFixed(4)) }), T = M.filter((r) => typeof r.transition === 'number'), comp = {};
for (const r of T) for (const [k, v] of Object.entries(JSON.parse(r.components).transition ?? {})) (comp[k] ??= []).push(v[0]);
const compMean = Object.fromEntries(Object.entries(comp).map(([k, v]) => [k, Number(mean(v).toFixed(4))])), largest = Object.entries(compMean).sort((a, b) => b[1] - a[1])[0][0];
const comparisons = M.reduce((s, r) => s + (r.reference_count ?? 0) + (r.incomparable ?? 0), 0), incomparable = M.reduce((s, r) => s + (r.incomparable ?? 0), 0), I = M.filter((r) => typeof r.individuality === 'number');
const out = {
  nights: N.length, moments: M.length, series: S.length, from: N[0].date, to: N[N.length - 1].date,
  E12: { mean_transition: Number(mean(T.map((r) => r.transition)).toFixed(4)), transition_above_one: mean(T.map((r) => r.transition)) > 1, component_means: compMean, largest_component: largest, state_is_largest: largest === 'state',
    incomparable_share: Number((incomparable / comparisons).toFixed(6)), incomparable_below_5pct: incomparable / comparisons < 0.05 },
  transition: { ...Q(T.map((r) => r.transition)), unavailable: M.length - T.length, components_p90: Object.fromEntries(Object.entries(comp).map(([k, v]) => [k, Number(X.quantile(v, 0.9).toFixed(4))])) },
  individuality: { ...Q(I.map((r) => r.individuality)), unavailable: M.length - I.length,
    median_first_100_nights: med(I.filter((r) => r.run_id <= N[Math.min(99, N.length - 1)].date).map((r) => r.individuality)), median_last_100_nights: med(I.filter((r) => r.run_id > N[Math.max(0, N.length - 101)].date).map((r) => r.individuality)), reference_full_at_the_end: M.filter((r) => r.run_id === N[N.length - 1].date && r.reference_full).length },
  nearest_is_previous_share: mean(I.map((r) => +(r.nearest_prior === r.previous))),
  dispersion_median_of_nights: med(N.map((r) => JSON.parse(r.dispersion).median).filter((x) => x !== null)),
  integrity: { nights_checked: N.filter((r) => JSON.parse(r.replay_integrity).checked).length, reproduced: N.filter((r) => JSON.parse(r.replay_integrity).reproduced === true).length },
  cost: { median_ms_per_night: med(ms), max_ms_per_night: Math.max(...ms), largest_moment_bytes: Math.max(...M.map((r) => JSON.stringify(r).length)), total_ms: Date.now() - t0 },
};
fs.writeFileSync(path.join(here, 'experience', SURROGATE ? `control_shuffled_days_${SURROGATE}.json` : 'real_series.json'), JSON.stringify(SURROGATE ? { control: 'days in a random order, the same for every series', seed: SURROGATE, ...out } : out, null, 1)); console.log(JSON.stringify(out, null, 1));
