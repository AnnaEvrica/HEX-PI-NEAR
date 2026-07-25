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

// Vocabulary tokenization for adaptive triage profiling.
const STOPWORDS = new Set(['the','and','for','you','your','yours','this','that','with','from','have','has','are','was','were','but','not','can','will','would','could','should','about','into','they','them','their','there','here','just','like','know','think','tell','give','want','need','let','get','got','its','it','is','to','of','a','in','on','at','or','as','be','by','an','my','me','we','he','she','if','so','do','did','does','how','why','when','who','whats','im','ive','really','still','also','than','then','some','any','all','out','our','us','one','two','three','been','being','more','most','much','very','over','under','up','down']);
function tokenize(s) {
  if (!s) return [];
  return (s.toLowerCase().match(/[a-z][a-z0-9]{2,}/g) || []).filter((w) => !STOPWORDS.has(w) && w.length >= 3);
}
function topCues(freq, n) {
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, n).map((e) => e[0]);
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

    // ── Live-engine calibration (the real learning loop) ──
    // The engine that fires in chat writes a CognitiveState per cycle with a
    // walk-forward `forward_accuracy` — the out-of-sample directional hit rate
    // on the held-out tail of the analyzed series. That is the honest measure
    // of live accuracy. Grade from it, grouped by ticker extracted from the
    // user query, plus a GLOBAL aggregate. This closes the loop that was
    // emitting empty INSUFFICIENT_DATA rows every night.
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
      const conf = rows.reduce((t, s) => t + (s.confidence || 0), 0) / total;
      const grade = total < 5 ? 'INSUFFICIENT_DATA' : gradeFromAccuracy(dirAcc);
      const scoreData = {
        score_date: today,
        ticker,
        predictions_evaluated: total,
        directional_accuracy: parseFloat(dirAcc.toFixed(4)),
        exposure_correlation: 0,
        avg_realized_return: 0,
        calibration_grade: grade,
        notes: `Live engine: ${total} out-of-sample cycles, directional accuracy ${(dirAcc * 100).toFixed(1)}%, avg confidence ${conf.toFixed(2)}.`,
      };
      await base44.asServiceRole.entities.CalibrationScore.create(scoreData);
      results.push(scoreData);
    }

    const globalRow = results.find((r) => r.ticker === 'GLOBAL') || { predictions_evaluated: 0, directional_accuracy: 0, calibration_grade: 'INSUFFICIENT_DATA' };
    const globalGrade = globalRow.calibration_grade;
    const globalEval = globalRow.predictions_evaluated;
    const globalAcc = globalRow.directional_accuracy;

    // Per-user memory: derive a calibration-aware state from each user's recent
    // cognitive cycles and store it on their UserConversationMemory so The Model
    // can adapt voice and steering to their tracked pattern.
    try {
      const states = await base44.asServiceRole.entities.CognitiveState.list('-created_date', 500).catch(() => []);
      const byUser = {};
      for (const s of (states || [])) {
        if (!s.user_email) continue;
        if (!byUser[s.user_email]) byUser[s.user_email] = [];
        byUser[s.user_email].push(s);
      }
      for (const email of Object.keys(byUser)) {
        const cycles = byUser[email];
        const conf = cycles.reduce((t, c) => t + (c.confidence || 0), 0) / cycles.length;
        const dirs = { UP: 0, DOWN: 0, FLAT: 0 };
        for (const c of cycles) if (c.predicted_direction) dirs[c.predicted_direction] = (dirs[c.predicted_direction] || 0) + 1;
        const lean = dirs.UP > dirs.DOWN ? 'UP' : dirs.DOWN > dirs.UP ? 'DOWN' : 'flat';
        const calibrationState = `Engine calibration grade ${globalGrade}; ${cycles.length} recent cycles, avg confidence ${conf.toFixed(2)}, lean ${lean}.`;

        // Vocabulary adaptation: split this user's past queries by whether the
        // engine actually ran (probability != null) and keep the most frequent
        // distinctive tokens as triage cues for the hybrid classifier.
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