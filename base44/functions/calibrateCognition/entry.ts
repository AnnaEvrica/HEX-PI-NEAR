// Nightly update — the learning loop.
//
// Runs from the "Nightly Cognition Calibration" workflow. For every tracked
// series (shared/universe.ts, plus tickers people asked about in chat):
//   1. score yesterday's calls from both versions of HEX against the bar that has
//      now finished
//   2. write down today's calls from both versions of HEX, before their outcome
// Then, across all series:
//   3. refit 6.4's calibration map, pooled over every tracked series
//   4. add the newly settled days to each read's running tally and apply
//      the promotion rule to the whole record (shared/ledger.ts)
//   5. store one EngineStatus row per read: the engine to show, its record,
//      and the calibration map. Every function reads that row before it
//      shows a number.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { fetchYahooReturns } from '../../shared/marketDataClient.ts';
import { runEngines, READS, CANDIDATE_ENGINE } from '../../shared/engines.ts';
import { loadLive, logCalls, rowsFor, scoreOpenCalls, foldDays, decide, pooledCalibration, EMPTY_TALLY, SETTLE_DAYS } from '../../shared/ledger.ts';
import { UNIVERSE, MAX_EXTRA_SERIES, HISTORY_DAYS } from '../../shared/universe.ts';
import { ENGINE_VERSION } from '../../shared/version.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const L = base44.asServiceRole.entities.CallLedger;
    const S = base44.asServiceRole.entities.EngineStatus;
    const live = await loadLive(base44);

    // Series to track tonight: the fixed list, then anything asked about in chat.
    const tickers = UNIVERSE.map((u) => u.ticker);
    try {
      const chat = await L.filter({ source: 'chat' }, '-call_date', 400);
      for (const r of chat || []) {
        if (tickers.length >= UNIVERSE.length + MAX_EXTRA_SERIES) break;
        if (!tickers.includes(r.series_id)) tickers.push(r.series_id);
      }
    } catch { /* fixed list only */ }

    let scored = 0, logged = 0;
    const pooled = { MOVE: [], RANGE: [] };
    const failed: string[] = [];
    for (const ticker of tickers) {
      let md = null;
      try { md = await fetchYahooReturns(ticker, HISTORY_DAYS); } catch { failed.push(ticker); continue; }
      const bars = { closes: md.completedCloses, timestamps: md.timestamps.slice(0, md.completedBars) };
      scored += await scoreOpenCalls(base44, ticker, bars);
      const run = runEngines(md.returns, live);
      if (!run) { failed.push(ticker); continue; }
      logged += await logCalls(base44, rowsFor(ticker, bars, md.returns, run, 'nightly'));
      // 6.4's own scored steps on this series. Every outcome in them is
      // already known, so pooling them leaks nothing forward.
      for (const read of READS) pooled[read].push(...run.candidateSteps[read]);
    }

    // Recently scored rows. Days already in the tally are skipped inside
    // foldDays, so only the new ones matter here.
    const rows = await L.filter({ scored: true }, '-call_date', 5000).catch(() => []);
    const existing = await S.list('-updated_date', 10).catch(() => []);
    const through = new Date(Date.now() - SETTLE_DAYS * 86400000).toISOString().slice(0, 10);
    const status = {};
    for (const read of READS) {
      const prev = (existing || []).find((r) => r.read === read);
      let tally = EMPTY_TALLY;
      if (prev?.tally) { try { tally = { ...EMPTY_TALLY, ...JSON.parse(prev.tally) }; } catch { /* start again */ } }
      tally = foldDays(tally, read, rows || [], through);
      const st = decide(read, tally, live[read]);
      const map = pooledCalibration(pooled[read]);
      const row = {
        ...st,
        tally: JSON.stringify(tally),
        calibration: map ? JSON.stringify(map) : (prev?.calibration ?? null),
        calibration_steps: map ? map.n : (prev?.calibration_steps ?? 0),
        promoted_at: st.decision === 'promote' ? new Date().toISOString() : (st.live_engine === CANDIDATE_ENGINE ? prev?.promoted_at ?? null : null),
        engine_version: ENGINE_VERSION,
      };
      if (prev?.id) await S.update(prev.id, row).catch(() => {});
      else await S.create(row).catch(() => {});
      status[read] = { live_engine: st.live_engine, decision: st.decision, reason: st.reason, paired_calls: st.paired_calls, paired_days: st.paired_days, gain: st.gain, hit_control: st.hit_control, hit_candidate: st.hit_candidate, calibration_steps: row.calibration_steps };
    }

    return Response.json({ ok: true, engine_version: ENGINE_VERSION, series: tickers.length, failed, newly_scored: scored, newly_logged: logged, status });
  } catch (error) {
    console.error('calibrateCognition error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
