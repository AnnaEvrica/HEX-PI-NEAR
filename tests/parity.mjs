// Engine parity: the TypeScript engine against the Python reference
// (validation/parity.py), step by step, on three real series.
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
console.log(bad ? `${bad} FAILED` : `ALL PASSED (largest difference ${worst.toExponential(2)})`);
process.exit(bad ? 1 : 0);
