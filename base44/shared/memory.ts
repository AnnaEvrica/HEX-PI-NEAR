// ===========================================================================
// The Learning Module: the MEMORY LIBRARY, and the one stage of the nightly
// calibration that writes to it (stage 5, Experiential Integration).
//
//   MomentMemory        one row per series per finished bar: the moment as it
//                       was perceived, and how it stood against the moments
//                       before it. Appended, never changed.
//   NightlyCalibration  one row per night: the summary. Appended, never changed.
//
// The mathematics is in experience.ts (pure). This file only reads and writes.
// It runs CER's perception and no forecast. Nothing it writes is read by the
// engine, by CER's weights, by governance or by any function a person sees.
// ===========================================================================
import { channel } from './cer/normalize.ts';
import { prepare } from './cer/graph.ts';
import { countUpTo } from './cer/align.ts';
import { CER_VERSION } from './cer/types.ts';
import type { Channel } from './cer/types.ts';
import { momentOf, experience, nightly, canonical, sha256hex, referenceTier, tier, REFERENCE, DISPERSION_WINDOW, TIERS, SIGNATURE_VERSION, DISTANCE_VERSION, BANDWIDTH_VERSION, METRIC_VERSION } from './experience.ts';
import type { Experience, Remembered, Signature } from './experience.ts';

/** One tracked series as the night fetched it: finished bars only. returns[i] is the log return into timestamps[i + 1] (seconds). */
export interface NightSeries { ticker: string; returns: number[]; timestamps: number[] }
export interface NightContext { date?: string; engine_version: string; status?: Record<string, any>; failed?: string[] }

const ENVIRONMENT = 'market', PROVENANCE = 'yahoo-finance daily bars';
const iso = (day: number) => new Date(day * 86400000).toISOString().slice(0, 10);
const put = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined && !(typeof v === 'number' && !Number.isFinite(v))));

/** Channels from the night's series. A series whose bars are out of order or hold a non-finite change is left out and named. */
export function nightChannels(series: NightSeries[]): { channels: Channel[]; last: Record<string, number>; left_out: string[] } {
  const channels: Channel[] = [], last: Record<string, number> = {}, left_out: string[] = [];
  for (const s of series) {
    const days = s.timestamps.slice(1).map((t) => Math.floor(t / 86400));
    const ok = s.returns.length > 0 && days.length === s.returns.length && s.returns.every(Number.isFinite) && days.every((d, i) => i === 0 || d > days[i - 1]);
    if (!ok) { left_out.push(s.ticker); continue; }
    channels.push(prepare(channel(s.ticker, ENVIRONMENT, days, s.returns, 'log return', PROVENANCE))); last[s.ticker] = s.timestamps[s.timestamps.length - 1];
  }
  return { channels, last, left_out };
}

const remembered = (r: any): Remembered | null => { try { return { id: r.moment_id, as_of: r.as_of_day, signature: JSON.parse(r.signature), seq: r.seq }; } catch { return null; } };
const storedExperience = (r: any): Experience => ({
  metric: r.metric_version, distance: r.distance_version, bandwidth: r.bandwidth_version, individuality: r.individuality ?? null, nearest_prior: r.nearest_prior ?? null, nearest_components: null,
  reference_count: r.reference_count ?? 0, reference_full: !!r.reference_full, incomparable: r.incomparable ?? 0, affinity_nearest: r.affinity_nearest ?? null, affinity_median: r.affinity_median ?? null,
  affinity_quartiles: r.affinity_q25 === undefined || r.affinity_q25 === null ? null : [r.affinity_q25, r.affinity_q75],
  transition: r.transition ?? null, transition_components: null, transition_days: r.transition_days ?? null, transition_rate: r.transition_rate ?? null, previous: r.previous ?? null,
});

/**
 * The earlier moments a new one is compared with: the previous one, and the
 * tiers its reference is drawn from. `recent`: the series' latest rows, most
 * recent first. Never reads the library whole: at most 2 x REFERENCE rows.
 */
