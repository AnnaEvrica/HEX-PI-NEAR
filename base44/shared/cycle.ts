// ===========================================================================
// THE CYCLE — the one structure every call goes through. Nothing about a
// call is decided anywhere else.
//
//   1  CALL     Memory is asked about the step that has not happened. Each
//               part of memory answers on its own (the views); HEX combines
//               them into one probability; the strength of that probability
//               is restated from the record. All of it is written down
//               before the outcome exists.
//   2  OUTCOME  The step happens.
//   3  SCORE    Information gain over the null (the measure everything is
//               decided on). Closeness: how near the stated probability
//               came. Progress: closeness against the version's own record
//               on that series. Reward: the progress when there is some.
//               Never negative.
//   4  REASON   For every miss, the reason is found from the views written
//               down at step 1: which part of memory pointed the wrong way,
//               and whether any part had it right.
//   5  LEARN    Only now is memory updated. Every part that answered at
//               step 1 has its trust multiplied by the probability it gave
//               to what happened, so influence moves to the parts the reason
//               names as right (hex7.ts, hex.ts, observer.ts). The record and the
//               strength map take the call in (ledger.ts, isotonic.ts). A
//               shortfall is kept as a lesson with its reason, for analysis:
//               it is subtracted from nothing.
//
// One identity ties the steps together. For any call,
//   closeness = 0.75 + baseline part + structure part + strength part
// where 0.75 is a coin flip, the baseline part is what the series' own
// record (the null) added, the structure part is what HEX added to that,
// and the strength part is what restating the strength added. The reason
// for a miss is read off the same three layers.
//
// The canonical measure of a call is its INFORMATION GAIN over the null:
//   g = ln p(y) - ln q0(y)
// positive when HEX gave what happened more probability than the series'
// own record did. Summed over calls and divided by ln 2 it is in bits. It
// decides which version is shown and whether a read has a verified edge.
//
// The mathematics is written out in docs/MODEL.md, section 7.
// ===========================================================================

import type { View } from './observer.ts';

/** What was written down at call time, before the outcome. */
export interface Views {
  /** What the series' own record implies: the observer's baseline. */
  baseline: number;
  /** HEX's own probability, before its strength is restated. */
  raw: number;
  /** What each memory length of the baseline said on its own. */
  memories?: View[];
  /** What each of HEX's own models (7.0) or each reading of the six-line state (6.5) said on its own. */
  readings?: View[];
}

// ---- 3. score ---------------------------------------------------------------
/** How near a stated probability came to what happened: 1 certain and right, 0.75 a coin flip, 0 at worst. */
export const closeness = (p: number, y: number) => 1 - (p - y) ** 2;
/** The record a version starts from on a series, before its first call: a coin flip. */
export const START_CLOSENESS = 0.75;
/** Closeness against the average closeness of the same version's earlier calls on the same series and read. */
export const progress = (c: number, recordBefore: number) => c - recordBefore;
/** The progress when there is some; otherwise nothing. Never negative. */
export const rewardOf = (c: number, recordBefore: number) => Math.max(0, progress(c, recordBefore));
/** How far a call fell short of the record, when it did. Analysis only: subtracted from nothing. */
export const lessonOf = (c: number, recordBefore: number) => Math.max(0, -progress(c, recordBefore));

/** Log score of a stated probability: ln of the probability it gave to what happened. Probabilities are kept within [0.01, 0.99]. */
export const logScore = (p: number, y: number) => Math.log(y ? Math.min(0.99, Math.max(0.01, p)) : 1 - Math.min(0.99, Math.max(0.01, p)));
/** Information gain of p over q on one outcome, in nats: ln p(y) - ln q(y). Divide by ln 2 for bits. */
export const informationGain = (p: number, q: number, y: number) => logScore(p, y) - logScore(q, y);

/**
 * Running sums for a per-call mean with days as the unit of uncertainty:
 * calls made on the same day move together, so a day's calls enter as one
 * cluster. For day totals S_d over n_d calls, the mean is m = sum S_d / sum n_d
 * and its standard error is sqrt( D/(D-1) * sum (S_d - m n_d)^2 ) / sum n_d.
 */
