// ===========================================================================
// LEDGER — the learning loop's memory.
//
// HEX makes every call, in two versions (engines.ts). Every call either
// version makes on a tracked series is written down before
// its outcome exists: the baseline probability, the engine's probability, and
// what would count as the event. When the next finished daily bar prints, the
// call is scored. Nothing is replayed or back-filled.
//
// The nightly job (functions/calibrateCognition) then does three things with
// the scored rows:
//   1. STATUS     how each engine has done on each read, on the same calls
//   2. PROMOTION  6.4 is shown for a read once its probabilities there
//                 beat 6.2's by a margin that excludes zero AND it is right
//                 at least as often; it is taken back down when it is worse
//                 on either count by a margin that excludes zero
//   3. CALIBRATION  one map per read from stated to observed frequency for
//                 6.4, pooled across every tracked series
// The result is one EngineStatus row per read, which every function reads
// before it shows a number (loadLive).
// ===========================================================================

import { CANDIDATE_ENGINE, CONTROL_ENGINE, DEFAULT_LIVE, ENGINES, EngineId, EngineRun, LiveEngines, READS, ReadName } from './engines.ts';
import { isotonicKnots, Knots } from './isotonic.ts';
import type { ScoredStep } from './hex.ts';
import { ENGINE_VERSION } from './version.ts';

// ---- the promotion rule, fixed in advance ---------------------------------
/** Calls scored for both engines on the same series and day, needed before any decision. */
export const MIN_PAIRED_CALLS = 300;
/** Distinct days those calls must span. */
export const MIN_PAIRED_DAYS = 60;
/** Width of the interval, in standard errors (1.96 = 95%). */
export const Z = 1.96;
/** Pooled calibration needs at least this many scored steps. */
export const MIN_CALIBRATION_STEPS = 2000;

const clip = (p: number) => Math.min(0.99, Math.max(0.01, p));
const logLoss = (p: number, y: number) => -Math.log(y ? clip(p) : 1 - clip(p));
const dateOf = (tsSec: number) => new Date(tsSec * 1000).toISOString().slice(0, 10);

/** Finished daily bars, oldest first. */
export interface Bars { closes: number[]; timestamps: number[] }

/** Median size of every change so far: the next change is "larger than usual" above this. */
export function usualChange(returns: number[]): number | null {
  if (returns.length < 20) return null;
  const a = returns.map(Math.abs).sort((x, y) => x - y), m = a.length;
  return m % 2 ? a[(m - 1) / 2] : (a[m / 2 - 1] + a[m / 2]) / 2;
}

export interface LedgerRow {
  id?: string;
  series_id: string; read: ReadName; engine: EngineId;
  call_date: string; bar_ts: number; last_close: number; threshold: number | null;
  baseline: number; probability: number; shown: boolean; source: string;
  made_at: string; engine_version: string;
  scored?: boolean; outcome?: number; scored_at?: string;
  log_loss?: number; log_loss_baseline?: number;
}

/** The rows one read of one series produces: both engines, both reads. */
export function rowsFor(seriesId: string, bars: Bars, returns: number[], run: EngineRun, source: string): LedgerRow[] {
  const n = bars.closes.length;
  if (!n) return [];
  const bar_ts = bars.timestamps[n - 1], made_at = new Date().toISOString(), threshold = usualChange(returns);
  const rows: LedgerRow[] = [];
  for (const read of READS) for (const engine of ENGINES) {
    const c = run.calls[engine][read];
    rows.push({
      series_id: seriesId, read, engine, call_date: dateOf(bar_ts), bar_ts, last_close: bars.closes[n - 1],
      threshold: read === 'RANGE' ? threshold : null,
      baseline: c.baseline, probability: c.p, shown: run.live[read] === engine, source, made_at, engine_version: ENGINE_VERSION,
    });
  }
  return rows;
}

/** Write the calls for a series and day unless they are already there. Never throws. */
export async function logCalls(base44, rows: LedgerRow[]): Promise<number> {
  if (!rows.length) return 0;
  try {
    const L = base44.asServiceRole.entities.CallLedger;
    const existing = await L.filter({ series_id: rows[0].series_id, call_date: rows[0].call_date });
    const have = new Set((existing || []).map((r) => `${r.read}|${r.engine}`));
    let wrote = 0;
    for (const row of rows) {
      if (have.has(`${row.read}|${row.engine}`)) continue;
      await L.create({ ...row, scored: false });
      wrote++;
    }
    return wrote;
  } catch {
    return 0;
  }
}

