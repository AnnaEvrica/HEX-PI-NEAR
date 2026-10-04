// Engine parity: both TypeScript engines against their Python references
// (validation/parity.py, validation/parity_adaptive.py), step by step, on three real series.
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
// ---- the observer and state-6.3 against validation/hexadaptive.py
const outO = path.join(here, 'backend-smoke', 'out', 'observer.mjs');
await build({ entryPoints: [path.join(here, '../base44/shared/observer.ts')], bundle: true, format: 'esm', outfile: outO, logLevel: 'error' });
const { observeBaseline } = await import(outO);
const refA = JSON.parse(fs.readFileSync(path.join(here, 'parity_adaptive_reference.json'), 'utf8'));
for (const [name, e] of Object.entries(refA)) {
  const baseline = { up: observeBaseline(e.returns, 'MOVE'), big: observeBaseline(e.returns, 'RANGE') };
  const { steps, final } = walkStateProbability(e.returns, baseline);
  for (const [read, key, bkey, fk, fb] of [['MOVE', 'p_up', 'up', 'p_up', 'b_up'], ['RANGE', 'p_big', 'big', 'p_big', 'b_big']]) {
    const q = e[read]; let d = 0;
    // the observer's baseline, every step
    for (let i = 0; i < q.baseline.length; i++) {
      const ours = baseline[bkey][i], theirs = q.baseline[i];
      if ((theirs === null) !== Number.isNaN(ours)) d = 1; else if (theirs !== null) d = Math.max(d, Math.abs(ours - theirs));
    }
    // HEX against that baseline, every scored step (steps[j] is the call made at step 12 + j)
    let seen = 0;
    for (let k = 0; k < q.i.length; k++) {
      const st = steps[q.i[k] - 12]; const p = st[key];
      if (p === null || Number.isNaN(p)) { d = 1; continue; }
      d = Math.max(d, Math.abs(p - q.p[k])); seen++;
    }
    d = Math.max(d, Math.abs(final[fk] - q.final[0]), Math.abs(final[fb] - q.final[1]));
    worst = Math.max(worst, d);
    const ok = d < 1e-9 && seen === q.i.length; if (!ok) bad++;
    console.log(ok ? 'PASS' : 'FAIL', `state-6.3 ${name} ${read}`, `${seen} steps, max difference ${d.toExponential(2)}`);
  }
}
console.log(bad ? `${bad} FAILED` : `ALL PASSED (largest difference ${worst.toExponential(2)})`);
process.exit(bad ? 1 : 0);