export interface Clustered { n: number; days: number; s: number; ss: number; sn: number; nn: number }
export const EMPTY_CLUSTERED: Clustered = { n: 0, days: 0, s: 0, ss: 0, sn: 0, nn: 0 };
export function addDay(c: Clustered, dayTotal: number, dayCalls: number): Clustered {
  return { n: c.n + dayCalls, days: c.days + 1, s: c.s + dayTotal, ss: c.ss + dayTotal * dayTotal, sn: c.sn + dayTotal * dayCalls, nn: c.nn + dayCalls * dayCalls };
}
/** The mean per call and its interval at z standard errors; null until there are two days. */
export function clusteredMean(c: Clustered, z = 1.96): { mean: number; low: number; high: number } | null {
  if (c.days < 2 || !c.n) return null;
  const m = c.s / c.n, se = Math.sqrt(Math.max(0, c.ss - 2 * m * c.sn + m * m * c.nn) * c.days / (c.days - 1)) / c.n;
  return { mean: m, low: m - z * se, high: m + z * se };
}

// ---- 4. reason --------------------------------------------------------------
export type Reason = 'structure' | 'change' | 'blip' | 'outvoted' | 'unseen';
export const REASONS: Reason[] = ['structure', 'change', 'blip', 'outvoted', 'unseen'];
export const REASON_MEANING: Record<Reason, string> = {
  structure: "the series' own record (the null) pointed the right way; what HEX added to it pointed the other way and carried the call",
  change: 'the series had changed: the shorter memories pointed the right way, the longer ones did not, and the call followed the longer',
  blip: 'the recent stretch was unusual: the longer memories pointed the right way, the shorter ones did not, and the call followed the shorter',
  outvoted: 'the memories all pointed the wrong way, but the position rule or one of HEX\'s own models pointed the right way and carried too little influence',
  unseen: 'nothing the engine remembers about this series pointed that way',
};

const sideOf = (p: number) => (p >= 0.5 ? 1 : 0);

/**
 * The reason for a miss, or null when the call was on the right side.
 * Deterministic, and uses only what was written down before the outcome.
 */
export function reasonFor(stated: number, views: Views, outcome: number): Reason | null {
  const right = (p: number) => sideOf(p) === outcome;
  if (right(stated)) return null;
  if (right(views.baseline)) return 'structure';
  const lengths = (views.memories || []).filter((m) => m.label.startsWith('memory:'));
  const at = (ok: boolean) => lengths.map((m, i) => (right(m.p) === ok ? i : -1)).filter((i) => i >= 0);
  const had = at(true), hadNot = at(false);
  if (had.length && hadNot.length) {
    const mean = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;
    return mean(had) < mean(hadNot) ? 'change' : 'blip'; // memories are listed shortest first
  }
  const others = [...(views.memories || []).filter((m) => !m.label.startsWith('memory:')), ...(views.readings || [])];
  if (had.length || others.some((v) => right(v.p))) return 'outvoted';
  return 'unseen';
}

/** The views that were on the right side, by label: the parts of memory the reason names. */
export function rightViews(views: Views, outcome: number): string[] {
  return [...(views.memories || []), ...(views.readings || [])].filter((v) => sideOf(v.p) === outcome).map((v) => v.label);
}

// ---- the identity -----------------------------------------------------------
/** closeness = 0.75 + baseline + structure + strength, exactly. */
export interface Account { baseline: number; structure: number; strength: number }
export function accountOf(stated: number, views: Views, outcome: number): Account {
  const cb = closeness(views.baseline, outcome), cr = closeness(views.raw, outcome), cs = closeness(stated, outcome);
  return { baseline: cb - START_CLOSENESS, structure: cr - cb, strength: cs - cr };
}

// ---- steps 3 and 4 for one call, and the record it leaves --------------------
export interface Record_ { n: number; mean: number }
export const EMPTY_RECORD: Record_ = { n: 0, mean: START_CLOSENESS };

export interface Scored {
  outcome: number;
  right: boolean;
  /** ln of the probability given to what happened, and the gain over the null in nats. */
  log_score: number;
  info_gain: number;
  closeness: number;
  closeness_baseline: number;
  reward: number;
  lesson: number;
  reason: Reason | null;
  account: Account;
  record: Record_;
}

/** Score one call against its outcome and the version's record so far. Pure. */
export function scoreCall(stated: number, views: Views, outcome: number, record: Record_): Scored {
  const c = closeness(stated, outcome);
  const before = record.n ? record.mean : START_CLOSENESS;
  return {
    outcome,
    right: sideOf(stated) === outcome,
    log_score: logScore(stated, outcome),
    info_gain: informationGain(stated, views.baseline, outcome),
    closeness: c,
    closeness_baseline: closeness(views.baseline, outcome),
    reward: rewardOf(c, before),
    lesson: lessonOf(c, before),
    reason: reasonFor(stated, views, outcome),
    account: accountOf(stated, views, outcome),
    record: { n: record.n + 1, mean: record.n ? record.mean + (c - record.mean) / (record.n + 1) : c },
  };
}
