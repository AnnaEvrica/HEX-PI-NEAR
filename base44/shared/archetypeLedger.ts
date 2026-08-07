import type { LedgerCounts } from './onlineArchetypeLearner.ts';

// Persistent cross-asset archetype memory.
//
// Why this exists: every walk-forward replay used to be born amnesiac — the
// learner re-lived an asset's years from zero on each conversation and threw
// the experience away. Nothing SOL taught him ever reached ETH, and nothing
// yesterday taught him ever reached today. This module gives that memory a
// home.
//
// The honesty rule, which is the whole design: a stored ledger is used ONLY
// as a prior on the LIVE read (today's bar, predicting tomorrow). It is never
// seeded into the historical replay that produces the audit metrics, because
// counts learned through today would be future knowledge relative to a 2021
// bar. The scoreboard stays clean; only the live guess gets smarter.
//
// Cross-asset only: predicting SOL, he draws on every asset EXCEPT SOL, so a
// ticker's own row can never feed back into its own replay.

const MAX_ARCHETYPE_KEYS = 400;
// Stored fields have a hard size ceiling; a full 400-key ledger blew past it
// and every write was silently lost. Keep the highest-support keys that fit.
const MAX_COUNTS_CHARS = 15000;

const emptyLedger = (): LedgerCounts => ({ global: { up: 0, down: 0 }, states: {}, families: {}, archetypes: {} });

const support = (counts: { up: number; down: number }) => counts.up + counts.down;

// Entity fields must stay small — keep the highest-support archetype keys and
// drop the long tail of near-empty ones, which carry no signal anyway.
function prune(ledger: LedgerCounts): LedgerCounts {
  let kept = Object.entries(ledger.archetypes)
    .sort((a, b) => support(b[1]) - support(a[1]))
    .slice(0, MAX_ARCHETYPE_KEYS);
  let out = { ...ledger, archetypes: Object.fromEntries(kept) };
  while (kept.length > 0 && JSON.stringify(out).length > MAX_COUNTS_CHARS) {
    kept = kept.slice(0, Math.floor(kept.length * 0.7));
    out = { ...ledger, archetypes: Object.fromEntries(kept) };
  }
  return out;
}

function mergeInto(target: LedgerCounts, source: LedgerCounts) {
  target.global.up += source.global?.up ?? 0;
  target.global.down += source.global?.down ?? 0;
  for (const field of ['states', 'families', 'archetypes'] as const) {
    for (const [key, counts] of Object.entries(source[field] ?? {})) {
      const existing = target[field][key] || { up: 0, down: 0 };
      target[field][key] = { up: existing.up + counts.up, down: existing.down + counts.down };
    }
  }
}

// One read serves a whole multi-ticker turn: fetch every row once, then hand
// each asset the sum of all the OTHER assets' memories.
export async function loadLedgerRows(base44: any) {
  try {
    return await base44.asServiceRole.entities.ArchetypeLedger.list('-bars_learned', 40) || [];
  } catch { return []; }
}

// Implied matching across similar classes: an asset's peers move it far more
// than an unrelated one does. Same-class memory is the primary prior; the rest
// of the book is only a fallback when no peer has been lived yet.
const CLASSES: Record<string, string> = {
  BTC: 'crypto_major', ETH: 'crypto_major', SOL: 'crypto_major', BNB: 'crypto_major', XRP: 'crypto_major', ADA: 'crypto_major', LTC: 'crypto_major',
  DOGE: 'crypto_alt', MATIC: 'crypto_alt', LINK: 'crypto_alt', ATOM: 'crypto_alt', AVAX: 'crypto_alt', DOT: 'crypto_alt', UNI: 'crypto_alt', NEAR: 'crypto_alt', ALGO: 'crypto_alt', XTZ: 'crypto_alt',
  SPY: 'index', QQQ: 'index',
  AAPL: 'mega_tech', MSFT: 'mega_tech', NVDA: 'mega_tech', GOOG: 'mega_tech', GOOGL: 'mega_tech', AMZN: 'mega_tech', META: 'mega_tech', AMD: 'mega_tech', INTC: 'mega_tech', NFLX: 'mega_tech', TSLA: 'mega_tech',
  JPM: 'financial', GS: 'financial', V: 'financial', MA: 'financial', COIN: 'financial',
};
export const assetClass = (ticker: string) => CLASSES[ticker?.toUpperCase()] || 'unclassified';

function peerRows(rows: any[], ticker: string) {
  const others = rows.filter((row) => row.ticker !== ticker);
  const cls = assetClass(ticker);
  const sameClass = others.filter((row) => assetClass(row.ticker) === cls);
  return sameClass.length ? sameClass : others;
}

export function priorForTicker(rows: any[], ticker: string): LedgerCounts | null {
  const others = peerRows(rows, ticker);
  if (!others.length) return null;
  const merged = emptyLedger();
  let any = false;
  for (const row of others) {
    try { mergeInto(merged, JSON.parse(row.counts)); any = true; } catch { /* skip corrupt row */ }
  }
  return any ? merged : null;
}

export function priorSummary(rows: any[], ticker: string) {
  const others = peerRows(rows, ticker);
  const bars = others.reduce((sum, row) => sum + (row.bars_learned || 0), 0);
  return { assets: others.length, bars, tickers: others.map((row) => row.ticker), class: assetClass(ticker) };
}

// Fire-and-forget upsert of what this asset taught him on this replay.
export async function persistLedger(base44: any, rows: any[], ticker: string, ledger: LedgerCounts, barsLearned: number) {
  try {
    const pruned = prune(ledger);
    const payload = {
      ticker,
      counts: JSON.stringify(pruned),
      bars_learned: barsLearned,
      entries: Object.keys(pruned.archetypes).length,
      last_updated: new Date().toISOString(),
    };
    const existing = rows.find((row) => row.ticker === ticker);
    const SR = base44.asServiceRole.entities.ArchetypeLedger;
    if (existing?.id) await SR.update(existing.id, payload);
    else await SR.create(payload);
  } catch (e) { console.error('persistLedger failed:', (e as any)?.message || e); }
}