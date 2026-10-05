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
//   2. PROMOTION  6.5 is shown for a read once its probabilities there
//                 beat 6.2's by a margin that excludes zero AND it is right
//                 at least as often; it is taken back down when it is worse
//                 on either count by a margin that excludes zero. Every
//                 night's decision rests on the whole record (a running
//                 tally), not on the most recent calls
//   3. CALIBRATION  one map per read from stated to observed frequency for
//                 6.5, pooled across every tracked series
// The result is one EngineStatus row per read, which every function reads
// before it shows a number (loadLive).
// ===========================================================================

import { CANDIDATE_ENGINE, CONTROL_ENGINE, DEFAULT_LIVE, ENGINES, EngineId, EngineRun, LiveEngines, READS, ReadName } from './engines.ts';
import { strengthKnots, Knots } from './isotonic.ts';
import { closeness, scoreCall, EMPTY_RECORD, Record_, Views } from './cycle.ts';
import type { ScoredStep } from './hex.ts';
import { ENGINE_VERSION } from './version.ts';

// ---- the promotion rule, fixed in advance ---------------------------------
/** Calls scored for both engines on the same series and day, needed before any decision. */
export const MIN_PAIRED_CALLS = 300;
/** Distinct days those calls must span. */
export const MIN_PAIRED_DAYS = 60;
/** Width of the interval, in standard errors (1.96 = 95%). */
export const Z = 1.96;
/** A day is added to the tally once it is this many days old, so its scoring is complete. */
export const SETTLE_DAYS = 5;
/** Pooled calibration needs at least this many scored steps. */
export const MIN_CALIBRATION_STEPS = 2000;

export { closeness, progress, rewardOf, lessonOf, reasonFor, rightViews, accountOf, scoreCall, START_CLOSENESS, EMPTY_RECORD, REASONS, REASON_MEANING } from './cycle.ts';
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
  /** Step 1 of the cycle, written before the outcome: the engine's own probability and what each part of memory said (JSON). */
  raw?: number; views?: string;
  made_at: string; engine_version: string;
  scored?: boolean; outcome?: number; scored_at?: string;
  closeness?: number; closeness_baseline?: number;
  /** Progress against the version's record on this series, when positive; otherwise 0. Never negative. */
  reward?: number;
  /** How far the call fell short of that record, when it did. Analysis only. */
  lesson?: number;
  /** Step 4: why the call missed, found from the views; empty when it was on the right side. */
  reason?: string;
  /** closeness = 0.75 + these three. */
  part_baseline?: number; part_state?: number; part_strength?: number;
  /** The version's record on this series and read after this call: calls scored and their mean closeness. */
  record_calls?: number; record_closeness?: number;
}

