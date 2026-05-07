// GET /api/engine-runs?updated_after=ISO8601
// Returns JSON array of EngineRunLog objects.
// Mirrors services/engineRunLog.ts (backend functions cannot import local files,
// so the join + KL math is inlined here).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ---------------------------------------------------------------------------
// Helpers (mirror services/engineRunLog.ts)
// ---------------------------------------------------------------------------

function uuidv4() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function safeParse(value, fallback) {
  if (typeof value !== 'string') return value ?? fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

function klDivergence(countsA, countsB, alpha = 1.0) {
  const NUM_STATES = 64;
  let totalKL = 0;
  let rowsCompared = 0;
  for (let s0 = 0; s0 < NUM_STATES; s0++) {
    let sumA = 0, sumB = 0;
    const rowA = {}, rowB = {};
    for (let s1 = 0; s1 < NUM_STATES; s1++) {
      const key = `${s0}->${s1}`;
      const cA = (countsA[key] || 0) + alpha;
      const cB = (countsB[key] || 0) + alpha;
      rowA[s1] = cA; rowB[s1] = cB;
      sumA += cA; sumB += cB;
    }
    const rawA = Object.keys(countsA).filter(k => k.startsWith(`${s0}->`)).reduce((s, k) => s + countsA[k], 0);
    const rawB = Object.keys(countsB).filter(k => k.startsWith(`${s0}->`)).reduce((s, k) => s + countsB[k], 0);
    if (rawA === 0 && rawB === 0) continue;
    let rowKL = 0;
    for (let s1 = 0; s1 < NUM_STATES; s1++) {
      const pA = rowA[s1] / sumA;
      const pB = rowB[s1] / sumB;
      if (pA > 0 && pB > 0) rowKL += pA * Math.log(pA / pB);
    }
    totalKL += rowKL;
    rowsCompared += 1;
  }
  if (rowsCompared === 0) return Infinity;
  return totalKL / rowsCompared;
}

function transitionCountsFromStates(states) {
  const counts = {};
  for (let i = 0; i < states.length - 1; i++) {
    const key = `${states[i]}->${states[i + 1]}`;
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Parse query string. The platform invokes this via POST/JSON, but we also
    // support GET-style query params for direct curl access.
    let updatedAfter = null;
    try {
      const url = new URL(req.url);
      updatedAfter = url.searchParams.get('updated_after');
    } catch { /* ignore */ }
    if (!updatedAfter) {
      try {
        const body = await req.json();
        updatedAfter = body?.updated_after || null;
      } catch { /* no body */ }
    }

    // 1. Pull Output (per-step apex log), ascending by timestamp.
    const outputs = await base44.asServiceRole.entities.Output.list('timestamp', 5000);
    if (!outputs || outputs.length === 0) return Response.json([]);

    const filtered = updatedAfter
      ? outputs.filter(o => o.timestamp && o.timestamp > updatedAfter)
      : outputs;
    if (filtered.length === 0) return Response.json([]);

    // 2. Pull supporting tables in parallel and index in memory.
    const [brains, routings, seriesList] = await Promise.all([
      base44.asServiceRole.entities.Brain.list('', 1000),
      base44.asServiceRole.entities.Routing.list('', 5000),
      base44.asServiceRole.entities.Series.list('', 5000),
    ]);

    const seriesById = {};
    for (const s of seriesList || []) seriesById[s.series_id] = s;

    const routingBySeries = {};
    for (const r of routings || []) routingBySeries[r.series_id] = r;

    // Pre-parse brain matrices once (KL is computed per-step against every brain).
    const brainMatrices = (brains || []).map(b => ({
      brain: b,
      counts: safeParse(b.transition_matrix, {}),
    }));

    // 3. Build one EngineRunLog per Output.
    const logs = [];
    for (const o of filtered) {
      const series = seriesById[o.series_id];
      if (!series) continue;

      const routing = routingBySeries[o.series_id];
      const states = Array.isArray(series.states) ? series.states : [];
      const seriesCounts = transitionCountsFromStates(states);

      const organisms = brainMatrices.map(({ brain, counts }) => ({
        brain_id: brain.brain_id,
        kl_distance_to_series: klDivergence(seriesCounts, counts),
        is_apex: brain.brain_id === o.brain_id,
        count: brain.count ?? 0,
        series_count: brain.series_count ?? 0,
        confidence: brain.confidence ?? 0,
        transition_matrix: counts,
        transition_rewards: safeParse(brain.transition_rewards, {}),
        brain_last_updated: brain.last_updated ?? '',
      }));

      logs.push({
        run_id: uuidv4(),
        engine_timestamp: o.timestamp,
        series_id: o.series_id,
        current_state: o.current_state,
        apex_brain_id: o.brain_id,
        apex_predicted_distribution: safeParse(o.predicted_distribution, {}),
        apex_direction: o.direction ?? 'UNKNOWN',
        apex_confidence: o.confidence ?? 0,
        apex_expected_return: o.expected_return ?? 0,
        apex_actual_outcome: o.actual_outcome ?? null,
        apex_error: o.error ?? null,
        apex_calibration_score: o.calibration_score ?? null,
        apex_routing_distance: routing?.distance ?? null,
        apex_routing_threshold: routing?.threshold_at_routing ?? null,
        apex_routing_confidence: routing?.confidence ?? null,
        organisms,
        series: {
          series_id: series.series_id,
          states,
          last_routed_brain_id: series.last_routed_brain_id ?? '',
          last_updated: series.last_updated ?? '',
        },
      });
    }

    return Response.json(logs);
  } catch (error) {
    console.error('engineRuns error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});