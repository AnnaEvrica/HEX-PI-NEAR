// TIME SIMULATION, part 2: the cycle, run through time.
// Starts on 1 January 2016 with an empty ledger and no map. For every calendar
// day and every series with a bar that day, the real code does what the
// nightly job does:
//   score the calls whose outcome is now known (outcome, score, reason),
//   state tonight's calls (6.5's strength restated by the map in force),
//   write them to the ledger with their views,
// and once all series are done, the nightly update: add the settled days to
// the tally, apply the promotion rule, refit the pooled strength map.
// The functions are the ones in base44/shared; only the database is in memory.
//   node validation/timesim/cycle.mjs <calls dir from part 1> <out.json>
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const [callsDir, outFile] = process.argv.slice(2);
const entry = path.join(callsDir, '_entry_c.ts'), bundle = path.join(callsDir, '_code_c.mjs');
const sh = path.join(here, '..', '..', 'base44', 'shared');
fs.writeFileSync(entry, ['ledger', 'engines', 'isotonic', 'hex7', 'observer', 'cycle'].map((m) => `export * from '${path.join(sh, m + '.ts')}';`).join('\n'));
await build({ entryPoints: [entry], bundle: true, format: 'esm', outfile: bundle, logLevel: 'error' });
const M = await import(bundle);

// ---- in-memory entities (indexed; rows are created in date order) -----------
function ledgerTable() {
  const rows = [], byId = new Map(), bySeries = new Map(), byDay = new Map(), open = new Map(); let id = 0;
  const match = (r, q) => { for (const k in q) if (r[k] !== q[k]) return false; return true; };
  return {
    rows,
    create: async (o) => { const r = { id: String(++id), ...o }; rows.push(r); byId.set(r.id, r);
      (bySeries.get(r.series_id) ?? bySeries.set(r.series_id, []).get(r.series_id)).push(r);
      const dk = r.series_id + '|' + r.call_date; (byDay.get(dk) ?? byDay.set(dk, []).get(dk)).push(r);
      if (!r.scored) (open.get(r.series_id) ?? open.set(r.series_id, new Set()).get(r.series_id)).add(r); return r; },
    update: async (i, p) => { const r = byId.get(i); Object.assign(r, p); if (r.scored) open.get(r.series_id)?.delete(r); return r; },
    filter: async (q, sort, limit) => {
      let pool = rows;
      if (q.series_id !== undefined && q.call_date !== undefined) pool = byDay.get(q.series_id + '|' + q.call_date) || [];
      else if (q.series_id !== undefined && q.scored === false) pool = [...(open.get(q.series_id) || [])];
      else if (q.series_id !== undefined) pool = bySeries.get(q.series_id) || [];
      if (sort === '-call_date') { const out = []; for (let k = pool.length - 1; k >= 0 && out.length < (limit || Infinity); k--) if (match(pool[k], q)) out.push(pool[k]); return out; }
      const out = pool.filter((r) => match(r, q)); return limit ? out.slice(0, limit) : out;
    },
    list: async () => rows.slice(),
  };
}
function plainTable() { const rows = []; let id = 0; return { rows, create: async (o) => { const r = { id: String(++id), ...o }; rows.push(r); return r; },
  update: async (i, p) => Object.assign(rows.find((r) => r.id === i), p), filter: async (q) => rows.filter((r) => Object.entries(q || {}).every(([k, v]) => r[k] === v)), list: async () => rows.slice() }; }
const db = { CallLedger: ledgerTable(), EngineStatus: plainTable() };
const base44 = { asServiceRole: { entities: db } };

