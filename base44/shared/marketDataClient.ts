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
  const closes = (result.indicators?.quote?.[0]?.close || []).filter(
    (c: number | null) => c !== null && c !== undefined,
  ) as number[];
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] && closes[i - 1]) returns.push(Math.log(closes[i] / closes[i - 1]));
  }
  return {
    ticker,
    closes,
    returns,
    latestPrice: closes[closes.length - 1] ?? null,
    dataPoints: closes.length,
  };
}