// Scheduled sync: EngineRunLog → external PostgreSQL.
// Runs every 5 minutes via automation. Idempotent. Lock-protected.
// Mirrors the join + KL math from functions/engineRuns.js (functions cannot
// import local files, so the math is inlined).

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import postgres from 'npm:postgres@3.4.4';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const SYNC_NAME = 'engine_runs_to_postgres';
const STALE_LOCK_MINUTES = 15; // a "running" lock older than this is considered crashed
const MAX_BATCH = 5000;

// ---------------------------------------------------------------------------
// Math helpers — mirror functions/engineRuns.js exactly
// ---------------------------------------------------------------------------
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
// Build EngineRunLog payloads (mirrors engineRuns.js handler body).
// ---------------------------------------------------------------------------
async function buildEngineRunLogs(base44, updatedAfter) {
  const outputs = await base44.asServiceRole.entities.Output.list('timestamp', MAX_BATCH);
  if (!outputs || outputs.length === 0) return [];

  const filtered = updatedAfter
    ? outputs.filter(o => o.timestamp && o.timestamp > updatedAfter)
    : outputs;
  if (filtered.length === 0) return [];

  const [brains, routings, seriesList] = await Promise.all([
    base44.asServiceRole.entities.Brain.list('', 1000),
    base44.asServiceRole.entities.Routing.list('', 5000),
    base44.asServiceRole.entities.Series.list('', 5000),
  ]);

  const seriesById = {};
  for (const s of seriesList || []) seriesById[s.series_id] = s;

  const routingBySeries = {};
  for (const r of routings || []) routingBySeries[r.series_id] = r;

  const brainMatrices = (brains || []).map(b => ({
    brain: b,
    counts: safeParse(b.transition_matrix, {}),
  }));

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
      run_id: crypto.randomUUID(),
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
  return logs;
}

