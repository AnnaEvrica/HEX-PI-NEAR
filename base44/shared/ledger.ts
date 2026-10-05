// ===========================================================================
// LEDGER — the learning loop's memory.
//
// HEX makes every call, in two versions (engines.ts). Every call either
// version makes on a tracked series is written down before its outcome
// exists: the null's probability, the engine's probability, what each part
// of its memory said, and what would count as the event. When the next
// finished daily bar prints, the call is scored (cycle.ts). Nothing is
// replayed or back-filled.
//
// The nightly job (functions/calibrateCognition) then does four things with
// the scored rows:
//   1. STATUS     how each version has done on each read, on the same calls:
//                 information gain over the null in bits per call, share of
//                 calls right, stated strength, misses by reason
//   2. VERSION    7.0 is shown for a read once its information gain over 6.5
//                 on the same calls is clear of zero AND it is right at least
//                 as often; it is taken back down when it is behind on either
//                 count by a margin clear of zero
//   3. VERIFIED   a read has a verified edge when the shown version's
//                 information gain over the null is clear of zero. The
//                 status starts from the replay (engines.ts) and the
//                 ledger changes it only when its own record is decisive
//   4. STRENGTH   one map per read and version from stated strength to how
//                 often such calls were right, pooled across tracked series
// Every decision rests on the whole record, kept as running sums with days
// as the unit of uncertainty. The result is one EngineStatus row per read,
// which every function reads before it shows a number (loadLive).
// ===========================================================================

import { CANDIDATE_ENGINE, CONTROL_ENGINE, DEFAULT_LIVE, ENGINES, EngineId, EngineRun, LiveEngines, READS, ReadName } from './engines.ts';
import { strengthKnots, Knots } from './isotonic.ts';
import { scoreCall, addDay, clusteredMean, logScore, Clustered, EMPTY_CLUSTERED, EMPTY_RECORD, Record_, Views } from './cycle.ts';
import type { ScoredStep } from './hex7.ts';
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

export { closeness, progress, rewardOf, lessonOf, reasonFor, rightViews, accountOf, scoreCall, logScore, informationGain, addDay, clusteredMean, START_CLOSENESS, EMPTY_RECORD, EMPTY_CLUSTERED, REASONS, REASON_MEANING } from './cycle.ts';
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
  /** 7.0 only: what it had learned on this series when it made the call (JSON: coefficients and each expert's influence). */
  learned?: string;
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
  part_baseline?: number; part_structure?: number; part_strength?: number;
  /** ln of the probability given to what happened, and the information gain over the null, in nats. */
  log_score?: number; info_gain?: number;
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
      ...(engine === CANDIDATE_ENGINE ? { learned: JSON.stringify({ beta: run.learned[read].beta.map(r5), influence: run.learned[read].influence.map(r5) }) } : {}),
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
        log_score: Number(s.log_score.toFixed(6)), info_gain: Number(s.info_gain.toFixed(6)),
        closeness: Number(s.closeness.toFixed(6)),
        closeness_baseline: Number(s.closeness_baseline.toFixed(6)),
        reward: Number(s.reward.toFixed(6)),
        lesson: Number(s.lesson.toFixed(6)),
        reason: s.reason ?? '',
        part_baseline: Number(s.account.baseline.toFixed(6)), part_structure: Number(s.account.structure.toFixed(6)), part_strength: Number(s.account.strength.toFixed(6)),
        record_calls: s.record.n, record_closeness: Number(s.record.mean.toFixed(8)),
      });
      // 5. the record takes the call in; the engines learn from it on their next run
      record.set(`${row.read}|${row.engine}`, s.record);
      scored++;
    }
  } catch { /* non-blocking */ }
  return scored;
}

