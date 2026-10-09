// CER parity: base44/shared/cer/*.ts against the reference (validation/cercore.py)
// on the synthetic signals of validation/cer_synthetic.py, whose relationships
// are known. The tested mathematics and the module's mathematics must be the
// same to rounding. Also checks ingestion (normalize.ts), which has no Python twin.
//   python3 validation/cer_synthetic.py   (writes tests/cer_reference.json)
//   node tests/cer.mjs
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, 'backend-smoke', 'out'); fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'cer.mjs');
await build({ entryPoints: [path.join(here, '..', 'base44', 'shared', 'cer', 'index.ts')], bundle: true, format: 'esm', outfile: out, logLevel: 'error' });
const cer = await import(out);
const ref = JSON.parse(fs.readFileSync(path.join(here, 'cer_reference.json'), 'utf8'));
let bad = 0, worst = 0;
const report = (label, d, extra = '') => { if (Number.isFinite(d)) worst = Math.max(worst, d); const ok = d < 1e-9; if (!ok) bad++; console.log(ok ? 'PASS' : 'FAIL', label, extra, `max difference ${Number(d).toExponential(2)}`); };
const mk = (c) => { const ch = cer.channel(c.id, c.env ?? '', c.days, c.changes, c.unit ?? '', c.source ?? ''); cer.coordinates(ch); return ch; };
/** Largest difference between two JSON values; 1 where their shape or a non-numeric value differs. */
const diff = (a, b) => {
  if (typeof a === 'number' && typeof b === 'number') return Number.isNaN(a) && Number.isNaN(b) ? 0 : Math.abs(a - b);
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length ? a.reduce((m, x, i) => Math.max(m, diff(x, b[i])), 0) : 1;
  if (a && b && typeof a === 'object' && typeof b === 'object') { const ka = Object.keys(a).sort(), kb = Object.keys(b).sort(); return ka.join() === kb.join() ? ka.reduce((m, k) => Math.max(m, diff(a[k], b[k])), 0) : 1; }
  return a === b ? 0 : 1;
};

// ---- measurement: every edge of every case
for (const c of ref.measure) {
  const ours = cer.edges(mk(c.target), mk(c.neighbour), c.others.map(mk), c.upto), plain = JSON.parse(JSON.stringify(ours));
  report(`measure: ${c.label}`, diff(plain, c.edges), `${ours.length} edges,`);
}
// ---- the measured edge weight w = A.L.C.Q
for (const c of ref.weight) report(`weight: ${c.label}`, diff(JSON.parse(JSON.stringify(cer.edgeWeight(mk(c.target), mk(c.neighbour), c.others.map(mk), c.upto, c.lead, c.read))), c.weight));
// ---- alignment: which observation a call may see
for (const c of ref.asof) report(`asof: lag ${c.lag}, shift ${c.shift}`, diff(Array.from(cer.asof(c.tdays, c.jdays, c.lag, c.shift)), c.k), `${c.k.length} calls,`);
// ---- inference: every call, and the final shares
for (const c of ref.infer) {
  const N = c.neighbours.map(mk), { F, M } = cer.features(c.days, N, c.lag), ew = c.pq ? cer.edgeWeights(c.days, mk(c.target), N, c.lag) : undefined, W = ew?.W, w = cer.walkCer(c.offset, c.y, F, M, true, W, ew ? { E: ew.E, T: cer.temperatures(ew.E, M) } : undefined);
  const d = c.pq ? Math.max(diff(w.steps.map((s) => s.pq), c.pq), diff(w.steps.map((s) => s.pe), c.pe), diff(w.steps.map((s) => s.pt), c.pt), diff(W[W.length - 1], c.W_last)) : diff(w.steps[w.steps.length - 1].share, c.share);
  report(`infer: ${c.label}`, Math.max(diff(w.steps.map((s) => s.p), c.p), d), `${c.p.length} calls,`);
}
// ---- relaxation: the distribution over interpretations, and the temperature rule on a relationship that keeps switching
{
  const r = ref.relax, E = [], M = [];
  r.E.forEach((row, a) => { for (let k = 0; k < 25; k++) { E.push(row); M.push(r.M[a]); } });
  const T = cer.temperatures(E, M).filter((_, i) => i % 25 === 0);
  report('relaxation: interpretations and temperatures', Math.max(diff(cer.interpretations([3.0, 0.0, 1.0, 7.5], [true, true, false, true], 2.0), r.interp), diff(T, r.T)), `${T.length} measurements,`);
}
// ---- the shadow walk-forward: HEX's calls and CER's beside them
for (const c of ref.shadow) {
  const t = cer.channel('target', 'lab', c.target.map((_, i) => i), c.target), r = cer.shadowReplay(t, c.neighbours.map(mk), c.read, c.lag, 'reliability'), s = r.calls.filter((x) => x.y !== undefined);
  const q = cer.shadowReplay(t, c.neighbours.map(mk), c.read, c.lag).calls.filter((x) => x.y !== undefined);
  const sc = (mode) => cer.shadowReplay(t, c.neighbours.map(mk), c.read, c.lag, mode).calls.filter((x) => x.y !== undefined), e1 = sc('relaxation'), e2 = sc('relaxation-tempered');
  const d = Math.max(diff(e1.map((x) => x.cer_probability), c.cere), diff(e1.map((x) => x.fusion_probability), c.fusione), diff(e2.map((x) => x.cer_probability), c.cert), diff(e2.map((x) => x.fusion_probability), c.fusiont), diff(q.map((x) => x.cer_probability), c.cerq), diff(q.map((x) => x.fusion_probability), c.fusionq), diff(s.map((x) => x.i), c.i), diff(s.map((x) => x.null_probability), c.null), diff(s.map((x) => x.hex_probability), c.hex), diff(s.map((x) => x.cer_probability), c.cer), diff(s.map((x) => x.fusion_probability), c.fusion));
  report(`shadow replay: ${c.read}`, d, `${s.length} scored calls, one open call, fusion over HEX ${r.gain.fusion_over_hex.toFixed(4)} bits per call,`);
}
// ---- ingestion: out of order, a duplicate tick, a missing sample, a flagged sample; units carried through
const DAY = 86400000, o = (day, value, extra = {}) => ({ source_id: 'rig-1', environment_id: 'server B', channel_id: 'mycelium_voltage', timestamp: day * DAY + 3600000, measurement: 'voltage', unit: 'mV', value, ...extra });
const ch = cer.toChannel([o(3, 5), o(1, 1), o(2, 2), o(2, 3, { acquired_at: 2 * DAY + 7200000 }), o(4, null, { missing: true }), o(5, 99, { quality: ['saturated'] }), o(6, 4)], { excluded: ['saturated'] });
const want = { id: 'server B.mycelium_voltage', env: 'server B', unit: 'mV', source: 'rig-1', days: [2, 3, 6], changes: [2, 2, -1], level: [2, 4, 3], quality: { observations: 7, dropped_missing: 1, dropped_flagged: 1, duplicates: 1 } };
report('ingestion: order, duplicates, missing and flagged samples, units kept', diff(JSON.parse(JSON.stringify(ch)), want));
console.log(bad ? `${bad} FAILED` : `ALL PASSED (largest difference ${worst.toExponential(2)})`);
process.exit(bad ? 1 : 0);
