// HEX6 BLE — Generalized Multi-Brain Engine Loop
// Subject-agnostic: works on any sequential numerical signal (finance, sports, biometrics, anything).
// Architecture: route → predict → learn → calibrate.
// No clustering evolution in v1 (no split/merge/remove).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ---------------------------------------------------------------------------
// State encoding — 6-bit (64 states)
// Each bit = sign of one return; bit i = 1 if r > 0 else 0
// ---------------------------------------------------------------------------
function encodeState6(slice) {
  if (slice.length < 6) return null;
  const bits = slice.slice(-6).map(r => r > 0 ? '1' : '0').join('');
  return parseInt(bits, 2);
}

// Extract transition counts and reward stats from a returns array
function extractTransitions(returns) {
  const counts = {};
  const stats = {};
  for (let i = 6; i < returns.length - 1; i++) {
    const s0 = encodeState6(returns.slice(i - 6, i));
    const s1 = encodeState6(returns.slice(i - 5, i + 1));
    if (s0 === null || s1 === null) continue;
    const key = `${s0}->${s1}`;
    counts[key] = (counts[key] || 0) + 1;
    if (!stats[key]) stats[key] = { sum: 0, sum2: 0, n: 0 };
    const r = returns[i + 1];
    stats[key].sum += r;
    stats[key].sum2 += r * r;
    stats[key].n += 1;
  }
  return { counts, stats };
}

