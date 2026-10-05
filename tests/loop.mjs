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
  `export * from '../../../base44/shared/ledger.ts'; export * from '../../../base44/shared/engines.ts'; export * from '../../../base44/shared/isotonic.ts'; export * from '../../../base44/shared/hex7.ts'; export * from '../../../base44/shared/observer.ts';`);
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
  const st = M.summarise(read, L, 'state-6.5');
  console.log(`  ${read}: ${st.paired_calls} paired calls over ${st.paired_days} days | right: 6.5 ${(st.hit_control * 100).toFixed(1)}%, 7.0 ${(st.hit_candidate * 100).toFixed(1)}%, expected ${(st.hit_baseline * 100).toFixed(1)}% | bits per call over the null: 6.5 ${st.bits_control}, 7.0 ${st.bits_candidate} [${st.bits_candidate_low}, ${st.bits_candidate_high}] | ${st.decision}: ${st.reason}`);
  check(`${read}: summary pairs every scored night`, st.paired_calls === NIGHTS && st.paired_days === NIGHTS);
  check(`${read}: decision follows the rule`, (st.decision === 'promote') === (st.paired_calls >= 300 && st.gain_low > 0 && st.hit_candidate >= st.hit_control) && st.decision !== 'demote');
  check(`${read}: too little record -> verified is not decided`, st.paired_calls >= 300 || st.verified === null);
}
// ---- information gain and its day-clustered interval
{
  check('information gain: positive when more probability went to what happened', M.informationGain(0.7, 0.5, 1) > 0 && M.informationGain(0.7, 0.5, 0) < 0 && M.informationGain(0.6, 0.6, 1) === 0);
  check('information gain: the same for the event and for its absence', Math.abs(M.informationGain(0.3, 0.5, 0) - M.informationGain(0.7, 0.5, 1)) < 1e-12);
  const scored = L.filter((r) => r.scored);
  check('every scored call carries its information gain over the null', scored.every((r) => Math.abs(r.info_gain - M.informationGain(r.probability, JSON.parse(r.views).baseline, r.outcome)) < 2e-6 && Math.abs(r.log_score - M.logScore(r.probability, r.outcome)) < 2e-6));
  // the clustered mean equals the plain mean, and one call per day gives the ordinary standard error
  const v = [0.2, -0.1, 0.4, 0.0, 0.3, -0.2, 0.1]; let c = M.EMPTY_CLUSTERED; for (const x of v) c = M.addDay(c, x, 1);
  const m = v.reduce((a, b) => a + b, 0) / v.length, sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1)), cm = M.clusteredMean(c);
  check('clustered mean: one call a day reduces to the ordinary mean and standard error', Math.abs(cm.mean - m) < 1e-12 && Math.abs((cm.high - cm.mean) / 1.96 - sd / Math.sqrt(v.length)) < 1e-12);
  let c2 = M.EMPTY_CLUSTERED; c2 = M.addDay(c2, 3, 10); c2 = M.addDay(c2, 1, 1); c2 = M.addDay(c2, -1, 5);
  check('clustered mean: days are weighted by their calls', Math.abs(M.clusteredMean(c2).mean - 3 / 16) < 1e-12);
}
// ---- the rule itself, on made-up rows (dCtl, dCand: each version's log loss above a common level)
const mk = (n, days, dCtl, dCand) => { const rows = []; for (let i = 0; i < n; i++) { const day = `2026-01-${String(1 + (i % days)).padStart(2, '0')}-${i % days}`; const j = (i * 7919) % 100 / 100 - 0.5;
  for (const [engine, ll] of [['state-6.5', 0.69 + dCtl + j * 0.05], ['hex-7.0', 0.69 + dCand + j * 0.05 + ((i * 31) % 10 - 4.5) * 0.002]]) rows.push({ series_id: 'S' + (i % 5), read: 'RANGE', engine, call_date: day + '|' + Math.floor(i / days), scored: true, outcome: 1, probability: 0.6, baseline: 0.55, log_score: -ll, info_gain: 0.75 - ll, closeness: 0.84 }); } return rows; };
