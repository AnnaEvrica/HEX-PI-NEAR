// Nightly forward-record scorer.
//
// Every direction read HEX gives in chat that departs from its usual odds is
// logged in PredictionJournal (shared/predictionJournal.ts). This job scores
// the ones whose horizon has passed against the first real daily close after
// that horizon, then writes one CalibrationScore row per ticker and one
// GLOBAL row. It is the live, out-of-sample record of the engine: nothing is
// replayed or back-filled.
//
// Runs from the "Nightly Cognition Calibration" workflow.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { fetchYahooReturns } from '../../shared/marketDataClient.ts';
import { scoreDueCalls } from '../../shared/predictionJournal.ts';
import { ENGINE_VERSION } from '../../shared/version.ts';

// With fewer scored reads than this, a hit rate means nothing and is not graded.
const MIN_TO_GRADE = 100;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const J = base44.asServiceRole.entities.PredictionJournal;
    const today = new Date().toISOString().split('T')[0];
    const now = Date.now();

    const rows = await J.list('-predicted_at', 2000).catch(() => []);
    const due = (rows || []).filter((r) => !r.resolved && r.resolve_after && new Date(r.resolve_after).getTime() <= now);

    // 1. Score what is due, one price fetch per ticker.
    const byTicker = new Map();
    for (const r of due) {
      if (!byTicker.has(r.ticker)) byTicker.set(r.ticker, []);
      byTicker.get(r.ticker).push(r);
    }
    let newlyScored = 0;
    for (const [ticker, list] of byTicker) {
      let md = null;
      try { md = await fetchYahooReturns(ticker, 120); } catch { continue; }
      // Finished bars only: the bar still in progress has no close yet.
      newlyScored += await scoreDueCalls(J, list, { closes: md.completedCloses, timestamps: md.timestamps.slice(0, md.completedBars) });
    }

    // 2. Summarise the whole scored record.
    const scored = (rows || []).filter((r) => r.resolved && typeof r.correct === 'boolean');
    const summarise = (list) => {
      const n = list.length;
      const hits = list.filter((r) => r.correct).length;
      const moves = list.filter((r) => r.entry_price > 0 && r.exit_price > 0).map((r) => Math.log(r.exit_price / r.entry_price));
      return {
        n,
        accuracy: n ? hits / n : 0,
        avgMove: moves.length ? moves.reduce((s, x) => s + x, 0) / moves.length : 0,
      };
    };
    const CS = base44.asServiceRole.entities.CalibrationScore;
    const write = async (ticker, list) => {
      const { n, accuracy, avgMove } = summarise(list);
      await CS.create({
        score_date: today,
        ticker,
        predictions_evaluated: n,
        directional_accuracy: Number(accuracy.toFixed(4)),
        avg_realized_return: Number(avgMove.toFixed(6)),
        // No letter grade is given. The field says only whether there are
        // enough scored reads for the hit rate to be read at all.
        calibration_grade: n < MIN_TO_GRADE ? 'INSUFFICIENT_DATA' : 'UNGRADED',
        notes: n < MIN_TO_GRADE
          ? `Forward record, engine ${ENGINE_VERSION}: ${n} scored direction reads so far (${(accuracy * 100).toFixed(1)}% matched the next close). Too few to draw a conclusion; at least ${MIN_TO_GRADE} are needed.`
          : `Forward record, engine ${ENGINE_VERSION}: ${n} scored direction reads, ${(accuracy * 100).toFixed(1)}% matched the next close.`,
      }).catch(() => {});
    };
    const tickers = [...new Set(scored.map((r) => r.ticker))];
    for (const t of tickers) await write(t, scored.filter((r) => r.ticker === t));
    await write('GLOBAL', scored);

    return Response.json({ ok: true, newly_scored: newlyScored, total_scored: scored.length, tickers: tickers.length, engine_version: ENGINE_VERSION });
  } catch (error) {
    console.error('calibrateCognition error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
