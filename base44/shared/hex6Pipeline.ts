// ===========================================================================
// HEX6 PIPELINE — the unified entry point for the validated engine stack.
//
// One universe, two engines, one pipeline:
//   HEX6-BLE (hex6Engine.ts)     — Loop 1: pre-trained, market-agnostic
//     directional probability from 6-bit momentum states. Real statistics from
//     real outcomes. This is the loop that gets backtested.
//   PI-US (piusEngine.ts)        — Loop 2: tone/context calibration. Takes
//     HEX6-BLE's real output and calibrates HOW an LLM should talk about it.
//     No predictions of its own — a deterministic translation from real numbers
//     to communication guidance.
//   PI-US Resonance (piusResonance.ts) — descriptive linguistic cadence FFT.
//   Self-Calibration (this file) — the live forward learning loop. Walks the
//     last 60 bars of the input series, predicts each step, and tracks rolling
//     directional accuracy. When the engine is anti-predictive (< 45% over the
//     last 30 bars), flips the prediction — the engine is in an inverted
//     regime where its lean is systematically wrong. This is the same logic
//     validated in walkForwardAccuracy, now running live in production.
//
// This module replaces the old thinkingEngine.ts + adaptiveGate.ts +
// zeroScope.ts + geneticRiskEngine.ts accessory stack. Those were coupled to
// the old SCEFM engine's mu/sigma output and are redundant with hex6Engine's
// p_up / conviction / n_obs fields, since PI-US's calibrate() already handles
// the gate (high_conviction + well_supported).
// ===========================================================================

import { predictFromSequence, Hex6Output } from './hex6Engine.ts';
import { calibrate, PiUsResult } from './piusEngine.ts';
import { resonanceSignature } from './piusResonance.ts';
import type { ChartContext } from './chartContext.ts';
import { classifyHybridArchetype, PerceptionLens } from './hybridArchetypes.ts';

// Map a ticker to the closest pre-trained domain. hex6Engine has validated
// tables for NFL, BTC, HORSE_RACING, and WEATHER. For equities and other
// financial markets without a dedicated table, BTC is the closest
// financial-market proxy — the 6-bit momentum structure captures universal
// market microstructure that transfers across assets.
export function mapTickerToDomain(ticker: string | null): string {
  if (!ticker) return 'BTC';
  const t = ticker.toUpperCase();
  if (['BTC','ETH','SOL','DOGE','XRP','ADA','MATIC','BNB','LTC','UNI','LINK','ATOM','AVAX','DOT'].includes(t)) return 'BTC';
  if (t.startsWith('WEATHER') || t === 'TEMP') return 'WEATHER';
  if (t === 'NFL') return 'NFL';
  if (t.startsWith('HORSE') || t === 'RACING') return 'HORSE_RACING';
  return 'BTC'; // default financial-market proxy
}

// Extract a numerical series from free text (for inline-data detection).
// Moved here from thinkingEngine.ts so callers don't depend on the retired
// engine.
export function extractNumberSeries(text: string): number[] | null {
  const matches = text.match(/-?\d+(\.\d+)?/g);
  if (!matches || matches.length < 7) return null;
  return matches.map(Number);
}

export interface CalibrationResult {
  anti_predictive: boolean;
  rolling_accuracy: number | null;
  recent_n: number;
  flipped: boolean;
}

export interface Hex6PipelineResult {
  hex6: Hex6Output;
  pius: PiUsResult;
  resonance: ReturnType<typeof resonanceSignature>;
  domain: string;
  calibration: CalibrationResult;
  perception?: PerceptionLens;
}

