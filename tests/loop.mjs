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
  console.log(`  ${read}: ${st.paired_calls} paired calls over ${st.paired_days} days | right: 6.2 ${(st.hit_control * 100).toFixed(1)}%, 6.4 ${(st.hit_candidate * 100).toFixed(1)}%, baseline rule ${(st.hit_baseline * 100).toFixed(1)}% | gain ${(st.gain * 1000).toFixed(1)} [${(st.gain_low * 1000).toFixed(1)}, ${(st.gain_high * 1000).toFixed(1)}] | ${st.decision}: ${st.reason}`);
  check(`${read}: summary pairs every scored night`, st.paired_calls === NIGHTS && st.paired_days === NIGHTS);
  check(`${read}: decision follows the rule`, (st.decision === 'promote') === (st.gain_low > 0 && st.hit_candidate >= st.hit_control) && st.decision !== 'demote');
}
// ---- the rule itself, on made-up rows
const mk = (n, days, dCtl, dCand) => { const rows = []; for (let i = 0; i < n; i++) { const day = `2026-01-${String(1 + (i % days)).padStart(2, '0')}-${i % days}`; const j = (i * 7919) % 100 / 100 - 0.5;
  for (const [engine, ll] of [['state-6.2', 0.69 + dCtl + j * 0.05], ['state-6.4', 0.69 + dCand + j * 0.05 + ((i * 31) % 10 - 4.5) * 0.002]]) rows.push({ series_id: 'S' + (i % 5), read: 'RANGE', engine, call_date: day + '|' + Math.floor(i / days), scored: true, outcome: 1, probability: 0.6, baseline: 0.55, reward: 0.75 - (ll - 0.69) }); } return rows; };
const lessOften = mk(400, 80, 0, -0.02).map((r, i) => (r.engine === 'state-6.4' && i % 6 < 2 ? { ...r, probability: 0.4 } : r));
check('rule: better probabilities but right less often -> hold', M.summarise('RANGE', lessOften, 'state-6.2').decision === 'hold');
check('rule: too few calls -> hold', M.summarise('RANGE', mk(200, 70, 0, -0.02), 'state-6.2').decision === 'hold');
check('rule: enough calls, 6.4 clearly better -> promote', M.summarise('RANGE', mk(400, 80, 0, -0.02), 'state-6.2').decision === 'promote');
check('rule: enough calls, no difference -> hold', M.summarise('RANGE', mk(400, 80, 0, 0), 'state-6.2').decision === 'hold');
check('rule: promoted and clearly worse -> demote', M.summarise('RANGE', mk(400, 80, 0, 0.02), 'state-6.4').decision === 'demote');
const rightLess = mk(400, 80, 0, -0.001).map((r, i) => (r.engine === 'state-6.4' && i % 6 < 3 ? { ...r, probability: 0.4 } : r));
check('rule: promoted but right clearly less often -> demote', M.summarise('RANGE', rightLess, 'state-6.4').decision === 'demote');
check('rule: promoted and still better -> stays', M.summarise('RANGE', mk(400, 80, 0, -0.02), 'state-6.4').live_engine === 'state-6.4');

// ---- the running tally: folding night by night equals folding once, and no day is counted twice
{
  const days = [...new Set(L.filter((r) => r.scored).map((r) => r.call_date))].sort();
  let t = M.EMPTY_TALLY;
  for (const cut of [days[40], days[41], days[120], days[days.length - 1]]) t = M.foldDays(t, 'RANGE', L, cut);
  const again = M.foldDays(t, 'RANGE', L, days[days.length - 1]);
  const once = M.foldDays(M.EMPTY_TALLY, 'RANGE', L, '9999-12-31');
  check('tally: folded in four batches equals folded once', t.calls === once.calls && t.days === once.days && Math.abs(t.gain_sum - once.gain_sum) < 1e-9 && Math.abs(t.day_gain_sq - once.day_gain_sq) < 1e-9);
  check('tally: folding the same days again adds nothing', again.calls === t.calls && again.days === t.days);
  check('tally: decision from the tally equals decision from the rows', JSON.stringify(M.decide('RANGE', once, 'state-6.2')) === JSON.stringify(M.summarise('RANGE', L, 'state-6.2')));
}

// ---- pooled calibration
const map = M.pooledCalibration(lastRun.candidateSteps.RANGE);
check('calibration map is fitted and monotone', !!map && map.y.every((v, i) => i === 0 || v >= map.y[i - 1] - 1e-12) && map.x.every((v, i) => i === 0 || v > map.x[i - 1]));
check('too few steps -> no map', M.pooledCalibration(lastRun.candidateSteps.RANGE.slice(0, 500)) === null);
const f = M.fitStrength(lastRun.candidateSteps.RANGE.map((s) => s.p), lastRun.candidateSteps.RANGE.map((s) => s.y));
const grid = Array.from({ length: 197 }, (_, i) => 0.01 + i * 0.005);
check('stored map reproduces the fitted curve', grid.every((p) => Math.abs(M.applyStrength(map, p) - M.restate(p, f)) < 1e-4));
check('calibration never changes the side of a call', grid.every((p) => (M.applyStrength(map, p) >= 0.5) === (p >= 0.5)));
check('calibration never states less than 50% for the side called', grid.every((p) => Math.max(M.applyStrength(map, p), 1 - M.applyStrength(map, p)) >= 0.5001 - 1e-12));
{ // a map that says every call was wrong still cannot turn a call round
  const wrong = M.strengthKnots(grid, grid.map((p) => (p >= 0.5 ? 0 : 1)));
  check('even a record of all wrong calls leaves the side alone', grid.every((p) => (M.applyStrength(wrong, p) >= 0.5) === (p >= 0.5)));
}
check('reward: 1 for certain and right, 0.75 for a coin flip, never negative', M.reward(1, 1) === 1 && M.reward(0.5, 1) === 0.75 && M.reward(0.5, 0) === 0.75 && M.reward(1, 0) === 0);
console.log(`  calibration map: ${map.x.length} knots from ${map.n} steps`);

// ---- loadLive
await db.EngineStatus.create({ read: 'RANGE', live_engine: 'state-6.4', calibration: JSON.stringify(map) });
live = await M.loadLive(base44);
check('loadLive returns the promoted engine and its map', live.RANGE === 'state-6.4' && live.MOVE === 'state-6.2' && live.calibration.RANGE.x.length === map.x.length);
console.log(`\n${fails ? fails + ' FAILED' : 'ALL PASSED'}`);
process.exit(fails ? 1 : 0);
