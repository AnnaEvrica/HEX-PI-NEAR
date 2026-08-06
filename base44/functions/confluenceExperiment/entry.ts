import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { fetchYahooReturns } from '../../shared/marketDataClient.ts';
import { runConfluenceExperiment } from '../../shared/confluenceExperiment.ts';

const DEFAULT_BASKET = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'LINK', 'AVAX'];

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const tickers = Array.isArray(body.tickers) && body.tickers.length ? body.tickers : DEFAULT_BASKET;
    const lookbackDays = Math.max(1095, Math.min(Number(body.lookbackDays) || 1825, 3650));
    const frictionBps = Math.max(0, Math.min(Number(body.frictionBps) || 10, 100));

    const fetched = await Promise.all(tickers.map(async (ticker) => {
      const md = await fetchYahooReturns(String(ticker), lookbackDays);
      return {
        ticker: String(ticker).toUpperCase(), closes: md.closes, highs: md.highs,
        lows: md.lows, volumes: md.volumes, timestamps: md.timestamps,
      };
    }));
    const usable = fetched.filter((x) => x.closes.length >= 300);
    if (usable.length < 3) return Response.json({ error: 'At least three assets need 300 aligned daily bars.' }, { status: 400 });

    const result = runConfluenceExperiment(usable, frictionBps);
    if (body.compact === true) {
      const horizonEntries = body.horizon && result.horizons[body.horizon]
        ? [[body.horizon, result.horizons[body.horizon]]]
        : Object.entries(result.horizons);
      const horizons = Object.fromEntries(horizonEntries.map(([key, value]) => [key, {
        variants: value.variants,
        promotion_candidate: value.promotion_candidate,
        verdict: value.verdict,
      }]));
      return Response.json({ design: result.design, horizons, generated_at: new Date().toISOString() });
    }
    return Response.json({ ...result, generated_at: new Date().toISOString() });
  } catch (error) {
    return Response.json({ error: error.message || 'Experiment failed' }, { status: 500 });
  }
}