// ---- status and the version rule (pure functions) --------------------------
const LN2 = Math.log(2);
export interface ReadStatus {
  read: ReadName;
  live_engine: EngineId;
  paired_calls: number; paired_days: number;
  /** Information gain of 7.0 over 6.5 on the same calls, nats per call, with its 95% interval. Positive = 7.0 gave what happened more probability. */
  gain: number | null; gain_low: number | null; gain_high: number | null;
  /** Information gain over the null, bits per call, each version, with 95% intervals. */
  bits_control: number | null; bits_control_low: number | null; bits_control_high: number | null;
  bits_candidate: number | null; bits_candidate_low: number | null; bits_candidate_high: number | null;
  /** True when the shown version's gain over the null is clearly above zero on this record; false when it is clearly below; null when this record does not settle it. */
  verified: boolean | null;
  /** Share of calls right, on the paired calls. */
  hit_control: number | null; hit_candidate: number | null; hit_baseline: number | null;
  /** Mean probability stated for the side called: compare with the share right. */
  stated_control: number | null; stated_candidate: number | null;
  /** Mean closeness (1 - squared error) per call, each version. */
  closeness_control: number | null; closeness_candidate: number | null;
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
 * decision rests on all of it. Days are the unit of uncertainty: calls on the
 * same day move together (cycle.ts, Clustered).
 */
export interface Tally {
  calls: number; days: number;
  /** 7.0 over 6.5: difference of log scores. */
  versus: Clustered;
  /** Each version over the null. */
  over_null_control: Clustered; over_null_candidate: Clustered;
  /** 7.0 right minus 6.5 right. */
  hits: Clustered;
  hits_control: number; hits_candidate: number; hits_baseline: number;
  stated_control: number; stated_candidate: number;
  closeness_control: number; closeness_candidate: number;
  progress_control: number; progress_candidate: number;
  lesson_control: number; lesson_candidate: number;
  reasons_control: Record<string, number>; reasons_candidate: Record<string, number>;
  /** Last call date already counted; later days are still open. */
  last_day: string;
}
export const EMPTY_TALLY: Tally = { calls: 0, days: 0, versus: EMPTY_CLUSTERED, over_null_control: EMPTY_CLUSTERED, over_null_candidate: EMPTY_CLUSTERED, hits: EMPTY_CLUSTERED,
  hits_control: 0, hits_candidate: 0, hits_baseline: 0, stated_control: 0, stated_candidate: 0, closeness_control: 0, closeness_candidate: 0,
  progress_control: 0, progress_candidate: 0, lesson_control: 0, lesson_candidate: 0, reasons_control: {}, reasons_candidate: {}, last_day: '' };

const right = (r: LedgerRow) => ((r.probability >= 0.5 ? 1 : 0) === r.outcome ? 1 : 0);
const score = (r: LedgerRow) => r.log_score ?? logScore(r.probability, r.outcome!);
const overNull = (r: LedgerRow) => r.info_gain ?? (logScore(r.probability, r.outcome!) - logScore(r.baseline, r.outcome!));

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
  const t = { ...EMPTY_TALLY, ...tally, reasons_control: { ...(tally.reasons_control || {}) }, reasons_candidate: { ...(tally.reasons_candidate || {}) } };
  for (const date of [...byDay.keys()].sort()) {
    const pairs = [...byDay.get(date)!.values()].filter((p) => p[CONTROL_ENGINE] && p[CANDIDATE_ENGINE]) as Record<EngineId, LedgerRow>[];
    if (!pairs.length) continue;
    let dv = 0, dc = 0, dk = 0, dh = 0;
    for (const p of pairs) {
      const c = p[CONTROL_ENGINE], k = p[CANDIDATE_ENGINE];
      dv += score(k) - score(c); dc += overNull(c); dk += overNull(k); dh += right(k) - right(c);
      t.hits_control += right(c); t.hits_candidate += right(k);
      t.hits_baseline += (k.baseline >= 0.5 ? 1 : 0) === k.outcome ? 1 : 0;
      t.stated_control += Math.max(c.probability, 1 - c.probability); t.stated_candidate += Math.max(k.probability, 1 - k.probability);
      t.closeness_control += c.closeness ?? 0; t.closeness_candidate += k.closeness ?? 0;
      t.progress_control += c.reward ?? 0; t.progress_candidate += k.reward ?? 0;
      t.lesson_control += c.lesson ?? 0; t.lesson_candidate += k.lesson ?? 0;
      for (const [row, into] of [[c, t.reasons_control], [k, t.reasons_candidate]] as [LedgerRow, Record<string, number>][]) { const why = row.reason; if (why) into[why] = (into[why] || 0) + 1; }
    }
    t.calls += pairs.length; t.days += 1;
    t.versus = addDay(t.versus, dv, pairs.length); t.over_null_control = addDay(t.over_null_control, dc, pairs.length);
    t.over_null_candidate = addDay(t.over_null_candidate, dk, pairs.length); t.hits = addDay(t.hits, dh, pairs.length);
    t.last_day = date;
  }
  return t;
}

