// ===========================================================================
// HEX PIPELINE — the single entry point from a numeric series to what the
// language model is told.
//
//   1. Probability  (probabilityRead.ts -> engines.ts)
//      The only numbers HEX states: P(next move up) and P(next move larger
//      than usual), each beside its usual odds.
//   2. Voice        (piusEngine.ts, piusResonance.ts)
//      How to speak about the read. No numbers of its own.
//   3. Chart lens   (chartContext.ts)
//      Whether the chart structure lines up with the direction read, and the
//      move over a long lookback. Descriptive; it never changes a probability.
// ===========================================================================

import { readProbability, seriesToReturns, ProbabilityRead } from './probabilityRead.ts';
import { DEFAULT_LIVE, LiveEngines } from './engines.ts';
import { calibrate, PiUsResult } from './piusEngine.ts';
import { resonanceSignature, ResonanceSignature } from './piusResonance.ts';
import { confluenceAgrees, ChartContext } from './chartContext.ts';

/** Bars in the long lookback described to the model in plain words. */
export const LONG_LOOKBACK_BARS = 137;

export interface ChartLens {
  /** Chart structure against the direction read. */
  structure: 'aligned' | 'mixed' | 'contested';
  /** Move over the long lookback, or null when there is not enough history. */
  long_return: number | null;
  long_phase: 'upward' | 'downward' | 'neutral' | 'insufficient_history';
}

export interface Hex6PipelineResult {
  /** The probabilities HEX may state. Null when the series is too short. */
  read: ProbabilityRead | null;
  pius: PiUsResult;
  resonance: ResonanceSignature | { status: 'insufficient_data'; n_tokens: number };
  lens?: ChartLens;
}

// values:    the raw series, oldest first: levels (prices, temperatures,
//            scores) or step-to-step changes.
// label:     how the series is named to the model ("BTC", "this series").
// messageHistory: the person's earlier messages, for cadence.
// asReturns: true if `values` are already changes, false if levels, undefined
//            to decide from the data (strictly positive = levels).
// live:      which engine is shown for each read (shared/ledger.ts loadLive).
export function runPipeline(
  values: number[],
  label: string | null = null,
  messageHistory: string[] = [],
  asReturns?: boolean,
  live: LiveEngines = DEFAULT_LIVE,
): Hex6PipelineResult {
  const clean = (values || []).filter((v) => Number.isFinite(v));
  const read = readProbability(seriesToReturns(clean, asReturns), live);
  const resonance = messageHistory.length >= 2
    ? resonanceSignature(messageHistory)
    : { status: 'insufficient_data' as const, n_tokens: 0 };
  const pius = calibrate(read, resonance.status === 'computed' ? resonance : null, label || 'this series');
  return { read, pius, resonance };
}

function longLookback(closes: number[]): Pick<ChartLens, 'long_return' | 'long_phase'> {
  if (closes.length < LONG_LOOKBACK_BARS) return { long_return: null, long_phase: 'insufficient_history' };
  const w = closes.slice(-LONG_LOOKBACK_BARS);
  const steps = w.slice(1).map((p, i) => Math.log(p / w[i]));
  const mean = steps.reduce((s, x) => s + x, 0) / steps.length;
  const sd = Math.sqrt(steps.reduce((s, x) => s + (x - mean) ** 2, 0) / steps.length);
  const total = Math.log(w[w.length - 1] / w[0]);
  // The move measured in units of what a drift-free series of this
  // variability would typically cover over the same number of bars.
  const scaled = sd > 0 ? total / (sd * Math.sqrt(steps.length)) : 0;
  return { long_return: Math.exp(total) - 1, long_phase: scaled > 0.5 ? 'upward' : scaled < -0.5 ? 'downward' : 'neutral' };
}

// Add the chart lens. It describes the setup around the read and never
// changes a probability.
export function applyChartLens(result: Hex6PipelineResult, ctx: ChartContext | null, closes: number[] = []): Hex6PipelineResult {
  const leaning = !!result.read && !result.read.direction_at_base;
  const agrees = leaning ? confluenceAgrees(ctx, result.read!.direction) : null;
  const structure = agrees === true ? 'aligned' : agrees === false ? 'contested' : 'mixed';
  const note = !leaning
    ? ' Chart structure (internal, descriptive only): the direction read sits at its usual odds, so describe what the chart is doing without presenting a direction as a call.'
    : structure === 'aligned'
      ? ' Chart structure (internal, descriptive only): it lines up with the direction read. This describes the setup and does not change any probability.'
      : structure === 'contested'
        ? ' Chart structure (internal, descriptive only): it points the other way from the direction read. Say both plainly; neither overrides the other and no probability changes.'
        : ' Chart structure (internal, descriptive only): mixed around the direction read. No probability changes.';
  return { ...result, lens: { structure, ...longLookback(closes) }, pius: { ...result.pius, directive: result.pius.directive + note } };
}
