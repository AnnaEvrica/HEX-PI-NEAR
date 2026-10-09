// The Learning Module, stage 5 (Experiential Integration) and the Memory Library.
//   1. parity: base44/shared/experience.ts against the reference
//      (validation/experience.py) on built signals, to rounding
//   2. the nightly stage on an in-memory database: append-only, idempotent,
//      a rolling history, the sparse read of the library, the hash chain
//   3. the nightly function with the stage working and with it failing:
//      everything the calibration writes and returns is the same
//   4. cost at 27 series of 3,900 bars
//   python3 validation/experience_tests.py   (writes tests/experience_reference.json)
//   node tests/backend-smoke/build.mjs && node tests/experience.mjs
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, 'backend-smoke', 'out'); fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, '_experience_entry.ts'), `export * from '../../../base44/shared/experience.ts'; export * from '../../../base44/shared/memory.ts'; export * as cer from '../../../base44/shared/cer/index.ts';`);
const out = path.join(outDir, 'experience.mjs');
await build({ entryPoints: [path.join(outDir, '_experience_entry.ts')], bundle: true, format: 'esm', outfile: out, logLevel: 'error' });
const X = await import(out), cer = X.cer;
const ref = JSON.parse(fs.readFileSync(path.join(here, 'experience_reference.json'), 'utf8'));
let bad = 0, worst = 0;
const diff = (a, b) => {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b);
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length ? a.reduce((m, x, i) => Math.max(m, diff(x, b[i])), 0) : 1;
  if (a && b && typeof a === 'object' && typeof b === 'object') { const ka = Object.keys(a).sort(), kb = Object.keys(b).sort(); return ka.join() === kb.join() ? ka.reduce((m, k) => Math.max(m, diff(a[k], b[k])), 0) : 1; }
  return a === b ? 0 : 1;
};
const plain = (o) => JSON.parse(JSON.stringify(o));
const parity = (label, d) => { worst = Math.max(worst, d); const ok = d < 1e-9; if (!ok) bad++; console.log(ok ? 'PASS' : 'FAIL', label, `max difference ${Number(d).toExponential(2)}`); };
const check = (label, ok, note = '') => { if (!ok) bad++; console.log(ok ? 'PASS' : 'FAIL', label, note); };

// ---- 1. parity with the reference
const C = ref.channels.map((c) => cer.prepare(cer.channel(c.id, 'lab', c.days, c.changes)));
const H = [], sigs = [], exps = [], novs = [];
for (const d of ref.days) {
  const got = X.momentOf(C[0], C.slice(1), d), E = X.experience(got.signature, H), id = `${got.signature.target}|${d}`;
  sigs.push(got.signature); exps.push(E); novs.push(got.novelty); H.unshift({ id, as_of: d, signature: got.signature, seq: H.length + 1 });
}
parity(`signatures: ${sigs.length} moments`, diff(plain(sigs), ref.signatures));
parity('novelty beside each signature', diff(plain(novs), ref.novelty));
parity('experience: individuality, affinity, transition', diff(plain(exps), ref.experience));
parity(`distances: ${ref.distances.length} pairs, by component`, diff(plain(sigs.slice(0, -1).map((s) => X.distance(sigs[sigs.length - 1], s))), ref.distances));
parity('phase is circular', diff(plain(X.distance(ref.phase_case.a, ref.phase_case.b)), ref.phase_case.distance));
parity('a missing channel contributes nothing', diff(plain(X.distance(ref.missing_case.a, ref.missing_case.b)), ref.missing_case.distance));
parity('too little in common: no number', diff(plain(X.distance(ref.missing_case.a, ref.missing_case.c)), ref.missing_case.none));
parity('nightly summary', diff(plain(X.nightly(ref.nightly_rows, { c0: sigs.slice().reverse() })), ref.nightly));
check('the signature holds no novelty', sigs.every((s) => !Object.keys(s).some((k) => /novel|tail|surpris/.test(k))));

// ---- in-memory entities (equality filters, sort, limit: all the stage uses)
const table = () => { const rows = []; let id = 0, updates = 0, reads = 0, most = 0;
  const match = (r, q) => Object.entries(q || {}).every(([k, v]) => r[k] === v);
  const sorted = (v, s) => { if (!s) return v; const desc = s[0] === '-', k = desc ? s.slice(1) : s; return v.slice().sort((a, b) => (a[k] < b[k] ? -1 : a[k] > b[k] ? 1 : 0) * (desc ? -1 : 1)); };
  const take = (v, n) => { const o = n ? v.slice(0, n) : v; reads++; most = Math.max(most, o.length); return plain(o); };
  return { rows, stats: () => ({ updates, reads, most }), create: async (o) => { const r = { id: String(++id), ...plain(o) }; rows.push(r); return r; },
    update: async () => { updates++; }, delete: async () => { updates++; },
    filter: async (q, s, n) => take(sorted(rows.filter((r) => match(r, q)), s), n), list: async (s, n) => take(sorted(rows, s), n) }; };
