// ===========================================================================
// CER — the causal walk-forward. HEX 7.0 is walked exactly as the product
// walks it; beside every one of its calls CER makes its own, standalone and
// as the fusion candidate, and all of them are scored on the same outcome.
// Nothing here writes to CallLedger or EngineStatus, and nothing returned
// here is shown to a user: this is the shadow path.
// ===========================================================================
import { observeBaseline, ReadName } from '../observer.ts';
import { walkHex7 } from '../hex7.ts';
import { coordinates, features } from './align.ts';
import { edgeWeights } from './graph.ts';
import { temperatures, walkCer } from './inference.ts';
import { CER_VERSION, Channel, Weighting } from './types.ts';

const LN2 = Math.log(2);
const bits = (p: number, q: number, y: number) => (Math.log(y ? p : 1 - p) - Math.log(y ? q : 1 - q)) / LN2;

export interface ShadowCall {
  /** Index into the target's changes, and its tick. */
  i: number; day: number;
  /** The outcome; undefined for the call that has not been scored yet. */
  y?: number;
  null_probability: number; hex_probability: number;
  /** CER from the neighbours alone, and on top of HEX's call. */
  cer_probability: number; fusion_probability: number;
  /** Neighbours present at the call. Zero means CER had nothing to read and both of its calls equal their offsets. */
  present: number;
}
export interface ShadowReplay {
  cer_version: string; target: string; read: ReadName; lag: number; neighbours: string[]; weighting: Weighting;
  calls: ShadowCall[];
  /** Mean information gain in bits per call over the scored calls with a neighbour present. */
  gain: { calls: number; hex_over_null: number; cer_over_null: number; fusion_over_hex: number };
  /** Final share of [offset, pool, each neighbour] under the reliability weighting, standalone and fusion. */
  share: { standalone: number[]; fusion: number[] };
}

/**
 * Walk one target forward with CER in shadow.
 * @param lag        0: a neighbour's value of the same tick may be used. 1: only earlier ticks. Use 1 unless every channel is known to be complete before the target's call is made.
 * @param weighting  'measurement' (the default): each edge is heard at its measured weight w = A.L.C.Q.
 *                   'relaxation', 'relaxation-tempered': the maximum-entropy distribution over interpretations at T = 1, or at the validated temperature.
 *                   'reliability': the voices are combined by past predictive success. Kept for comparison.
 */
export function shadowReplay(target: Channel, neighbours: Channel[], read: ReadName, lag = 1, weighting: Weighting = 'measurement'): ShadowReplay {
  for (const n of neighbours) if (!n.Z) coordinates(n);
  const r = target.changes, { steps, final } = walkHex7(r, read, observeBaseline(r, read));
  const all = final ? [...steps.map((s) => ({ i: s.i, p: s.p, b: s.b, y: s.y as number | undefined })), { i: r.length - 1, p: final.p, b: final.b, y: undefined }] : steps.map((s) => ({ i: s.i, p: s.p, b: s.b, y: s.y as number | undefined }));
  const tdays = all.map((s) => target.days[s.i]), y = steps.map((s) => s.y), { F, M } = features(tdays, neighbours, lag);
  const ew = weighting === 'reliability' ? undefined : edgeWeights(tdays, target, neighbours, lag, read), relax = ew ? { E: ew.E, T: temperatures(ew.E, M) } : undefined;
  const alone = walkCer(all.map((s) => s.b), y, F, M, false, ew?.W, relax), fused = walkCer(all.map((s) => s.p), y, F, M, false, ew?.W, relax);
  const pick = (s: { p: number; pq?: number; pe?: number; pt?: number }) => (weighting === 'measurement' ? s.pq! : weighting === 'relaxation' ? s.pe! : weighting === 'relaxation-tempered' ? s.pt! : s.p);
  const calls: ShadowCall[] = all.map((s, t) => ({ i: s.i, day: tdays[t], y: s.y, null_probability: s.b, hex_probability: s.p, cer_probability: pick(alone.steps[t]), fusion_probability: pick(fused.steps[t]), present: M[t].filter(Boolean).length }));
  const scored = calls.filter((c) => c.y !== undefined && c.present > 0), mean = (f: (c: ShadowCall) => number) => (scored.length ? scored.reduce((s, c) => s + f(c), 0) / scored.length : 0);
  return {
    cer_version: CER_VERSION, target: target.id, read, lag, weighting, neighbours: neighbours.map((n) => n.id), calls,
    gain: { calls: scored.length, hex_over_null: mean((c) => bits(c.hex_probability, c.null_probability, c.y!)), cer_over_null: mean((c) => bits(c.cer_probability, c.null_probability, c.y!)), fusion_over_hex: mean((c) => bits(c.fusion_probability, c.hex_probability, c.y!)) },
    share: { standalone: alone.share, fusion: fused.share },
  };
}
