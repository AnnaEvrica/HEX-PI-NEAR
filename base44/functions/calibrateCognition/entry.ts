// Cognition Calibration Scorer — closes the loop for the PI-US / unified engine.
// Scores the CognitiveState records produced by `think` (which already carry a
// realized, out-of-sample walk-forward directional accuracy on the held-out tail
// of each input series). Rolls them up into one CalibrationScore row per day.
//
// This is self-contained (DB-only — no external market fetch), so it cannot hit
// the CONNECT_TIMEOUT issues that affect outward-calling syncs.
//
// Metrics:
//   predictions_evaluated — total held-out predictions across runs
//   directional_accuracy  — accuracy weighted by each run's forward_count
//   exposure_correlation — Pearson(support, forward_accuracy) across runs
//                           (does Pascal's support rank realized quality?)

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.39';

function pearson(a, b) {
  const n = Math.min(a.length, b.length);
  if (n < 3) return 0;
  const ma = a.reduce((s, x) => s + x, 0) / n;
  const mb = b.reduce((s, x) => s + x, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
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
    const today = new Date().toISOString().split('T')[0];

    const recent = await base44.asServiceRole.entities.CognitiveState.list('-created_date', 1000).catch(() => []);
    const runs = (recent || []).filter(r => r.forward_accuracy != null && r.forward_count > 0);

    if (runs.length === 0) {
      await base44.asServiceRole.entities.CalibrationScore.create({
        score_date: today,
        ticker: 'PI-US',
        predictions_evaluated: 0,
        directional_accuracy: 0,
        exposure_correlation: 0,
        avg_realized_return: 0,
        calibration_grade: 'INSUFFICIENT_DATA',
        notes: 'No CognitiveState forward-test records available to score yet.',
      });
      return Response.json({ ok: true, message: 'No cognition runs to score yet.' });
    }

    let totalPred = 0, totalCorrect = 0;
    const supports = [], accs = [];
    const buckets = { high: { n: 0, c: 0 }, mid: { n: 0, c: 0 }, low: { n: 0, c: 0 } };

    for (const r of runs) {
      const cnt = r.forward_count || 0;
      const acc = r.forward_accuracy || 0;
      totalPred += cnt;
      totalCorrect += acc * cnt;
      supports.push(r.value || 0); // support is stored in the `value` field
      accs.push(acc);
      const b = (r.value || 0) > 0.05 ? 'high' : (r.value || 0) > 0.01 ? 'mid' : 'low';
      buckets[b].n += cnt;
      buckets[b].c += acc * cnt;
    }

    const dirAcc = totalPred > 0 ? totalCorrect / totalPred : 0;
    const supCorr = pearson(supports, accs);
    const bucketAcc = (bk) => bk.n > 0 ? +(bk.c / bk.n).toFixed(3) : null;
    const grade = totalPred < 10 ? 'INSUFFICIENT_DATA' : gradeFromAccuracy(dirAcc);

    const notes = `PI-US cognition across ${runs.length} runs, ${totalPred} held-out predictions. Directional accuracy ${(dirAcc * 100).toFixed(1)}%. Support-calibration corr ${supCorr.toFixed(2)} (high-support ${bucketAcc(buckets.high)}, mid ${bucketAcc(buckets.mid)}, low ${bucketAcc(buckets.low)}).`;

    await base44.asServiceRole.entities.CalibrationScore.create({
      score_date: today,
      ticker: 'PI-US',
      predictions_evaluated: totalPred,
      directional_accuracy: parseFloat(dirAcc.toFixed(4)),
      exposure_correlation: parseFloat(supCorr.toFixed(4)),
      avg_realized_return: 0,
      calibration_grade: grade,
      notes,
    });

    return Response.json({
      ok: true,
      runs_scored: runs.length,
      predictions_evaluated: totalPred,
      directional_accuracy: parseFloat(dirAcc.toFixed(4)),
      support_correlation: parseFloat(supCorr.toFixed(4)),
      calibration_grade: grade,
    });
  } catch (e) {
    console.error('calibrateCognition error:', e);
    return Response.json({ error: e.message }, { status: 500 });
  }
});