/** Apply the version rule and the verified-edge test to the whole record. */
export function decide(read: ReadName, t: Tally, current: EngineId): ReadStatus {
  const st: ReadStatus = {
    read, live_engine: current, paired_calls: t.calls, paired_days: t.days,
    gain: null, gain_low: null, gain_high: null,
    bits_control: null, bits_control_low: null, bits_control_high: null, bits_candidate: null, bits_candidate_low: null, bits_candidate_high: null, verified: null,
    hit_control: null, hit_candidate: null, hit_baseline: null, stated_control: null, stated_candidate: null, closeness_control: null, closeness_candidate: null,
    progress_control: null, progress_candidate: null, lesson_control: null, lesson_candidate: null,
    reasons_control: { ...(t.reasons_control || {}) }, reasons_candidate: { ...(t.reasons_candidate || {}) }, decision: 'hold', reason: '',
  };
  if (!t.calls) { st.reason = 'no scored calls yet'; return st; }
  const r4 = (v: number) => Number(v.toFixed(4)), r5 = (v: number) => Number(v.toFixed(5)), per = (v: number) => v / t.calls;
  const v = clusteredMean(t.versus, Z), c0 = clusteredMean(t.over_null_control, Z), k0 = clusteredMean(t.over_null_candidate, Z), h = clusteredMean(t.hits, Z);
  if (v) { st.gain = r5(v.mean); st.gain_low = r5(v.low); st.gain_high = r5(v.high); }
  if (c0) { st.bits_control = r5(c0.mean / LN2); st.bits_control_low = r5(c0.low / LN2); st.bits_control_high = r5(c0.high / LN2); }
  if (k0) { st.bits_candidate = r5(k0.mean / LN2); st.bits_candidate_low = r5(k0.low / LN2); st.bits_candidate_high = r5(k0.high / LN2); }
  st.hit_control = r4(per(t.hits_control)); st.hit_candidate = r4(per(t.hits_candidate)); st.hit_baseline = r4(per(t.hits_baseline));
  st.stated_control = r4(per(t.stated_control)); st.stated_candidate = r4(per(t.stated_candidate));
  st.closeness_control = r5(per(t.closeness_control)); st.closeness_candidate = r5(per(t.closeness_candidate));
  st.progress_control = r5(per(t.progress_control)); st.progress_candidate = r5(per(t.progress_candidate));
  st.lesson_control = r5(per(t.lesson_control)); st.lesson_candidate = r5(per(t.lesson_candidate));

  const enough = t.calls >= MIN_PAIRED_CALLS && t.days >= MIN_PAIRED_DAYS && !!v;
  const bits = (x: number) => (x / LN2 * 1000).toFixed(1);
  const span = v ? `[${bits(v.low)}, ${bits(v.high)}]` : '';
  if (!enough) {
    st.reason = `${t.calls} of ${MIN_PAIRED_CALLS} paired calls over ${t.days} of ${MIN_PAIRED_DAYS} days: no decision yet`;
  } else if (current === CONTROL_ENGINE && v!.low > 0 && t.hits_candidate < t.hits_control) {
    st.reason = `7.0 gains ${bits(v!.mean)} thousandths of a bit per call over 6.5 but is right less often (${(st.hit_candidate! * 100).toFixed(1)}% against ${(st.hit_control! * 100).toFixed(1)}%), so 6.5 stays`;
  } else if (current === CONTROL_ENGINE && v!.low > 0) {
    st.decision = 'promote'; st.live_engine = CANDIDATE_ENGINE;
    st.reason = `7.0 gains ${bits(v!.mean)} thousandths of a bit per call over 6.5 ${span}; the interval excludes zero`;
  } else if (current === CANDIDATE_ENGINE && v!.high < 0) {
    st.decision = 'demote'; st.live_engine = CONTROL_ENGINE;
    st.reason = `6.5 gains ${bits(-v!.mean)} thousandths of a bit per call over 7.0; the interval excludes zero`;
  } else if (current === CANDIDATE_ENGINE && h && h.high < 0) {
    st.decision = 'demote'; st.live_engine = CONTROL_ENGINE;
    st.reason = `7.0 was right less often than 6.5 (${(st.hit_candidate! * 100).toFixed(1)}% against ${(st.hit_control! * 100).toFixed(1)}%); the interval excludes zero`;
  } else if (current === CONTROL_ENGINE) {
    st.reason = `7.0 over 6.5: ${bits(v!.mean)} thousandths of a bit per call ${span}: not clearly ahead, so 6.5 stays`;
  } else {
    st.reason = `7.0 over 6.5: ${bits(v!.mean)} thousandths of a bit per call ${span}: not clearly behind, so 7.0 stays`;
  }
  // a verified edge: the version that will be shown gains over the null by a margin clear of zero.
  // The ledger's own record settles it only when it is decisive either way; until then what was
  // established before it stands (the caller keeps the earlier status when this is null).
  const shown = st.live_engine === CANDIDATE_ENGINE ? k0 : c0;
  st.verified = enough && shown ? (shown.low > 0 ? true : shown.high < 0 ? false : null) : null;
  return st;
}