const lessOften = mk(400, 80, 0, -0.02).map((r, i) => (r.engine === 'hex-7.0' && i % 6 < 2 ? { ...r, probability: 0.4 } : r));
check('rule: more information but right less often -> hold', M.summarise('RANGE', lessOften, 'state-6.5').decision === 'hold');
check('rule: too few calls -> hold', M.summarise('RANGE', mk(200, 70, 0, -0.02), 'state-6.5').decision === 'hold');
check('rule: enough calls, 7.0 clearly ahead -> shown', M.summarise('RANGE', mk(400, 80, 0, -0.02), 'state-6.5').decision === 'promote');
check('rule: enough calls, no difference -> hold', M.summarise('RANGE', mk(400, 80, 0, 0), 'state-6.5').decision === 'hold');
check('rule: shown and clearly behind -> taken down', M.summarise('RANGE', mk(400, 80, 0, 0.02), 'hex-7.0').decision === 'demote');
const rightLess = mk(400, 80, 0, -0.001).map((r, i) => (r.engine === 'hex-7.0' && i % 6 < 3 ? { ...r, probability: 0.4 } : r));
check('rule: shown but right clearly less often -> taken down', M.summarise('RANGE', rightLess, 'hex-7.0').decision === 'demote');
check('rule: shown and still ahead -> stays', M.summarise('RANGE', mk(400, 80, 0, -0.02), 'hex-7.0').live_engine === 'hex-7.0');
{ // verified edge: the shown version against the null
  const ahead = M.summarise('RANGE', mk(400, 80, 0, -0.02), 'hex-7.0'), level = M.summarise('RANGE', mk(400, 80, 0, 0).map((r) => ({ ...r, info_gain: ((r.call_date.length * 7 + r.series_id.charCodeAt(1)) % 5 - 2) * 0.01 })), 'hex-7.0');
  check('verified: gain over the null clear of zero -> verified', ahead.verified === true && ahead.bits_candidate_low > 0);
  check('verified: a record that does not settle it -> left as it stood', level.verified === null);
  const behind = M.summarise('RANGE', mk(400, 80, 0, 0).map((r) => ({ ...r, info_gain: -0.05 + ((r.call_date.length * 7 + r.series_id.charCodeAt(1)) % 5 - 2) * 0.01 })), 'hex-7.0');
  check('verified: gain over the null clearly below zero -> no verified edge', behind.verified === false);
}

// ---- the running tally: folding night by night equals folding once, and no day is counted twice
{
  const days = [...new Set(L.filter((r) => r.scored).map((r) => r.call_date))].sort();
  let t = M.EMPTY_TALLY;
  for (const cut of [days[40], days[41], days[120], days[days.length - 1]]) t = M.foldDays(t, 'RANGE', L, cut);
  const again = M.foldDays(t, 'RANGE', L, days[days.length - 1]);
  const once = M.foldDays(M.EMPTY_TALLY, 'RANGE', L, '9999-12-31');
  check('tally: folded in four batches equals folded once', t.calls === once.calls && t.days === once.days && Math.abs(t.versus.s - once.versus.s) < 1e-9 && Math.abs(t.versus.ss - once.versus.ss) < 1e-9 && Math.abs(t.over_null_candidate.s - once.over_null_candidate.s) < 1e-9);
  check('tally: folding the same days again adds nothing', again.calls === t.calls && again.days === t.days);
  check('tally: decision from the tally equals decision from the rows', JSON.stringify(M.decide('RANGE', once, 'state-6.5')) === JSON.stringify(M.summarise('RANGE', L, 'state-6.5')));
}

