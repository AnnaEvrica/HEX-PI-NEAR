export function fitStrength(ps: number[], ys: number[]): (s: number) => number {
  return fitIsotonic(ps.map(strength), ps.map((p, i) => ((isUp(p) ? 1 : 0) === ys[i] ? 1 : 0)));
}
/** The same map as knots, to store. */
export function strengthKnots(ps: number[], ys: number[]): Knots {
  return isotonicKnots(ps.map(strength), ps.map((p, i) => ((isUp(p) ? 1 : 0) === ys[i] ? 1 : 0)));
}
/** Restate the strength of a call; the side stays where HEX put it. */
export function restate(p: number, map: (s: number) => number): number {
  const s = Math.min(STRENGTH_CEIL, Math.max(STRENGTH_FLOOR, map(strength(p))));
  return isUp(p) ? s : 1 - s;
}
