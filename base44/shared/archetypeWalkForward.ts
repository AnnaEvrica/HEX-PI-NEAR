import { mapTickerToDomain, applySelfCalibration } from './hex6Pipeline.ts';
import { buildChartContext } from './chartContext.ts';
import { classifyHybridArchetype } from './hybridArchetypes.ts';
import { OnlineArchetypeLearner, type LedgerCounts } from './onlineArchetypeLearner.ts';

export interface HistoricalBars {
  ticker: string;
  closes: number[];
  highs: number[];
  lows: number[];
  volumes: number[];
}

type Prediction = { rawDirection: number; adjustedDirection: number; liveDirection: number; trusted: boolean; actualDirection: number; rawPUp: number; adjustedPUp: number; conviction: number; support: number; weight: number; fineStructure137: 'upward' | 'downward' | 'neutral' | 'insufficient_history'; };
const mean = (xs: number[]) => xs.length ? xs.reduce((sum, value) => sum + value, 0) / xs.length : null;
const round = (value: number | null, decimals = 4) => value == null ? null : Number(value.toFixed(decimals));

function promotionGate(metrics: ReturnType<typeof summarize>, recent: ReturnType<typeof summarize>) {
  const lift = metrics.directional_accuracy_lift ?? -1;
  const brierGain = metrics.raw_brier != null && metrics.archetype_adjusted_brier != null ? metrics.raw_brier - metrics.archetype_adjusted_brier : -1;
  const stable = recent.archetype_adjusted_directional_accuracy != null && recent.raw_directional_accuracy != null && recent.archetype_adjusted_directional_accuracy >= recent.raw_directional_accuracy;
  const rules = { minimum_predictions: metrics.predictions >= 400, minimum_accuracy_lift: lift >= 0.015, calibration_improves: brierGain >= 0.002, final_quarter_stable: stable };
  // Two separate verdicts from one audit. Direction is the strict gate above.
  // Calibration is its own earned right: when the learned ledger measurably
  // sharpens probability (Brier) on enough held-out bars, that knowledge goes
  // live as certainty sizing — without ever moving the directional call.
  const recentBrierGain = recent.raw_brier != null && recent.archetype_adjusted_brier != null ? recent.raw_brier - recent.archetype_adjusted_brier : -1;
  const calibrationRules = { minimum_predictions: metrics.predictions >= 400, brier_improves: brierGain >= 0.002, final_quarter_brier_holds: recentBrierGain > 0 };
  return {
    ...rules, live: Object.values(rules).every(Boolean), accuracy_lift: round(lift), brier_improvement: round(brierGain),
    calibration: { ...calibrationRules, live: Object.values(calibrationRules).every(Boolean), final_quarter_brier_improvement: round(recentBrierGain) },
  };
}

function summarize(rows: Prediction[]) {
  const valid = rows.filter((row) => row.actualDirection !== 0);
  const rawAccuracy = mean(valid.map((row) => row.rawDirection === row.actualDirection ? 1 : 0));
  const adjustedAccuracy = mean(valid.map((row) => row.adjustedDirection === row.actualDirection ? 1 : 0));
  const rawBrier = mean(valid.map((row) => (row.rawPUp - (row.actualDirection === 1 ? 1 : 0)) ** 2));
  const adjustedBrier = mean(valid.map((row) => (row.adjustedPUp - (row.actualDirection === 1 ? 1 : 0)) ** 2));
  const liveAccuracy = mean(valid.map((row) => row.liveDirection === row.actualDirection ? 1 : 0));
  return {
    predictions: valid.length,
    trust_gated_directional_accuracy: round(liveAccuracy),
    trust_gated_lift: round(rawAccuracy == null || liveAccuracy == null ? null : liveAccuracy - rawAccuracy),
    trusted_share: round(mean(valid.map((row) => row.trusted ? 1 : 0))),
    raw_directional_accuracy: round(rawAccuracy),
    archetype_adjusted_directional_accuracy: round(adjustedAccuracy),
    directional_accuracy_lift: round(rawAccuracy == null || adjustedAccuracy == null ? null : adjustedAccuracy - rawAccuracy),
    raw_brier: round(rawBrier),
    archetype_adjusted_brier: round(adjustedBrier),
    avg_archetype_support: round(mean(valid.map((row) => row.support))),
    avg_archetype_weight: round(mean(valid.map((row) => row.weight))),
    avg_hex_conviction_unchanged: round(mean(valid.map((row) => row.conviction))),
  };
}