// ---- part 1's calls ---------------------------------------------------------
const series = {};
for (const f of fs.readdirSync(callsDir).filter((x) => x.endsWith('.jsonl')).sort()) {
  const nights = []; for await (const line of readline.createInterface({ input: fs.createReadStream(path.join(callsDir, f)) })) if (line) nights.push(JSON.parse(line));
  series[f.replace('.jsonl', '')] = nights;
}
const names = Object.keys(series);
const csvDir = process.env.TIMESIM_DATA;
const bars = {}; // every bar, including the ones before the first call
for (const name of names) { const r = fs.readFileSync(path.join(csvDir, name + '.csv'), 'utf8').trim().split('\n').slice(1).map((l) => l.split(','));
  bars[name] = { dates: r.map((x) => x[0]), closes: r.map((x) => +x[1]), timestamps: r.map((x) => Math.floor(Date.parse(x[0] + 'T00:00:00Z') / 1000)) }; }
const calendar = [...new Set(names.flatMap((n) => series[n].map((x) => x.date)))].sort();
const cursor = Object.fromEntries(names.map((n) => [n, 0]));
const pooled = Object.fromEntries(M.ENGINES.map((e) => [e, { MOVE: [], RANGE: [] }])), counted = new Set(), events = [];
let thresholdMismatch = 0, mapFirst = { MOVE: null, RANGE: null };
console.log(`${names.length} series, ${calendar.length} calendar days, ${names.reduce((s, n) => s + series[n].length, 0)} series-nights`);

const t0 = Date.now();
for (const day of calendar) {
  const live = await M.loadLive(base44);
  for (const name of names) {
    const night = series[name][cursor[name]];
    if (!night || night.date !== day) continue;
    cursor[name]++;
    const B = bars[name], end = B.dates.indexOf(day, Math.max(0, cursor[name] - 1)) + 1;
    const known = { closes: B.closes.slice(0, end), timestamps: B.timestamps.slice(0, end) };
    // 2-4: outcome, score, reason for the calls that can now be scored
    await M.scoreOpenCalls(base44, name, known);
    // 1: tonight's calls. 6.2 as it stated them; 6.5's strength restated by the map in force tonight
    const run = { calls: {}, live: { MOVE: live.MOVE, RANGE: live.RANGE }, verified: live.verified || {}, learned: night.learned };
    for (const e of M.ENGINES) { run.calls[e] = {}; for (const read of M.READS) { const c = night.calls[e][read];
      run.calls[e][read] = { p: M.stated(c.views.raw, live.calibration?.[e]?.[read]), baseline: c.baseline, views: c.views }; } }
    const returns = []; for (let i = 1; i < end; i++) returns.push(Math.log(known.closes[i] / known.closes[i - 1]));
    const rows = M.rowsFor(name, known, returns, run, 'nightly');
    if (Math.abs((rows.find((r) => r.read === 'RANGE').threshold ?? 0) - (night.threshold ?? 0)) > 1e-12) thresholdMismatch++;
    await M.logCalls(base44, rows);
  }
  // 6.5's scored steps so far, for the pooled map (each counted once)
  const recent = await db.CallLedger.filter({ scored: true }, '-call_date', 5000);
  for (const r of recent) if (!counted.has(r.id)) { counted.add(r.id); pooled[r.engine][r.read].push({ p: r.raw, y: r.outcome }); }
  // the nightly update (functions/calibrateCognition)
  const through = new Date(Date.parse(day + 'T00:00:00Z') - M.SETTLE_DAYS * 86400000).toISOString().slice(0, 10);
  for (const read of M.READS) {
    const prev = db.EngineStatus.rows.find((r) => r.read === read);
    let tally = M.EMPTY_TALLY; if (prev?.tally) tally = { ...M.EMPTY_TALLY, ...JSON.parse(prev.tally) };
    tally = M.foldDays(tally, read, recent, through);
    const st = M.decide(read, tally, live[read]);
    const map = M.pooledCalibration(pooled[M.CANDIDATE_ENGINE][read]), mapControl = M.pooledCalibration(pooled[M.CONTROL_ENGINE][read]);
    if (map && !mapFirst[read]) mapFirst[read] = day;
    if (st.decision !== 'hold') events.push({ day, read, decision: st.decision, reason: st.reason });
    const row = { ...st, verified: st.verified ?? (typeof prev?.verified === 'boolean' ? prev.verified : live.verified?.[read] ?? null), tally: JSON.stringify(tally), calibration: map ? JSON.stringify(map) : (prev?.calibration ?? null), calibration_control: mapControl ? JSON.stringify(mapControl) : (prev?.calibration_control ?? null), calibration_steps: map ? map.n : (prev?.calibration_steps ?? 0) };
    if (prev && prev.verified !== row.verified) events.push({ day, read, verified: row.verified });
    if (prev) await db.EngineStatus.update(prev.id, row); else await db.EngineStatus.create(row);
  }
  if (day.endsWith('-01-04') || day.endsWith('-07-01')) console.log(day, `${db.CallLedger.rows.length} rows`, `${((Date.now() - t0) / 60000).toFixed(1)} min`, JSON.stringify(Object.fromEntries(M.READS.map((r) => [r, db.EngineStatus.rows.find((x) => x.read === r)?.live_engine]))));
}