// ---------------------------------------------------------------------------
// Postgres schema (auto-created on first run; idempotent)
// ---------------------------------------------------------------------------
async function ensureSchema(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS apex_history (
      run_id UUID PRIMARY KEY,
      engine_timestamp TIMESTAMPTZ NOT NULL,
      series_id TEXT NOT NULL,
      current_state INTEGER,
      apex_brain_id TEXT,
      apex_predicted_distribution JSONB,
      apex_direction TEXT,
      apex_confidence DOUBLE PRECISION,
      apex_expected_return DOUBLE PRECISION,
      apex_actual_outcome DOUBLE PRECISION,
      apex_error DOUBLE PRECISION,
      apex_calibration_score DOUBLE PRECISION,
      apex_routing_distance DOUBLE PRECISION,
      apex_routing_threshold DOUBLE PRECISION,
      apex_routing_confidence DOUBLE PRECISION,
      ingested_at TIMESTAMPTZ DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS apex_history_ts_idx ON apex_history (engine_timestamp)`;
  await sql`CREATE INDEX IF NOT EXISTS apex_history_series_idx ON apex_history (series_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS organism_steps (
      run_id UUID NOT NULL REFERENCES apex_history(run_id) ON DELETE CASCADE,
      brain_id TEXT NOT NULL,
      kl_distance_to_series DOUBLE PRECISION,
      is_apex BOOLEAN,
      count INTEGER,
      series_count INTEGER,
      confidence DOUBLE PRECISION,
      transition_matrix JSONB,
      transition_rewards JSONB,
      brain_last_updated TIMESTAMPTZ,
      PRIMARY KEY (run_id, brain_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS cross_market_series (
      series_id TEXT PRIMARY KEY,
      states JSONB,
      last_routed_brain_id TEXT,
      last_updated TIMESTAMPTZ
    )
  `;
}

// ---------------------------------------------------------------------------
// Upsert one EngineRunLog into the three tables (transactional per log).
// ---------------------------------------------------------------------------
async function upsertLog(sql, log) {
  await sql.begin(async (tx) => {
    // apex_history
    await tx`
      INSERT INTO apex_history (
        run_id, engine_timestamp, series_id, current_state, apex_brain_id,
        apex_predicted_distribution, apex_direction, apex_confidence,
        apex_expected_return, apex_actual_outcome, apex_error, apex_calibration_score,
        apex_routing_distance, apex_routing_threshold, apex_routing_confidence
      ) VALUES (
        ${log.run_id}, ${log.engine_timestamp}, ${log.series_id}, ${log.current_state},
        ${log.apex_brain_id}, ${sql.json(log.apex_predicted_distribution)}, ${log.apex_direction},
        ${log.apex_confidence}, ${log.apex_expected_return}, ${log.apex_actual_outcome},
        ${log.apex_error}, ${log.apex_calibration_score}, ${log.apex_routing_distance},
        ${log.apex_routing_threshold}, ${log.apex_routing_confidence}
      )
      ON CONFLICT (run_id) DO NOTHING
    `;

    // organism_steps
    for (const org of log.organisms) {
      await tx`
        INSERT INTO organism_steps (
          run_id, brain_id, kl_distance_to_series, is_apex, count, series_count,
          confidence, transition_matrix, transition_rewards, brain_last_updated
        ) VALUES (
          ${log.run_id}, ${org.brain_id},
          ${isFinite(org.kl_distance_to_series) ? org.kl_distance_to_series : null},
          ${org.is_apex}, ${org.count}, ${org.series_count}, ${org.confidence},
          ${sql.json(org.transition_matrix)}, ${sql.json(org.transition_rewards)},
          ${org.brain_last_updated || null}
        )
        ON CONFLICT (run_id, brain_id) DO NOTHING
      `;
    }

    // cross_market_series upsert
    await tx`
      INSERT INTO cross_market_series (series_id, states, last_routed_brain_id, last_updated)
      VALUES (${log.series.series_id}, ${sql.json(log.series.states)},
              ${log.series.last_routed_brain_id}, ${log.series.last_updated || null})
      ON CONFLICT (series_id) DO UPDATE SET
        states = EXCLUDED.states,
        last_routed_brain_id = EXCLUDED.last_routed_brain_id,
        last_updated = EXCLUDED.last_updated
    `;
  });
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
Deno.serve(async (req) => {
  const started = new Date();
  const log = (msg, extra) => console.log(`[syncEngineRuns ${started.toISOString()}] ${msg}`, extra || '');

  const base44 = createClientFromRequest(req);

  // 1. Acquire / load sync state
  let stateRecord;
  const existing = await base44.asServiceRole.entities.SyncState.filter({ sync_name: SYNC_NAME });
  if (existing && existing.length > 0) {
    stateRecord = existing[0];
  } else {
    stateRecord = await base44.asServiceRole.entities.SyncState.create({
      sync_name: SYNC_NAME,
      status: 'idle',
      rows_total: 0,
      rows_last_run: 0,
    });
  }

  // 2. Lock check — skip if another run is in flight (and not stale)
  if (stateRecord.status === 'running' && stateRecord.lock_acquired_at) {
    const ageMin = (Date.now() - new Date(stateRecord.lock_acquired_at).getTime()) / 60000;
    if (ageMin < STALE_LOCK_MINUTES) {
      log(`skip — another run in flight (age ${ageMin.toFixed(1)}m)`);
      return Response.json({ skipped: true, reason: 'lock_held', lock_age_minutes: ageMin });
    }
    log(`stale lock detected (age ${ageMin.toFixed(1)}m) — taking over`);
  }

  // 3. Acquire lock
  await base44.asServiceRole.entities.SyncState.update(stateRecord.id, {
    status: 'running',
    last_attempt_at: started.toISOString(),
    lock_acquired_at: started.toISOString(),
    last_error: '',
  });

  // 4. Pull engine run logs since watermark — Base44 only, NO Postgres touched yet.
  //    Idle cycles (no new outputs) short-circuit here so the 5-min schedule burns
  //    zero external-DB compute on empty runs. This is the dominant case: most
  //    5-min ticks have nothing new, and opening a Postgres connection +
  //    running ensureSchema on every one of them is what pushed the Supabase
  //    project past its compute-time quota.
  const watermark = stateRecord.last_synced_timestamp || null;
  log(`fetching logs since ${watermark || 'beginning'}`);
  const logs = await buildEngineRunLogs(base44, watermark);
  log(`fetched ${logs.length} logs`);

  if (!logs || logs.length === 0) {
    const finished = new Date();
    await base44.asServiceRole.entities.SyncState.update(stateRecord.id, {
      status: 'success',
      last_success_at: finished.toISOString(),
      rows_last_run: 0,
      lock_acquired_at: null,
      last_error: '',
    });
    const durationMs = finished - started;
    log(`success (idle) — 0 new rows in ${durationMs}ms, no Postgres work needed`);
    return Response.json({ ok: true, rows_synced: 0, idle: true, duration_ms: durationMs });
  }

  // 5. Read Postgres connection string — only reached when there is actual work.
  const connStr = Deno.env.get('POSTGRES_CONNECTION_STRING');
  if (!connStr) {
    await base44.asServiceRole.entities.SyncState.update(stateRecord.id, {
      status: 'error',
      last_error: 'POSTGRES_CONNECTION_STRING secret is not set',
    });
    log('ERROR: POSTGRES_CONNECTION_STRING not set');
    return Response.json({ error: 'POSTGRES_CONNECTION_STRING secret missing' }, { status: 500 });
  }

  // Parse the URI for diagnostics (redact password)
  let connDiag = { host: null, port: null, database: null, sslmode: null, user: null };
  try {
    const u = new URL(connStr);
    connDiag = {
      host: u.hostname,
      port: u.port || '5432 (default)',
      database: u.pathname.replace(/^\//, ''),
      sslmode: u.searchParams.get('sslmode') || '(not specified — defaulting to require)',
      user: u.username,
    };
    console.log('[syncEngineRuns] connection target:', JSON.stringify(connDiag));
  } catch (e) {
    console.log('[syncEngineRuns] could not parse connection string:', e.message);
  }

  let sql;
  try {
    sql = postgres(connStr, { ssl: 'require', max: 3, idle_timeout: 20, connect_timeout: 30 });

    // 6. Ensure schema — retry once on connect timeout (Neon cold wake)
    const withRetry = async (fn) => {
      try { return await fn(); }
      catch (e) {
        if (e?.code === 'CONNECT_TIMEOUT' || e?.message?.includes('CONNECT_TIMEOUT')) {
          log('connect timeout, waiting 5s and retrying...');
          await new Promise(r => setTimeout(r, 5000));
          return await fn();
        }
        throw e;
      }
    };
    await withRetry(() => ensureSchema(sql));

    // 7. Upsert each log
    let inserted = 0;
    let maxTs = watermark;
    for (const l of logs) {
      await upsertLog(sql, l);
      inserted += 1;
      if (!maxTs || l.engine_timestamp > maxTs) maxTs = l.engine_timestamp;
    }

    // 8. Mark success
    const finished = new Date();
    await base44.asServiceRole.entities.SyncState.update(stateRecord.id, {
      status: 'success',
      last_success_at: finished.toISOString(),
      last_synced_timestamp: maxTs || stateRecord.last_synced_timestamp,
      rows_last_run: inserted,
      rows_total: (stateRecord.rows_total || 0) + inserted,
      lock_acquired_at: null,
      last_error: '',
    });

    const durationMs = finished - started;
    log(`success — ${inserted} rows in ${durationMs}ms, watermark advanced to ${maxTs || 'unchanged'}`);
    return Response.json({
      ok: true,
      rows_synced: inserted,
      watermark: maxTs,
      duration_ms: durationMs,
    });
  } catch (error) {
    // Keep connection diagnostics out of persisted error fields (console only) to avoid leaking DB topology.
    console.error('syncEngineRuns ERROR:', error, '| connDiag=', connDiag);
    const errMsg = `${error?.code || ''} ${error?.message || error}`.trim();
    await base44.asServiceRole.entities.SyncState.update(stateRecord.id, {
      status: 'error',
      last_error: errMsg.slice(0, 1000),
      lock_acquired_at: null,
    });
    return Response.json({
      error: errMsg,
      error_code: error?.code,
    }, { status: 500 });
  } finally {
    if (sql) {
      try { await sql.end({ timeout: 5 }); } catch { /* noop */ }
    }
  }
});