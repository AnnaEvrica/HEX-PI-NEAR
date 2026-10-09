// Engine parity: the TypeScript engines against their Python references
// (validation/hexmodel.py, validation/hexcoupled.py, validation/hex7core.py),
// step by step on real series. The tested mathematics and the deployed
// mathematics must be the same to rounding.
//   node tests/parity.mjs
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, 'backend-smoke', 'out'); fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'parity.mjs');
fs.writeFileSync(path.join(outDir, '_parity_entry.ts'), ['hex', 'hex7', 'observer'].map((m) => `export * from '../../../base44/shared/${m}.ts';`).join('\n'));
await build({ entryPoints: [path.join(outDir, '_parity_entry.ts')], bundle: true, format: 'esm', outfile: out, logLevel: 'error' });
const { walkHex, walkHex7, observeBaseline } = await import(out);
let bad = 0, worst = 0;
const report = (label, d, extra) => { worst = Math.max(worst, d); const ok = d < 1e-9; if (!ok) bad++; console.log(ok ? 'PASS' : 'FAIL', label, extra, `max difference ${d.toExponential(2)}`); };

// ---- the null and 6.5 (own pattern only, and with the two reads coupled)
for (const [label, file, coupled] of [['state-6.5, own pattern only', 'parity_hex_reference.json', false], ['state-6.5', 'parity_coupled_reference.json', true]]) {
  const ref = JSON.parse(fs.readFileSync(path.join(here, file), 'utf8'));
  for (const [name, e] of Object.entries(ref)) for (const read of ['MOVE', 'RANGE']) {
    const q = e[read], baseline = observeBaseline(e.returns, read); let d = 0;
    for (let i = 0; i < q.baseline.length; i++) { const ours = baseline[i], theirs = q.baseline[i]; if ((theirs === null) !== Number.isNaN(ours)) d = 1; else if (theirs !== null) d = Math.max(d, Math.abs(ours - theirs)); }
    const { steps, final, weights } = walkHex(e.returns, read, baseline, coupled);
    if (steps.length !== q.i.length || weights.length !== q.weights.length) d = 1;
    for (let k = 0; k < Math.min(steps.length, q.i.length); k++) { if (steps[k].i !== q.i[k] || steps[k].y !== q.y[k]) d = 1; d = Math.max(d, Math.abs(steps[k].p - q.p[k])); }
    d = Math.max(d, Math.abs(final.p - q.final[0]), Math.abs(final.b - q.final[1]));
    for (let k = 0; k < weights.length; k++) d = Math.max(d, Math.abs(weights[k] - q.weights[k]));
    report(`${label} ${name} ${read}`, d, `${steps.length} steps, ${weights.length} weights,`);
  }
}
// ---- 7.0: every call, the null under it, the final coefficients and influence
const ref7 = JSON.parse(fs.readFileSync(path.join(here, 'parity_hex7_reference.json'), 'utf8'));
for (const [name, e] of Object.entries(ref7)) for (const read of ['MOVE', 'RANGE']) {
  const q = e[read], { steps, final } = walkHex7(e.returns, read, observeBaseline(e.returns, read)); let d = steps.length === q.i.length ? 0 : 1;
  for (let k = 0; k < Math.min(steps.length, q.i.length); k++) { if (steps[k].i !== q.i[k] || steps[k].y !== q.y[k]) d = 1; d = Math.max(d, Math.abs(steps[k].p - q.p[k]), Math.abs(steps[k].b - q.null[k])); }
  d = Math.max(d, Math.abs(final.p - q.final[0]), Math.abs(final.b - q.final[1]), Math.abs(final.rank - q.final[2]), Math.abs(final.cross - q.final[3]), ...final.beta.map((v, i) => Math.abs(v - q.beta[i])), ...final.influence.map((v, i) => Math.abs(v - q.influence[i])));
  report(`hex-7.0 ${name} ${read}`, d, `${steps.length} steps, 14 coefficients,`);
}
// ---- 7.0 with the clock: a dated series. Every call, the null, the clock's own probability, 14 + 23 coefficients, four influences
const refc = JSON.parse(fs.readFileSync(path.join(here, 'parity_hex7_clock_reference.json'), 'utf8'));
for (const [name, e] of Object.entries(refc)) for (const read of ['MOVE', 'RANGE']) {
  const q = e[read], base = observeBaseline(e.returns, read), { steps, final } = walkHex7(e.returns, read, base, false, e.days); let d = steps.length === q.i.length && final.influence.length === 4 ? 0 : 1;
  for (let k = 0; k < Math.min(steps.length, q.i.length); k++) { if (steps[k].i !== q.i[k] || steps[k].y !== q.y[k]) d = 1; d = Math.max(d, Math.abs(steps[k].p - q.p[k]), Math.abs(steps[k].b - q.null[k])); }
  d = Math.max(d, Math.abs(final.p - q.final[0]), Math.abs(final.b - q.final[1]), Math.abs(final.rank - q.final[2]), Math.abs(final.cross - q.final[3]), Math.abs(final.clock - q.final[4]),
    ...final.beta.map((v, i) => Math.abs(v - q.beta[i])), ...final.beta_clock.map((v, i) => Math.abs(v - q.beta_clock[i])), ...final.influence.map((v, i) => Math.abs(v - q.influence[i])));
  report(`hex-7.0 with clock ${name} ${read}`, d, `${steps.length} steps, 14 + 23 coefficients,`);
  // dates that cannot be used (wrong count, or going backwards) leave the three-voice walk exactly
  const plain = walkHex7(e.returns, read, base), short = walkHex7(e.returns, read, base, false, e.days.slice(1)), back = walkHex7(e.returns, read, base, false, e.days.slice().reverse());
  let u = plain.final.influence.length === 3 && plain.final.clock === undefined ? 0 : 1;
  for (const w of [short, back]) { u = Math.max(u, Math.abs(w.final.p - plain.final.p)); for (let k = 0; k < plain.steps.length; k++) u = Math.max(u, Math.abs(w.steps[k].p - plain.steps[k].p)); }
  report(`hex-7.0 unusable dates ${name} ${read}`, u, 'no clock,');
}
console.log(bad ? `${bad} FAILED` : `ALL PASSED (largest difference ${worst.toExponential(2)})`);
process.exit(bad ? 1 : 0);
