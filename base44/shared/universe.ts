// The series tracked every night: scored, logged and used for the pooled
// calibration. The Discord signal posts on the same list.
export interface TrackedSeries { ticker: string; label: string; kind: 'crypto' | 'index' }

export const UNIVERSE: TrackedSeries[] = [
  { ticker: 'BTC', label: 'Bitcoin', kind: 'crypto' },
  { ticker: 'ETH', label: 'Ethereum', kind: 'crypto' },
  { ticker: 'SOL', label: 'Solana', kind: 'crypto' },
  { ticker: 'XRP', label: 'XRP', kind: 'crypto' },
  { ticker: 'DOGE', label: 'Dogecoin', kind: 'crypto' },
  { ticker: 'SPY', label: 'S&P 500', kind: 'index' },
  { ticker: 'QQQ', label: 'Nasdaq-100', kind: 'index' },
];

/** Tickers asked about in chat are tracked too, up to this many beyond the list above. */
export const MAX_EXTRA_SERIES = 20;
/** Daily history pulled for every read. */
export const HISTORY_DAYS = 5475;
