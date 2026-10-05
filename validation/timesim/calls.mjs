// TIME SIMULATION, part 1: the calls.
// For every series, both versions of HEX walk it once from 1 January 2016, one
// step at a time, with the product's own functions (observe, walkHex7,
// walkHex). At each step the call is written down, with what each part of
// memory said, before the walk moves on. Because the nightly job runs these
// same walks from the first bar every night, the call at step i here is the
// call the nightly job makes on the night of bar i. That is checked, not
// assumed: on sampled nights the nightly entry point (runEngines) is run on
// only what was known that night and must return the same call.
//   node validation/timesim/calls.mjs <data dir> <out dir> [shard] [shards]
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const [dataDir, outDir, shard = '0', shards = '1'] = process.argv.slice(2);
const entry = path.join(outDir, `_entry_${shard}.ts`), bundle = path.join(outDir, `_code_${shard}.mjs`);
const sh = path.join(here, '..', '..', 'base44', 'shared');
fs.writeFileSync(entry, ['ledger', 'engines', 'isotonic', 'hex7', 'observer', 'cycle'].map((m) => `export * from '${path.join(sh, m + '.ts')}';`).join('\n') + `\nexport { walkHex } from '${path.join(sh, 'hex.ts')}';`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', outfile: bundle, logLevel: 'error' });
const M = await import(bundle);
const NO_MAP = { MOVE: M.CANDIDATE_ENGINE, RANGE: M.CANDIDATE_ENGINE }; // no stored maps: strength is restated in part 2, when that night's maps are known
const SAMPLES = Number(process.env.SAMPLES || 25);

const files = fs.readdirSync(dataDir).filter((f) => f.endsWith('.csv')).sort().filter((_, i) => i % Number(shards) === Number(shard));
for (const f of files) {
  const name = f.replace('.csv', ''), rows = fs.readFileSync(path.join(dataDir, f), 'utf8').trim().split('\n').slice(1).map((l) => l.split(','));
  const dates = rows.map((r) => r[0]), closes = rows.map((r) => +r[1]), t0 = Date.now();
  const returns = []; for (let i = 1; i < closes.length; i++) returns.push(Math.log(closes[i] / closes[i - 1]));
  const W = {};
  for (const read of M.READS) {
    const obs = M.observe(returns, read, true);
    const by = (steps) => new Map(steps.map((s) => [s.i, s]));
    W[read] = { memories: obs.history, h7: by(M.walkHex7(returns, read, obs.baseline, true).steps), h65: by(M.walkHex(returns, read, obs.baseline, true, true).steps) };
  }
  const walkMs = Date.now() - t0;
  const nights = [];
  for (let i = 0; i < returns.length - 1; i++) {
    if (i + 1 < 28 || !M.READS.every((read) => W[read].h7.has(i) && W[read].h65.has(i))) continue;   // the nightly entry point needs 28 changes
    const rec = { date: dates[i + 1], close: closes[i + 1], threshold: M.usualChange(returns.slice(0, i + 1)), calls: { [M.CONTROL_ENGINE]: {}, [M.CANDIDATE_ENGINE]: {} }, learned: {} };
    for (const read of M.READS) {
      const a = W[read].h7.get(i), b = W[read].h65.get(i), memories = W[read].memories[i];
      rec.calls[M.CANDIDATE_ENGINE][read] = { baseline: Number(a.b.toFixed(4)), views: M.compactViews({ baseline: a.b, raw: a.p, memories, readings: [{ label: 'ranks', p: a.rank, w: a.influence[1] }, { label: 'ranks+other', p: a.cross, w: a.influence[2] }] }) };
      rec.calls[M.CONTROL_ENGINE][read] = { baseline: Number(b.b.toFixed(4)), views: M.compactViews({ baseline: b.b, raw: b.p, memories, readings: b.readings }) };
      rec.learned[read] = { beta: a.beta, influence: a.influence };
    }
    nights.push([i, rec]);
  }
  // the nightly entry point, on only what was known that night, must return the same call
  let checked = 0, failed = 0, worst = 0, runMs = 0; const pick = new Set([0, nights.length - 1]); let s = 12345 + name.length;
  while (pick.size < Math.min(SAMPLES, nights.length)) { s = (s * 16807) % 2147483647; pick.add(s % nights.length); }
  for (const k of pick) {
    const [i, rec] = nights[k], t = Date.now(), run = M.runEngines(returns.slice(0, i + 1), NO_MAP); runMs += Date.now() - t;
    for (const e of M.ENGINES) for (const read of M.READS) {
      const c = run?.calls[e][read], mine = rec.calls[e][read]; checked++;
      let d = c ? Math.max(Math.abs(c.views.raw - mine.views.raw), Math.abs(c.baseline - mine.baseline), ...c.views.memories.map((m, j) => Math.max(0, Math.abs(m.p - mine.views.memories[j].p) - 1e-5, Math.abs(m.w - mine.views.memories[j].w) - 1e-5))) : 1;
      if (c && e === M.CANDIDATE_ENGINE) d = Math.max(d, ...run.learned[read].beta.map((v, j) => Math.abs(v - rec.learned[read].beta[j])));
      worst = Math.max(worst, d); if (d > 1e-9) failed++;
    }
  }
  fs.writeFileSync(path.join(outDir, name + '.jsonl'), nights.map(([, rec]) => JSON.stringify(rec)).join('\n') + '\n');
  console.log(`${name}: ${closes.length} bars, ${nights.length} nights, one pass ${(walkMs / 1000).toFixed(1)} s, nightly entry point checked on ${pick.size} nights (${checked} calls, ${failed} failed, largest difference ${worst.toExponential(1)}), ${(runMs / pick.size).toFixed(0)} ms per nightly run`);
}
