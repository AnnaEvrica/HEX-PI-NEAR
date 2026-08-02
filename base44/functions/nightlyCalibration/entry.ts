// Nightly Calibration Scorer (v2 — multi-brain)
// Scores predictions stored in the Output entity, grouped by brain_id.
// For each output, fetches the next state in its Series (after the prediction's current_state)
// and compares predicted direction vs realized direction.
// Writes one CalibrationScore row per brain + a GLOBAL aggregate.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function pearson(a, b) {
  const n = Math.min(a.length, b.length);
  if (n < 3) return 0;
  const ma = a.reduce((s, x) => s + x, 0) / n;
  const mb = b.reduce((s, x) => s + x, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return (da === 0 || db === 0) ? 0 : num / Math.sqrt(da * db);
}

function gradeFromAccuracy(acc) {
  if (acc >= 0.75) return 'A';
  if (acc >= 0.65) return 'B';
  if (acc >= 0.55) return 'C';
  if (acc >= 0.45) return 'D';
  return 'F';
}

// Direction implied by the realized state transition (state-bit popularity):
// If majority of bits in state_t+1 are 1 → UP, else DOWN. FLAT if exactly 3.
function directionOfState(state) {
  if (state === null || state === undefined) return 'UNKNOWN';
  let ones = 0;
  for (let b = 0; b < 6; b++) if ((state >> b) & 1) ones++;
  if (ones > 3) return 'UP';
  if (ones < 3) return 'DOWN';
  return 'FLAT';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Pull recent Output records (last 1000)
    const outputs = await base44.asServiceRole.entities.Output.list('-timestamp', 1000).catch(() => []);

    if (!outputs || outputs.length === 0) {
      await base44.asServiceRole.entities.CalibrationScore.create({
        score_date: new Date().toISOString().split('T')[0],
        ticker: 'GLOBAL',
        predictions_evaluated: 0,
        directional_accuracy: 0,
        exposure_correlation: 0,
        avg_realized_return: 0,
        calibration_grade: 'INSUFFICIENT_DATA',
        notes: 'No Output records available to score.',
      });
      return Response.json({ ok: true, message: 'No outputs to score.' });
    }

    // Group outputs by brain_id
    const byBrain = {};
    for (const o of outputs) {
      const b = o.brain_id || 'UNKNOWN';
      if (!byBrain[b]) byBrain[b] = [];
      byBrain[b].push(o);
    }

    // Cache series state arrays so we don't re-fetch per output
    const seriesCache = {};
    async function getSeriesStates(seriesId) {
      if (seriesCache[seriesId] !== undefined) return seriesCache[seriesId];
      const s = await base44.asServiceRole.entities.Series.filter({ series_id: seriesId }).catch(() => []);
      seriesCache[seriesId] = (s && s.length > 0) ? (s[0].states || []) : [];
      return seriesCache[seriesId];
    }

    const today = new Date().toISOString().split('T')[0];
    const results = [];

    for (const brainId in byBrain) {
      const records = byBrain[brainId];
      let hits = 0, total = 0;
      const expectedReturns = [];
      const realizedDirs = [];

      for (const o of records) {
        const states = await getSeriesStates(o.series_id);
        if (!states || states.length === 0) continue;

        // Find the index of current_state and check the next state
        const idx = states.lastIndexOf(o.current_state);
        if (idx < 0 || idx >= states.length - 1) continue;
        const nextState = states[idx + 1];
        const realizedDir = directionOfState(nextState);

        if (o.direction && o.direction !== 'UNKNOWN' && realizedDir !== 'UNKNOWN') {
          total++;
          if (o.direction === realizedDir) hits++;
          expectedReturns.push(o.expected_return || 0);
          realizedDirs.push(realizedDir === 'UP' ? 1 : realizedDir === 'DOWN' ? -1 : 0);
        }
      }

      const dirAcc = total > 0 ? hits / total : 0;
      const expCorr = pearson(expectedReturns, realizedDirs);
      const grade = total < 5 ? 'INSUFFICIENT_DATA' : gradeFromAccuracy(dirAcc);

      const scoreData = {
        score_date: today,
        ticker: brainId,
        predictions_evaluated: total,
        directional_accuracy: parseFloat(dirAcc.toFixed(4)),
        exposure_correlation: parseFloat(expCorr.toFixed(4)),
        avg_realized_return: 0,
        calibration_grade: grade,
        notes: `Brain ${brainId}: ${total} predictions scored. Directional accuracy ${(dirAcc * 100).toFixed(1)}%.`,
      };

      await base44.asServiceRole.entities.CalibrationScore.create(scoreData);
      results.push(scoreData);
    }

    // Global aggregate
    const scored = results.filter(r => r.calibration_grade !== 'INSUFFICIENT_DATA');
    const globalAcc = scored.length > 0 ? scored.reduce((s, r) => s + r.directional_accuracy, 0) / scored.length : 0;
    const globalEval = results.reduce((s, r) => s + r.predictions_evaluated, 0);

    await base44.asServiceRole.entities.CalibrationScore.create({
      score_date: today,
      ticker: 'GLOBAL',
      predictions_evaluated: globalEval,
      directional_accuracy: parseFloat(globalAcc.toFixed(4)),
      exposure_correlation: 0,
      avg_realized_return: 0,
      calibration_grade: globalEval < 10 ? 'INSUFFICIENT_DATA' : gradeFromAccuracy(globalAcc),
      notes: `Multi-brain calibration across ${results.length} brains, ${globalEval} total predictions.`,
    });

    return Response.json({
      ok: true,
      brainsScored: results.length,
      totalPredictions: globalEval,
      globalAccuracy: globalAcc,
      results,
    });
  } catch (error) {
    console.error('Calibration error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});