const mkdb = () => { const db = { MomentMemory: table(), NightlyCalibration: table() }; return { db, base44: { asServiceRole: { entities: db } } }; };
// built series: a shared driver, one leader, noise. Deterministic.
let seed = 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return (seed + 0.5) / 4294967296; }, g = () => Math.sqrt(-2 * Math.log(rnd())) * Math.cos(2 * Math.PI * rnd());
const make = (K, n) => { const drv = Array.from({ length: n }, g); return Array.from({ length: K }, (_, k) => ({ ticker: `S${k}`, r: drv.map((d, i) => 0.01 * ((k % 3 ? 0.5 : 0) * d + (k === 1 && i ? 0.4 * drv[i - 1] : 0) + g())) })); };
const night = (S, end, from = 0) => S.map((s) => ({ ticker: s.ticker, returns: s.r.slice(from + 1, end), timestamps: Array.from({ length: end - from }, (_, i) => (10000 + from + i) * 86400 + 3600) }));
const dateOf = (end) => new Date((10000 + end) * 86400000).toISOString().slice(0, 10);
const ctx = (end) => ({ date: dateOf(end), engine_version: 'test', status: { MOVE: { live_engine: 'hex-7.0', decision: 'hold', verified: null, bits_candidate: 0.01 } }, failed: [] });

// ---- 2. the stage, night after night. Three series over 620 nights, the fetched history rolling forward, so the reference comes from the tiers.
{
  const S = make(3, 1600), { db, base44 } = mkdb(), NIGHTS = 620, first = 1600 - NIGHTS, ROLL = 900; let last = null;
  for (let end = first; end <= 1600; end++) last = await X.integrateExperience(base44, night(S, end, end - ROLL), ctx(end));
  const M = db.MomentMemory.rows, N = db.NightlyCalibration.rows;
  check('one moment per series per night, one summary per night', M.length === 3 * (NIGHTS + 1) && N.length === NIGHTS + 1, `${M.length} moments, ${N.length} nights`);
  check('moment identifiers are unique', new Set(M.map((r) => r.moment_id)).size === M.length);
  const again = await X.integrateExperience(base44, night(S, 1600, 1600 - ROLL), ctx(1600));
  check('E9 a second run on the same night writes nothing', again.recorded === false && M.length === 3 * (NIGHTS + 1) && N.length === NIGHTS + 1);
  const weekend = await X.integrateExperience(base44, night(S, 1600, 1600 - ROLL), { ...ctx(1601) });
  check('a night with no new bar records the night and no moment', weekend.recorded && weekend.moments === 0 && M.length === 3 * (NIGHTS + 1) && N.length === NIGHTS + 2 && weekend.no_new_bar.length === 3);
  check('nothing in the library was ever updated or deleted', db.MomentMemory.stats().updates === 0 && db.NightlyCalibration.stats().updates === 0);
  const s0 = M.filter((r) => r.series_id === 'S0');
  check('the step counts on from the previous moment while the fetched history rolls', s0.every((r, i) => i === 0 || r.step === s0[i - 1].step + 1) && s0.every((r, i) => r.seq === i + 1 && r.tier === X.tier(i + 1)));
  // the sparse read gives what the whole library gives
  let d = 0, used = 0;
  for (const r of s0.slice(-40)) {
    const full = s0.filter((h) => h.seq < r.seq).reverse().map((h) => ({ id: h.moment_id, as_of: h.as_of_day, signature: JSON.parse(h.signature), seq: h.seq }));
    const E = X.experience(JSON.parse(r.signature), full); used = Math.max(used, X.referenceTier(r.seq - 1));
    d = Math.max(d, diff([E.individuality, E.affinity_median, E.transition, E.reference_count], [r.individuality, r.affinity_median, r.transition, r.reference_count]), E.nearest_prior === r.nearest_prior ? 0 : 1);
  }
  parity(`the reference read by tiers (tier ${used}) is the reference from the whole library`, d);
  check('the library is never read whole', db.MomentMemory.stats().most <= 2 * X.REFERENCE, `largest read ${db.MomentMemory.stats().most} rows of ${M.length}`);
  check('every moment after the first has a transition and an individuality, the first has neither', s0[0].individuality === undefined && s0[0].transition === undefined && s0.slice(1).every((r) => r.transition > 0 && r.individuality > 0));
  const refs = N.map((r) => JSON.parse(r.experience_reference));
  check('each night is chained to the night before', refs.every((r, i) => i === 0 ? r.previous_run === null : r.previous_run === N[i - 1].run_id) && new Set(refs.map((r) => r.chain)).size === N.length);
  check('replay integrity: a moment perceived again from the raw bars has the stored hash', N.slice(0, -1).every((r) => JSON.parse(r.replay_integrity).reproduced === true));
  const n1 = N[N.length - 2];
  check('the nightly record carries every required field', ['run_id', 'date', 'hex_precision', 'cer_version', 'moment_count', 'individuality', 'transitions', 'dispersion', 'affinities', 'experience_reference', 'replay_integrity', 'measurement_coverage', 'metric_version', 'distance_version', 'bandwidth_version', 'governance_reference'].every((k) => n1[k] !== undefined));
  check('the nightly record is numbers and references, no prose', Object.values(n1).every((v) => typeof v !== 'string' || v.length < 40 || v[0] === '{'));
  // a run that stopped half way: the moments it wrote are not written again, and the night is completed
  const { db: db2, base44: b2 } = mkdb(); await X.integrateExperience(b2, night(S, 1400), ctx(1400));
  const half = { asServiceRole: { entities: { MomentMemory: db2.MomentMemory, NightlyCalibration: { ...db2.NightlyCalibration, create: async () => { throw new Error('stopped'); } } } } };
  await X.integrateExperience(half, night(S, 1401), ctx(1401)).catch(() => {});
  const done = await X.integrateExperience(b2, night(S, 1401), ctx(1401));
  check('a night that stopped half way is completed without writing a moment twice', done.recorded && done.moments === 3 && db2.MomentMemory.rows.length === 6 && db2.NightlyCalibration.rows.length === 2);
  // a series that cannot be read is named and the others are recorded
  const { db: db3, base44: b3 } = mkdb(), brokenNight = night(S, 1400); brokenNight[2].returns[5] = NaN;
  const br = await X.integrateExperience(b3, brokenNight, ctx(1400));
  check('a series with a bad bar is left out and named; the others are recorded', br.moments === 2 && br.without_a_moment.includes('S2') && JSON.parse(db3.NightlyCalibration.rows[0].measurement_coverage).without_a_moment.includes('S2'));
  console.log('  sample night:', JSON.stringify({ individuality: JSON.parse(n1.individuality), transitions: JSON.parse(n1.transitions), dispersion: JSON.parse(n1.dispersion) }));
}

