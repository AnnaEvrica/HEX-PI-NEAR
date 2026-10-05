// ===========================================================================
// ENGINES — the one place the two versions of HEX meet.
//
//   hex-7.0     HEX as a residual on the null: logit p = logit q0 + beta . Z,
//               with continuous ranks for Z, learned online (hex7.ts).
//   state-6.5   the previous engine, frozen: evidence filed under six-line
//               states (hex.ts). Kept unchanged as the comparator.
//
// Both run on every read, on the same null (observer.ts), and both go through
// the same cycle (cycle.ts): call, outcome, score, reason, learn. Which one a
// person sees is decided per read by the record in the ledger (ledger.ts).
// HEX makes every call; the null never does.
//
// Reads:  MOVE   the next value is higher than this one
//         RANGE  the next change is larger than usual
// Each read is a probability beside its usual odds (the null).
// ===========================================================================

import { hexProbability } from './hex.ts';
import { hex7Probability, ScoredStep } from './hex7.ts';
import type { ReadName } from './observer.ts';
import type { Knots } from './isotonic.ts';
import type { Views } from './cycle.ts';

export type EngineId = 'state-6.5' | 'hex-7.0';
export type { ReadName };
export const ENGINES: EngineId[] = ['state-6.5', 'hex-7.0'];
export const READS: ReadName[] = ['MOVE', 'RANGE'];
/** The frozen comparator, and the engine measured against it. */
export const CONTROL_ENGINE: EngineId = 'state-6.5';
export const CANDIDATE_ENGINE: EngineId = 'hex-7.0';

/** One engine's answer to one read: what is stated, the usual odds, and what each part of its memory said. */
export interface EngineCall { p: number; baseline: number; views: Views }

type Maps = { MOVE?: Knots | null; RANGE?: Knots | null };
/** What the ledger has decided: which version is shown per read, each version's strength map, and whether the read has a verified edge. */
export interface LiveEngines {
  MOVE: EngineId;
  RANGE: EngineId;
  /** Strength maps pooled over the tracked daily series, per engine; absent until the nightly job has fitted them. */
  calibration?: Partial<Record<EngineId, Maps>>;
  /** Whether the shown version's information gain over the null is clear of zero on the tracked series. */
  verified?: { MOVE?: boolean; RANGE?: boolean };
}
/**
 * What is shown before the ledger has a record of its own, from the one-pass
 * replay (validation/replay.py, 2016-2026, 17 market series started from
 * nothing, and series never used before):
 *   RANGE  7.0. Its information gain over 6.5 is clear of zero and the
 *          ledger's rule switches to it in October 2019 and never back.
 *          Verified: its gain over the null is clear of zero.
 *   MOVE   7.0. On markets it is level with 6.5 and neither has an edge over
 *          the null, so the read is marked not verified. On temperature
 *          series, including three stations never used before, 7.0 is far
 *          ahead of 6.5, so it is the better default for a series the ledger
 *          does not track.
 * From the first night the ledger keeps score and can change all of this.
 */
export const DEFAULT_LIVE: LiveEngines = { MOVE: CANDIDATE_ENGINE, RANGE: CANDIDATE_ENGINE, verified: { MOVE: false, RANGE: true } };

/** The same selection with nothing that was learned from the tracked daily series: for a series of another kind. */
export const withoutCalibration = (live: LiveEngines): LiveEngines => ({ MOVE: live.MOVE, RANGE: live.RANGE });

export interface EngineRun {
  /** Every engine's call for every read. */
  calls: Record<EngineId, Record<ReadName, EngineCall>>;
  /** The engine shown for each read. */
  live: { MOVE: EngineId; RANGE: EngineId };
  /** Whether each read has a verified edge, where the ledger has said. */
  verified: { MOVE?: boolean; RANGE?: boolean };
  /** Forward-scored steps behind the numbers. */
  history: number;
  /** What 7.0 has learned on this series: coefficients and present influence, per read. */
  learned: { MOVE: { beta: number[]; influence: number[] }; RANGE: { beta: number[]; influence: number[] } };
  /** Each engine's scored steps on this series, for the nightly pooled strength maps. */
  steps: Record<EngineId, { MOVE: ScoredStep[]; RANGE: ScoredStep[] }>;
}

/** Run both versions on a series of step-to-step changes. Null when it is too short for either. */
export function runEngines(returns: number[], live: LiveEngines = DEFAULT_LIVE): EngineRun | null {
  const k = hexProbability(returns, live.calibration?.[CONTROL_ENGINE]);
  const h = hex7Probability(returns, live.calibration?.[CANDIDATE_ENGINE]);
  if (!k || !h) return null;
  return {
    calls: {
      'state-6.5': { MOVE: { p: k.p_up, baseline: k.base_up, views: k.views.MOVE }, RANGE: { p: k.p_big_move, baseline: k.base_big, views: k.views.RANGE } },
      'hex-7.0': { MOVE: { p: h.p_up, baseline: h.base_up, views: h.views.MOVE }, RANGE: { p: h.p_big_move, baseline: h.base_big, views: h.views.RANGE } },
    },
    live: { MOVE: live.MOVE, RANGE: live.RANGE },
    verified: { ...(live.verified || {}) },
    history: h.history,
    learned: h.learned,
    steps: { 'state-6.5': k.steps, 'hex-7.0': h.steps },
  };
}
