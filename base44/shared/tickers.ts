// The one list of symbols the backend recognises in a message. Triage and the
// chat function both read it, so a symbol is either known everywhere or nowhere.
//
// Uppercase is a deliberate mention. Lowercase is accepted only for symbols
// that are not English words ("link", "near", "atom", "dot", "uni", "ada",
// "meta", "coin" would otherwise pull market data into life conversations).
const UPPER = 'BTC|ETH|SOL|DOGE|XRP|ADA|MATIC|LINK|ATOM|AVAX|DOT|LTC|BNB|UNI|NEAR|ALGO|XTZ|SPY|QQQ|TSLA|AAPL|MSFT|NVDA|GOOG|GOOGL|AMZN|META|COIN|BABA|JPM|GS|V|MA|NFLX|DIS|AMD|INTC|BA';
const LOWER = 'btc|eth|sol|doge|xrp|matic|avax|ltc|bnb|xtz|tsla|aapl|msft|nvda|amzn|spy|qqq';

/** Every recognised symbol named in the text, uppercase, in order, without repeats. */
export function tickersIn(text: string, limit = 8): string[] {
  const t = text || '';
  const upper = t.match(new RegExp(`\\b(${UPPER})\\b`, 'g')) || [];
  const lower = (t.match(new RegExp(`\\b(${LOWER})\\b`, 'gi')) || []).map((s) => s.toUpperCase());
  return [...new Set([...upper, ...lower])].slice(0, limit);
}

export const mentionsTicker = (text: string): boolean => tickersIn(text, 1).length > 0;
