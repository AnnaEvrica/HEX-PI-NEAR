// TIME SIMULATION, part 1: the calls.
// For every series and every night since 1 January 2016, the engines are run
// from scratch on what was known that night, exactly as the nightly job runs
// them (runEngines), and what they said is written down: both versions, both
// reads, with the views. Nothing after that night is visible to the run.
//   node validation/timesim/calls.mjs <data dir> <out dir> [shard] [shards]
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const [dataDir, outDir, shard = '0', shards = '1'] = process.argv.slice(2);
const entry = path.join(outDir, `_entry_${shard}.ts`), bundle = path.join(outDir, `_code_${shard}.mjs`);
const sh = path.join(here, '..', '..', 'base44', 'shared');
fs.writeFileSync(entry, ['ledger', 'engines', 'isotonic', 'hex', 'observer', 'cycle'].map((m) => `export * from '${path.join(sh, m + '.ts')}';`).join('\n'));
await build({ entryPoints: [entry], bundle: true, format: 'esm', outfile: bundle, logLevel: 'error' });
const M = await import(bundle);
const NO_MAP = { MOVE: 'state-6.2', RANGE: 'state-6.5' }; // no stored map: the strength of 6.5 is restated in part 2, when that night's map is known

const files = fs.readdirSync(dataDir).filter((f) => f.endsWith('.csv')).sort().filter((_, i) => i % Number(shards) === Number(shard));
for (const f of files) {
  const name = f.replace('.csv', ''), rows = fs.readFileSync(path.join(dataDir, f), 'utf8').trim().split('\n').slice(1).map((l) => l.split(','));
  const dates = rows.map((r) => r[0]), closes = rows.map((r) => +r[1]);
  const out = fs.createWriteStream(path.join(outDir, name + '.jsonl'));
  let prev = null, causal = 0, checked = 0, t0 = Date.now();
  for (let end = 2; end <= closes.length; end++) {
    const returns = []; for (let i = 1; i < end; i++) returns.push(Math.log(closes[i] / closes[i - 1]));
    const run = M.runEngines(returns, NO_MAP);
    if (!run) continue;
    // the call made last night must be the step tonight's run remembers for that night
    if (prev) for (const read of M.READS) { const last = run.candidateSteps[read].at(-1); if (last) { checked++; if (Math.abs(last.p - prev[read]) > 1e-12) causal++; } }
    prev = { MOVE: run.calls['state-6.5'].MOVE.views.raw, RANGE: run.calls['state-6.5'].RANGE.views.raw };
    const rec = { date: dates[end - 1], close: closes[end - 1], threshold: M.usualChange(returns), calls: {} };
    for (const e of M.ENGINES) { rec.calls[e] = {}; for (const read of M.READS) { const c = run.calls[e][read]; rec.calls[e][read] = { p: c.p, baseline: c.baseline, views: M.compactViews(c.views) }; } }
    out.write(JSON.stringify(rec) + '\n');
  }
  await new Promise((r) => out.end(r));
  console.log(`${name}: ${closes.length} bars, ${checked} causality checks, ${causal} failed, ${((Date.now() - t0) / 60000).toFixed(1)} min`);
}
