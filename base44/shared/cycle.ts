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
//   3  SCORE    Closeness: how near the stated probability came. Progress:
//               closeness against the version's own record on that series.
//               Reward: the progress when there is some. Never negative.
//   4  REASON   For every miss, the reason is found from the views written
//               down at step 1: which part of memory pointed the wrong way,
//               and whether any part had it right.
//   5  LEARN    Only now is memory updated. Every part that answered at
//               step 1 has its trust multiplied by the probability it gave
//               to what happened, so trust moves to the parts the reason
//               names as right (hex.ts, observer.ts). The record and the
//               strength map take the call in (ledger.ts, isotonic.ts). A
//               shortfall is kept as a lesson with its reason, for analysis:
//               it is subtracted from nothing.
//
// One identity ties the steps together. For any call,
//   closeness = 0.75 + baseline part + state part + strength part
// where 0.75 is a coin flip, the baseline part is what the series' own
// record added, the state part is what the six-line state added to that,
// and the strength part is what restating the strength added. The reason
// for a miss is read off the same three layers.
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
  /** What each reading of the six-line state said on its own. */
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

// ---- 4. reason --------------------------------------------------------------
export type Reason = 'state' | 'change' | 'blip' | 'outvoted' | 'unseen';
export const REASONS: Reason[] = ['state', 'change', 'blip', 'outvoted', 'unseen'];
export const REASON_MEANING: Record<Reason, string> = {
  state: "the series' own record pointed the right way; the six-line state pointed the other way and carried the call",
  change: 'the series had changed: the shorter memories pointed the right way, the longer ones did not, and the call followed the longer',
  blip: 'the recent stretch was unusual: the longer memories pointed the right way, the shorter ones did not, and the call followed the shorter',
  outvoted: 'the memories all pointed the wrong way, but some reading of the state or of position pointed the right way and carried too little trust',
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
  if (right(views.baseline)) return 'state';
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
/** closeness = 0.75 + baseline + state + strength, exactly. */
export interface Account { baseline: number; state: number; strength: number }
export function accountOf(stated: number, views: Views, outcome: number): Account {
  const cb = closeness(views.baseline, outcome), cr = closeness(views.raw, outcome), cs = closeness(stated, outcome);
  return { baseline: cb - START_CLOSENESS, state: cr - cb, strength: cs - cr };
}

// ---- steps 3 and 4 for one call, and the record it leaves --------------------
export interface Record_ { n: number; mean: number }
export const EMPTY_RECORD: Record_ = { n: 0, mean: START_CLOSENESS };

export interface Scored {
  outcome: number;
  right: boolean;
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
    closeness: c,
    closeness_baseline: closeness(views.baseline, outcome),
    reward: rewardOf(c, before),
    lesson: lessonOf(c, before),
    reason: reasonFor(stated, views, outcome),
    account: accountOf(stated, views, outcome),
    record: { n: record.n + 1, mean: record.n ? record.mean + (c - record.mean) / (record.n + 1) : c },
  };
}
