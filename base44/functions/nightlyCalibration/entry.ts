// HEX6-BLE Nightly Calibration — grades the PROBABILITY operator only.
// HEX6-BLE acts on probability (full-Kelly exposure). This job grades its
// directional accuracy (forward_accuracy on the held-out tail) and whether
// its probability magnitude discriminates good cycles from bad. Writes one
// CalibrationScore per ticker + GLOBAL, tagged operator=HEX6_BLE, and evolves
// the per-user calibration_state + triage_profile so The Model's probability
// reads adapt nightly. PI-US (resonance/value) has its OWN job — no overlap.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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

// Vocabulary tokenization for adaptive triage profiling.
const STOPWORDS = new Set(['the','and','for','you','your','yours','this','that','with','from','have','has','are','was','were','but','not','can','will','would','could','should','about','into','they','them','their','there','here','just','like','know','think','tell','give','want','need','let','get','got','its','it','is','to','of','a','in','on','at','or','as','be','by','an','my','me','we','he','she','if','so','do','did','does','how','why','when','who','whats','im','ive','really','still','also','than','then','some','any','all','out','our','us','one','two','three','been','being','more','most','much','very','over','under','up','down']);
function tokenize(s) {
  if (!s) return [];
  return (s.toLowerCase().match(/[a-z][a-z0-9]{2,}/g) || []).filter((w) => !STOPWORDS.has(w) && w.length >= 3);
}
function topCues(freq, n) {
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, n).map((e) => e[0]);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const TICKER_RE = /\b(BTC|ETH|SOL|DOGE|XRP|ADA|MATIC|SPY|QQQ|TSLA|AAPL|MSFT|NVDA|GOOG|GOOGL|AMZN|META)\b/i;
    const today = new Date().toISOString().split('T')[0];
    const results = [];

    const liveStates = await base44.asServiceRole.entities.CognitiveState
      .list('-created_date', 500).catch(() => []);
    const graded = (liveStates || []).filter((s) => s.forward_accuracy != null);

    const byTicker = { GLOBAL: [] };
    for (const s of graded) {
      byTicker.GLOBAL.push(s);
      const m = (s.query || '').match(TICKER_RE);
      if (m) {
        const t = m[1].toUpperCase();
        (byTicker[t] = byTicker[t] || []).push(s);
      }
    }

    for (const ticker of Object.keys(byTicker)) {
      const rows = byTicker[ticker];
      const total = rows.length;
      if (total === 0) continue;
      const dirAcc = rows.reduce((t, s) => t + s.forward_accuracy, 0) / total;
      // Probability-tier discrimination: does a bigger Kelly bet (probability)
      // correspond to higher realized directional accuracy?
      const probCorr = pearson(
        rows.map((s) => s.probability || 0),
        rows.map((s) => s.forward_accuracy || 0)
      );
      const sorted = [...rows].sort((a, b) => (a.probability || 0) - (b.probability || 0));
      const half = Math.floor(sorted.length / 2);
      const low = sorted.slice(0, half), high = sorted.slice(half);
      const highAcc = high.length ? high.reduce((t, s) => t + s.forward_accuracy, 0) / high.length : null;
      const lowAcc = low.length ? low.reduce((t, s) => t + s.forward_accuracy, 0) / low.length : null;
      const avgProb = rows.reduce((t, s) => t + (s.probability || 0), 0) / total;
      const grade = total < 5 ? 'INSUFFICIENT_DATA' : gradeFromAccuracy(dirAcc);
      const scoreData = {
        score_date: today,
        operator: 'HEX6_BLE',
        ticker,
        predictions_evaluated: total,
        directional_accuracy: parseFloat(dirAcc.toFixed(4)),
        exposure_correlation: parseFloat(probCorr.toFixed(4)),
        avg_realized_return: 0,
        calibration_grade: grade,
        notes: `HEX6-BLE: ${total} out-of-sample cycles, directional accuracy ${(dirAcc * 100).toFixed(1)}%, avg probability ${avgProb.toFixed(2)}, prob-accuracy corr ${probCorr.toFixed(2)} (high-prob ${highAcc != null ? (highAcc * 100).toFixed(0) + '%' : 'n/a'} vs low-prob ${lowAcc != null ? (lowAcc * 100).toFixed(0) + '%' : 'n/a'}).`,
      };
      await base44.asServiceRole.entities.CalibrationScore.create(scoreData);
      results.push(scoreData);
    }

    const globalRow = results.find((r) => r.ticker === 'GLOBAL') || { predictions_evaluated: 0, directional_accuracy: 0, calibration_grade: 'INSUFFICIENT_DATA' };

    // Per-user HEX6-BLE calibration state + triage profile (probability engine).
    try {
      const states = await base44.asServiceRole.entities.CognitiveState.list('-created_date', 500).catch(() => []);
      const byUser = {};
      for (const s of (states || [])) {
        if (!s.user_email) continue;
        (byUser[s.user_email] = byUser[s.user_email] || []).push(s);
      }
      for (const email of Object.keys(byUser)) {
        const cycles = byUser[email];
        const graded2 = cycles.filter((c) => c.forward_accuracy != null);
        const acc = graded2.length ? graded2.reduce((t, c) => t + c.forward_accuracy, 0) / graded2.length : 0;
        const avgProb = cycles.reduce((t, c) => t + (c.probability || 0), 0) / cycles.length;
        const dirs = { UP: 0, DOWN: 0, FLAT: 0 };
        for (const c of cycles) if (c.predicted_direction) dirs[c.predicted_direction] = (dirs[c.predicted_direction] || 0) + 1;
        const lean = dirs.UP > dirs.DOWN ? 'UP' : dirs.DOWN > dirs.UP ? 'DOWN' : 'flat';
        const calibrationState = `Probability engine grade ${globalRow.calibration_grade}; ${graded2.length} graded cycles, directional accuracy ${(acc * 100).toFixed(0)}%, avg probability ${avgProb.toFixed(2)}, lean ${lean}.`;

        const aFreq = {}, cFreq = {};
        for (const c of cycles) {
          const isAnalytical = c.probability != null;
          for (const t of tokenize(c.query)) {
            if (isAnalytical) aFreq[t] = (aFreq[t] || 0) + 1; else cFreq[t] = (cFreq[t] || 0) + 1;
          }
        }
        const triageProfile = JSON.stringify({ analytical_cues: topCues(aFreq, 15), casual_cues: topCues(cFreq, 10) });

        const existing = await base44.asServiceRole.entities.UserConversationMemory.filter({ user_email: email }).catch(() => []);
        if (existing && existing.length > 0) {
          await base44.asServiceRole.entities.UserConversationMemory.update(existing[0].id, { calibration_state: calibrationState, triage_profile: triageProfile });
        } else {
          await base44.asServiceRole.entities.UserConversationMemory.create({ user_email: email, calibration_state: calibrationState, triage_profile: triageProfile, total_conversations: 0 });
        }
      }
    } catch (e) { /* non-blocking */ }

    return Response.json({
      ok: true,
      operator: 'HEX6_BLE',
      brainsScored: results.length,
      totalPredictions: globalRow.predictions_evaluated,
      globalAccuracy: globalRow.directional_accuracy,
      results,
    });
  } catch (error) {
    console.error('HEX6-BLE calibration error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});