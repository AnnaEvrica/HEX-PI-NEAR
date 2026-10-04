// ===========================================================================
// ENGINES — the one place the two engines meet.
//
//   state-6.2   the 64-state engine (stateProbability.ts). The control.
//   rank-1      the rank core (rankCore.ts). Runs beside it on every call.
//
// Both run on every read. Which one a person sees is decided per read by the
// record in the ledger (shared/ledger.ts): rank-1 is shown for a read only
// after the nightly job has promoted it there. Until then 6.2 is shown and
// rank-1 is recorded silently.
//
// Reads:  MOVE   the next value is higher than this one
//         RANGE  the next change is larger than usual
// Each read is a probability beside its baseline ("usual odds").
// ===========================================================================

import { stateProbability } from './stateProbability.ts';
import { rankProbability, RankStep } from './rankCore.ts';
import type { Knots } from './isotonic.ts';

export type EngineId = 'state-6.2' | 'rank-1';
export type ReadName = 'MOVE' | 'RANGE';
export const ENGINES: EngineId[] = ['state-6.2', 'rank-1'];
export const READS: ReadName[] = ['MOVE', 'RANGE'];
export const CONTROL_ENGINE: EngineId = 'state-6.2';
export const CANDIDATE_ENGINE: EngineId = 'rank-1';

/** One engine's answer to one read. */
export interface EngineCall { p: number; baseline: number }

/** Which engine is shown for each read, and the stored calibration for rank-1. */
export interface LiveEngines {
  MOVE: EngineId;
  RANGE: EngineId;
  /** Pooled calibration maps for rank-1 on daily market series; absent until the nightly job has fitted them. */
  calibration?: { MOVE?: Knots | null; RANGE?: Knots | null };
}
export const DEFAULT_LIVE: LiveEngines = { MOVE: CONTROL_ENGINE, RANGE: CONTROL_ENGINE };

/** The same selection without the stored calibration: for series that are not daily market bars. */
export const withoutCalibration = (live: LiveEngines): LiveEngines => ({ MOVE: live.MOVE, RANGE: live.RANGE });

export interface EngineRun {
  /** Every engine's call for every read. */
  calls: Record<EngineId, Record<ReadName, EngineCall>>;
  /** The engine shown for each read. */
  live: { MOVE: EngineId; RANGE: EngineId };
  /** Forward-scored steps behind the numbers. */
  history: number;
  /** What kind of series this behaves like, worked out by 6.2 from the series alone. */
  family_up: Record<string, number>;
  family_big: Record<string, number>;
  /** rank-1's scored steps, for the nightly pooled calibration. */
  rankSteps: { MOVE: RankStep[]; RANGE: RankStep[] };
}

/** Run both engines on a series of step-to-step changes. Null when it is too short for either. */
export function runEngines(returns: number[], live: LiveEngines = DEFAULT_LIVE): EngineRun | null {
  const s = stateProbability(returns);
  const k = rankProbability(returns, live.calibration);
  if (!s || !k) return null;
  return {
    calls: {
      'state-6.2': { MOVE: { p: s.p_up, baseline: s.base_up }, RANGE: { p: s.p_big_move, baseline: s.base_big } },
      'rank-1': { MOVE: { p: k.p_up, baseline: k.null_up }, RANGE: { p: k.p_big_move, baseline: k.null_big } },
    },
    live: { MOVE: live.MOVE, RANGE: live.RANGE },
    history: s.history,
    family_up: s.family_up, family_big: s.family_big,
    rankSteps: k.steps,
  };
}
