/**
 * marketData — Fetches real OHLCV data from Yahoo Finance (no API key needed).
 * Returns daily close prices and computed log returns for the HEX6 BLE engine.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Fetch Yahoo Finance chart data for a ticker over a given period.
 * period1/period2 are Unix timestamps.
 */
async function fetchYahooFinance(ticker, period1, period2, interval = '1d') {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?period1=${period1}&period2=${period2}&interval=${interval}&events=history`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Accept': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Yahoo Finance error for ${ticker}: ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(`No data for ${ticker}`);
  const closes = result.indicators?.quote?.[0]?.close || [];
  const timestamps = result.timestamp || [];
  return { closes, timestamps };
}

/** Compute log returns from a price series */
function logReturns(closes) {
  const returns = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] && closes[i - 1]) {
      returns.push(Math.log(closes[i] / closes[i - 1]));
    }
  }
  return returns;
}

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

    // Current date: April 27 2026
    const now = Math.floor(Date.now() / 1000);
    const period1 = now - lookbackDays * 86400;

    const results = {};
    const errors = {};

    await Promise.all(
      tickers.map(async (ticker) => {
        try {
          const { closes, timestamps } = await fetchYahooFinance(ticker, period1, now);
          const validCloses = closes.filter((c) => c !== null && c !== undefined);
          results[ticker] = {
            closes: validCloses,
            returns: logReturns(validCloses),
            latestPrice: validCloses[validCloses.length - 1] ?? null,
            dataPoints: validCloses.length,
          };
        } catch (err) {
          errors[ticker] = err.message;
          // Fallback: synthetic data so engine doesn't break
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