// walkForwardAccuracy — the one-pass test, on live data, on demand.
//
// For each ticker both versions of HEX walk the series one bar at a time:
// every call is made before its outcome is known and learning happens only
// afterwards. Reported per ticker and pooled, for 7.0 and for 6.5:
//   - information gain over the null, in bits per call (the canonical measure)
//   - share of calls right beside the share the null alone gets right
//   - Brier skill over the null, and stated against observed frequencies
// Probabilities here are each engine's own, before any strength map.
//
// POST { tickers?: string[], ticker?: string, lookbackDays?: number }

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { fetchYahooReturns } from '../../shared/marketDataClient.ts';
import { observeBaseline } from '../../shared/observer.ts';
import { walkHex } from '../../shared/hex.ts';
import { walkHex7 } from '../../shared/hex7.ts';
import { informationGain } from '../../shared/cycle.ts';
import { ENGINE_VERSION } from '../../shared/version.ts';

const DEFAULT_BASKET = ['BTC', 'ETH', 'SOL', 'SPY', 'QQQ'];

// The first steps of each series are the engine's first experience of it and
// are reported separately from the rest.
const WARMUP = 250;

function score(pairs) {
  const n = pairs.length;
  if (!n) return null;
  let bp = 0, bb = 0, hits = 0, hitsNull = 0, gain = 0;
  for (const x of pairs) {
    bp += (x.p - x.y) ** 2;
    bb += (x.b - x.y) ** 2;
    gain += informationGain(x.p, x.b, x.y);
    if ((x.p >= 0.5 ? 1 : 0) === x.y) hits++;
    if ((x.b >= 0.5 ? 1 : 0) === x.y) hitsNull++;
  }
  const edges = [0, 0.4, 0.45, 0.55, 0.6, 1.0001];
  const bins = [];
  for (let k = 0; k < edges.length - 1; k++) {
    const inBin = pairs.filter((x) => x.p >= edges[k] && x.p < edges[k + 1]);
    if (!inBin.length) continue;
    bins.push({
      stated: `${Math.round(edges[k] * 100)}–${Math.min(100, Math.round(edges[k + 1] * 100))}%`,
      mean_stated: Number((inBin.reduce((s, x) => s + x.p, 0) / inBin.length).toFixed(4)),
      observed: Number((inBin.reduce((s, x) => s + x.y, 0) / inBin.length).toFixed(4)),
      n: inBin.length,
    });
  }
  return {
    n,
    bits_per_call_over_null: Number((gain / n / Math.log(2)).toFixed(5)),
    right: Number((hits / n).toFixed(4)),
    expected_right: Number((hitsNull / n).toFixed(4)),
    brier: Number((bp / n).toFixed(5)),
    brier_null: Number((bb / n).toFixed(5)),
    brier_skill: bb > 0 ? Number((1 - bp / bb).toFixed(4)) : null,
    reliability: bins,
  };
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const tickers: string[] = (Array.isArray(body.tickers) && body.tickers.length
      ? body.tickers.map((t: unknown) => String(t).trim().toUpperCase()).filter(Boolean)
      : body.ticker ? [String(body.ticker).trim().toUpperCase()] : DEFAULT_BASKET).slice(0, 12);
    const lookbackDays = Math.max(730, Math.min(Number(body.lookbackDays) || 5475, 7300));

    const started = Date.now();
    const perTicker: Record<string, unknown> = {};
    const pooled = { hex_7_0: { MOVE: [], RANGE: [] }, state_6_5: { MOVE: [], RANGE: [] } };
    for (const ticker of tickers) {
      let md = null;
      try { md = await fetchYahooReturns(ticker, lookbackDays); } catch { perTicker[ticker] = { error: 'no data' }; continue; }
      if (!md?.returns || md.returns.length < WARMUP + 100) { perTicker[ticker] = { error: 'not enough history' }; continue; }
      const t0 = Date.now();
      const out = { bars: md.dataPoints, hex_7_0: {}, state_6_5: {}, first_250_steps: {} };
      for (const read of ['MOVE', 'RANGE'] as const) {
        const baseline = observeBaseline(md.returns, read);
        const s7 = walkHex7(md.returns, read, baseline, false, md.returnDays).steps, s65 = walkHex(md.returns, read, baseline).steps;
        const name = read === 'MOVE' ? 'direction' : 'move_size';
        const later = (steps) => steps.slice(WARMUP);
        out.hex_7_0[name] = score(later(s7)); out.state_6_5[name] = score(later(s65));
        out.first_250_steps[name] = score(s7.slice(0, WARMUP));
        pooled.hex_7_0[read].push(...later(s7)); pooled.state_6_5[read].push(...later(s65));
      }
      perTicker[ticker] = { ...out, walk_ms: Date.now() - t0 };
    }

    return Response.json({
      engine_version: ENGINE_VERSION,
      method: 'one pass: each call precedes its outcome and learning follows it; the first 250 calls on each series are reported separately; gain and skill are against the null; probabilities are before any strength map',
      tickers: perTicker,
      pooled: {
        hex_7_0: { direction: score(pooled.hex_7_0.MOVE), move_size: score(pooled.hex_7_0.RANGE) },
        state_6_5: { direction: score(pooled.state_6_5.MOVE), move_size: score(pooled.state_6_5.RANGE) },
      },
      elapsed_ms: Date.now() - started,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
