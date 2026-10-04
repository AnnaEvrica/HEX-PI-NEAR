// walkForwardAccuracy — run both engines' walk-forward test on live data.
//
// For each ticker it replays the calibrated probability read one bar at a
// time: every call is made before its outcome is known, and learning happens
// only afterwards. It reports, per ticker and pooled, the Brier score, the
// Brier skill against the series' own base rate, and stated-versus-observed
// frequencies, on whatever tickers you pass.
//
// POST { tickers?: string[], ticker?: string, lookbackDays?: number }

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { fetchYahooReturns } from '../../shared/marketDataClient.ts';
import { walkStateProbability, stateProbability } from '../../shared/stateProbability.ts';
import { walkRank } from '../../shared/rankCore.ts';
import { ENGINE_VERSION } from '../../shared/version.ts';

const DEFAULT_BASKET = ['BTC', 'ETH', 'SOL', 'SPY', 'QQQ'];

// The first steps of each series are warm-up and are not scored.
const WARMUP = 250;

function score(pairs) {
  const n = pairs.length;
  if (!n) return null;
  let bp = 0, bb = 0, hits = 0;
  for (const x of pairs) {
    bp += (x.p - x.y) ** 2;
    bb += (x.b - x.y) ** 2;
    if ((x.p >= 0.5 ? 1 : 0) === x.y) hits++;
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
    brier: Number((bp / n).toFixed(5)),
    brier_base_rate: Number((bb / n).toFixed(5)),
    brier_skill: bb > 0 ? Number((1 - bp / bb).toFixed(4)) : null,
    hit_rate: Number((hits / n).toFixed(4)),
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

    const perTicker: Record<string, unknown> = {};
    const pooledUp = [], pooledBig = [], rankUp = [], rankBig = [];
    for (const ticker of tickers) {
      let md = null;
      try { md = await fetchYahooReturns(ticker, lookbackDays); } catch { perTicker[ticker] = { error: 'no data' }; continue; }
      if (!md?.returns || md.returns.length < WARMUP + 100) { perTicker[ticker] = { error: 'not enough history' }; continue; }
      // Raw walk-forward steps (before the isotonic step, which is fitted on
      // earlier calls at read time). Each step was made before its outcome.
      const { steps } = walkStateProbability(md.returns);
      const scoredSteps = steps.slice(WARMUP);
      const up = scoredSteps.map((s) => ({ p: s.p_up, b: s.b_up, y: s.y_up }));
      const big = scoredSteps.filter((s) => s.p_big !== null && s.y_big !== null).map((s) => ({ p: s.p_big as number, b: s.b_big, y: s.y_big as number }));
      pooledUp.push(...up); pooledBig.push(...big);
      // rank-1 on the same series, scored from the same step. `b` is its own baseline.
      const from = WARMUP + 12;
      const rk = (read) => walkRank(md.returns, read).steps.filter((s) => s.i >= from).map((s) => ({ p: s.p, b: s.null, y: s.y }));
      const rUp = rk('MOVE'), rBig = rk('RANGE');
      rankUp.push(...rUp); rankBig.push(...rBig);
      // Which pre-trained family the series came to resemble, worked out from
      // the series alone.
      const now = stateProbability(md.returns);
      perTicker[ticker] = { bars: md.dataPoints, direction: score(up), move_size: score(big), rank_1: { direction: score(rUp), move_size: score(rBig) }, behaves_like: { direction: now?.family_up, move_size: now?.family_big } };
    }

    return Response.json({
      engine_version: ENGINE_VERSION,
      method: 'walk-forward: each call precedes its outcome; first 250 steps of each series unscored; skill is against each engine own baseline; rank_1 is uncalibrated here',
      tickers: perTicker,
      pooled: { direction: score(pooledUp), move_size: score(pooledBig), rank_1: { direction: score(rankUp), move_size: score(rankBig) } },
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
