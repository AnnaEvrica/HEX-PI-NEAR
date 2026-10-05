// ===========================================================================
// State probability — the engine. Probability and statistics only.
//
// For a series of step-to-step changes it walks strictly forward and returns:
//   P(next move up)                 from 128 direction states
//                                   (6 up/down lines + a 12-step consensus bit)
//   P(next move larger than usual)  from 64 size states
//                                   (6 lines: |move| above its running median)
// Each is a decayed frequency for the current state, shrunk toward the series'
// own decayed base rate (lambda = 0.999, prior weight K = 100), pooled with
// related states through the symmetry field, then recalibrated by isotonic
// regression fitted only on the series' earlier calls.
//
// It comes pre-trained (pretrainedTables.ts: markets, weather, horse racing)
// and is domain-agnostic: every family's table competes with "no table", each
// weighted by how well it has explained this series' own outcomes.
//
// Learning happens only after an outcome is known: no call sees its future.
//
// state-6.2: the control (see engines.ts). Its numbers were set by hand and
// are frozen; hex.ts is the same idea written as an explicit model.
//
// Walk-forward test, 17 market series, 2016-01 to 2026-09, 46,937 days
// (validation/field.py, validation/field_results.json):
//   direction, 1 day:  Brier 0.2496, skill 0.15% (shuffled data 0.25%) — at chance
//   move size, 1 day:  Brier 0.2396, skill 3.56% (shuffled data 0.00%)
//   calibration error: 0.3% on direction, 0.8% on move size
// With the pre-trained tables (validation/pretrain_standard.py, same test):
//   move size skill 3.57% -> 3.67%, calibration error 0.8% -> 0.5%; direction unchanged
// ===========================================================================

import { PRETRAINED_FAMILIES, PRETRAINED_DIRECTION, PRETRAINED_SIZE } from './pretrainedTables.ts';
import { fitIsotonic } from './isotonic.ts';

export interface StateProbability {
  p_up: number;            // P(next move is up), calibrated
  p_big_move: number;      // P(next move larger than its usual size), calibrated
  base_up: number;         // series' own decayed base rate for "up"
  base_big: number;        // ... and for "big move"
  history: number;         // forward-scored steps behind these numbers
  brier_skill_up: number | null;   // in-series walk-forward Brier skill vs base rate
  brier_skill_big: number | null;
  calibrated: boolean;     // isotonic step applied (needs ≥ 200 scored steps)
  field_up: number;        // current symmetry-field strength α (weighted) on direction
  field_big: number;       // ... and on move size
  /** Which pre-trained family this series behaves like, by weight: none, markets, weather, racing. */
  family_up: Record<string, number>;
  family_big: Record<string, number>;
}

const LAM = 0.999;
const K = 100;
const MIN_CAL = 200;

// ---- Symmetry field --------------------------------------------------------
// Each state's decayed evidence is a charge. Partners pull on it:
//   Coulomb: patterns at Hamming distance d ≤ 2 (same consensus bit), weight 1/d²
//   Mirror:  the complement pattern (all six lines flipped), weight 1, sign −
// p_s = b + (D_s + α·Σ w·σ·D_j) / (N_s + α·Σ |w|·N_j + K)
// Motivation: four field strengths α compete; the one whose symmetric world
// has explained the decayed evidence best gains weight (forgetting G).
// Walk-forward 2016–2026, 17 series: big-move Brier skill 2.7% → 3.6%
// (95% range of gain excludes zero; zero gain on shuffled data).
const ALPHAS = [0, 0.25, 1, 4];
const G = 0.999;