/** The rule applied to a set of rows in one go (every scored day counted). */
export function summarise(read: ReadName, rows: LedgerRow[], current: EngineId): ReadStatus {
  return decide(read, foldDays(EMPTY_TALLY, read, rows, '9999-12-31'), current);
}

/** One strength map per read and version, pooled across series. Null until there are enough steps. */
export function pooledCalibration(steps: ScoredStep[]): Knots | null {
  if (steps.length < MIN_CALIBRATION_STEPS) return null;
  return strengthKnots(steps.map((s) => s.p), steps.map((s) => s.y));
}

// ---- what every function reads before it shows a number --------------------
/** What the ledger has decided: the version shown per read, the strength maps, and whether each read has a verified edge. Falls back to the defaults on any failure. */
export async function loadLive(base44): Promise<LiveEngines> {
  try {
    const rows = await base44.asServiceRole.entities.EngineStatus.list('-updated_date', 10);
    const live: LiveEngines = { MOVE: DEFAULT_LIVE.MOVE, RANGE: DEFAULT_LIVE.RANGE, calibration: { [CONTROL_ENGINE]: {}, [CANDIDATE_ENGINE]: {} }, verified: { ...DEFAULT_LIVE.verified } };
    for (const read of READS) {
      const row = (rows || []).find((r) => r.read === read);
      if (!row) continue;
      if (ENGINES.includes(row.live_engine)) live[read] = row.live_engine;
      if (typeof row.verified === 'boolean') live.verified![read] = row.verified;
      for (const [engine, field] of [[CANDIDATE_ENGINE, 'calibration'], [CONTROL_ENGINE, 'calibration_control']] as [EngineId, string][]) {
        if (row[field]) { try { live.calibration![engine]![read] = JSON.parse(row[field]); } catch { /* ignore */ } }
      }
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