// ============================ what happened ==================================
const R = db.CallLedger.rows.filter((r) => r.scored);
const side = (p) => (p >= 0.5 ? 1 : 0), pct = (v) => Number((v * 100).toFixed(1)), mean = (v) => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : null), r4 = (v) => (v === null ? null : Number(v.toFixed(4)));
function stats(rows) {
  if (!rows.length) return null;
  const hit = rows.map((r) => (side(r.probability) === r.outcome ? 1 : 0)), str = rows.map((r) => Math.max(r.probability, 1 - r.probability));
  const order = rows.map((_, i) => i).sort((a, b) => str[b] - str[a]).slice(0, Math.max(1, Math.round(rows.length / 10)));
  const missed = rows.filter((r) => r.reason), reasons = {}; for (const r of missed) reasons[r.reason] = (reasons[r.reason] || 0) + 1;
  return {
    calls: rows.length, bits_per_call_over_null: Number((mean(rows.map((r) => r.info_gain)) / Math.log(2)).toFixed(5)), right: pct(mean(hit)), closeness: r4(mean(rows.map((r) => r.closeness))), stated: pct(mean(str)),
    strongest_tenth: { stated: pct(mean(order.map((i) => str[i]))), right: pct(mean(order.map((i) => hit[i]))) },
    baseline_right: pct(mean(rows.map((r) => (side(r.baseline) === r.outcome ? 1 : 0)))),
    rewarded: pct(mean(rows.map((r) => (r.reward > 0 ? 1 : 0)))), reward: r4(mean(rows.map((r) => r.reward))), lesson: r4(mean(rows.map((r) => r.lesson))),
    parts: { coin_flip: 0.75, baseline: r4(mean(rows.map((r) => r.part_baseline))), structure: r4(mean(rows.map((r) => r.part_structure))), strength: r4(mean(rows.map((r) => r.part_strength))) },
    misses: missed.length, reasons: Object.fromEntries(M.REASONS.map((k) => [k, pct((reasons[k] || 0) / Math.max(1, missed.length))])),
  };
}
const year = (r) => r.call_date.slice(0, 4);
const AGES = [['first 100', 0, 100], ['100-250', 100, 250], ['250-500', 250, 500], ['500-1000', 500, 1000], ['1000-2000', 1000, 2000], ['2000+', 2000, 1e9]];
const scopes = { shown: (r) => r.shown, 'state-6.5': (r) => r.engine === 'state-6.5', 'hex-7.0': (r) => r.engine === 'hex-7.0' };
const OUT = { started: calendar[0], ended: calendar.at(-1), series: names.length, series_nights: names.reduce((s, n) => s + series[n].length, 0), scored_rows: R.length,
  threshold_mismatches: thresholdMismatch, events, map_first_fitted: mapFirst, final_status: Object.fromEntries(M.READS.map((read) => { const s = db.EngineStatus.rows.find((x) => x.read === read); return [read, { live_engine: s.live_engine, paired_calls: s.paired_calls, paired_days: s.paired_days, verified: s.verified, gain: s.gain, gain_low: s.gain_low, gain_high: s.gain_high, bits_candidate: s.bits_candidate, bits_candidate_low: s.bits_candidate_low, bits_candidate_high: s.bits_candidate_high, bits_control: s.bits_control, hit_control: s.hit_control, hit_candidate: s.hit_candidate, reasons_control: s.reasons_control, reasons_candidate: s.reasons_candidate, reason: s.reason }]; })) };