export async function loadHistory(M: any, series_id: string, recent: any[]): Promise<Remembered[]> {
  if (!recent.length) return [];
  const n = recent[0].seq ?? recent.length, j = referenceTier(n), q = { series_id, signature_version: SIGNATURE_VERSION };
  let rows: any[] = recent;
  if (n > recent.length && j === 0) rows = (await M.filter(q, '-as_of_day', 2 * REFERENCE)) || [];
  else if (j > 0) { rows = [recent[0]]; for (let t = j; t <= TIERS && 2 ** t <= n; t++) rows.push(...((await M.filter({ ...q, tier: t }, '-as_of_day', 2 * REFERENCE)) || [])); }
  const seen = new Set<string>(), out: Remembered[] = [];
  for (const r of rows) { if (seen.has(r.moment_id)) continue; seen.add(r.moment_id); const h = remembered(r); if (h) out.push(h); }
  return out.sort((a, b) => (b.seq ?? 0) - (a.seq ?? 0));
}

/**
 * Stage 5. For every series fetched tonight: perceive its moment on its last
 * finished bar with every other series as a neighbour, compare it with the
 * library, append it. Then append the night's summary. A night already
 * recorded writes nothing; a moment already recorded is never written again.
 */
export async function integrateExperience(base44: any, series: NightSeries[], ctx: NightContext) {
  const started = Date.now(), M = base44.asServiceRole.entities.MomentMemory, N = base44.asServiceRole.entities.NightlyCalibration;
  const date = ctx.date ?? new Date().toISOString().slice(0, 10), run_id = date;
  if (((await N.filter({ run_id })) || []).length) return { ok: true, run_id, recorded: false, reason: 'this night is already recorded', moments: 0 };

  const { channels, last, left_out } = nightChannels(series);
  const rows: { E: Experience; channels: string[] }[] = [], recent: Record<string, Signature[]> = {}, hashes: Record<string, string> = {}, without: string[] = [...left_out], unchanged: string[] = [];
  for (const target of channels) {
    const others = channels.filter((c) => c !== target), upto = target.days[target.days.length - 1], moment_id = `${target.id}|${iso(upto)}|${SIGNATURE_VERSION}`;
    const stored = ((await M.filter({ moment_id })) || [])[0];
    if (stored) {       // this bar was met before: nothing is written. If it was tonight (a run that stopped half way), it still counts in tonight's summary
      if (stored.run_id === run_id) { const h = remembered(stored); if (h) { rows.push({ E: storedExperience(stored), channels: h.signature.channels }); hashes[target.id] = stored.signature_hash; recent[target.id] = [h.signature]; } }
      else unchanged.push(target.id);
      continue;
    }
    const latest = ((await M.filter({ series_id: target.id, signature_version: SIGNATURE_VERSION }, '-as_of_day', DISPERSION_WINDOW)) || []) as any[];
    const prev = latest[0];
    if (prev && prev.as_of_day >= upto) { unchanged.push(target.id); continue; }
    const got = momentOf(target, others, upto);
    if (!got) { without.push(target.id); continue; }
    const sig = got.signature;
    // the step is counted on from the previous moment, so it stays the same coordinate when the fetched history rolls forward
    if (prev) sig.step = prev.step + (countUpTo(target.days, upto) - countUpTo(target.days, prev.as_of_day));
    const seq = prev ? (prev.seq ?? latest.length) + 1 : 1, history = await loadHistory(M, target.id, latest), E = experience(sig, history), signature_hash = await sha256hex(canonical(sig));
    await M.create(put({
      moment_id, run_id, series_id: target.id, as_of: iso(upto), as_of_day: upto, seq, tier: tier(seq), bar_time: last[target.id], step: sig.step, samples: sig.samples,
      environment: ENVIRONMENT, provenance: PROVENANCE, channels: sig.channels.join(','), signature: JSON.stringify(sig), signature_hash,
      intrinsic_tail: got.novelty.intrinsic_tail, joint_tail: got.novelty.joint_tail, relational_surprisal: got.novelty.relational_surprisal,
      individuality: E.individuality, nearest_prior: E.nearest_prior, reference_count: E.reference_count, reference_full: E.reference_full, incomparable: E.incomparable,
      affinity_nearest: E.affinity_nearest, affinity_median: E.affinity_median, affinity_q25: E.affinity_quartiles?.[0], affinity_q75: E.affinity_quartiles?.[1],
      transition: E.transition, transition_days: E.transition_days, transition_rate: E.transition_rate, previous: E.previous,
      components: JSON.stringify({ nearest: E.nearest_components, transition: E.transition_components }),
      cer_version: CER_VERSION, signature_version: SIGNATURE_VERSION, distance_version: DISTANCE_VERSION, bandwidth_version: BANDWIDTH_VERSION, metric_version: METRIC_VERSION,
    }));
    rows.push({ E, channels: sig.channels }); hashes[target.id] = signature_hash;
    recent[target.id] = [sig, ...latest.map((r) => remembered(r)?.signature).filter((s): s is Signature => !!s)].slice(0, DISPERSION_WINDOW);
  }

  // replay integrity: perceive one of tonight's moments again from the raw bars and compare its hash with the one stored
  let integrity: Record<string, unknown> = { checked: false };
  const probe = series.find((s) => hashes[s.ticker] && recent[s.ticker]?.length);
  if (probe) {
    const again = nightChannels(series).channels, t = again.find((c) => c.id === probe.ticker)!, got = momentOf(t, again.filter((c) => c !== t), t.days[t.days.length - 1]);
    if (got) { got.signature.step = recent[probe.ticker][0].step; integrity = { checked: true, series: probe.ticker, reproduced: (await sha256hex(canonical(got.signature))) === hashes[probe.ticker] }; }
  }
  const before = ((await N.list('-date', 1)) || [])[0];
  let chain_before = ''; try { chain_before = JSON.parse(before?.experience_reference ?? '{}').chain ?? ''; } catch { /* the chain starts here */ }
  const chain = await sha256hex(`${chain_before}|${run_id}|${Object.keys(hashes).sort().map((k) => `${k}:${hashes[k]}`).join(',')}`);
  const sum = nightly(rows, recent), st = ctx.status ?? {};
  const pick = (keys: string[]) => Object.fromEntries(Object.entries(st).map(([read, s]) => [read, Object.fromEntries(keys.map((k) => [k, (s as any)?.[k] ?? null]))]));
  await N.create(put({
    run_id, date, timezone: 'UTC', engine_version: ctx.engine_version, cer_version: CER_VERSION, moment_count: sum.moment_count,
    hex_precision: JSON.stringify(pick(['bits_candidate', 'bits_candidate_low', 'bits_candidate_high', 'bits_control', 'gain', 'gain_low', 'gain_high', 'hit_candidate', 'hit_control', 'hit_baseline', 'paired_calls', 'paired_days'])),
    individuality: JSON.stringify(sum.individuality), transitions: JSON.stringify(sum.transitions), dispersion: JSON.stringify(sum.dispersion), affinities: JSON.stringify(sum.affinities), continuity: JSON.stringify(sum.continuity),
    experience_reference: JSON.stringify({ moments: hashes, previous_run: before?.run_id ?? null, chain }),
    replay_integrity: JSON.stringify({ ...integrity, engine_version: ctx.engine_version, cer_version: CER_VERSION }),
    measurement_coverage: JSON.stringify({ ...sum.measurement_coverage, series_fetched: series.length, not_fetched: ctx.failed ?? [], without_a_moment: without, no_new_bar: unchanged }),
    metric_version: METRIC_VERSION, distance_version: DISTANCE_VERSION, bandwidth_version: BANDWIDTH_VERSION, signature_version: SIGNATURE_VERSION,
    governance_reference: JSON.stringify(pick(['live_engine', 'decision', 'reason', 'verified'])), elapsed_ms: Date.now() - started,
  }));
  return { ok: true, run_id, recorded: true, moments: sum.moment_count, without_a_moment: without, no_new_bar: unchanged, integrity, elapsed_ms: Date.now() - started };
}