// ---- Pre-trained prior (domain-agnostic) ------------------------------------
// The engine comes pre-trained: PRETRAINED_* hold, for every state, how far
// the outcome has run from the base rate in three families of real data.
// A series is never told which family it is. "No table" and each family's
// table compete (crossed with the field strengths), each weighted by how well
// it has explained this series' own outcomes; a family that does not fit is
// weighted out. "No table" starts with half the weight.
//   p(alpha, f) = b + (D_s + alpha*pull_D + K*delta_f[s]) / (N_s + alpha*pull_N + K)
// Cold-start walk-forward (validation/pretrain.py), Brier skill, scratch -> pre-trained:
//   racing direction 5.3% -> 10.3%; weather direction 1.3% -> 2.2%;
//   market move size 1.1% -> 1.2%; on shuffled data it costs about 0.1%.
// Correction (2 October 2026, validation/core2.py): the racing and weather
// direction figures are scored against the unconditional base rate. A rule
// that uses only the rank of the current level beats them (racing 27.2% log
// skill), so they are not evidence of structure beyond regression to the mean.
const FAMILY_NAMES = ['none', ...PRETRAINED_FAMILIES];
const ZERO128 = new Array(128).fill(0), ZERO64 = new Array(64).fill(0);
const DELTA_D: number[][] = [ZERO128, ...PRETRAINED_DIRECTION];
const DELTA_M: number[][] = [ZERO64, ...PRETRAINED_SIZE];
const NF = FAMILY_NAMES.length, NA = ALPHAS.length, NC = NF * NA;
// log starting weights, family-major: [none x alphas, markets x alphas, ...]
const LOG_W0 = new Float64Array(NC);
for (let f = 0; f < NF; f++) for (let k = 0; k < NA; k++) LOG_W0[f * NA + k] = Math.log((f === 0 ? 0.5 : 0.5 / (NF - 1)) / NA);
function fieldMatrix(bits: number, mirror: boolean, consensus: boolean): Float64Array[] {
  const S = 1 << bits, n = S * (consensus ? 2 : 1);
  const W = Array.from({ length: n }, () => new Float64Array(n));
  for (let s = 0; s < n; s++) {
    const ms = consensus ? s >> 1 : s, cs = consensus ? s & 1 : 0;
    for (let t = 0; t < n; t++) {
      const mt = consensus ? t >> 1 : t, ct = consensus ? t & 1 : 0;
      if (s === t || cs !== ct) continue;
      let x = ms ^ mt, d = 0; while (x) { d += x & 1; x >>= 1; }
      if (mirror && mt === ((S - 1) ^ ms)) W[s][t] -= 1;
      else if (d <= 2) W[s][t] += 1 / (d * d);
    }
  }
  return W;
}
const WD = fieldMatrix(6, true, true);   // direction: 128 states, with mirror
const WM = fieldMatrix(6, false, false); // move size: 64 states, Coulomb only
function fieldCandidates(W: Float64Array[], s: number, D: Float64Array, N: Float64Array, b: number, deltas: number[][]): number[] {
  let pd = 0, pn = 0;
  const row = W[s];
  for (let j = 0; j < row.length; j++) { const w = row[j]; if (w !== 0) { pd += w * D[j]; pn += Math.abs(w) * N[j]; } }
  const out: number[] = new Array(NC);
  for (let f = 0; f < NF; f++) {
    const prior = K * deltas[f][s];
    for (let k = 0; k < NA; k++) out[f * NA + k] = clip(b + (D[s] + ALPHAS[k] * pd + prior) / (N[s] + ALPHAS[k] * pn + K));
  }
  return out;
}
function mixWeights(ll: Float64Array): number[] {
  let m = -Infinity;
  for (let k = 0; k < ll.length; k++) m = Math.max(m, ll[k] + LOG_W0[k]);
  const w = Array.from(ll, (v, k) => Math.exp(v + LOG_W0[k] - m));
  const z = w.reduce((x, y) => x + y, 0);
  return w.map((v) => v / z);
}

const clip = (p: number) => Math.min(0.99, Math.max(0.01, p));

function key128(r: number[], i: number): number {
  let mom = 0;
  for (let j = i - 5; j <= i; j++) mom = (mom << 1) | (r[j] > 0 ? 1 : 0);
  let pos = 0;
  for (let j = i - 11; j <= i; j++) if (r[j] > 0) pos++;
  return (mom << 1) | (pos / 12 > 0.6 ? 1 : 0);
}