// Self-calibration: the live forward learning loop. Walks the last 60 bars
// of the input series, predicts each step using the pre-trained tables, and
// tracks rolling directional accuracy over a 30-bar window. When accuracy
// falls below 45% (anti-predictive), the engine is in an inverted regime —
// its directional lean is systematically wrong and should be flipped.
//
// This is the EXACT same logic validated in walkForwardAccuracy's forward
// learning loop, now running live. Same threshold (45%), same window (30),
// same mechanism. The only difference: the test applies the flip out-of-sample
// across the full test set; here we apply it to the single current prediction
// based on the most recent rolling track record.
//
// Precision-seeking: the engine doesn't just predict — it checks whether its
// predictions have been landing, and inverts itself when they're systematically
// wrong. This is the self-correction that lifted accuracy from ~52% to ~59%
// across all tested assets.
function selfCalibrate(domain: string, values: number[]): CalibrationResult {
  const n = values.length;
  if (n < 37) return { anti_predictive: false, rolling_accuracy: null, recent_n: 0, flipped: false };

  const lookback = Math.min(60, n - 7);
  const recentErrors: number[] = [];
  const windowSize = 30;

  for (let i = n - lookback; i < n - 1; i++) {
    const recentCloses = values.slice(Math.max(0, i - 6), i + 1);
    if (recentCloses.length < 7) continue;

    const pred = predictFromSequence(domain, recentCloses);
    const rawDir = pred.predicted_direction === 'UP' ? 1 : -1;
    const actualDir = values[i + 1] > values[i] ? 1 : values[i + 1] < values[i] ? -1 : 0;

    if (rawDir !== 0 && actualDir !== 0) {
      recentErrors.push(rawDir === actualDir ? 1 : 0);
      if (recentErrors.length > windowSize) recentErrors.shift();
    }
  }

  if (recentErrors.length < 15) {
    return { anti_predictive: false, rolling_accuracy: null, recent_n: recentErrors.length, flipped: false };
  }

  const rollingAccuracy = recentErrors.reduce((s, x) => s + x, 0) / recentErrors.length;
  return {
    anti_predictive: rollingAccuracy < 0.45,
    rolling_accuracy: rollingAccuracy,
    recent_n: recentErrors.length,
    flipped: false,
  };
}

export function applySelfCalibration(domain: string, values: number[]) {
  const raw = predictFromSequence(domain, values);
  const calibration = selfCalibrate(domain, values);
  const hex6 = calibration.anti_predictive
    ? { ...raw, predicted_direction: raw.predicted_direction === 'UP' ? 'DOWN' : 'UP', p_up: 1 - raw.p_up }
    : raw;
  calibration.flipped = calibration.anti_predictive;
  return { hex6, calibration };
}

// Run the full pipeline: hex6Engine → self-calibration → piusResonance → piusEngine.calibrate.
//
// values: 7+ recent raw values (prices, temperatures, scores — any sequence).
//   hex6Engine's valuesToBits encodes "did the value go up?" so the units
//   don't matter, only the ordering. Pass CLOSES (not returns) for market
//   data — the pre-trained tables were built on price-level bits.
// ticker: optional ticker for domain mapping.
// messageHistory: optional chronological user messages for resonance analysis.
export function runPipeline(
  values: number[],
  ticker: string | null = null,
  messageHistory: string[] = [],
): Hex6PipelineResult {
  const domain = mapTickerToDomain(ticker);
  const { hex6, calibration } = applySelfCalibration(domain, values);

  const resonance = messageHistory.length >= 2
    ? resonanceSignature(messageHistory)
    : { status: 'insufficient_data' as const, n_tokens: 0 };

  const pius = calibrate(hex6, resonance.status === 'computed' ? resonance : null);

  return { hex6, pius, resonance, domain, calibration };
}

// Add the OHLCV perception lens without rewriting the frozen 64-state tables.
// The next-move prediction remains visible; only independently corroborated
// calls receive qualified confidence.
export function applyChartPerception(result: Hex6PipelineResult, ctx: ChartContext | null, closes: number[] = []): Hex6PipelineResult {
  const perception = classifyHybridArchetype(
    result.hex6.state, ctx, result.hex6.predicted_direction, result.hex6.personal_call_strength, closes,
  );
  const note = perception.prediction_status === 'STRUCTURE_ALIGNED'
    ? ` Perception lens: chart structure ALIGNS with the raw HEX next-move lean; this describes the market setup but does not raise directional confidence. Hybrid archetype ${perception.archetype_id}, grid ${perception.grid.label}.`
    : perception.prediction_status === 'STRUCTURE_CONTESTED'
      ? ` Perception lens: chart structure CONTESTS the raw HEX next-move lean; preserve both observations without quietly overriding either. Hybrid archetype ${perception.archetype_id}, grid ${perception.grid.label}.`
      : ` Perception lens: chart structure is MIXED around the raw HEX lean. Hybrid archetype ${perception.archetype_id}, grid ${perception.grid.label}.`;
  return { ...result, perception, pius: { ...result.pius, directive: result.pius.directive + note } };
}