/** Score every open call on this series whose next finished bar has printed. Never throws. */
export async function scoreOpenCalls(base44, seriesId: string, bars: Bars): Promise<number> {
  let scored = 0;
  try {
    const L = base44.asServiceRole.entities.CallLedger;
    const open = await L.filter({ series_id: seriesId, scored: false });
    for (const row of open || []) {
      const k = bars.timestamps.findIndex((t) => t > row.bar_ts);
      if (k < 1) continue; // the scoring bar has not printed, or the call bar is out of range
      const change = Math.log(bars.closes[k] / row.last_close);
      if (!Number.isFinite(change)) continue;
      if (row.read === 'RANGE' && !(row.threshold > 0)) continue;
      const outcome = row.read === 'MOVE' ? (change > 0 ? 1 : 0) : (Math.abs(change) > row.threshold ? 1 : 0);
      await L.update(row.id, {
        scored: true, outcome, scored_at: new Date().toISOString(),
        log_loss: Number(logLoss(row.probability, outcome).toFixed(6)),
        log_loss_baseline: Number(logLoss(row.baseline, outcome).toFixed(6)),
      });
      scored++;
    }
  } catch { /* non-blocking */ }
  return scored;
}

// ---- status and promotion (pure functions) --------------------------------
export interface ReadStatus {
  read: ReadName;
  live_engine: EngineId;
  paired_calls: number; paired_days: number;
  /** Mean log loss of 6.2 minus 6.4 on the same calls, nats. Positive = 6.4 better. */
  gain: number | null; gain_low: number | null; gain_high: number | null;
  /** Share of calls right, on the paired calls. */
  hit_control: number | null; hit_candidate: number | null; hit_baseline: number | null;
  /** Mean probability stated for the side called: compare with the hit rate. */
  stated_control: number | null; stated_candidate: number | null;
  decision: 'hold' | 'promote' | 'demote';
  reason: string;
}

const mean = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;

/**
 * Summarise scored rows for one read and apply the promotion rule.
 * Days are the unit of uncertainty: calls on the same day move together.
 */
export function summarise(read: ReadName, rows: LedgerRow[], current: EngineId): ReadStatus {
  const byKey = new Map<string, Partial<Record<EngineId, LedgerRow>>>();
  for (const r of rows) {
    if (r.read !== read || !r.scored || typeof r.outcome !== 'number') continue;
    const k = `${r.series_id}|${r.call_date}`;
    if (!byKey.has(k)) byKey.set(k, {});
    byKey.get(k)![r.engine] = r;
  }
  const pairs = [...byKey.values()].filter((p) => p[CONTROL_ENGINE] && p[CANDIDATE_ENGINE]) as Record<EngineId, LedgerRow>[];
  const st: ReadStatus = {
    read, live_engine: current, paired_calls: pairs.length, paired_days: 0,
    gain: null, gain_low: null, gain_high: null, hit_control: null, hit_candidate: null, hit_baseline: null,
    stated_control: null, stated_candidate: null, decision: 'hold', reason: '',
  };
  if (!pairs.length) { st.reason = 'no scored calls yet'; return st; }
  const byDay = new Map<string, number[]>();
  const hitByDay = new Map<string, number[]>();
  const right = (r: LedgerRow) => ((r.probability >= 0.5 ? 1 : 0) === r.outcome ? 1 : 0);
  for (const p of pairs) {
    const d = (p[CONTROL_ENGINE].log_loss ?? logLoss(p[CONTROL_ENGINE].probability, p[CONTROL_ENGINE].outcome!))
      - (p[CANDIDATE_ENGINE].log_loss ?? logLoss(p[CANDIDATE_ENGINE].probability, p[CANDIDATE_ENGINE].outcome!));
    const day = p[CONTROL_ENGINE].call_date;
    if (!byDay.has(day)) { byDay.set(day, []); hitByDay.set(day, []); }
    byDay.get(day)!.push(d);
    hitByDay.get(day)!.push(right(p[CANDIDATE_ENGINE]) - right(p[CONTROL_ENGINE]));
  }
  const dayMeans = [...byDay.values()].map(mean);
  const g = mean([...byDay.values()].flat());
  const m = mean(dayMeans);
  const se = dayMeans.length > 1 ? Math.sqrt(dayMeans.reduce((s, x) => s + (x - m) ** 2, 0) / (dayMeans.length - 1) / dayMeans.length) : Infinity;
  // the same interval for the difference in hit rate (candidate minus control)
  const hd = [...hitByDay.values()].map(mean), hm = mean(hd);
  const hse = hd.length > 1 ? Math.sqrt(hd.reduce((s, x) => s + (x - hm) ** 2, 0) / (hd.length - 1) / hd.length) : Infinity;
  const hitHigh = hm + Z * hse;
  const hit = (e: EngineId) => mean(pairs.map((p) => ((p[e].probability >= 0.5 ? 1 : 0) === p[e].outcome ? 1 : 0)));
  const stated = (e: EngineId) => mean(pairs.map((p) => Math.max(p[e].probability, 1 - p[e].probability)));
  const r4 = (v: number) => Number(v.toFixed(4));
  st.paired_days = dayMeans.length;
  st.gain = Number(g.toFixed(5));
  st.gain_low = Number.isFinite(se) ? Number((m - Z * se).toFixed(5)) : null;
  st.gain_high = Number.isFinite(se) ? Number((m + Z * se).toFixed(5)) : null;
  st.hit_control = r4(hit(CONTROL_ENGINE)); st.hit_candidate = r4(hit(CANDIDATE_ENGINE));
  st.hit_baseline = r4(mean(pairs.map((p) => ((p[CANDIDATE_ENGINE].baseline >= 0.5 ? 1 : 0) === p[CANDIDATE_ENGINE].outcome ? 1 : 0))));
  st.stated_control = r4(stated(CONTROL_ENGINE)); st.stated_candidate = r4(stated(CANDIDATE_ENGINE));

  const enough = st.paired_calls >= MIN_PAIRED_CALLS && st.paired_days >= MIN_PAIRED_DAYS && st.gain_low !== null;
  if (!enough) {
    st.reason = `${st.paired_calls} of ${MIN_PAIRED_CALLS} paired calls over ${st.paired_days} of ${MIN_PAIRED_DAYS} days: no decision yet`;
  } else if (current === CONTROL_ENGINE && st.gain_low! > 0 && st.hit_candidate! < st.hit_control!) {
    st.reason = `6.4 states better probabilities (gain ${(g * 1000).toFixed(1)}) but is right less often (${(st.hit_candidate! * 100).toFixed(1)}% against ${(st.hit_control! * 100).toFixed(1)}%), so 6.2 stays`;
  } else if (current === CONTROL_ENGINE && st.gain_low! > 0) {
    st.decision = 'promote'; st.live_engine = CANDIDATE_ENGINE;
    st.reason = `6.4 beat 6.2 by ${(g * 1000).toFixed(1)} thousandths of a nat per call; the interval excludes zero`;
  } else if (current === CANDIDATE_ENGINE && st.gain_high! < 0) {
    st.decision = 'demote'; st.live_engine = CONTROL_ENGINE;
    st.reason = `6.4 trailed 6.2 by ${(-g * 1000).toFixed(1)} thousandths of a nat per call; the interval excludes zero`;
  } else if (current === CANDIDATE_ENGINE && hitHigh < 0) {
    st.decision = 'demote'; st.live_engine = CONTROL_ENGINE;
    st.reason = `6.4 was right less often than 6.2 (${(st.hit_candidate! * 100).toFixed(1)}% against ${(st.hit_control! * 100).toFixed(1)}%); the interval excludes zero`;
  } else if (current === CONTROL_ENGINE) {
    st.reason = `gain ${(g * 1000).toFixed(1)} thousandths of a nat per call [${(st.gain_low! * 1000).toFixed(1)}, ${(st.gain_high! * 1000).toFixed(1)}]: not clearly better, so 6.2 stays`;
  } else {
    st.reason = `gain ${(g * 1000).toFixed(1)} thousandths of a nat per call [${(st.gain_low! * 1000).toFixed(1)}, ${(st.gain_high! * 1000).toFixed(1)}]: not clearly worse, so 6.4 stays`;
  }
  return st;
}

