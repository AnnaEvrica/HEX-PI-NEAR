// The learning loop, end to end, on real BTC daily bars with an in-memory
// database: night after night, score yesterday's calls, log today's, refit
// the pooled calibration, apply the promotion rule.
//   node tests/loop.mjs
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, 'backend-smoke', 'out', 'loop.mjs');
fs.writeFileSync(path.join(here, 'backend-smoke', 'out', '_loop_entry.ts'),
  `export * from '../../../base44/shared/ledger.ts'; export * from '../../../base44/shared/engines.ts'; export * from '../../../base44/shared/isotonic.ts';`);
await build({ entryPoints: [path.join(here, 'backend-smoke', 'out', '_loop_entry.ts')], bundle: true, format: 'esm', outfile: out, logLevel: 'error' });
const M = await import(out);

// ---- in-memory entities
const table = () => { const rows = []; let id = 0; const match = (r, q) => Object.entries(q || {}).every(([k, v]) => r[k] === v);
  return { rows, create: async (o) => { const r = { id: String(++id), ...o }; rows.push(r); return r; },
    update: async (i, p) => Object.assign(rows.find((r) => r.id === i), p),
    filter: async (q) => rows.filter((r) => match(r, q)), list: async () => rows.slice() }; };
const db = { CallLedger: table(), EngineStatus: table() };
const base44 = { asServiceRole: { entities: db } };

let fails = 0; const check = (name, ok) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) fails++; };

// ---- bars
const csv = fs.readFileSync(path.join(here, 'backend-smoke', 'BTC_daily.csv'), 'utf8').trim().split('\n').slice(1).map((l) => l.split(','));
const closes = csv.map((r) => +r[4]), ts = csv.map((r) => Math.floor(new Date(r[0]).getTime() / 1000));
const NIGHTS = Number(process.env.NIGHTS || 330), N = closes.length;
let live = { ...M.DEFAULT_LIVE }, lastRun = null;
for (let end = N - NIGHTS; end <= N; end++) {
  const bars = { closes: closes.slice(0, end), timestamps: ts.slice(0, end) };
  const returns = []; for (let i = 1; i < end; i++) returns.push(Math.log(bars.closes[i] / bars.closes[i - 1]));
  await M.scoreOpenCalls(base44, 'BTC', bars);
  lastRun = M.runEngines(returns, live);
  await M.logCalls(base44, M.rowsFor('BTC', bars, returns, lastRun, 'nightly'));
}
const L = db.CallLedger.rows;
check('four calls a night: two reads, two engines', L.length === (NIGHTS + 1) * 4);
check('logging the same night twice adds nothing', (await M.logCalls(base44, M.rowsFor('BTC', { closes, timestamps: ts }, [0.01], lastRun, 'nightly'))) === 0);
check('every call but the last night is scored', L.filter((r) => r.scored).length === NIGHTS * 4);
// a call is scored only from the bar after it, with the threshold fixed at call time
const one = L.find((r) => r.scored && r.read === 'RANGE'), k = ts.indexOf(one.bar_ts);
check('RANGE outcome uses the next bar and the stored threshold', one.outcome === (Math.abs(Math.log(closes[k + 1] / closes[k])) > one.threshold ? 1 : 0));
const mv = L.find((r) => r.scored && r.read === 'MOVE'), km = ts.indexOf(mv.bar_ts);
check('MOVE outcome uses the next bar', mv.outcome === (closes[km + 1] > closes[km] ? 1 : 0));

for (const read of ['MOVE', 'RANGE']) {
  const st = M.summarise(read, L, 'state-6.2');
  console.log(`  ${read}: ${st.paired_calls} paired calls over ${st.paired_days} days | right: 6.2 ${(st.hit_control * 100).toFixed(1)}%, rank-1 ${(st.hit_candidate * 100).toFixed(1)}%, baseline rule ${(st.hit_baseline * 100).toFixed(1)}% | gain ${(st.gain * 1000).toFixed(1)} [${(st.gain_low * 1000).toFixed(1)}, ${(st.gain_high * 1000).toFixed(1)}] | ${st.decision}: ${st.reason}`);
  check(`${read}: summary pairs every scored night`, st.paired_calls === NIGHTS && st.paired_days === NIGHTS);
  check(`${read}: decision follows the rule`, (st.decision === 'promote') === (st.gain_low > 0 && st.hit_candidate >= st.hit_control) && st.decision !== 'demote');
}
// ---- the rule itself, on made-up rows
const mk = (n, days, dCtl, dCand) => { const rows = []; for (let i = 0; i < n; i++) { const day = `2026-01-${String(1 + (i % days)).padStart(2, '0')}-${i % days}`; const j = (i * 7919) % 100 / 100 - 0.5;
  for (const [engine, ll] of [['state-6.2', 0.69 + dCtl + j * 0.05], ['rank-1', 0.69 + dCand + j * 0.05 + ((i * 31) % 10 - 4.5) * 0.002]]) rows.push({ series_id: 'S' + (i % 5), read: 'RANGE', engine, call_date: day + '|' + Math.floor(i / days), scored: true, outcome: 1, probability: 0.6, baseline: 0.55, log_loss: ll }); } return rows; };
const lessOften = mk(400, 80, 0, -0.02).map((r, i) => (r.engine === 'rank-1' && i % 6 < 2 ? { ...r, probability: 0.4 } : r));
check('rule: better probabilities but right less often -> hold', M.summarise('RANGE', lessOften, 'state-6.2').decision === 'hold');
check('rule: too few calls -> hold', M.summarise('RANGE', mk(200, 70, 0, -0.02), 'state-6.2').decision === 'hold');
check('rule: enough calls, rank-1 clearly better -> promote', M.summarise('RANGE', mk(400, 80, 0, -0.02), 'state-6.2').decision === 'promote');
check('rule: enough calls, no difference -> hold', M.summarise('RANGE', mk(400, 80, 0, 0), 'state-6.2').decision === 'hold');
check('rule: promoted and clearly worse -> demote', M.summarise('RANGE', mk(400, 80, 0, 0.02), 'rank-1').decision === 'demote');
check('rule: promoted and still better -> stays', M.summarise('RANGE', mk(400, 80, 0, -0.02), 'rank-1').live_engine === 'rank-1');

// ---- pooled calibration
const map = M.pooledCalibration(lastRun.rankSteps.RANGE);
check('calibration map is fitted and monotone', !!map && map.y.every((v, i) => i === 0 || v >= map.y[i - 1] - 1e-12) && map.x.every((v, i) => i === 0 || v > map.x[i - 1]));
check('too few steps -> no map', M.pooledCalibration(lastRun.rankSteps.RANGE.slice(0, 500)) === null);
const f = M.fitIsotonic(lastRun.rankSteps.RANGE.map((s) => s.p), lastRun.rankSteps.RANGE.map((s) => s.y));
check('stored map reproduces the fitted curve', [0.2, 0.35, 0.5, 0.62, 0.8].every((p) => Math.abs(M.applyKnots(map, p) - f(p)) < 1e-4));
console.log(`  calibration map: ${map.x.length} knots from ${map.n} steps`);

// ---- loadLive
await db.EngineStatus.create({ read: 'RANGE', live_engine: 'rank-1', calibration: JSON.stringify(map) });
live = await M.loadLive(base44);
check('loadLive returns the promoted engine and its map', live.RANGE === 'rank-1' && live.MOVE === 'state-6.2' && live.calibration.RANGE.x.length === map.x.length);
console.log(`\n${fails ? fails + ' FAILED' : 'ALL PASSED'}`);
process.exit(fails ? 1 : 0);
