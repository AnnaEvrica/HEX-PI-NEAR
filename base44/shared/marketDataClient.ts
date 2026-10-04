// ---------------------------------------------------------------------------
// marketDataClient — Yahoo Finance daily bars, shared by the chat function
// and the scheduled posts. One source of real daily bars, so
// every probability is computed on actual data.
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
 * Fetch daily bars from Yahoo Finance and compute log returns over the
 * finished bars.
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
  // Yahoo's last daily bar is usually the day still in progress. A bar that
  // has not finished is not a step the engine may learn from or count as an
  // outcome, so `returns` (and `completedCloses`) stop at the last finished
  // bar. `closes` keeps the live bar so chart levels and the latest price stay
  // current.
  const nowSec = Date.now() / 1000;
  const sessionEnd = Number(result.meta?.currentTradingPeriod?.regular?.end);
  const lastTs = timestamps[timestamps.length - 1] ?? 0;
  const lastBarFinished = Number.isFinite(sessionEnd) && sessionEnd > lastTs
    ? nowSec >= sessionEnd
    : nowSec >= lastTs + 86400;
  const completedBars = lastBarFinished ? closes.length : Math.max(0, closes.length - 1);
  const completedCloses = closes.slice(0, completedBars);
  const returns: number[] = [];
  for (let i = 1; i < completedCloses.length; i++) {
    if (completedCloses[i] && completedCloses[i - 1]) returns.push(Math.log(completedCloses[i] / completedCloses[i - 1]));
  }
  return {
    ticker,
    closes,
    completedCloses,
    completedBars,
    highs,
    lows,
    volumes,
    timestamps,
    returns,
    latestPrice: closes[closes.length - 1] ?? null,
    dataPoints: closes.length,
  };
}
