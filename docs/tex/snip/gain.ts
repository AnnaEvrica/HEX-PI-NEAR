export const logScore = (p: number, y: number) => Math.log(y ? Math.min(0.99, Math.max(0.01, p)) : 1 - Math.min(0.99, Math.max(0.01, p)));
/** Information gain of p over q on one outcome, in nats: ln p(y) - ln q(y). Divide by ln 2 for bits. */
export const informationGain = (p: number, q: number, y: number) => logScore(p, y) - logScore(q, y);

/**
 * Running sums for a per-call mean with days as the unit of uncertainty:
 * calls made on the same day move together, so a day's calls enter as one
 * cluster. For day totals S_d over n_d calls, the mean is m = sum S_d / sum n_d
 * and its standard error is sqrt( D/(D-1) * sum (S_d - m n_d)^2 ) / sum n_d.
 */
export interface Clustered { n: number; days: number; s: number; ss: number; sn: number; nn: number }
export const EMPTY_CLUSTERED: Clustered = { n: 0, days: 0, s: 0, ss: 0, sn: 0, nn: 0 };
export function addDay(c: Clustered, dayTotal: number, dayCalls: number): Clustered {
  return { n: c.n + dayCalls, days: c.days + 1, s: c.s + dayTotal, ss: c.ss + dayTotal * dayTotal, sn: c.sn + dayTotal * dayCalls, nn: c.nn + dayCalls * dayCalls };
}
/** The mean per call and its interval at z standard errors; null until there are two days. */
export function clusteredMean(c: Clustered, z = 1.96): { mean: number; low: number; high: number } | null {
  if (c.days < 2 || !c.n) return null;
  const m = c.s / c.n, se = Math.sqrt(Math.max(0, c.ss - 2 * m * c.sn + m * m * c.nn) * c.days / (c.days - 1)) / c.n;
  return { mean: m, low: m - z * se, high: m + z * se };
}
