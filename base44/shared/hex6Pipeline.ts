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

export interface Hex6PipelineResult {
  hex6: Hex6Output;
  pius: PiUsResult;
  resonance: ReturnType<typeof resonanceSignature>;
  domain: string;
}

// Run the full pipeline: hex6Engine → piusResonance → piusEngine.calibrate.
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
  const hex6 = predictFromSequence(domain, values);

  const resonance = messageHistory.length >= 2
    ? resonanceSignature(messageHistory)
    : { status: 'insufficient_data' as const, n_tokens: 0 };

  const pius = calibrate(hex6, resonance.status === 'computed' ? resonance : null);

  return { hex6, pius, resonance, domain };
}