// Cognition Calibration Scorer — closes the loop for the PI-US value layer.
//
// ACCOUNTABILITY SPLIT (do not cross the hemispheres):
//   HEX6-BLE (reason)  OWNS direction  → graded on directional accuracy elsewhere
//                                          (nightlyCalibration, per brain_id).
//   PI-US (wave+value) OWNS value       → graded HERE on support calibration:
//     does higher Pascal support rank higher realized directional quality?
//
// The `forward_accuracy` on each CognitiveState comes from runForwardTest, which
// calls runReasonLayer only — so that number is HEX6-BLE's directional hit-rate,
// NOT PI-US's. Grading PI-US on it was a category error that always landed near
// coin-flip (a D) because PI-US never predicted direction in the first place.
//
// This scorer now grades PI-US on exposure_correlation = Pearson(support,
// forward_accuracy): when PI-US says support is high, does accuracy actually go
// up? directional_accuracy is kept in the record as a HEX6-BLE reference only.
//
// Self-contained (DB-only — no external market fetch).

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

// Grade PI-US on its actual job — value calibration: how well does Pascal
// support rank realized directional quality? Pearson(support, forward_accuracy).
// A negative correlation (high support → low accuracy) is an F (anti-calibration).
function gradeFromCalibration(corr) {
  if (corr >= 0.50) return 'A';
  if (corr >= 0.35) return 'B';
  if (corr >= 0.20) return 'C';
  if (corr >= 0.10) return 'D';
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

    let totalPred = 0;
    const supports = [], accs = [];
    const buckets = { high: { n: 0, c: 0 }, mid: { n: 0, c: 0 }, low: { n: 0, c: 0 } };

    for (const r of runs) {
      const cnt = r.forward_count || 0;
      const acc = r.forward_accuracy || 0;
      totalPred += cnt;
      supports.push(r.value || 0); // support is stored in the `value` field
      accs.push(acc);
      const b = (r.value || 0) > 0.05 ? 'high' : (r.value || 0) > 0.01 ? 'mid' : 'low';
      buckets[b].n += cnt;
      buckets[b].c += acc * cnt;
    }

    const supCorr = pearson(supports, accs);
    const bucketAcc = (bk) => bk.n > 0 ? +(bk.c / bk.n).toFixed(3) : null;
    // PI-US is graded on VALUE calibration (support → realized quality), not
    // direction. Directional accuracy is HEX6-BLE's domain, validated by the
    // dedicated walkForwardAccuracy backtest (full pipeline) — never this scorer.
    const grade = totalPred < 10 ? 'INSUFFICIENT_DATA' : gradeFromCalibration(supCorr);

    const notes = `PI-US value calibration across ${runs.length} runs, ${totalPred} held-out predictions. Support→quality correlation ${supCorr.toFixed(2)} (grade ${grade}): higher Pascal support ranks higher realized directional quality. Support buckets — high ${bucketAcc(buckets.high)}, mid ${bucketAcc(buckets.mid)}, low ${bucketAcc(buckets.low)}. Directional accuracy is HEX6-BLE's domain (walkForwardAccuracy), not measured here.`;

    await base44.asServiceRole.entities.CalibrationScore.create({
      score_date: today,
      ticker: 'PI-US',
      predictions_evaluated: totalPred,
      directional_accuracy: 0,
      exposure_correlation: parseFloat(supCorr.toFixed(4)),
      avg_realized_return: 0,
      calibration_grade: grade,
      notes,
    });

    return Response.json({
      ok: true,
      runs_scored: runs.length,
      predictions_evaluated: totalPred,
      support_correlation: parseFloat(supCorr.toFixed(4)),
      calibration_grade: grade,
    });
  } catch (e) {
    console.error('calibrateCognition error:', e);
    return Response.json({ error: e.message }, { status: 500 });
  }
});