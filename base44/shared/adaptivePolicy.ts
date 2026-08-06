import { calibrate } from './piusEngine.ts';
import type { Hex6PipelineResult } from './hex6Pipeline.ts';
import { runArchetypeWalkForward, type HistoricalBars } from './archetypeWalkForward.ts';

// One audit, two independently earned rights:
//   direction  — strict gate (accuracy lift + calibration + stability).
//   calibration — the learned ledger sharpened probability on held-out bars,
//                 so it sizes certainty live while the directional call stays
//                 exactly as HEX called it. This is what the walk-forward
//                 actually proved: better probabilities, not a better lean.
export function applyPromotedAdaptivePolicy(result: Hex6PipelineResult, bars: HistoricalBars) {
  const audit = runArchetypeWalkForward(bars);
  const adjustment = audit.current_adjustment;
  if (!adjustment) return { result, policy: audit.promotion };

  if (audit.promotion.live) {
    const hex6 = { ...result.hex6, p_up: adjustment.adjustedPUp, predicted_direction: adjustment.adjustedDirection === 1 ? 'UP' : 'DOWN' };
    const pius = calibrate(hex6, result.resonance.status === 'computed' ? result.resonance : null);
    return { result: { ...result, hex6, pius }, policy: audit.promotion, applied: 'direction_and_calibration' };
  }

  // Time-varying directional right: the learner moves the call only while its
  // rolling recent record is actually beating the raw lean, and hands direction
  // straight back the moment that edge decays. Direction and conviction now
  // adapt together through time instead of one static all-window verdict.
  if (audit.directional_trust?.live) {
    const hex6 = { ...result.hex6, p_up: adjustment.adjustedPUp, predicted_direction: adjustment.liveDirection === 1 ? 'UP' : 'DOWN', personal_call_strength: Math.abs(adjustment.adjustedPUp - 0.5) * 2 };
    const pius = calibrate(hex6, result.resonance.status === 'computed' ? result.resonance : null);
    return { result: { ...result, hex6, pius }, policy: audit.promotion, trust: audit.directional_trust, applied: 'trusted_direction_and_calibration' };
  }

  if (audit.promotion.calibration.live) {
    // Keep HEX's direction untouched; adopt only the sharpened probability,
    // clamped so a contrary learned probability can never silently invert the
    // call — a disagreeing ledger pulls the read toward uncertainty instead.
    const up = result.hex6.predicted_direction === 'UP';
    const pUp = up ? Math.max(0.5, adjustment.adjustedPUp) : Math.min(0.5, adjustment.adjustedPUp);
    const hex6 = { ...result.hex6, p_up: pUp, personal_call_strength: Math.abs(pUp - 0.5) * 2 };
    const pius = calibrate(hex6, result.resonance.status === 'computed' ? result.resonance : null);
    return { result: { ...result, hex6, pius }, policy: audit.promotion, applied: 'calibration_only' };
  }

  return { result, policy: audit.promotion, applied: 'none' };
}