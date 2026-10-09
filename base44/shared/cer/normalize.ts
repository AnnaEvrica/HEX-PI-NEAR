// ===========================================================================
// CER — from raw observations to a channel.
// Units are kept and never converted: every later step works on ranks, which
// have no unit. What is dropped is counted, not hidden.
// ===========================================================================
import type { Channel, SignalObservation } from './types.ts';

export const DAY_MS = 86400000;

/**
 * One channel from its observations (scalar values). Sorted by time; a
 * missing, non-finite or excluded sample is dropped and counted; several
 * samples in one tick keep the one acquired last. The first sample has no
 * change, so the channel starts at the second.
 * @param tick_ms     length of one tick. A day for daily series; shorter for sensors.
 * @param ratio       true for quantities that move in proportion (prices): the change is the log of the ratio.
 * @param excluded    quality flags that remove a sample ('saturated', ...).
 */
export function toChannel(obs: SignalObservation[], opts: { tick_ms?: number; ratio?: boolean; excluded?: string[] } = {}): Channel {
  const tick = opts.tick_ms ?? DAY_MS, excluded = new Set(opts.excluded ?? []);
  let missing = 0, flagged = 0, duplicates = 0;
  const kept: { t: number; a: number; v: number }[] = [];
  for (const o of obs) {
    const v = typeof o.value === 'number' ? o.value : NaN;
    if (o.missing || !Number.isFinite(v) || (opts.ratio && v <= 0)) { missing++; continue; }
    if ((o.quality ?? []).some((q) => excluded.has(q))) { flagged++; continue; }
    kept.push({ t: Math.floor(o.timestamp / tick), a: o.acquired_at ?? o.timestamp, v });
  }
  kept.sort((x, y) => x.t - y.t || x.a - y.a);
  const days: number[] = [], vals: number[] = [];
  for (const k of kept) {
    if (days.length && days[days.length - 1] === k.t) { vals[vals.length - 1] = k.v; duplicates++; } else { days.push(k.t); vals.push(k.v); }
  }
  const changes: number[] = [], level: number[] = []; let acc = 0;
  for (let i = 1; i < vals.length; i++) { const c = opts.ratio ? Math.log(vals[i] / vals[i - 1]) : vals[i] - vals[i - 1]; changes.push(c); acc += c; level.push(acc); }
  const f = obs[0];
  return {
    id: f ? `${f.environment_id}.${f.channel_id}` : '', env: f?.environment_id ?? '', unit: f?.unit ?? '', source: f?.source_id ?? '',
    days: days.slice(1), changes, level,
    quality: { observations: obs.length, dropped_missing: missing, dropped_flagged: flagged, duplicates },
  };
}

/** A channel from ticks and changes already in hand (replays, tests). */
export function channel(id: string, env: string, days: number[], changes: number[], unit = '', source = ''): Channel {
  const level: number[] = []; let acc = 0;
  for (const c of changes) { acc += c; level.push(acc); }
  return { id, env, unit, source, days, changes, level };
}