/** One calibration map per read for 6.4, pooled across series. Null until there are enough steps. */
export function pooledCalibration(steps: ScoredStep[]): Knots | null {
  if (steps.length < MIN_CALIBRATION_STEPS) return null;
  return isotonicKnots(steps.map((s) => s.p), steps.map((s) => s.y));
}

// ---- what every function reads before it shows a number --------------------
/** Which engine is shown for each read, and the stored calibration. Falls back to 6.2 on any failure. */
export async function loadLive(base44): Promise<LiveEngines> {
  try {
    const rows = await base44.asServiceRole.entities.EngineStatus.list('-updated_date', 10);
    const live: LiveEngines = { ...DEFAULT_LIVE, calibration: {} };
    for (const read of READS) {
      const row = (rows || []).find((r) => r.read === read);
      if (!row) continue;
      if (ENGINES.includes(row.live_engine)) live[read] = row.live_engine;
      if (row.calibration) { try { live.calibration![read] = JSON.parse(row.calibration); } catch { /* ignore */ } }
    }
    return live;
  } catch {
    return DEFAULT_LIVE;
  }
}

/** The record on one series, shown back to the model so it can speak honestly about it. */
export async function recordBlock(base44, seriesId: string): Promise<string> {
  try {
    const rows = await base44.asServiceRole.entities.CallLedger.filter({ series_id: seriesId, shown: true, scored: true }, '-call_date', 400);
    if (!rows?.length) return '';
    const lines = [`YOUR FORWARD RECORD ON ${seriesId} (calls logged before the outcome and scored on the next daily close):`];
    for (const read of READS) {
      const r = rows.filter((x) => x.read === read);
      if (!r.length) continue;
      const hits = r.filter((x) => ((x.probability >= 0.5 ? 1 : 0) === x.outcome)).length;
      lines.push(`  ${read === 'MOVE' ? 'direction' : 'move size'}: ${hits} of ${r.length} calls right`);
    }
    if (rows.length < 100) lines.push('  this is too few to mean anything yet — if you mention it, say it is a short record');
    lines.push('  Mention this only if they ask how you have done. Never present it as a track record or a performance claim.');
    return lines.join('\n');
  } catch {
    return '';
  }
}