// ---- the cycle: call -> outcome -> score -> reason -> learn
{
  const done = L.filter((r) => r.scored), missed = done.filter((r) => (r.probability >= 0.5 ? 1 : 0) !== r.outcome);
  check('cycle 1: every call carries its views, written before the outcome', L.every((r) => typeof r.raw === 'number' && typeof r.views === 'string') && L.filter((r) => !r.scored).length === 4);
  check('cycle 1: 7.0 records what each memory and each of its models said, and what it had learned', L.filter((r) => r.engine === 'hex-7.0').every((r) => { const v = JSON.parse(r.views), k = JSON.parse(r.learned); return v.memories.length >= 7 && v.readings.length === 2 && Math.abs(v.memories.reduce((s, m) => s + m.w, 0) - 1) < 1e-3 && k.beta.length === 14 && Math.abs(k.influence.reduce((a, b) => a + b, 0) - 1) < 1e-3; }));
  check('cycle 1: 6.5 records what each memory and each reading of the state said', L.filter((r) => r.engine === 'state-6.5').every((r) => { const v = JSON.parse(r.views); return v.memories.length >= 7 && v.readings.length === 16; }));
  check('cycle 1: calibration left the side where the engine put it', L.every((r) => (r.probability >= 0.5) === (r.raw >= 0.5)));
  check('cycle 3: closeness = 0.75 + baseline part + structure part + strength part, on every call', done.every((r) => Math.abs(0.75 + r.part_baseline + r.part_structure + r.part_strength - r.closeness) < 5e-6));
  check('cycle 4: every miss has a reason and no right call has one', missed.length > 0 && missed.every((r) => M.REASONS.includes(r.reason)) && done.filter((r) => !missed.includes(r)).every((r) => r.reason === ''));
  check('cycle 4: the reason is the one the stored views give', missed.every((r) => M.reasonFor(r.probability, JSON.parse(r.views), r.outcome) === r.reason));
  const by = {}; for (const r of missed) by[r.reason] = (by[r.reason] || 0) + 1;
  console.log('  misses by reason:', JSON.stringify(by));
  // made-up views: each reason in turn
  const V = (b, mem, rd) => ({ baseline: b, raw: 0.6, memories: mem.map((p, i) => ({ label: 'memory:' + [32, 64, 128][i], p, w: 1 / 3 })), readings: rd.map((p, i) => ({ label: 'evidence:' + i, p, w: 0.5 })) });
  check('reason: right side -> none', M.reasonFor(0.6, V(0.6, [0.6, 0.6, 0.6], [0.6]), 1) === null);
  check('reason: the null had it, what HEX added turned it -> structure', M.reasonFor(0.6, V(0.4, [0.4, 0.4, 0.4], [0.6]), 0) === 'structure');
  check('reason: shorter memories had it -> change', M.reasonFor(0.6, V(0.55, [0.4, 0.45, 0.6], [0.6]), 0) === 'change');
  check('reason: longer memories had it -> blip', M.reasonFor(0.6, V(0.55, [0.6, 0.55, 0.4], [0.6]), 0) === 'blip');
  check('reason: only one of HEX\'s own models had it -> outvoted', M.reasonFor(0.6, V(0.55, [0.6, 0.6, 0.6], [0.6, 0.4]), 0) === 'outvoted');
  check('reason: nothing had it -> unseen', M.reasonFor(0.6, V(0.55, [0.6, 0.6, 0.6], [0.6, 0.7]), 0) === 'unseen');
  // 5: after a miss, influence moves toward the memories that had it right (a theorem for the null's mixture; checked on the frozen 6.5, whose weights are plain Bayes)
  let moved = 0, n = 0, never = true;
  for (const read of ['MOVE', 'RANGE']) { const c64 = L.filter((r) => r.engine === 'state-6.5' && r.read === read).sort((a, b) => a.bar_ts - b.bar_ts);
  for (let i = 0; i + 1 < c64.length; i++) { const r = c64[i]; if (!r.scored || !r.reason || r.reason === 'unseen' || r.reason === 'structure') continue; const before = moved;
    const now = JSON.parse(r.views), next = JSON.parse(c64[i + 1].views), ok = new Set(M.rightViews(now, r.outcome));
    for (const k of ['memories', 'readings']) for (let j = 0; j < now[k].length; j++) if (ok.has(now[k][j].label)) moved += next[k][j].w - now[k][j].w; n++; if (moved < before - 1e-4) never = false; } }
  console.log(`  after ${n} misses with a reason, trust in the parts that had it right moved by ${(moved / Math.max(1, n)).toFixed(4)} per miss`);
  check('cycle 5: after every such miss, trust moves toward the parts of memory that had it right', n > 0 && moved > 0 && never);
}