export function runArchetypeWalkForward(bars: HistoricalBars, trainRatio = 0.6, prior: LedgerCounts | null = null) {
  const start = Math.max(120, Math.floor(bars.closes.length * trainRatio));
  const learner = new OnlineArchetypeLearner();
  const rows: Prediction[] = [];
  const early: Prediction[] = [];
  const late: Prediction[] = [];

  for (let index = start; index + 1 < bars.closes.length; index++) {
    const { hex6: raw } = applySelfCalibration(mapTickerToDomain(bars.ticker), bars.closes.slice(0, index + 1));
    const context = buildChartContext(bars.closes.slice(0, index + 1), bars.highs.slice(0, index + 1), bars.lows.slice(0, index + 1), bars.volumes.slice(0, index + 1));
    const lens = classifyHybridArchetype(raw.state, context, raw.predicted_direction, raw.personal_call_strength, bars.closes.slice(0, index + 1));
    const adjustment = learner.adjust(raw.p_up, lens);
    const realized = bars.closes[index + 1] / bars.closes[index] - 1;
    const actualDirection = realized > 0 ? 1 : realized < 0 ? -1 : 0;
    if (actualDirection === 0) continue;
    const row = {
      rawDirection: adjustment.rawDirection,
      adjustedDirection: adjustment.adjustedDirection,
      liveDirection: adjustment.liveDirection,
      trusted: adjustment.trust.live,
      actualDirection,
      rawPUp: raw.p_up,
      adjustedPUp: adjustment.adjustedPUp,
      conviction: raw.personal_call_strength,
      support: adjustment.support,
      weight: adjustment.archetypeWeight,
      fineStructure137: lens.fine_structure_137.phase,
    };
    rows.push(row);
    if (rows.length <= 60) early.push(row); else late.push(row);
    learner.learn(adjustment, actualDirection as -1 | 1);
  }

  const metrics = summarize(rows);
  const recent = summarize(rows.slice(Math.floor(rows.length * 0.75)));
  const { hex6: currentHex } = applySelfCalibration(mapTickerToDomain(bars.ticker), bars.closes);
  const currentContext = buildChartContext(bars.closes, bars.highs, bars.lows, bars.volumes);
  const currentLens = classifyHybridArchetype(currentHex.state, currentContext, currentHex.predicted_direction, currentHex.personal_call_strength, bars.closes);
  // Export FIRST — this asset's row stores only what this asset taught him.
  // Then seed the cross-asset prior, so inherited memory shapes today's live
  // read only, never the held-out rows the metrics above were scored on.
  const ledger = learner.export();
  learner.seedPrior(prior);
  const currentAdjustment = learner.adjust(currentHex.p_up, currentLens);
  return {
    ticker: bars.ticker,
    ledger,
    prior_applied: prior != null,
    historical_bars: bars.closes.length,
    held_out_bars: rows.length,
    learning_protocol: 'empty archetype ledger at held-out start; predict first; update only after the next realized daily close',
    no_confidence_mutation: true,
    direction_ratio_only: true,
    learning_activity: { adjusted_predictions: learner.adjustments, direction_flips: learner.directionFlips },
    promotion: promotionGate(metrics, recent),
    directional_trust: currentAdjustment.trust,
    current_adjustment: currentAdjustment,
    metrics,
    fine_structure_137_regimes: {
      upward: summarize(rows.filter((row) => row.fineStructure137 === 'upward')),
      neutral: summarize(rows.filter((row) => row.fineStructure137 === 'neutral')),
      downward: summarize(rows.filter((row) => row.fineStructure137 === 'downward')),
    },
    maturation_check: { first_60_predictions: summarize(early), later_predictions: summarize(late) },
  };
}

export function summarizeWalkForward(results: ReturnType<typeof runArchetypeWalkForward>[]) {
  const weighted = (field: string) => {
    const total = results.reduce((sum, result) => sum + result.metrics.predictions, 0);
    if (!total) return null;
    return results.reduce((sum, result) => sum + (result.metrics[field] ?? 0) * result.metrics.predictions, 0) / total;
  };
  const weightedRegime = (regime: 'upward' | 'neutral' | 'downward', field: string) => {
    const total = results.reduce((sum, result) => sum + result.fine_structure_137_regimes[regime].predictions, 0);
    if (!total) return null;
    return results.reduce((sum, result) => sum + (result.fine_structure_137_regimes[regime][field] ?? 0) * result.fine_structure_137_regimes[regime].predictions, 0) / total;
  };
  const regimeSummary = (regime: 'upward' | 'neutral' | 'downward') => ({
    predictions: results.reduce((sum, result) => sum + result.fine_structure_137_regimes[regime].predictions, 0),
    raw_directional_accuracy: round(weightedRegime(regime, 'raw_directional_accuracy')),
    archetype_adjusted_directional_accuracy: round(weightedRegime(regime, 'archetype_adjusted_directional_accuracy')),
    raw_brier: round(weightedRegime(regime, 'raw_brier')),
    archetype_adjusted_brier: round(weightedRegime(regime, 'archetype_adjusted_brier')),
  });
  return {
    assets: results.length,
    predictions: results.reduce((sum, result) => sum + result.metrics.predictions, 0),
    raw_directional_accuracy: round(weighted('raw_directional_accuracy')),
    archetype_adjusted_directional_accuracy: round(weighted('archetype_adjusted_directional_accuracy')),
    directional_accuracy_lift: round(weighted('directional_accuracy_lift')),
    raw_brier: round(weighted('raw_brier')),
    archetype_adjusted_brier: round(weighted('archetype_adjusted_brier')),
    direction_flips: results.reduce((sum, result) => sum + result.learning_activity.direction_flips, 0),
    adjusted_predictions: results.reduce((sum, result) => sum + result.learning_activity.adjusted_predictions, 0),
    fine_structure_137_regimes: {
      upward: regimeSummary('upward'), neutral: regimeSummary('neutral'), downward: regimeSummary('downward'),
    },
  };
}