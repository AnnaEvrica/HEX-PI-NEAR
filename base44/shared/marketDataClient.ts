// ---------------------------------------------------------------------------
// marketDataClient — Yahoo Finance OHLCV fetcher shared by the marketData
// HTTP function and the think engine. One source for real price/return series
// so the Model can collapse a directional read on actual data, not on
// LLM-narrated stats.
// ---------------------------------------------------------------------------

// Crypto tickers need the -USD suffix for Yahoo Finance chart endpoints.
const CRYPTO_MAP: Record<string, string> = {
  BTC: 'BTC-USD', ETH: 'ETH-USD', SOL: 'SOL-USD', DOGE: 'DOGE-USD',
  XRP: 'XRP-USD', ADA: 'ADA-USD', MATIC: 'MATIC-USD',
  LINK: 'LINK-USD', ATOM: 'ATOM-USD', AVAX: 'AVAX-USD', DOT: 'DOT-USD',
  LTC: 'LTC-USD', BNB: 'BNB-USD', UNI: 'UNI-USD',
  NEAR: 'NEAR-USD', ALGO: 'ALGO-USD', XTZ: 'XTZ-USD',
};

export function resolveYahooTicker(raw: string): string {
  const t = String(raw || '').toUpperCase().trim();
  return CRYPTO_MAP[t] || t;
}

/**
 * Fetch daily closes from Yahoo Finance and compute log returns.
 * @param rawTicker  e.g. "BTC", "ETH", "SPY", "AAPL"
 * @param lookbackDays  how many calendar days of history to pull (default 730 = 2yr)
 */
export async function fetchYahooReturns(rawTicker: string, lookbackDays = 730) {
  const ticker = resolveYahooTicker(rawTicker);
  const now = Math.floor(Date.now() / 1000);
  const period1 = now - lookbackDays * 86400;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?period1=${period1}&period2=${now}&interval=1d&events=history`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`Yahoo Finance error for ${ticker}: ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(`No data for ${ticker}`);
  // Keep the bars aligned: filter on close but carry high/low/volume for the
  // same index, so the chart-structure layer reads a coherent OHLCV series
  // instead of four independently-filtered arrays.
  const q = result.indicators?.quote?.[0] || {};
  const rawCloses = (q.close || []) as (number | null)[];
  const rawTimestamps = (result.timestamp || []) as number[];
  const closes: number[] = [];
  const highs: number[] = [];
  const lows: number[] = [];
  const volumes: number[] = [];
  const timestamps: number[] = [];
  for (let i = 0; i < rawCloses.length; i++) {
    const c = rawCloses[i];
    if (c === null || c === undefined) continue;
    closes.push(c);
    highs.push(q.high?.[i] ?? c);
    lows.push(q.low?.[i] ?? c);
    volumes.push(q.volume?.[i] ?? 0);
    timestamps.push(rawTimestamps[i] ?? 0);
  }
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] && closes[i - 1]) returns.push(Math.log(closes[i] / closes[i - 1]));
  }
  return {
    ticker,
    closes,
    highs,
    lows,
    volumes,
    timestamps,
    returns,
    latestPrice: closes[closes.length - 1] ?? null,
    dataPoints: closes.length,
  };
}

/**
 * Fetch daily max temperatures from Open-Meteo and compute day-over-day
 * changes (the "returns" of temperature). Tests the engine on a non-financial
 * domain — weather is a physical signal with real cyclicality.
 */
export async function fetchWeatherReturns(lat = 40.71, lon = -74.01, days = 730) {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - days * 86400000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${fmt(startDate)}&end_date=${fmt(endDate)}&daily=temperature_2m_max&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);
  const json = await res.json();
  const temps: number[] = (json?.daily?.temperature_2m_max || []).filter(
    (t: number | null) => t !== null && t !== undefined,
  ) as number[];
  const returns: number[] = [];
  for (let i = 1; i < temps.length; i++) {
    returns.push(temps[i] - temps[i - 1]);
  }
  return {
    ticker: 'WEATHER_NYC',
    closes: temps,
    returns,
    latestPrice: temps[temps.length - 1] ?? null,
    dataPoints: temps.length,
  };
}