// ---- pooled calibration
const map = M.pooledCalibration(lastRun.steps['hex-7.0'].RANGE);
check('calibration map is fitted and monotone', !!map && map.y.every((v, i) => i === 0 || v >= map.y[i - 1] - 1e-12) && map.x.every((v, i) => i === 0 || v > map.x[i - 1]));
check('too few steps -> no map', M.pooledCalibration(lastRun.steps['hex-7.0'].RANGE.slice(0, 500)) === null);
const f = M.fitStrength(lastRun.steps['hex-7.0'].RANGE.map((s) => s.p), lastRun.steps['hex-7.0'].RANGE.map((s) => s.y));
const grid = Array.from({ length: 197 }, (_, i) => 0.01 + i * 0.005);
check('stored map reproduces the fitted curve', grid.every((p) => Math.abs(M.applyStrength(map, p) - M.restate(p, f)) < 1e-4));
check('calibration never changes the side of a call', grid.every((p) => (M.applyStrength(map, p) >= 0.5) === (p >= 0.5)));
check('calibration never states less than 50% for the side called', grid.every((p) => Math.max(M.applyStrength(map, p), 1 - M.applyStrength(map, p)) >= 0.5001 - 1e-12));
check('rounding to four decimals never changes the side of a call', [0.01, 0.49994, 0.49995, 0.4999999, 0.5, 0.50004, 0.99].every((p) => (M.stated(p) >= 0.5) === (p >= 0.5) && (M.stated(p, map) >= 0.5) === (p >= 0.5)) && M.stated(0.4999999) === 0.4999);
{ // a map that says every call was wrong still cannot turn a call round
  const wrong = M.strengthKnots(grid, grid.map((p) => (p >= 0.5 ? 0 : 1)));
  check('even a record of all wrong calls leaves the side alone', grid.every((p) => (M.applyStrength(wrong, p) >= 0.5) === (p >= 0.5)));
}
check('closeness: 1 for certain and right, 0.75 for a coin flip, 0 at worst', M.closeness(1, 1) === 1 && M.closeness(0.5, 1) === 0.75 && M.closeness(0.5, 0) === 0.75 && M.closeness(1, 0) === 0);
// ---- reward is progress against the version's own record
for (const engine of ['state-6.5', 'hex-7.0']) for (const read of ['MOVE', 'RANGE']) {
  const rs = L.filter((r) => r.scored && r.engine === engine && r.read === read).sort((a, b) => a.bar_ts - b.bar_ts);
  let sum = 0, ok = true;
  rs.forEach((r, i) => {
    const before = i ? sum / i : M.START_CLOSENESS;
    const d = r.closeness - before;
    if (Math.abs(r.reward - Math.max(0, d)) > 2e-6 || Math.abs(r.lesson - Math.max(0, -d)) > 2e-6 || r.reward < 0 || r.lesson < 0 || r.record_calls !== i + 1) ok = false;
    sum += r.closeness;
    if (Math.abs(r.record_closeness - sum / (i + 1)) > 1e-6) ok = false;
  });
  check(`${engine} ${read}: reward is progress against the record before it, never negative; a shortfall is kept as a lesson`, ok && rs.length === NIGHTS);
}
check('reward: the same call earns more against a lower record', M.rewardOf(0.8, 0.70) > M.rewardOf(0.8, 0.78) && M.rewardOf(0.8, 0.8) === 0);
check('reward: falling short earns nothing, not a negative; the distance is a lesson', M.rewardOf(0.6, 0.76) === 0 && Math.abs(M.lessonOf(0.6, 0.76) - 0.16) < 1e-12 && M.lessonOf(0.8, 0.76) === 0);
check('a call that falls short still enters the record', L.filter((r) => r.scored && r.lesson > 0).every((r) => r.record_calls >= 1 && Number.isFinite(r.record_closeness)) && L.some((r) => r.lesson > 0));
{ const st = M.summarise('RANGE', L, 'state-6.5'); check('status carries each version\'s mean reward (never negative) and mean lesson', st.progress_control >= 0 && st.progress_candidate >= 0 && st.lesson_control >= 0 && st.lesson_candidate >= 0); }
console.log(`  calibration map: ${map.x.length} knots from ${map.n} steps`);

// ---- loadLive
await db.EngineStatus.create({ read: 'RANGE', live_engine: 'state-6.5', verified: false, calibration: JSON.stringify(map), calibration_control: JSON.stringify(map) });
live = await M.loadLive(base44);
check('loadLive returns the version, the maps and the verified flag the ledger stored', live.RANGE === 'state-6.5' && live.MOVE === 'hex-7.0' && live.calibration['hex-7.0'].RANGE.x.length === map.x.length && live.calibration['state-6.5'].RANGE.x.length === map.x.length && live.verified.RANGE === false && live.verified.MOVE === false);
console.log(`\n${fails ? fails + ' FAILED' : 'ALL PASSED'}`);
process.exit(fails ? 1 : 0);
