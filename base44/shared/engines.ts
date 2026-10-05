// ===========================================================================
// ENGINES — the one place the two versions of HEX meet.
//
//   state-6.2   HEX with hand-set numbers (stateProbability.ts). The control.
//   state-6.4   HEX as an explicit model with no hand-set numbers (hex.ts),
//               measured against the observer's baseline (observer.ts) and
//               calibrated by the map the nightly job fits from the ledger.
//
// HEX makes every call. The observer never does: it supplies the baseline
// and the ledger supplies the calibration.
//
// Both versions run on every read. Which one a person sees is decided per
// read by the record in the ledger (shared/ledger.ts): 6.4 is shown for a
// read only after the nightly job has promoted it there.
//
// Reads:  MOVE   the next value is higher than this one
//         RANGE  the next change is larger than usual
// Each read is a probability beside its baseline ("usual odds").
// ===========================================================================

import { stateProbability } from './stateProbability.ts';
import { hexProbability, ScoredStep } from './hex.ts';
import type { ReadName } from './observer.ts';
import type { Knots } from './isotonic.ts';

export type EngineId = 'state-6.2' | 'state-6.4';
export type { ReadName };
export const ENGINES: EngineId[] = ['state-6.2', 'state-6.4'];
export const READS: ReadName[] = ['MOVE', 'RANGE'];
export const CONTROL_ENGINE: EngineId = 'state-6.2';
export const CANDIDATE_ENGINE: EngineId = 'state-6.4';

/** One engine's answer to one read. */
export interface EngineCall { p: number; baseline: number }

/** Which version is shown for each read, and the stored calibration for 6.4. */
export interface LiveEngines {
  MOVE: EngineId;
  RANGE: EngineId;
  /** Pooled calibration maps for 6.4 on daily market series; absent until the nightly job has fitted them. */
  calibration?: { MOVE?: Knots | null; RANGE?: Knots | null };
}
/**
 * What is shown before the ledger has a record of its own.
 * Move size starts on 6.4: on ten years of market history replayed night by
 * night the promotion rule chose it and never took it down
 * (validation/loop_sim_side.py), and it is right at least as often as 6.2 in
 * every domain measured. Direction starts on 6.2: on that record the rule
 * never chose 6.4. From the first night the ledger keeps score either way and
 * can change both.
 */
export const DEFAULT_LIVE: LiveEngines = { MOVE: CONTROL_ENGINE, RANGE: CANDIDATE_ENGINE };

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
  /** 6.4's scored steps, for the nightly pooled calibration. */
  candidateSteps: { MOVE: ScoredStep[]; RANGE: ScoredStep[] };
}

/** Run both versions on a series of step-to-step changes. Null when it is too short for either. */
export function runEngines(returns: number[], live: LiveEngines = DEFAULT_LIVE): EngineRun | null {
  const s = stateProbability(returns);
  const k = hexProbability(returns, live.calibration);
  if (!s || !k) return null;
  return {
    calls: {
      'state-6.2': { MOVE: { p: s.p_up, baseline: s.base_up }, RANGE: { p: s.p_big_move, baseline: s.base_big } },
      'state-6.4': { MOVE: { p: k.p_up, baseline: k.base_up }, RANGE: { p: k.p_big_move, baseline: k.base_big } },
    },
    live: { MOVE: live.MOVE, RANGE: live.RANGE },
    history: s.history,
    family_up: s.family_up, family_big: s.family_big,
    candidateSteps: k.steps,
  };
}
