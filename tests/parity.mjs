// Engine parity: both TypeScript engines against their Python references
// (validation/parity.py, validation/parity_rank.py), step by step, on three real series.
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
// ---- rank-1 against validation/rankcore.py
const outR = path.join(here, 'backend-smoke', 'out', 'rankCore.mjs');
await build({ entryPoints: [path.join(here, '../base44/shared/rankCore.ts')], bundle: true, format: 'esm', outfile: outR, logLevel: 'error' });
const { walkRank } = await import(outR);
const refR = JSON.parse(fs.readFileSync(path.join(here, 'parity_rank_reference.json'), 'utf8'));
for (const [name, e] of Object.entries(refR)) {
  for (const read of ['MOVE', 'RANGE']) {
    const { steps, final } = walkRank(e.returns, read); const q = e[read];
    let d = steps.length === q.i.length ? 0 : 1;
    for (let k = 0; k < Math.min(steps.length, q.i.length); k++) {
      if (steps[k].i !== q.i[k] || steps[k].y !== q.y[k]) d = 1;
      d = Math.max(d, Math.abs(steps[k].null - q.null[k]), Math.abs(steps[k].core - q.core[k]), Math.abs(steps[k].p - q.p[k]));
    }
    d = Math.max(d, Math.abs(final.null - q.final[0]), Math.abs(final.core - q.final[1]), Math.abs(final.p - q.final[2]));
    worst = Math.max(worst, d);
    const ok = d < 1e-9; if (!ok) bad++;
    console.log(ok ? 'PASS' : 'FAIL', `rank-1 ${name} ${read}`, `${steps.length} steps, max difference ${d.toExponential(2)}`);
  }
}
console.log(bad ? `${bad} FAILED` : `ALL PASSED (largest difference ${worst.toExponential(2)})`);
process.exit(bad ? 1 : 0);
