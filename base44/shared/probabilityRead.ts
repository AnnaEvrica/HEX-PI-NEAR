// ===========================================================================
// Probability read — the single place where a numeric series becomes the
// numbers HEX states. Every caller (chat, Discord signal, X engagement) goes
// through here, so there is one wording and one set of rules.
//
// Rules:
//   - Probability and statistics only. Each probability is shown next to its
//     usual odds (the null). There is no confidence, conviction or exposure.
//   - The numbers come from shared/engines.ts. HEX makes every call; two
//     versions run and the ledger decides which is shown.
//   - HEX is never told what kind of series it is reading.
//   - A read is presented as an edge only where the ledger says the edge is
//     verified: where information gain over the usual odds is clear of zero.
//     One-pass replay, 17 market series, 2016-2026 (validation/replay.py):
//       next-day move size: verified (+0.0043 bits per call over the null)
//       next-day direction: no verified edge
// ===========================================================================

import { runEngines, DEFAULT_LIVE, EngineRun, LiveEngines } from './engines.ts';

/**
 * Minimum step-to-step changes before any probability is stated. Below this
 * the engine has too few scored steps of its own for either number to be more
 * than a placeholder.
 */
export const MIN_RETURNS = 60;
/** Minimum scored walk-forward steps behind a read. */
export const MIN_SCORED_STEPS = 30;
/** A read within this many points of its base rate is reported as "at its usual odds". */
export const NEAR_BASE = 0.02;

/**
 * A run of 7+ numbers written as a list ("101.2, 102.4, 99.8 ..."). A message
 * that merely contains seven numbers (dates, amounts, a phone number) does not
 * qualify. Dates and ranges ("2026-10-02", "10-20") are not read as negative
 * numbers, and thousands separators ("64,250.10") are joined before parsing.
 */
export function extractNumberSeries(text: string): number[] | null {
  if (!text) return null;
  // "64,250.10" -> "64250.10". Only a comma followed by exactly three digits
  // and then a decimal point, a separator or the end counts as a thousands mark.
  const joined = text.replace(/(?<=\d),(?=\d{3}(?:\.\d|[,;]\s|\s|$))/g, '');
  // A number may not start in the middle of a word, date, range or path.
  const NUM = String.raw`(?<![\w/:-]|\d\.)-?\d+(?:\.\d+)?%?(?![\w/:-]|\.\d)`;
  const SEP = String.raw`\s*[,;\s]\s*`;
  const list = new RegExp(`${NUM}(?:${SEP}${NUM}){6,}`, 'g');
  const runs = joined.match(list);
  if (!runs) return null;
  const longest = runs.sort((a, b) => b.length - a.length)[0];
  const values = (longest.match(new RegExp(NUM, 'g')) || []).map((t) => parseFloat(t)).filter(Number.isFinite);
  return values.length >= 7 ? values : null;
}

/**
 * Turn a raw series into step-to-step changes.
 *   asReturns === true   the values are already changes: use as given
 *   asReturns === false  the values are levels: take log changes (or plain
 *                        differences when a level is zero or negative)
 *   asReturns undefined  decide from the data: a series that is strictly
 *                        positive is read as levels, anything else as changes
 */
export function seriesToReturns(values: number[], asReturns?: boolean): number[] {
  const v = (values || []).filter((x) => Number.isFinite(x));
  if (v.length < 2) return [];
  const levels = asReturns === undefined ? v.every((x) => x > 0) : !asReturns;
  if (!levels) return v;
  const positive = v.every((x) => x > 0);
  const out: number[] = [];
  for (let i = 1; i < v.length; i++) out.push(positive ? Math.log(v[i] / v[i - 1]) : v[i] - v[i - 1]);
  return out;
}

/** Sum consecutive changes into n-step changes (for example daily into weekly). */
export function aggregateReturns(returns: number[], n: number): number[] {
  if (n <= 1) return returns.slice();
  const out: number[] = [];
  const start = returns.length % n; // drop the oldest partial block so the newest block is complete
  for (let i = start; i + n <= returns.length; i += n) {
    let s = 0;
    for (let j = i; j < i + n; j++) s += returns[j];
    out.push(s);
  }
  return out;
}

/** The numbers shown, each beside its baseline. */
export interface ReadNumbers {
  p_up: number; base_up: number;
  p_big_move: number; base_big: number;
  /** Forward-scored steps behind the numbers. */
  history: number;
  /** True when there are enough scored steps (200) for the read to be more than early. */
  calibrated: boolean;
}

export interface ProbabilityRead {
  prob: ReadNumbers;
  /** Both engines' calls, and which one is shown for each read. Recorded in the ledger. */
  run: EngineRun;
  direction: 'UP' | 'DOWN';
  /** p_up minus its base rate, signed. */
  edge_up: number;
  /** p_big_move minus its base rate, signed. */
  edge_big: number;
  /** True when the direction read is within NEAR_BASE of its base rate. */
  direction_at_base: boolean;
  /** True when the size read is within NEAR_BASE of its base rate. */
  size_at_base: boolean;
}

