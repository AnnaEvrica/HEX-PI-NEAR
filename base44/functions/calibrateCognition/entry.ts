// Nightly update — the learning loop.
//
// Runs from the "Nightly Cognition Calibration" workflow. For every tracked
// series (shared/universe.ts, plus tickers people asked about in chat), in
// this order and no other:
//   1. REVEAL + SCORE  score the open calls of both versions against the bar
//                      that has now finished: information gain over the null,
//                      closeness, reward, and the reason for each miss
//   2. LEARN + PREDICT run both versions on everything known tonight. Each
//                      walks the series from its first bar, one step at a
//                      time, so what it has learned tonight is exactly what a
//                      single pass through history would have taught it
//   3. COMMIT          write tonight's calls to the ledger with what each part
//                      of memory said, before their outcomes exist
// Then, across all series:
//   4. refit each version's strength map, pooled over every tracked series
//   5. add the newly settled days to each read's running tally and apply the
//      version rule and the verified-edge test to the whole record
//   6. store one EngineStatus row per read. Every function reads that row
//      before it shows a number.
// Last, and apart from all of the above:
//   EXPERIENTIAL INTEGRATION  perceive tonight's moment of every series,
//      compare it with the moments already met, and append it to the Memory
//      Library (shared/memory.ts). It reads what the night already fetched,
//      predicts nothing and changes nothing above: a failure in it is
//      reported and leaves the calibration as it was.
// The response carries timings, for watching how the job scales.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { fetchYahooReturns } from '../../shared/marketDataClient.ts';
import { runEngines, READS, ENGINES, CANDIDATE_ENGINE, CONTROL_ENGINE } from '../../shared/engines.ts';
import { loadLive, logCalls, rowsFor, scoreOpenCalls, foldDays, decide, pooledCalibration, EMPTY_TALLY, SETTLE_DAYS } from '../../shared/ledger.ts';
import { UNIVERSE, MAX_EXTRA_SERIES, HISTORY_DAYS } from '../../shared/universe.ts';
import { ENGINE_VERSION } from '../../shared/version.ts';
import { integrateExperience } from '../../shared/memory.ts';

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

    const started = Date.now();
    let scored = 0, logged = 0;
    const pooled = Object.fromEntries(ENGINES.map((e) => [e, { MOVE: [], RANGE: [] }]));
    const failed: string[] = [];
    const timings: Record<string, number> = {};
    const fetched: { ticker: string; returns: number[]; timestamps: number[] }[] = [];
    for (const ticker of tickers) {
      const t0 = Date.now();
      let md = null;
      try { md = await fetchYahooReturns(ticker, HISTORY_DAYS); } catch { failed.push(ticker); continue; }
      const bars = { closes: md.completedCloses, timestamps: md.timestamps.slice(0, md.completedBars) };
      fetched.push({ ticker, returns: md.returns, timestamps: bars.timestamps });
      scored += await scoreOpenCalls(base44, ticker, bars);
      const run = runEngines(md.returns, live);
      if (!run) { failed.push(ticker); continue; }
      logged += await logCalls(base44, rowsFor(ticker, bars, md.returns, run, 'nightly'));
      // Each version's own scored steps on this series. Every outcome in them
      // is already known, so pooling them leaks nothing forward.
      for (const e of ENGINES) for (const read of READS) pooled[e][read].push(...run.steps[e][read]);
      timings[ticker] = Date.now() - t0;
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
      const map = pooledCalibration(pooled[CANDIDATE_ENGINE][read]), mapControl = pooledCalibration(pooled[CONTROL_ENGINE][read]);
      const row = {
        ...st,
        // the ledger's own record changes the status only when it is decisive; otherwise what stood before stands
        verified: st.verified ?? (typeof prev?.verified === 'boolean' ? prev.verified : live.verified?.[read] ?? null),
        tally: JSON.stringify(tally),
        calibration: map ? JSON.stringify(map) : (prev?.calibration ?? null),
        calibration_control: mapControl ? JSON.stringify(mapControl) : (prev?.calibration_control ?? null),
        calibration_steps: map ? map.n : (prev?.calibration_steps ?? 0),
        promoted_at: st.decision === 'promote' ? new Date().toISOString() : (st.live_engine === CANDIDATE_ENGINE ? prev?.promoted_at ?? null : null),
        engine_version: ENGINE_VERSION,
      };
      if (prev?.id) await S.update(prev.id, row).catch(() => {});
      else await S.create(row).catch(() => {});
      status[read] = { live_engine: st.live_engine, decision: st.decision, reason: st.reason, verified: row.verified, paired_calls: st.paired_calls, paired_days: st.paired_days,
        gain: st.gain, gain_low: st.gain_low, gain_high: st.gain_high, bits_control: st.bits_control, bits_candidate: st.bits_candidate, bits_candidate_low: st.bits_candidate_low, bits_candidate_high: st.bits_candidate_high,
        hit_control: st.hit_control, hit_candidate: st.hit_candidate, hit_baseline: st.hit_baseline, calibration_steps: row.calibration_steps };
    }

    const calibrated_ms = Date.now() - started;
    let experiential: Record<string, unknown>;
    try { experiential = await integrateExperience(base44, fetched, { engine_version: ENGINE_VERSION, status, failed }); }
    catch (error) { console.error('experiential integration error:', error); experiential = { ok: false, error: String(error?.message ?? error) }; }

    return Response.json({ ok: true, engine_version: ENGINE_VERSION, series: tickers.length, failed, newly_scored: scored, newly_logged: logged, status, elapsed_ms: calibrated_ms, per_series_ms: timings, experiential });
  } catch (error) {
    console.error('calibrateCognition error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
