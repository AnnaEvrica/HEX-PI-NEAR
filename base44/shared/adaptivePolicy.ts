import { calibrate } from './piusEngine.ts';
import type { Hex6PipelineResult } from './hex6Pipeline.ts';
import { runArchetypeWalkForward, type HistoricalBars } from './archetypeWalkForward.ts';

export function applyPromotedAdaptivePolicy(result: Hex6PipelineResult, bars: HistoricalBars) {
  const audit = runArchetypeWalkForward(bars);
  if (!audit.promotion.live || !audit.current_adjustment) return { result, policy: audit.promotion };
  const adjustment = audit.current_adjustment;
  const direction = adjustment.adjustedDirection === 1 ? 'UP' : 'DOWN';
  const hex6 = { ...result.hex6, p_up: adjustment.adjustedPUp, predicted_direction: direction };
  const pius = calibrate(hex6, result.resonance.status === 'computed' ? result.resonance : null);
  return { result: { ...result, hex6, pius }, policy: audit.promotion };
}