/** Walk the series forward. Returns raw per-step calls (for testing) and the final call. */
export function walkStateProbability(r: number[]) {
  const n = r.length;
  const a = r.map(Math.abs);
  // running median of |r| over indices < j (needs 20 values)
  const sorted: number[] = [];
  const medBefore: number[] = new Array(n).fill(NaN);
  for (let j = 0; j < n; j++) {
    if (sorted.length >= 20) {
      const m = sorted.length;
      medBefore[j] = m % 2 ? sorted[(m - 1) / 2] : (sorted[m / 2 - 1] + sorted[m / 2]) / 2;
    }
    let lo = 0, hi = sorted.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid] < a[j]) lo = mid + 1; else hi = mid; }
    sorted.splice(lo, 0, a[j]);
  }
  const sizeBit = (j: number) => (!isNaN(medBefore[j]) && a[j] > medBefore[j] ? 1 : 0);
  const sizeKey = (i: number) => { let s = 0; for (let j = i - 5; j <= i; j++) s = (s << 1) | sizeBit(j); return s; };

  const Dd = new Float64Array(128), Nd = new Float64Array(128);
  const Dm = new Float64Array(64), Nm = new Float64Array(64);
  let bu = 0, bn = 0, mu = 0, mn = 0;
  const lld = new Float64Array(NC), llm = new Float64Array(NC);
  const alphaOf = (w: number[]) => w.reduce((acc, v, k) => acc + v * ALPHAS[k % NA], 0);
  const familyOf = (w: number[]) => Object.fromEntries(FAMILY_NAMES.map((name, f) => [name, Number(w.slice(f * NA, (f + 1) * NA).reduce((x, y) => x + y, 0).toFixed(3))]));
  const steps: { p_up: number; b_up: number; y_up: number; p_big: number | null; b_big: number; y_big: number | null }[] = [];
  let final = { p_up: 0.5, b_up: 0.5, p_big: 0.5, b_big: 0.5, field_up: 0, field_big: 0, family_up: familyOf(mixWeights(lld)), family_big: familyOf(mixWeights(llm)) };

  for (let i = 12; i < n; i++) {
    const s = key128(r, i);
    const b = (bu + 1) / (bn + 2);
    const Pd = fieldCandidates(WD, s, Dd, Nd, b, DELTA_D);
    const wd = mixWeights(lld);
    const p = Pd.reduce((acc, v, k) => acc + wd[k] * v, 0);
    const sm = i > 25 ? sizeKey(i) : null;
    const bm = (mu + 1) / (mn + 2);
    const Pm = sm !== null ? fieldCandidates(WM, sm, Dm, Nm, bm, DELTA_M) : null;
    const wm = mixWeights(llm);
    const pm = Pm ? Pm.reduce((acc, v, k) => acc + wm[k] * v, 0) : null;
    if (i + 1 >= n) {
      final = { p_up: p, b_up: b, p_big: pm ?? bm, b_big: bm,
        field_up: alphaOf(wd), field_big: alphaOf(wm),
        family_up: familyOf(wd), family_big: familyOf(wm) };
      break;
    }
    const y = r[i + 1] > 0 ? 1 : 0;
    const ym = !isNaN(medBefore[i + 1]) ? (a[i + 1] > medBefore[i + 1] ? 1 : 0) : null;
    steps.push({ p_up: p, b_up: b, y_up: y, p_big: pm, b_big: bm, y_big: ym });
    // learn only now that the outcome is known: the field strengths that
    // explained it gain weight (decayed), then the states absorb the evidence
    if (Pm && sm !== null && ym !== null) {
      for (let k = 0; k < NC; k++) llm[k] = G * llm[k] + Math.log(ym ? Pm[k] : 1 - Pm[k]);
      for (let k = 0; k < 64; k++) { Dm[k] *= LAM; Nm[k] *= LAM; }
      Dm[sm] += ym - bm; Nm[sm] += 1; mu = mu * LAM + ym; mn = mn * LAM + 1;
    }
    for (let k = 0; k < NC; k++) lld[k] = G * lld[k] + Math.log(y ? Pd[k] : 1 - Pd[k]);
    for (let k = 0; k < 128; k++) { Dd[k] *= LAM; Nd[k] *= LAM; }
    Dd[s] += y - b; Nd[s] += 1; bu = bu * LAM + y; bn = bn * LAM + 1;
  }
  return { steps, final };
}

export function stateProbability(returns: number[]): StateProbability | null {
  const r = returns.filter((v) => Number.isFinite(v));
  if (r.length < 14) return null;
  const { steps, final } = walkStateProbability(r);
  const up = steps.slice(20);
  const big = steps.filter((s) => s.p_big !== null && s.y_big !== null).slice(20);
  const skill = (xs: { p: number; b: number; y: number }[]) => {
    if (xs.length < 50) return null;
    let bp = 0, bb = 0;
    for (const x of xs) { bp += (x.p - x.y) ** 2; bb += (x.b - x.y) ** 2; }
    return bb > 0 ? Number((1 - bp / bb).toFixed(4)) : null;
  };
  let p_up = final.p_up, p_big = final.p_big, calibrated = false;
  if (up.length >= MIN_CAL) { p_up = fitIsotonic(up.map((s) => s.p_up), up.map((s) => s.y_up))(p_up); calibrated = true; }
  if (big.length >= MIN_CAL) p_big = fitIsotonic(big.map((s) => s.p_big as number), big.map((s) => s.y_big as number))(p_big);
  return {
    p_up: Number(p_up.toFixed(4)),
    p_big_move: Number(p_big.toFixed(4)),
    base_up: Number(final.b_up.toFixed(4)),
    base_big: Number(final.b_big.toFixed(4)),
    history: up.length,
    brier_skill_up: skill(up.map((s) => ({ p: s.p_up, b: s.b_up, y: s.y_up }))),
    brier_skill_big: skill(big.map((s) => ({ p: s.p_big as number, b: s.b_big, y: s.y_big as number }))),
    calibrated,
    field_up: Number(final.field_up.toFixed(3)),
    field_big: Number(final.field_big.toFixed(3)),
    family_up: final.family_up,
    family_big: final.family_big,
  };
}
