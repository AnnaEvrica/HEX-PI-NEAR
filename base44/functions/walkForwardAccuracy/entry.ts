import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { fetchYahooReturns } from '../../shared/marketDataClient.ts';
import { runArchetypeWalkForward, summarizeWalkForward } from '../../shared/archetypeWalkForward.ts';

// Broad crypto basket with liquid proof-of-stake networks. Staking yield is
// not modelled as a price return; each asset is tested on unadjusted USD OHLCV.
const DEFAULT_BASKET = ['BTC', 'ETH', 'SOL', 'ADA', 'DOT', 'ATOM', 'AVAX', 'NEAR', 'ALGO', 'XTZ'];

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const tickers = Array.isArray(body.tickers) && body.tickers.length
      ? body.tickers.map((ticker: unknown) => String(ticker).trim().toUpperCase()).filter(Boolean)
      : body.ticker ? [String(body.ticker).trim().toUpperCase()] : DEFAULT_BASKET;
    const lookbackDays = Math.max(365, Math.min(Number(body.lookbackDays) || 5475, 7300));
    const trainRatio = Math.max(0.5, Math.min(Number(body.trainRatio) || 0.6, 0.85));

    const fetched = await Promise.all(tickers.map(async (ticker: string) => {
      try {
        const data = await fetchYahooReturns(ticker, lookbackDays);
        return data.closes.length >= 180 ? { ticker, ...data } : null;
      } catch { return null; }
    }));
    const usable = fetched.filter(Boolean);
    if (!usable.length) return Response.json({ error: 'No requested assets returned enough historical OHLCV data.' }, { status: 422 });

    const results = usable.map((data: any) => runArchetypeWalkForward({
      ticker: data.ticker, closes: data.closes, highs: data.highs, lows: data.lows, volumes: data.volumes,
    }, trainRatio));

    return Response.json({
      mode: 'PREQUENTIAL_ARCHETYPE_WALK_FORWARD',
      data_source: 'Yahoo Finance daily OHLCV',
      protocol: {
        historical_window_days: lookbackDays,
        held_out_fraction: 1 - trainRatio,
        rule: 'Each prediction sees only bars available at that timestamp. Its archetype ledger updates after, never before, the realized next daily close.',
        confidence: 'HEX personal_call_strength is recorded unchanged and never used as an archetype learning target or gate.',
        adjustment: 'Archetypes blend only into directional probability/ratio, with conservative support-based shrinkage; direction may change only when the adjusted ratio crosses 50%.',
        fine_structure_137: 'A fixed 137-calendar-bar trailing log-return observation is attached to each archetype as upward, neutral, or downward after volatility normalization. It is descriptive only: it does not alter raw HEX probability, conviction, or the learner weight. Staking yield is excluded; results are USD spot-price direction only.',
      },
      aggregate: summarizeWalkForward(results),
      asset_summary: results.map((result) => ({
        ticker: result.ticker,
        predictions: result.metrics.predictions,
        raw_directional_accuracy: result.metrics.raw_directional_accuracy,
        archetype_adjusted_directional_accuracy: result.metrics.archetype_adjusted_directional_accuracy,
        raw_brier: result.metrics.raw_brier,
        archetype_adjusted_brier: result.metrics.archetype_adjusted_brier,
      })),
      assets: results,
      unavailable_tickers: tickers.filter((ticker: string) => !usable.some((data: any) => data.ticker === ticker || data.ticker === `${ticker}-USD`)),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Walk-forward test failed' }, { status: 500 });
  }
}