// ---- 3. the nightly function: with the stage working, and with the Memory Library refusing every call
{
  const { load } = await import('./backend-smoke/harness.mjs'); const handler = await load('calibrateCognition');
  const VOLATILE = new Set(['elapsed_ms', 'per_series_ms', 'promoted_at', 'made_at', 'experiential']);   // wall-clock stamps, and the stage's own report
  const strip = (o) => JSON.parse(JSON.stringify(o, (k, v) => (VOLATILE.has(k) ? undefined : v)));
  const run = async (broken) => {
    const log = [], ent = (name) => new Proxy({}, { get: (_, m) => async (...a) => { if (broken && (name === 'MomentMemory' || name === 'NightlyCalibration')) throw new Error('library unavailable'); log.push({ name, m, a }); return m === 'create' ? { id: 'x1', ...a[0] } : m === 'update' ? {} : []; } });
    const entities = new Proxy({}, { get: (_, name) => ent(name) });
    globalThis.__base44 = { auth: { me: async () => null }, entities, asServiceRole: { entities } };
    const res = await handler(new Request('https://app.test/fn', { method: 'POST', body: '{}' })), json = await res.json();
    return { json, core: log.filter((w) => w.name !== 'MomentMemory' && w.name !== 'NightlyCalibration' && (w.m === 'create' || w.m === 'update')), mem: log.filter((w) => w.name === 'MomentMemory' || w.name === 'NightlyCalibration') };
  };
  const a = await run(false), b = await run(true);
  check('E10 with the stage failing, the calibration still completes', b.json.ok === true && b.json.experiential.ok === false && a.json.experiential.ok === true, JSON.stringify(a.json.experiential).slice(0, 160));
  check('E10 everything the calibration returns is the same either way', JSON.stringify(strip(a.json)) === JSON.stringify(strip(b.json)));
  check('E10 everything the calibration writes to the ledger and the status is the same either way', a.core.length > 0 && JSON.stringify(strip(a.core)) === JSON.stringify(strip(b.core)), `${a.core.length} writes`);
  check('the stage writes only to the Memory Library, and only by appending', a.mem.every((w) => ['create', 'filter', 'list'].includes(w.m)) && a.mem.some((w) => w.m === 'create'));
}

// ---- 4. cost: 27 series, 3,900 bars
{
  const S = make(27, 3900), { db, base44 } = mkdb(); await X.integrateExperience(base44, night(S, 3899), ctx(3899));
  const r = await X.integrateExperience(base44, night(S, 3900), ctx(3900)), big = Math.max(...db.MomentMemory.rows.map((x) => JSON.stringify(x).length));
  check('E11 27 series of 3,900 bars in under 10 seconds; a moment under 20 kB', r.elapsed_ms < 10000 && big < 20000 && r.moments === 27, `${r.elapsed_ms} ms, largest moment ${big} bytes, ${db.MomentMemory.stats().reads} reads`);
}
console.log(bad ? `${bad} FAILED` : `ALL PASSED (largest difference ${worst.toExponential(2)})`); process.exit(bad ? 1 : 0);
