// Engine parity: both TypeScript engines against their Python references
// (validation/parity.py, validation/parity_hex.py), step by step, on three real series.
//   node tests/parity.mjs   (reference produced by validation/parity.py in the 6.2.1 package)
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, 'backend-smoke', 'out', 'stateProbability.mjs');
await build({ entryPoints: [path.join(here, '../base44/shared/stateProbability.ts')], bundle: true, format: 'esm', outfile: out, logLevel: 'error' });
const { walkStateProbability } = await import(out);
const ref = JSON.parse(fs.readFileSync(path.join(here, 'parity_reference.json'), 'utf8'));
let worst = 0, bad = 0;
for (const [name, r] of Object.entries(ref)) {
  const { steps, final } = walkStateProbability(r.returns);
  let d = 0, n = 0;
  if (steps.length !== r.p_up.length) { console.log('FAIL', name, 'step count', steps.length, r.p_up.length); bad++; continue; }
  for (let i = 0; i < steps.length; i++) {
    d = Math.max(d, Math.abs(steps[i].p_up - r.p_up[i]));
    if (r.p_big[i] !== null && steps[i].p_big !== null) { d = Math.max(d, Math.abs(steps[i].p_big - r.p_big[i])); n++; }
    else if ((r.p_big[i] === null) !== (steps[i].p_big === null)) d = 1;
  }
  worst = Math.max(worst, d);
  const ok = d < 1e-9; if (!ok) bad++;
  console.log(ok ? 'PASS' : 'FAIL', name, `${steps.length} steps, ${n} size steps, max difference ${d.toExponential(2)}`, '| family weights (direction):', JSON.stringify(final.family_up));
}
// ---- the observer and HEX against the references (validation/hexmodel.py, validation/hexcoupled.py)
const outH = path.join(here, 'backend-smoke', 'out', 'hex.mjs');
fs.writeFileSync(path.join(here, 'backend-smoke', 'out', '_hex_entry.ts'), `export * from '../../../base44/shared/hex.ts'; export * from '../../../base44/shared/observer.ts';`);
await build({ entryPoints: [path.join(here, 'backend-smoke', 'out', '_hex_entry.ts')], bundle: true, format: 'esm', outfile: outH, logLevel: 'error' });
const { walkHex, observeBaseline } = await import(outH);
for (const [label, file, coupled] of [['state-6.4 (own pattern only)', 'parity_hex_reference.json', false], ['state-6.5', 'parity_coupled_reference.json', true]]) {
const refH = JSON.parse(fs.readFileSync(path.join(here, file), 'utf8'));
for (const [name, e] of Object.entries(refH)) {
  for (const read of ['MOVE', 'RANGE']) {
    const q = e[read], baseline = observeBaseline(e.returns, read); let d = 0;
    for (let i = 0; i < q.baseline.length; i++) {           // the observer's baseline, every step
      const ours = baseline[i], theirs = q.baseline[i];
      if ((theirs === null) !== Number.isNaN(ours)) d = 1; else if (theirs !== null) d = Math.max(d, Math.abs(ours - theirs));
    }
    const { steps, final, weights } = walkHex(e.returns, read, baseline, coupled);
    if (weights.length !== q.weights.length) d = 1;
    if (steps.length !== q.i.length) d = 1;
    for (let k = 0; k < Math.min(steps.length, q.i.length); k++) {
      if (steps[k].i !== q.i[k] || steps[k].y !== q.y[k]) d = 1;
      d = Math.max(d, Math.abs(steps[k].p - q.p[k]));
    }
    d = Math.max(d, Math.abs(final.p - q.final[0]), Math.abs(final.b - q.final[1]));
    for (let k = 0; k < weights.length; k++) d = Math.max(d, Math.abs(weights[k] - q.weights[k]));
    worst = Math.max(worst, d);
    const ok = d < 1e-9; if (!ok) bad++;
    console.log(ok ? 'PASS' : 'FAIL', `${label} ${name} ${read}`, `${steps.length} steps, ${weights.length} weights, max difference ${d.toExponential(2)}`);
  }
}
}
console.log(bad ? `${bad} FAILED` : `ALL PASSED (largest difference ${worst.toExponential(2)})`);
process.exit(bad ? 1 : 0);
