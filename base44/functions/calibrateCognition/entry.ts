// PI-US Nightly Calibration — grades the RESONANCE / VALUE operator only.
// PI-US reads the wave (resonance) and Pascal structural support (value). This
// job grades whether those reads DISCRIMINATE good probability cycles from bad
// (correlation with forward_accuracy, and high vs low support/resonance
// accuracy). It does NOT grade directional accuracy — that is HEX6-BLE's job.
// Writes one CalibrationScore tagged operator=PI_US, and evolves the per-user
// voice calibration (pius_calibration_state) so PI-US adapts over time.
// Self-contained (DB-only) — no external fetch, no CONNECT_TIMEOUT risk.

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

// Grade by how well PI-US discriminates quality (correlation of value/resonance
// with realized forward accuracy), NOT by directional accuracy.
function gradeFromDiscrimination(corr) {
  if (corr >= 0.25) return 'A';
  if (corr >= 0.15) return 'B';
  if (corr >= 0.08) return 'C';
  if (corr >= 0.03) return 'D';
  return 'F';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const today = new Date().toISOString().split('T')[0];

    const recent = await base44.asServiceRole.entities.CognitiveState.list('-created_date', 1000).catch(() => []);
    const runs = (recent || []).filter((r) => r.forward_accuracy != null && r.forward_count > 0);

    if (runs.length === 0) {
      await base44.asServiceRole.entities.CalibrationScore.create({
        score_date: today,
        operator: 'PI_US',
        ticker: 'PI-US',
        predictions_evaluated: 0,
        directional_accuracy: 0,
        exposure_correlation: 0,
        resonance_correlation: 0,
        value_correlation: 0,
        avg_realized_return: 0,
        calibration_grade: 'INSUFFICIENT_DATA',
        notes: 'No CognitiveState forward-test records available to score yet.',
      });
      return Response.json({ ok: true, operator: 'PI_US', message: 'No cognition runs to score yet.' });
    }

    const values = [], resonances = [], accs = [];
    const supBuckets = { high: { n: 0, c: 0 }, mid: { n: 0, c: 0 }, low: { n: 0, c: 0 } };
    const resBuckets = { high: { n: 0, c: 0 }, mid: { n: 0, c: 0 }, low: { n: 0, c: 0 } };

    for (const r of runs) {
      const cnt = r.forward_count || 0;
      const acc = r.forward_accuracy || 0;
      const v = r.value || 0;
      const res = r.resonance || 0;
      values.push(v); resonances.push(res); accs.push(acc);
      const vb = v > 0.05 ? 'high' : v > 0.01 ? 'mid' : 'low';
      supBuckets[vb].n += cnt; supBuckets[vb].c += acc * cnt;
      const rb = res > 0.4 ? 'high' : res > 0.2 ? 'mid' : 'low';
      resBuckets[rb].n += cnt; resBuckets[rb].c += acc * cnt;
    }

    const valueCorr = pearson(values, accs);
    const resonanceCorr = pearson(resonances, accs);
    const bucketAcc = (bk) => bk.n > 0 ? +(bk.c / bk.n).toFixed(3) : null;
    const discrimination = Math.max(0, valueCorr, resonanceCorr);
    const grade = runs.length < 10 ? 'INSUFFICIENT_DATA' : gradeFromDiscrimination(discrimination);

    const notes = `PI-US: ${runs.length} runs. Value-quality corr ${valueCorr.toFixed(2)} (high ${bucketAcc(supBuckets.high)}, mid ${bucketAcc(supBuckets.mid)}, low ${bucketAcc(supBuckets.low)}). Resonance-quality corr ${resonanceCorr.toFixed(2)} (high ${bucketAcc(resBuckets.high)}, mid ${bucketAcc(resBuckets.mid)}, low ${bucketAcc(resBuckets.low)}).`;

    await base44.asServiceRole.entities.CalibrationScore.create({
      score_date: today,
      operator: 'PI_US',
      ticker: 'PI-US',
      predictions_evaluated: runs.length,
      directional_accuracy: 0,
      exposure_correlation: 0,
      resonance_correlation: parseFloat(resonanceCorr.toFixed(4)),
      value_correlation: parseFloat(valueCorr.toFixed(4)),
      avg_realized_return: 0,
      calibration_grade: grade,
      notes,
    });

    // Per-user PI-US voice calibration: does a strong tonal read track accuracy?
    try {
      const byUser = {};
      for (const r of runs) {
        if (!r.user_email) continue;
        (byUser[r.user_email] = byUser[r.user_email] || []).push(r);
      }
      for (const email of Object.keys(byUser)) {
        const cy = byUser[email];
        const sorted = [...cy].sort((a, b) => (a.value || 0) - (b.value || 0));
        const half = Math.floor(sorted.length / 2);
        const low = sorted.slice(0, half), high = sorted.slice(half);
        const hAcc = high.length ? high.reduce((t, c) => t + (c.forward_accuracy || 0), 0) / high.length : 0;
        const lAcc = low.length ? low.reduce((t, c) => t + (c.forward_accuracy || 0), 0) / low.length : 0;
        const piusState = `Tonal read quality: strong-reads hit ${(hAcc * 100).toFixed(0)}% vs weak-reads ${(lAcc * 100).toFixed(0)}% over ${cy.length} cycles.`;
        const existing = await base44.asServiceRole.entities.UserConversationMemory.filter({ user_email: email }).catch(() => []);
        if (existing && existing.length > 0) {
          await base44.asServiceRole.entities.UserConversationMemory.update(existing[0].id, { pius_calibration_state: piusState });
        } else {
          await base44.asServiceRole.entities.UserConversationMemory.create({ user_email: email, pius_calibration_state: piusState, total_conversations: 0 });
        }
      }
    } catch (e) { /* non-blocking */ }

    return Response.json({
      ok: true,
      operator: 'PI_US',
      runs_scored: runs.length,
      value_correlation: parseFloat(valueCorr.toFixed(4)),
      resonance_correlation: parseFloat(resonanceCorr.toFixed(4)),
      calibration_grade: grade,
    });
  } catch (e) {
    console.error('PI-US calibration error:', e);
    return Response.json({ error: e.message }, { status: 500 });
  }
});