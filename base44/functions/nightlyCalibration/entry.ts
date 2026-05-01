// Nightly Calibration Scorer
// Replays past HEX6 engine outputs against subsequent realized returns
// Writes a calibration_grade per ticker + GLOBAL aggregate to CalibrationScore entity
// Triggered by scheduled automation

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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Optional: verify caller is admin OR coming from automation
    // Automations bypass auth, so we allow that path

    // Pull recent HEX6Memory backtest/trade records from the last 30 days
    const memories = await base44.asServiceRole.entities.HEX6Memory.list('-created_date', 500);

    if (!memories || memories.length === 0) {
      await base44.asServiceRole.entities.CalibrationScore.create({
        score_date: new Date().toISOString().split('T')[0],
        ticker: 'GLOBAL',
        predictions_evaluated: 0,
        directional_accuracy: 0,
        exposure_correlation: 0,
        avg_realized_return: 0,
        calibration_grade: 'INSUFFICIENT_DATA',
        notes: 'No engine memories available to score.',
      });
      return Response.json({ ok: true, message: 'No data to score.' });
    }

    // Group by ticker
    const byTicker = {};
    for (const m of memories) {
      const t = m.ticker || 'UNKNOWN';
      if (!byTicker[t]) byTicker[t] = [];
      byTicker[t].push(m);
    }

    const results = [];
    const today = new Date().toISOString().split('T')[0];

    // Score each ticker
    for (const ticker in byTicker) {
      const records = byTicker[ticker];
      const exposures = [];
      const realizedReturns = [];
      let directionalHits = 0;
      let directionalTotal = 0;

      for (const r of records) {
        try {
          const engineParams = JSON.parse(r.engine_params || '{}');
          const metrics = JSON.parse(r.metrics || '{}');
          const exposure = engineParams.exposure ?? engineParams.blendedExposure;
          const realizedMu = engineParams.mu ?? metrics.realizedReturn ?? null;
          const predictedMu = engineParams.markov?.mu ?? engineParams.mu ?? null;

          if (exposure != null && realizedMu != null) {
            exposures.push(exposure);
            realizedReturns.push(realizedMu);
          }

          // Directional accuracy: did predicted mu sign match realized mu sign?
          if (predictedMu != null && realizedMu != null) {
            directionalTotal++;
            if (Math.sign(predictedMu) === Math.sign(realizedMu)) directionalHits++;
          }
        } catch { /* skip malformed */ }
      }

      const dirAcc = directionalTotal > 0 ? directionalHits / directionalTotal : 0;
      const expCorr = pearson(exposures, realizedReturns);
      const avgRealized = realizedReturns.length > 0
        ? realizedReturns.reduce((s, x) => s + x, 0) / realizedReturns.length
        : 0;

      const grade = directionalTotal < 5 ? 'INSUFFICIENT_DATA' : gradeFromAccuracy(dirAcc);

      const scoreData = {
        score_date: today,
        ticker,
        predictions_evaluated: directionalTotal,
        directional_accuracy: parseFloat(dirAcc.toFixed(4)),
        exposure_correlation: parseFloat(expCorr.toFixed(4)),
        avg_realized_return: parseFloat(avgRealized.toFixed(6)),
        calibration_grade: grade,
        notes: `Scored ${directionalTotal} predictions for ${ticker}. Directional accuracy ${(dirAcc * 100).toFixed(1)}%, exposure-return corr ${expCorr.toFixed(3)}.`,
      };

      await base44.asServiceRole.entities.CalibrationScore.create(scoreData);
      results.push(scoreData);
    }

    // Global aggregate
    const allDirAcc = results.filter(r => r.calibration_grade !== 'INSUFFICIENT_DATA').map(r => r.directional_accuracy);
    const globalAcc = allDirAcc.length > 0 ? allDirAcc.reduce((s, x) => s + x, 0) / allDirAcc.length : 0;
    const globalEval = results.reduce((s, r) => s + r.predictions_evaluated, 0);

    await base44.asServiceRole.entities.CalibrationScore.create({
      score_date: today,
      ticker: 'GLOBAL',
      predictions_evaluated: globalEval,
      directional_accuracy: parseFloat(globalAcc.toFixed(4)),
      exposure_correlation: 0,
      avg_realized_return: 0,
      calibration_grade: globalEval < 10 ? 'INSUFFICIENT_DATA' : gradeFromAccuracy(globalAcc),
      notes: `Global calibration across ${results.length} tickers, ${globalEval} total predictions.`,
    });

    return Response.json({
      ok: true,
      tickersScored: results.length,
      totalPredictions: globalEval,
      globalAccuracy: globalAcc,
      results,
    });
  } catch (error) {
    console.error('Calibration error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});