const ENOUGH_RECORD = 200;

export function readProbability(returns: number[], live: LiveEngines = DEFAULT_LIVE): ProbabilityRead | null {
  const r = (returns || []).filter((x) => Number.isFinite(x));
  if (r.length < MIN_RETURNS) return null;
  const run = runEngines(r, live);
  if (!run || run.history < MIN_SCORED_STEPS) return null;
  const move = run.calls[run.live.MOVE].MOVE, range = run.calls[run.live.RANGE].RANGE;
  const prob: ReadNumbers = {
    p_up: move.p, base_up: move.baseline, p_big_move: range.p, base_big: range.baseline,
    history: run.history, calibrated: run.history >= ENOUGH_RECORD,
  };
  const edge_up = prob.p_up - prob.base_up;
  const edge_big = prob.p_big_move - prob.base_big;
  return {
    prob, run,
    direction: prob.p_up >= 0.5 ? 'UP' : 'DOWN',
    edge_up,
    edge_big,
    direction_at_base: Math.abs(edge_up) < NEAR_BASE,
    size_at_base: Math.abs(edge_big) < NEAR_BASE,
  };
}

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

/** What the ledger has established about each read, where it has said. */
function verifiedLines(run: EngineRun): string {
  const say = (v: boolean | undefined, name: string) => v === true
    ? `  record for ${name}: verified edge — on the tracked series this read has given what happened more probability than the usual odds did, by a margin clear of zero\n`
    : v === false
      ? `  record for ${name}: NO VERIFIED EDGE — on the tracked series this read has not beaten the usual odds by a margin clear of zero. Say plainly that there is no verified edge here and do not present it as a call\n`
      : '';
  return say(run.verified.MOVE, 'direction') + say(run.verified.RANGE, 'move size');
}

/**
 * The block the language model receives. It carries the numbers and the rules
 * for speaking about them. `label` names the series ("BTC daily", "this series").
 */
export function probabilityBlock(read: ProbabilityRead | null, label = 'this series'): string {
  if (!read) {
    return `PROBABILITY READ: none. ${label} is too short for a probability (it needs at least ${MIN_RETURNS} step-to-step changes). Say so plainly and do not state a probability for it.`;
  }
  const p = read.prob;
  const dirLine = read.direction_at_base
    ? `at its usual odds — there is no measured lean in direction right now; say it is close to its usual odds and do not present a direction as a call`
    : `${Math.abs(read.edge_up * 100).toFixed(1)} points ${read.edge_up > 0 ? 'above' : 'below'} its usual odds`;
  const sizeLine = read.size_at_base
    ? `at its usual odds`
    : `${Math.abs(read.edge_big * 100).toFixed(1)} points ${read.edge_big > 0 ? 'above' : 'below'} its usual odds — ${read.edge_big > 0 ? 'a larger-than-usual move is more likely than normal' : 'a quieter-than-usual move is more likely than normal'}`;
  return `PROBABILITY READ (${label}; walk-forward${p.calibrated ? '' : ', early: fewer than 200 scored steps'}):
  next move up: ${pct(p.p_up)} — usual odds ${pct(p.base_up)} — ${dirLine}
  next move larger than usual: ${pct(p.p_big_move)} — usual odds ${pct(p.base_big)} — ${sizeLine}
  scored steps behind these numbers: ${p.history}
${verifiedLines(read.run)}HOW TO SPEAK ABOUT IT:
  - These are the only probabilities you may state for ${label}. State each one next to its usual odds, in plain words ("about 54%, against a usual 52%"). "Usual odds" here means what this series' own recent behaviour and present position already imply.
  - Probability and statistics only. Never state or imply a confidence level, a conviction, a strength-of-call, or how firmly you hold it. The number and its distance from the usual odds carry everything.
  - Where a record line above says NO VERIFIED EDGE, say so in plain words ("there is no verified edge in direction here") and lead with a read that has one. Where there is no record line, state the numbers without claiming a record either way.
  - Never round a number toward a stronger claim, and never present a direction as a prediction when it sits at its usual odds.`;
}

/** One plain sentence, for places that append the read to finished text. */
export function probabilityLine(read: ProbabilityRead | null, label = ''): string {
  if (!read) return '';
  const p = read.prob;
  const head = label ? `${label}: ` : '';
  return `${head}next move up ${pct(p.p_up)} (usual ${pct(p.base_up)}); larger-than-usual move ${pct(p.p_big_move)} (usual ${pct(p.base_big)}); ${p.history} scored steps.`;
}