// Convert raw value series → returns if needed
function seriesToReturns(values, asReturns = false) {
  if (asReturns) return values;
  const out = [];
  for (let i = 1; i < values.length; i++) {
    if (values[i - 1] !== 0) out.push((values[i] - values[i - 1]) / values[i - 1]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// KL divergence with Laplace smoothing
// Compares two transition matrices over the 64-state space
// Returns divergence in nats (always ≥ 0; 0 = identical)
// ---------------------------------------------------------------------------
function klDivergence(countsA, countsB, alpha = 1.0) {
  // Build row-normalized probabilities with Laplace smoothing
  // For each state s0, compute P_A(s1|s0) and P_B(s1|s0)
  const NUM_STATES = 64;
  let totalKL = 0;
  let rowsCompared = 0;

  for (let s0 = 0; s0 < NUM_STATES; s0++) {
    // Row sums
    let sumA = 0, sumB = 0;
    const rowA = {}, rowB = {};
    for (let s1 = 0; s1 < NUM_STATES; s1++) {
      const key = `${s0}->${s1}`;
      const cA = (countsA[key] || 0) + alpha;
      const cB = (countsB[key] || 0) + alpha;
      rowA[s1] = cA;
      rowB[s1] = cB;
      sumA += cA;
      sumB += cB;
    }

    // Skip rows where neither matrix has any real observations
    const rawA = Object.keys(countsA).filter(k => k.startsWith(`${s0}->`)).reduce((s, k) => s + countsA[k], 0);
    const rawB = Object.keys(countsB).filter(k => k.startsWith(`${s0}->`)).reduce((s, k) => s + countsB[k], 0);
    if (rawA === 0 && rawB === 0) continue;

    // KL(A || B) for this row
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
  return totalKL / rowsCompared; // average per-row KL
}

// ---------------------------------------------------------------------------
// EWMA threshold state — held in a single singleton record
// We use the Brain entity with brain_id="__threshold_state__" as a poor-man's KV store.
// Actually simpler: store recent distances in a small array, recompute on each call.
// We'll keep the EWMA state in a dedicated Output-like record — but for v1, simplest:
// recompute observed = 25th percentile of last N routing distances on each call,
// then EWMA-smooth against the previous threshold value pulled from the most recent Routing record.
// ---------------------------------------------------------------------------
async function computeAdaptiveThreshold(base44, alpha = 0.2) {
  const STATIC_FALLBACK = 1.0;
  const FLOOR = 0.3;
  const CEIL = 2.0;
  const MIN_ROUTINGS_FOR_ADAPTIVE = 5;
  const RECENT_WINDOW = 50;

  // Pull most recent routings
  const recent = await base44.asServiceRole.entities.Routing.list('-last_updated', RECENT_WINDOW).catch(() => []);
  if (!recent || recent.length < MIN_ROUTINGS_FOR_ADAPTIVE) {
    return STATIC_FALLBACK;
  }

  // Observed = 25th percentile of recent distances
  const distances = recent.map(r => r.distance).filter(d => typeof d === 'number' && isFinite(d)).sort((a, b) => a - b);
  if (distances.length < MIN_ROUTINGS_FOR_ADAPTIVE) return STATIC_FALLBACK;
  const idx = Math.floor(distances.length * 0.25);
  const observed = distances[idx];

  // Previous threshold = threshold_at_routing of the most recent record
  const prevThreshold = recent[0].threshold_at_routing ?? STATIC_FALLBACK;

  let threshold = alpha * observed + (1 - alpha) * prevThreshold;
  threshold = Math.max(FLOOR, Math.min(CEIL, threshold));
  return threshold;
}

// ---------------------------------------------------------------------------
// Route a series to nearest brain (or spawn new)
// ---------------------------------------------------------------------------
async function routeSeries(base44, seriesId, seriesCounts) {
  const threshold = await computeAdaptiveThreshold(base44);

  // Pull all brains
  const brains = await base44.asServiceRole.entities.Brain.list('-count', 200).catch(() => []);

  if (!brains || brains.length === 0) {
    // No brains exist — spawn first
    return { brain: null, distance: 0, threshold, spawn: true };
  }

  // Compute KL distance to each brain
  let nearest = null;
  let nearestDist = Infinity;
  for (const b of brains) {
    const counts = JSON.parse(b.transition_matrix || '{}');
    const dist = klDivergence(seriesCounts, counts);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = b;
    }
  }

  if (nearestDist <= threshold) {
    return { brain: nearest, distance: nearestDist, threshold, spawn: false };
  }
  return { brain: null, distance: nearestDist, threshold, spawn: true };
}

// ---------------------------------------------------------------------------
// Predict next-state distribution from a brain
// ---------------------------------------------------------------------------
function predictFromBrain(brain, currentState) {
  const counts = JSON.parse(brain.transition_matrix || '{}');
  const stats = JSON.parse(brain.transition_rewards || '{}');

  // Aggregate outgoing transitions from currentState
  const outgoing = {};
  let total = 0;
  for (const key in counts) {
    if (key.startsWith(`${currentState}->`)) {
      const s1 = parseInt(key.split('->')[1]);
      outgoing[s1] = counts[key];
      total += counts[key];
    }
  }

  if (total === 0) {
    return {
      distribution: {},
      direction: 'UNKNOWN',
      confidence: 0,
      expected_return: 0,
    };
  }

  const distribution = {};
  let expectedReturn = 0;
  let upMass = 0, downMass = 0;
  for (const s1 in outgoing) {
    const prob = outgoing[s1] / total;
    distribution[s1] = prob;
    const s = stats[`${currentState}->${s1}`];
    const meanR = s && s.n > 0 ? s.sum / s.n : 0;
    expectedReturn += prob * meanR;
    if (meanR > 0) upMass += prob;
    else if (meanR < 0) downMass += prob;
  }

  let direction = 'FLAT';
  let confidence = Math.max(upMass, downMass);
  if (upMass > downMass && upMass > 0.5) direction = 'UP';
  else if (downMass > upMass && downMass > 0.5) direction = 'DOWN';

  return { distribution, direction, confidence, expected_return: expectedReturn };
}

// ---------------------------------------------------------------------------
// Merge fresh transitions into a brain (in-place merge of count/stats objects)
// ---------------------------------------------------------------------------
function mergeIntoBrain(brainCounts, brainStats, freshCounts, freshStats) {
  const mergedCounts = { ...brainCounts };
  const mergedStats = {};
  for (const k in brainStats) mergedStats[k] = { ...brainStats[k] };

  let added = 0;
  for (const k in freshCounts) {
    mergedCounts[k] = (mergedCounts[k] || 0) + freshCounts[k];
    if (!mergedStats[k]) mergedStats[k] = { sum: 0, sum2: 0, n: 0 };
    mergedStats[k].sum += freshStats[k].sum;
    mergedStats[k].sum2 += freshStats[k].sum2;
    mergedStats[k].n += freshStats[k].n;
    added += freshCounts[k];
  }
  return { counts: mergedCounts, stats: mergedStats, added };
}

// ---------------------------------------------------------------------------
// Main HTTP entry point
// POST body: {
//   series_id: string,            // required — any subject-agnostic identifier
//   values: number[],             // required — raw values OR returns
//   as_returns: boolean,          // default false (will diff to returns)
//   record_output: boolean,       // default true (writes to Output entity)
// }
// Returns: { brain_id, current_state, prediction, distance, threshold, spawned, output_id }
// ---------------------------------------------------------------------------
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { series_id, values, as_returns = false, record_output = true } = body;

    if (!series_id || !Array.isArray(values) || values.length < 8) {
      return Response.json({ error: 'series_id and values (min 8 points) required' }, { status: 400 });
    }

    const returns = seriesToReturns(values, as_returns);
    if (returns.length < 8) {
      return Response.json({ error: 'Insufficient data after conversion to returns' }, { status: 400 });
    }

    const currentState = encodeState6(returns.slice(-6));
    const { counts: freshCounts, stats: freshStats } = extractTransitions(returns);

    // 1. ROUTE
    const { brain: matchedBrain, distance, threshold, spawn } = await routeSeries(base44, series_id, freshCounts);

    let activeBrain;
    if (spawn || !matchedBrain) {
      // Spawn new brain seeded by this series
      const newId = `auto_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      activeBrain = {
        brain_id: newId,
        transition_matrix: JSON.stringify(freshCounts),
        transition_rewards: JSON.stringify(freshStats),
        count: Object.values(freshCounts).reduce((s, n) => s + n, 0),
        series_count: 1,
        confidence: Math.min(1, Object.values(freshCounts).reduce((s, n) => s + n, 0) / 30),
        last_updated: new Date().toISOString(),
      };
      const created = await base44.asServiceRole.entities.Brain.create(activeBrain);
      activeBrain.id = created.id;
    } else {
      // 4. LEARN — merge fresh into matched brain
      const brainCounts = JSON.parse(matchedBrain.transition_matrix || '{}');
      const brainStats = JSON.parse(matchedBrain.transition_rewards || '{}');
      const merged = mergeIntoBrain(brainCounts, brainStats, freshCounts, freshStats);
      const newCount = (matchedBrain.count || 0) + merged.added;
      activeBrain = {
        ...matchedBrain,
        transition_matrix: JSON.stringify(merged.counts),
        transition_rewards: JSON.stringify(merged.stats),
        count: newCount,
        confidence: Math.min(1, newCount / 30),
        last_updated: new Date().toISOString(),
      };
      // Increment series_count only if this series isn't already routed here
      const existingRouting = await base44.asServiceRole.entities.Routing.filter({ series_id }).catch(() => []);
      const wasAlreadyHere = existingRouting?.some(r => r.brain_id === matchedBrain.brain_id);
      if (!wasAlreadyHere) {
        activeBrain.series_count = (matchedBrain.series_count || 0) + 1;
      }
      await base44.asServiceRole.entities.Brain.update(matchedBrain.id, {
        transition_matrix: activeBrain.transition_matrix,
        transition_rewards: activeBrain.transition_rewards,
        count: activeBrain.count,
        series_count: activeBrain.series_count,
        confidence: activeBrain.confidence,
        last_updated: activeBrain.last_updated,
      });
    }

    // 2. RECORD ROUTING
    const routingConfidence = Math.max(0, Math.min(1, 1 - distance / threshold));
    const existingRouting = await base44.asServiceRole.entities.Routing.filter({ series_id }).catch(() => []);
    const routingData = {
      series_id,
      brain_id: activeBrain.brain_id,
      distance,
      confidence: routingConfidence,
      threshold_at_routing: threshold,
      last_updated: new Date().toISOString(),
    };
    if (existingRouting && existingRouting.length > 0) {
      await base44.asServiceRole.entities.Routing.update(existingRouting[0].id, routingData);
    } else {
      await base44.asServiceRole.entities.Routing.create(routingData);
    }

    // 3. UPDATE SERIES
    const existingSeries = await base44.asServiceRole.entities.Series.filter({ series_id }).catch(() => []);
    const recentStates = [];
    for (let i = 6; i <= returns.length; i++) {
      const s = encodeState6(returns.slice(i - 6, i));
      if (s !== null) recentStates.push(s);
    }
    const seriesData = {
      series_id,
      states: recentStates.slice(-200),
      last_routed_brain_id: activeBrain.brain_id,
      last_updated: new Date().toISOString(),
    };
    if (existingSeries && existingSeries.length > 0) {
      await base44.asServiceRole.entities.Series.update(existingSeries[0].id, seriesData);
    } else {
      await base44.asServiceRole.entities.Series.create(seriesData);
    }

    // 4. PREDICT
    const prediction = predictFromBrain(activeBrain, currentState);

    // 5. RECORD OUTPUT
    let outputId = null;
    if (record_output && currentState !== null) {
      outputId = `out_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      await base44.asServiceRole.entities.Output.create({
        output_id: outputId,
        series_id,
        brain_id: activeBrain.brain_id,
        timestamp: new Date().toISOString(),
        current_state: currentState,
        predicted_distribution: JSON.stringify(prediction.distribution),
        direction: prediction.direction,
        confidence: prediction.confidence,
        expected_return: prediction.expected_return,
      });
    }

    return Response.json({
      brain_id: activeBrain.brain_id,
      current_state: currentState,
      prediction,
      distance,
      threshold,
      spawned: spawn,
      output_id: outputId,
      series_count: activeBrain.series_count,
      brain_count: activeBrain.count,
      brain_confidence: activeBrain.confidence,
    });
  } catch (error) {
    console.error('hex6Process error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});