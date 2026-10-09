// Added after the E12 run (not pre-registered): are a series' moments years apart
// resolvably different, where consecutive nights are not? For each of the 27
// market series, three moments whose 750-observation windows share nothing,
// and the distance between each pair; then the same with the days in a random
// order (the same order for every series), which keeps every day's
// cross-section and removes everything that unfolds in time.
//   node experience_span.mjs  -> experience/across_years.json
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)), tmp = path.join(here, '..', 'tests', 'backend-smoke', 'out'); fs.mkdirSync(tmp, { recursive: true });
fs.writeFileSync(path.join(tmp, '_span_entry.ts'), `export * from '../../../base44/shared/experience.ts'; export * from '../../../base44/shared/memory.ts';`);
await build({ entryPoints: [path.join(tmp, '_span_entry.ts')], bundle: true, format: 'esm', outfile: path.join(tmp, 'span_experience.mjs'), logLevel: 'error' });
const X = await import(path.join(tmp, 'span_experience.mjs')), S0 = JSON.parse(fs.readFileSync(path.join(here, 'data', 'markets_channels.json'), 'utf8'));
const shuffled = (S, seed0) => { const U = [...new Set(S.flatMap((s) => s.days))].sort((a, b) => a - b), P = U.slice(); let seed = seed0; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = P.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [P[i], P[j]] = [P[j], P[i]]; }
  const to = new Map(U.map((u, i) => [u, P[i]]));
  return S.map((s) => { const o = s.days.map((d, i) => [to.get(d), s.returns[i]]).sort((a, b) => a[0] - b[0]); return { ticker: s.ticker, days: o.map((x) => x[0]), returns: o.map((x) => x[1]) }; }); };
const run = (S) => {
  const { channels } = X.nightChannels(S.map((s) => ({ ticker: s.ticker, returns: s.returns, timestamps: [s.days[0] - 1, ...s.days].map((d) => d * 86400) }))), d = [], comp = {};
  for (const t of channels) {
    const n = t.days.length, sig = [n - 1, n - 1 - 760, n - 1 - 1520].map((i) => X.momentOf(t, channels.filter((c) => c !== t), t.days[i])?.signature);
    for (const [a, b] of [[0, 1], [1, 2], [0, 2]]) { const D = X.distance(sig[a], sig[b]); if (!D.comparable) continue; d.push(D.d); for (const [k, v] of Object.entries(D.components)) (comp[k] ??= []).push(v[0]); }
  }
  const q = (v, p) => Number(X.quantile(v, p).toFixed(3));
  return { pairs: d.length, mean: Number((d.reduce((s, x) => s + x, 0) / d.length).toFixed(3)), median: q(d, 0.5), p10: q(d, 0.1), p90: q(d, 0.9), max: q(d, 1), components_median: Object.fromEntries(Object.entries(comp).map(([k, v]) => [k, q(v, 0.5)])), share_above: { 1.5: Number((d.filter((x) => x > 1.5).length / d.length).toFixed(3)), 2: Number((d.filter((x) => x > 2).length / d.length).toFixed(3)) } };
};
const out = { what: 'distance between moments of one series whose windows share no observation (about three years apart)', real: run(S0), control_days_in_random_order: [11, 12, 13].map((s) => ({ seed: s, ...run(shuffled(S0, s)) })) };
fs.writeFileSync(path.join(here, 'experience', 'across_years.json'), JSON.stringify(out, null, 1)); console.log(JSON.stringify(out, null, 1));