const r5 = (v: number) => Number(v.toFixed(5));
/** The views as stored: rounded, so a row stays small. */
export function compactViews(v: Views): Views {
  const list = (xs?: { label: string; p: number; w: number }[]) => xs?.map((x) => ({ label: x.label, p: r5(x.p), w: r5(x.w) }));
  return { baseline: v.baseline, raw: v.raw, ...(v.memories ? { memories: list(v.memories) } : {}), ...(v.readings ? { readings: list(v.readings) } : {}) };
}
/** The views a row carries; a row written before views existed is read as its baseline and its probability. */
export function viewsOf(row: LedgerRow): Views {
  try { if (row.views) return JSON.parse(row.views); } catch { /* fall through */ }
  return { baseline: row.baseline, raw: row.raw ?? row.probability };
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
      raw: c.views.raw, views: JSON.stringify(compactViews(c.views)),
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
    const open = ((await L.filter({ series_id: seriesId, scored: false })) || []).slice().sort((x, y) => x.bar_ts - y.bar_ts);
    if (!open.length) return 0;
    // Each version's record on this series so far, carried on its latest scored row.
    const record = new Map<string, Record_>();
    const recordOf = async (row: LedgerRow) => {
      const key = `${row.read}|${row.engine}`;
      if (!record.has(key)) {
        const done = (await L.filter({ series_id: seriesId, read: row.read, engine: row.engine, scored: true }, '-call_date', 50).catch(() => [])) || [];
        const last = done.filter((r) => typeof r.record_calls === 'number').sort((x, y) => y.record_calls - x.record_calls)[0];
        record.set(key, last ? { n: last.record_calls, mean: last.record_closeness } : EMPTY_RECORD);
      }
      return record.get(key)!;
    };
    for (const row of open) {
      // 2. outcome
      const k = bars.timestamps.findIndex((t) => t > row.bar_ts);
      if (k < 1) continue; // the scoring bar has not printed, or the call bar is out of range
      const change = Math.log(bars.closes[k] / row.last_close);
      if (!Number.isFinite(change)) continue;
      if (row.read === 'RANGE' && !(row.threshold > 0)) continue;
      const outcome = row.read === 'MOVE' ? (change > 0 ? 1 : 0) : (Math.abs(change) > row.threshold ? 1 : 0);
      // 3. score, 4. reason (shared/cycle.ts)
      const s = scoreCall(row.probability, viewsOf(row), outcome, await recordOf(row));
      await L.update(row.id, {
        scored: true, outcome, scored_at: new Date().toISOString(),
        closeness: Number(s.closeness.toFixed(6)),
        closeness_baseline: Number(s.closeness_baseline.toFixed(6)),
        reward: Number(s.reward.toFixed(6)),
        lesson: Number(s.lesson.toFixed(6)),
        reason: s.reason ?? '',
        part_baseline: Number(s.account.baseline.toFixed(6)), part_state: Number(s.account.state.toFixed(6)), part_strength: Number(s.account.strength.toFixed(6)),
        record_calls: s.record.n, record_closeness: Number(s.record.mean.toFixed(8)),
      });
      // 5. the record takes the call in; the engines learn from it on their next run
      record.set(`${row.read}|${row.engine}`, s.record);
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
  /** Mean closeness of 6.5 minus 6.2 on the same calls. Positive = 6.5 came closer. */
  gain: number | null; gain_low: number | null; gain_high: number | null;
  /** Share of calls right, on the paired calls. */
  hit_control: number | null; hit_candidate: number | null; hit_baseline: number | null;
  /** Mean probability stated for the side called: compare with the hit rate. */
  stated_control: number | null; stated_candidate: number | null;
  /** Mean reward per call, each version: progress against its own record, never negative. */
  progress_control: number | null; progress_candidate: number | null;
  /** Mean lesson per call, each version: how far calls fell short of the record. Analysis only. */
  lesson_control: number | null; lesson_candidate: number | null;
  /** Misses by reason, each version: counts over the whole record. */
  reasons_control: Record<string, number>; reasons_candidate: Record<string, number>;
  decision: 'hold' | 'promote' | 'demote';
  reason: string;
}

/**
 * The whole record for one read, kept as running sums so that every night's
 * decision rests on all of it. (A ten-year simulation showed that deciding
 * from only the most recent calls makes the shown version flip back and
 * forth; with the whole record it changed once.)
 * Days are the unit of uncertainty: calls on the same day move together.
 */
export interface Tally {
  calls: number; days: number;
  gain_sum: number;                     // over calls
  day_gain: number; day_gain_sq: number;   // over days: sum and sum of squares of the day's mean gain
  day_hit: number; day_hit_sq: number;     // over days: the day's mean (candidate right - control right)
  hits_control: number; hits_candidate: number; hits_baseline: number;
  stated_control: number; stated_candidate: number;
  progress_control: number; progress_candidate: number;
  lesson_control: number; lesson_candidate: number;
  reasons_control: Record<string, number>; reasons_candidate: Record<string, number>;
  /** Last call date already counted; later days are still open. */
  last_day: string;
}
export const EMPTY_TALLY: Tally = { calls: 0, days: 0, gain_sum: 0, day_gain: 0, day_gain_sq: 0, day_hit: 0, day_hit_sq: 0, hits_control: 0, hits_candidate: 0, hits_baseline: 0, stated_control: 0, stated_candidate: 0, progress_control: 0, progress_candidate: 0, lesson_control: 0, lesson_candidate: 0, reasons_control: {}, reasons_candidate: {}, last_day: '' };

const mean = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;
const right = (r: LedgerRow) => ((r.probability >= 0.5 ? 1 : 0) === r.outcome ? 1 : 0);

/**
 * Add to the tally every day after `tally.last_day` and up to `through`
 * (inclusive) on which both versions have a scored call on the same series.
 * A day is counted once; pass a `through` old enough that its scoring is done.
 */
export function foldDays(tally: Tally, read: ReadName, rows: LedgerRow[], through: string): Tally {
  const byDay = new Map<string, Map<string, Partial<Record<EngineId, LedgerRow>>>>();
  for (const r of rows) {
    if (r.read !== read || !r.scored || typeof r.outcome !== 'number') continue;
    if (r.call_date <= tally.last_day || r.call_date > through) continue;
    if (!byDay.has(r.call_date)) byDay.set(r.call_date, new Map());
    const day = byDay.get(r.call_date)!;
    if (!day.has(r.series_id)) day.set(r.series_id, {});
    day.get(r.series_id)![r.engine] = r;
  }
  const t = { ...tally, reasons_control: { ...(tally.reasons_control || {}) }, reasons_candidate: { ...(tally.reasons_candidate || {}) } };
  for (const date of [...byDay.keys()].sort()) {
    const pairs = [...byDay.get(date)!.values()].filter((p) => p[CONTROL_ENGINE] && p[CANDIDATE_ENGINE]) as Record<EngineId, LedgerRow>[];
    if (!pairs.length) continue;
    const gains = pairs.map((p) => (p[CANDIDATE_ENGINE].closeness ?? closeness(p[CANDIDATE_ENGINE].probability, p[CANDIDATE_ENGINE].outcome!))
      - (p[CONTROL_ENGINE].closeness ?? closeness(p[CONTROL_ENGINE].probability, p[CONTROL_ENGINE].outcome!)));
    const hd = pairs.map((p) => right(p[CANDIDATE_ENGINE]) - right(p[CONTROL_ENGINE]));
    const g = mean(gains), h = mean(hd);
    t.calls += pairs.length; t.days += 1;
    t.gain_sum += gains.reduce((x, y) => x + y, 0);
    t.day_gain += g; t.day_gain_sq += g * g; t.day_hit += h; t.day_hit_sq += h * h;
    for (const p of pairs) {
      t.hits_control += right(p[CONTROL_ENGINE]); t.hits_candidate += right(p[CANDIDATE_ENGINE]);
      t.hits_baseline += (p[CANDIDATE_ENGINE].baseline >= 0.5 ? 1 : 0) === p[CANDIDATE_ENGINE].outcome ? 1 : 0;
      t.stated_control += Math.max(p[CONTROL_ENGINE].probability, 1 - p[CONTROL_ENGINE].probability);
      t.stated_candidate += Math.max(p[CANDIDATE_ENGINE].probability, 1 - p[CANDIDATE_ENGINE].probability);
      t.progress_control += p[CONTROL_ENGINE].reward ?? 0; t.progress_candidate += p[CANDIDATE_ENGINE].reward ?? 0;
      t.lesson_control += p[CONTROL_ENGINE].lesson ?? 0; t.lesson_candidate += p[CANDIDATE_ENGINE].lesson ?? 0;
      for (const [e, into] of [[CONTROL_ENGINE, t.reasons_control], [CANDIDATE_ENGINE, t.reasons_candidate]] as [EngineId, Record<string, number>][]) {
        const why = p[e].reason; if (why) into[why] = (into[why] || 0) + 1;
      }
    }
    t.last_day = date;
  }
  return t;
}

/** Apply the promotion rule to the whole record. */
export function decide(read: ReadName, t: Tally, current: EngineId): ReadStatus {
  const st: ReadStatus = {
    read, live_engine: current, paired_calls: t.calls, paired_days: t.days,
    gain: null, gain_low: null, gain_high: null, hit_control: null, hit_candidate: null, hit_baseline: null,
    stated_control: null, stated_candidate: null, progress_control: null, progress_candidate: null, lesson_control: null, lesson_candidate: null, reasons_control: {}, reasons_candidate: {}, decision: 'hold', reason: '',
  };
  st.reasons_control = { ...(t.reasons_control || {}) }; st.reasons_candidate = { ...(t.reasons_candidate || {}) };
  if (!t.calls) { st.reason = 'no scored calls yet'; return st; }
  const g = t.gain_sum / t.calls, m = t.day_gain / t.days, hm = t.day_hit / t.days;
  const se = (sum: number, sq: number) => (t.days > 1 ? Math.sqrt(Math.max(0, sq / t.days - (sum / t.days) ** 2) * t.days / (t.days - 1) / t.days) : Infinity);
  const gse = se(t.day_gain, t.day_gain_sq), hitHigh = hm + Z * se(t.day_hit, t.day_hit_sq);
  const r4 = (v: number) => Number(v.toFixed(4));
  st.gain = Number(g.toFixed(5));
  st.gain_low = Number.isFinite(gse) ? Number((m - Z * gse).toFixed(5)) : null;
  st.gain_high = Number.isFinite(gse) ? Number((m + Z * gse).toFixed(5)) : null;
  st.hit_control = r4(t.hits_control / t.calls); st.hit_candidate = r4(t.hits_candidate / t.calls); st.hit_baseline = r4(t.hits_baseline / t.calls);
  st.stated_control = r4(t.stated_control / t.calls); st.stated_candidate = r4(t.stated_candidate / t.calls);
  st.progress_control = Number((t.progress_control / t.calls).toFixed(5)); st.progress_candidate = Number((t.progress_candidate / t.calls).toFixed(5));
  st.lesson_control = Number((t.lesson_control / t.calls).toFixed(5)); st.lesson_candidate = Number((t.lesson_candidate / t.calls).toFixed(5));

  const enough = st.paired_calls >= MIN_PAIRED_CALLS && st.paired_days >= MIN_PAIRED_DAYS && st.gain_low !== null;
  const span = `[${((st.gain_low ?? 0) * 1000).toFixed(1)}, ${((st.gain_high ?? 0) * 1000).toFixed(1)}]`;
  if (!enough) {
    st.reason = `${st.paired_calls} of ${MIN_PAIRED_CALLS} paired calls over ${st.paired_days} of ${MIN_PAIRED_DAYS} days: no decision yet`;
  } else if (current === CONTROL_ENGINE && st.gain_low! > 0 && t.hits_candidate < t.hits_control) {
    st.reason = `6.5 comes closer (by ${(g * 1000).toFixed(1)} thousandths per call) but is right less often (${(st.hit_candidate! * 100).toFixed(1)}% against ${(st.hit_control! * 100).toFixed(1)}%), so 6.2 stays`;
  } else if (current === CONTROL_ENGINE && st.gain_low! > 0) {
    st.decision = 'promote'; st.live_engine = CANDIDATE_ENGINE;
    st.reason = `6.5 came closer than 6.2 by ${(g * 1000).toFixed(1)} thousandths per call; the interval excludes zero`;
  } else if (current === CANDIDATE_ENGINE && st.gain_high! < 0) {
    st.decision = 'demote'; st.live_engine = CONTROL_ENGINE;
    st.reason = `6.2 came closer than 6.5 by ${(-g * 1000).toFixed(1)} thousandths per call; the interval excludes zero`;
  } else if (current === CANDIDATE_ENGINE && hitHigh < 0) {
    st.decision = 'demote'; st.live_engine = CONTROL_ENGINE;
    st.reason = `6.5 was right less often than 6.2 (${(st.hit_candidate! * 100).toFixed(1)}% against ${(st.hit_control! * 100).toFixed(1)}%); the interval excludes zero`;
  } else if (current === CONTROL_ENGINE) {
    st.reason = `closeness difference ${(g * 1000).toFixed(1)} thousandths per call ${span}: not clearly closer, so 6.2 stays`;
  } else {
    st.reason = `closeness difference ${(g * 1000).toFixed(1)} thousandths per call ${span}: not clearly further, so 6.5 stays`;
  }
  return st;
}

/** The rule applied to a set of rows in one go (every scored day counted). */
export function summarise(read: ReadName, rows: LedgerRow[], current: EngineId): ReadStatus {
  return decide(read, foldDays(EMPTY_TALLY, read, rows, '9999-12-31'), current);
}

/** One calibration map per read for 6.5, pooled across series. Null until there are enough steps. */
export function pooledCalibration(steps: ScoredStep[]): Knots | null {
  if (steps.length < MIN_CALIBRATION_STEPS) return null;
  return strengthKnots(steps.map((s) => s.p), steps.map((s) => s.y));
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
