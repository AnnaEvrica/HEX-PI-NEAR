// EngineRunLog exporter
// Builds one EngineRunLog object per engine step (per Output record),
// joining across Output + Routing + Brain (full population snapshot) + Series.
// Designed to mirror engine behavior into Postgres:
//   - apex_history     ← one row per EngineRunLog
//   - organism_steps   ← one row per element in EngineRunLog.organisms[]
//   - cross_market_series ← upsert by series_id
//
// NOTE on temporal fidelity: Base44's Brain entity mutates in place — we do NOT
// have historical snapshots of each brain at every prior engine_timestamp.
// The organisms[] array therefore contains the CURRENT Brain population state,
// which is the closest available approximation. This is acceptable for mirroring
// going forward; for historical backfill it represents "latest known state".

import { base44 } from '@/api/base44Client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OrganismStep {
  brain_id: string;
  kl_distance_to_series: number;
  is_apex: boolean;
  count: number;
  series_count: number;
  confidence: number;
  transition_matrix: Record<string, number>;
  transition_rewards: Record<string, { sum: number; sum2: number; n: number }>;
  brain_last_updated: string;
}

export interface CrossMarketSeries {
  series_id: string;
  states: number[];
  last_routed_brain_id: string;
  last_updated: string;
}

export interface EngineRunLog {
  run_id: string;
  engine_timestamp: string;
  series_id: string;
  current_state: number;
  apex_brain_id: string;
  apex_predicted_distribution: Record<string, number>;
  apex_direction: 'UP' | 'DOWN' | 'FLAT' | 'UNKNOWN';
  apex_confidence: number;
  apex_expected_return: number;
  apex_actual_outcome: number | null;
  apex_error: number | null;
  apex_calibration_score: number | null;
  apex_routing_distance: number | null;
  apex_routing_threshold: number | null;
  apex_routing_confidence: number | null;
  organisms: OrganismStep[];
  series: CrossMarketSeries;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function uuidv4(): string {
  // RFC4122 v4 — uses crypto.randomUUID when available, falls back to Math.random
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function safeParse<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') return (value as T) ?? fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

// Average per-row KL divergence with Laplace smoothing (α=1) over the 64-state space.
// Mirrors the math in functions/hex6Process.js so exported KL values match the engine's
// own routing distances.
function klDivergence(
  countsA: Record<string, number>,
  countsB: Record<string, number>,
  alpha = 1.0
): number {
  const NUM_STATES = 64;
  let totalKL = 0;
  let rowsCompared = 0;

  for (let s0 = 0; s0 < NUM_STATES; s0++) {
    let sumA = 0;
    let sumB = 0;
    const rowA: Record<number, number> = {};
    const rowB: Record<number, number> = {};
    for (let s1 = 0; s1 < NUM_STATES; s1++) {
      const key = `${s0}->${s1}`;
      const cA = (countsA[key] || 0) + alpha;
      const cB = (countsB[key] || 0) + alpha;
      rowA[s1] = cA;
      rowB[s1] = cB;
      sumA += cA;
      sumB += cB;
    }

    const rawA = Object.keys(countsA)
      .filter((k) => k.startsWith(`${s0}->`))
      .reduce((s, k) => s + countsA[k], 0);
    const rawB = Object.keys(countsB)
      .filter((k) => k.startsWith(`${s0}->`))
      .reduce((s, k) => s + countsB[k], 0);
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

// Reconstruct the series' transition counts from its states[] array.
// Mirrors hex6Process extractTransitions but operates on encoded 6-bit states
// directly (Series.states is already encoded). Each consecutive (s_t, s_t+1)
// is one transition.
function transitionCountsFromStates(states: number[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (let i = 0; i < states.length - 1; i++) {
    const key = `${states[i]}->${states[i + 1]}`;
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Main exporter
// ---------------------------------------------------------------------------

/**
 * Build EngineRunLog payloads for every Output record (optionally filtered by
 * timestamp). Each payload is one engine step joined with the apex's routing
 * decision, the full Brain population, and the series state.
 *
 * @param updatedAfter Optional ISO timestamp; only Output records with
 *                     timestamp > updatedAfter are returned.
 */
export async function listEngineRunLogs(
  updatedAfter?: string
): Promise<EngineRunLog[]> {
  // 1. Pull all Output records (the per-step apex log).
  //    Sorted ascending by timestamp so consumers can stream in order.
  const outputs = await base44.entities.Output.list('timestamp', 5000);
  if (!outputs || outputs.length === 0) return [];

  const filtered = updatedAfter
    ? outputs.filter((o: any) => o.timestamp && o.timestamp > updatedAfter)
    : outputs;
  if (filtered.length === 0) return [];

  // 2. Pull supporting tables once and index them in memory.
  //    Brain population is treated as the current snapshot for every step
  //    (Base44 does not persist historical brain states).
  const [brains, routings, seriesList] = await Promise.all([
    base44.entities.Brain.list('', 1000),
    base44.entities.Routing.list('', 5000),
    base44.entities.Series.list('', 5000),
  ]);

  const brainsById: Record<string, any> = {};
  for (const b of brains || []) brainsById[b.brain_id] = b;

  const seriesById: Record<string, any> = {};
  for (const s of seriesList || []) seriesById[s.series_id] = s;

  // Routing: keyed by series_id. v1 sticky routing → one record per series.
  const routingBySeries: Record<string, any> = {};
  for (const r of routings || []) routingBySeries[r.series_id] = r;

  // Pre-parse every brain's transition matrix once (KL is computed per-step
  // against every brain, so we'd otherwise re-parse N×M times).
  const brainMatrices: Array<{
    brain: any;
    counts: Record<string, number>;
  }> = (brains || []).map((b: any) => ({
    brain: b,
    counts: safeParse<Record<string, number>>(b.transition_matrix, {}),
  }));

  // 3. Build one EngineRunLog per Output.
  const logs: EngineRunLog[] = [];

  for (const o of filtered) {
    const series = seriesById[o.series_id];
    if (!series) continue; // can't build a complete payload without the series

    // Apex routing decision (matches series_id; v1 sticky so it's the same
    // routing that was active at this step).
    const routing = routingBySeries[o.series_id];

    // Series transition counts → KL distance to every brain in the population.
    const states: number[] = Array.isArray(series.states) ? series.states : [];
    const seriesCounts = transitionCountsFromStates(states);

    const organisms: OrganismStep[] = brainMatrices.map(({ brain, counts }) => ({
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

    const seriesPayload: CrossMarketSeries = {
      series_id: series.series_id,
      states,
      last_routed_brain_id: series.last_routed_brain_id ?? '',
      last_updated: series.last_updated ?? '',
    };

    logs.push({
      run_id: uuidv4(),
      engine_timestamp: o.timestamp,
      series_id: o.series_id,
      current_state: o.current_state,
      apex_brain_id: o.brain_id,
      apex_predicted_distribution: safeParse(o.predicted_distribution, {}),
      apex_direction: (o.direction ?? 'UNKNOWN') as EngineRunLog['apex_direction'],
      apex_confidence: o.confidence ?? 0,
      apex_expected_return: o.expected_return ?? 0,
      apex_actual_outcome: o.actual_outcome ?? null,
      apex_error: o.error ?? null,
      apex_calibration_score: o.calibration_score ?? null,
      apex_routing_distance: routing?.distance ?? null,
      apex_routing_threshold: routing?.threshold_at_routing ?? null,
      apex_routing_confidence: routing?.confidence ?? null,
      organisms,
      series: seriesPayload,
    });
  }

  return logs;
}