for (const read of M.READS) {
  const e = OUT[read] = {};
  for (const [nm, f] of Object.entries(scopes)) {
    const rows = R.filter((r) => r.read === read && f(r));
    e[nm] = { all: stats(rows), by_year: Object.fromEntries([...new Set(rows.map(year))].sort().map((y) => [y, stats(rows.filter((r) => year(r) === y))])),
      by_age: Object.fromEntries(AGES.map(([lab, lo, hi]) => [lab, stats(rows.filter((r) => r.record_calls > lo && r.record_calls <= hi))])) };
  }
  // step 5 checked: after a miss, did trust move toward the parts of memory that had it right?
  // and the coherence test: does the reason for one call tell you anything about the next?
  const follow = {}, next = {};
  for (const [nm, f] of [['hex-7.0', scopes['hex-7.0']], ['shown', scopes.shown]]) {
    next[nm] = {};
    for (const name of names) {
      const rows = db.CallLedger.rows.filter((r) => r.series_id === name && r.read === read && f(r));
      for (let i = 0; i + 1 < rows.length; i++) {
        const a = rows[i], b = rows[i + 1]; if (!a.scored) continue;
        const key = a.reason || 'right';
        if (b.scored) { const k = next[nm][key] ??= { n: 0, right: 0, closeness: 0, same: 0 }; k.n++; k.right += side(b.probability) === b.outcome ? 1 : 0; k.closeness += b.closeness; k.stated = (k.stated || 0) + Math.max(b.probability, 1 - b.probability); k.same += b.reason === a.reason && a.reason ? 1 : 0; }
        if (nm === 'hex-7.0' && a.reason && (a.reason === 'change' || a.reason === 'blip')) {
          const now = JSON.parse(a.views), then = JSON.parse(b.views), ok = new Set(M.rightViews(now, a.outcome)); let moved = 0;
          for (const g of ['memories']) for (let j = 0; j < now[g].length; j++) if (ok.has(now[g][j].label)) moved += then[g][j].w - now[g][j].w;
          const k = follow[a.reason] ??= { misses: 0, moved: 0, toward: 0 }; k.misses++; k.moved += moved; if (moved > -1e-4) k.toward++;
        }
      }
    }
    for (const k of Object.values(next[nm])) { k.right = pct(k.right / k.n); k.closeness = r4(k.closeness / k.n); k.stated = pct(k.stated / k.n); k.same = pct(k.same / k.n); }
  }
  for (const k of Object.values(follow)) { k.moved = r4(k.moved / k.misses); k.toward = pct(k.toward / k.misses); }
  e.learning_follows_reason = follow; e.next_call_after = next;
}
fs.writeFileSync(outFile, JSON.stringify(OUT, null, 1));
// the ledger itself, one line per scored call, for further analysis
fs.writeFileSync(outFile.replace(/\.json$/, '_ledger.csv'), 'series,date,read,engine,shown,stated,raw,baseline,outcome,reason,record_calls,closeness,reward,lesson,info_gain\n' + R.map((r) => [r.series_id, r.call_date, r.read, r.engine, r.shown ? 1 : 0, r.probability, r.raw, r.baseline, r.outcome, r.reason, r.record_calls, r.closeness, r.reward, r.lesson, r.info_gain].join(',')).join('\n') + '\n');
console.log(`done in ${((Date.now() - t0) / 60000).toFixed(1)} min; ${R.length} scored rows; events: ${JSON.stringify(events)}`);
