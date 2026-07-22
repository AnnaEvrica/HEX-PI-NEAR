/**
 * marketData — Fetches real OHLCV data from Yahoo Finance (no API key needed).
 * Returns daily close prices and computed log returns for the HEX6 BLE engine.
 * The Yahoo fetch + return math live in the shared marketDataClient module so
 * the think engine can pull the same real series directly.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { fetchYahooReturns } from '../../shared/marketDataClient.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { tickers, lookbackDays = 365 } = body;

    if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
      return Response.json({ error: 'tickers array required' }, { status: 400 });
    }

    const results = {};
    const errors = {};

    await Promise.all(
      tickers.map(async (ticker) => {
        try {
          const md = await fetchYahooReturns(ticker, lookbackDays);
          results[ticker] = {
            closes: md.closes,
            returns: md.returns,
            latestPrice: md.latestPrice,
            dataPoints: md.dataPoints,
          };
        } catch (err) {
          errors[ticker] = err.message;
          // Fallback: empty so callers degrade gracefully.
          results[ticker] = {
            closes: [],
            returns: [],
            latestPrice: null,
            dataPoints: 0,
            synthetic: true,
          };
        }
      })
    );

    return Response.json({ results, errors });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});