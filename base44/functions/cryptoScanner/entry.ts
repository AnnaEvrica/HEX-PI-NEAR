/**
 * cryptoScanner — HEX6 multi-asset crypto day trading engine
 * 1. Scans a wide universe of crypto/token pairs on Yahoo Finance
 * 2. Runs HEX6 engine on each to rank by momentum score
 * 3. Selects top N opportunities with highest risk-adjusted edge
 * 4. Executes trades on Alpaca for the top picks
 * 5. Saves outcomes to HEX6Memory for self-learning
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Category-tagged universe
const CRYPTO_CATEGORIES = {
  layer1:   ['BTC-USD', 'ETH-USD', 'SOL-USD', 'ADA-USD', 'AVAX-USD', 'DOT-USD', 'ATOM-USD', 'NEAR-USD', 'ALGO-USD', 'FTM-USD', 'ICP-USD'],
  layer2:   ['MATIC-USD', 'OP-USD', 'ARB-USD', 'IMX-USD', 'LRC-USD'],
  defi:     ['UNI-USD', 'AAVE-USD', 'CRV-USD', 'MKR-USD', 'COMP-USD', 'SNX-USD', 'YFI-USD', 'SUSHI-USD', 'BAL-USD', '1INCH-USD', 'RUNE-USD', 'LDO-USD', 'GRT-USD'],
  dao:      ['MKR-USD', 'UNI-USD', 'COMP-USD', 'YFI-USD', 'BAL-USD', 'CRV-USD', 'GRT-USD', 'ENJ-USD'],
  staking:  ['LDO-USD', 'ATOM-USD', 'DOT-USD', 'SOL-USD', 'AVAX-USD', 'KSM-USD', 'FTM-USD', 'NEAR-USD'],
  altcoins: ['LINK-USD', 'FIL-USD', 'RUNE-USD', 'KSM-USD', 'MANA-USD', 'SAND-USD', 'AXS-USD', 'APE-USD', 'IMX-USD', 'GRT-USD', 'ENJ-USD'],
  meme:     ['DOGE-USD', 'SHIB-USD', 'XRP-USD', 'LTC-USD', 'APE-USD'],
  all:      ['BTC-USD', 'ETH-USD', 'SOL-USD', 'BNB-USD', 'AVAX-USD',
             'MATIC-USD', 'LINK-USD', 'DOT-USD', 'ADA-USD', 'DOGE-USD',
             'SHIB-USD', 'LTC-USD', 'XRP-USD', 'UNI-USD', 'AAVE-USD',
             'CRV-USD', 'MKR-USD', 'COMP-USD', 'SNX-USD', 'YFI-USD',
             'SUSHI-USD', 'BAL-USD', '1INCH-USD', 'GRT-USD', 'FIL-USD',
             'ATOM-USD', 'NEAR-USD', 'ICP-USD', 'APE-USD', 'OP-USD',
             'ARB-USD', 'FTM-USD', 'RUNE-USD', 'KSM-USD', 'ALGO-USD',
             'MANA-USD', 'SAND-USD', 'AXS-USD', 'IMX-USD', 'LDO-USD'],
};

// These are the ones Alpaca crypto supports (subset)
const ALPACA_CRYPTO_SYMBOLS = [
  'BTCUSD', 'ETHUSD', 'SOLUSD', 'DOGEUSD', 'SHIBUSD',
  'LTCUSD', 'LINKUSD', 'UNIUSD', 'AAVEUSD', 'AVAXUSD',
  'BCHUSD', 'XRPUSD', 'MATICUSD', 'ADAUSD',
];

// Yahoo -> Alpaca symbol map
function toAlpaca(yahooSymbol) {
  return yahooSymbol.replace('-USD', 'USD');
}

const BASE_URL = (Deno.env.get('ALPACA_BASE_URL') || 'https://paper-api.alpaca.markets')
  .replace(/\/v2\/?$/, '').replace(/\/$/, '');

function alpacaHeaders() {
  const key = Deno.env.get('ALPACA_API_KEY');
  const secret = Deno.env.get('ALPACA_SECRET_KEY');
  if (!key || !secret) throw new Error('ALPACA_API_KEY and ALPACA_SECRET_KEY secrets are required');
  return {
    'APCA-API-KEY-ID': key,
    'APCA-API-SECRET-KEY': secret,
    'Content-Type': 'application/json',
  };
}

async function alpacaGet(path) {
  const res = await fetch(`${BASE_URL}${path}`, { headers: alpacaHeaders() });
  if (!res.ok) throw new Error(`Alpaca (${res.status}): ${await res.text()}`);
  return res.json();
}

async function alpacaPost(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: alpacaHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Alpaca order error (${res.status}): ${await res.text()}`);
  return res.json();
}

async function fetchYahooData(ticker, lookback = 180) {
  const now = Math.floor(Date.now() / 1000);
  const period1 = now - lookback * 86400;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?period1=${period1}&period2=${now}&interval=1d`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } });
  if (!res.ok) return null;
  const json = await res.json();
  const closes = json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
  const valid = closes.filter(c => c != null);
  if (valid.length < 20) return null;
  const returns = [];
  for (let i = 1; i < valid.length; i++) {
    returns.push(Math.log(valid[i] / valid[i - 1]));
  }
  return { returns, latestPrice: valid[valid.length - 1], dataPoints: valid.length };
}

function hex6Score(returns, riskAversion = 2.0) {
  if (!returns || returns.length < 20) return null;
  const n = returns.length;
  const mean = returns.reduce((s, r) => s + r, 0) / n;
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);
  const recent = returns.slice(-14); // 2-week momentum
  const recentMean = recent.reduce((s, r) => s + r, 0) / recent.length;
  const recentStd = Math.sqrt(recent.reduce((s, r) => s + (r - recentMean) ** 2, 0) / recent.length);

  const annualReturn = mean * 252;
  const annualVol = std * Math.sqrt(252);

  let marketState = 'LATERAL';
  if (recentMean > std * 0.3) marketState = 'BULL';
  else if (recentMean < -std * 0.3) marketState = 'BEAR';
  else if (recentStd > std * 1.5) marketState = 'VOLATILE';

  // Kelly-inspired weight
  const kelly = annualVol > 0 ? annualReturn / (riskAversion * annualVol ** 2) : 0;
  let targetWeight = Math.max(0, Math.min(0.25, kelly)); // cap at 25% per asset

  // State adjustment
  if (marketState === 'BEAR') targetWeight *= 0.2;
  else if (marketState === 'VOLATILE') targetWeight *= 0.4;
  else if (marketState === 'BULL') targetWeight = Math.min(targetWeight * 1.3, 0.25);

  // Momentum score = annualised recent return / annualVol (Sharpe of recent)
  const momentumScore = annualVol > 0 ? (recentMean * 252) / annualVol : 0;

  const confidence = Math.abs(recentMean) > std * 0.5 ? 'high' : Math.abs(recentMean) > std * 0.2 ? 'medium' : 'low';

  return {
    targetWeight: parseFloat(targetWeight.toFixed(4)),
    marketState,
    confidence,
    momentumScore: parseFloat(momentumScore.toFixed(4)),
    annualReturn: parseFloat((annualReturn * 100).toFixed(2)),
    annualVol: parseFloat((annualVol * 100).toFixed(2)),
    sharpe: annualVol > 0 ? parseFloat((annualReturn / annualVol).toFixed(3)) : 0,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const {
      topN = 5,
      riskAversion = 2.0,
      scanOnly = false,
      maxPositionPct = 0.15,
      category = 'all',
    } = body;

    // 1. Scan universe in parallel (batches of 8 to avoid rate limits)
    const categoryPool = CRYPTO_CATEGORIES[category] || CRYPTO_CATEGORIES.all;
    const universe = [...new Set(categoryPool)].filter(t => ALPACA_CRYPTO_SYMBOLS.includes(toAlpaca(t)));
    const scanResults = [];

    const batches = [];
    for (let i = 0; i < universe.length; i += 8) {
      batches.push(universe.slice(i, i + 8));
    }

    for (const batch of batches) {
      const results = await Promise.allSettled(
        batch.map(async (ticker) => {
          const data = await fetchYahooData(ticker);
          if (!data) return null;
          const score = hex6Score(data.returns, riskAversion);
          if (!score) return null;
          return { ticker, alpacaSymbol: toAlpaca(ticker), ...score, latestPrice: data.latestPrice, dataPoints: data.dataPoints };
        })
      );
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) scanResults.push(r.value);
      }
    }

    // 2. Rank by momentum score, filter out BEAR and zero-weight
    const ranked = scanResults
      .filter(s => s.marketState !== 'BEAR' && s.targetWeight > 0 && s.momentumScore > 0)
      .sort((a, b) => b.momentumScore - a.momentumScore);

    const topPicks = ranked.slice(0, topN);

    if (scanOnly) {
      return Response.json({ ranked, topPicks, scanned: scanResults.length });
    }

    // 3. Get account data
    const account = await alpacaGet('/v2/account');
    const portfolioValue = parseFloat(account.portfolio_value || account.equity || 0);
    const positions = await alpacaGet('/v2/positions');
    const positionMap = {};
    for (const p of positions) positionMap[p.symbol] = p;

    const trades = [];
    const errors = [];

    // 4. Execute trades for top picks
    for (const pick of topPicks) {
      try {
        const current = positionMap[pick.alpacaSymbol];
        const currentValue = parseFloat(current?.market_value || 0);
        const currentWeight = portfolioValue > 0 ? currentValue / portfolioValue : 0;

        // Cap position weight
        const targetW = Math.min(pick.targetWeight, maxPositionPct);
        const delta = targetW - currentWeight;

        if (Math.abs(delta) < 0.005) {
          trades.push({ ticker: pick.ticker, skipped: true, reason: 'Already near target weight' });
          continue;
        }

        const side = delta > 0 ? 'buy' : 'sell';
        const tradeValue = Math.abs(delta) * portfolioValue;
        const price = pick.latestPrice || 1;
        let qty = parseFloat((tradeValue / price).toFixed(6));
        if (qty < 0.0001) {
          trades.push({ ticker: pick.ticker, skipped: true, reason: 'Qty too small' });
          continue;
        }

        // Alpaca crypto uses fractional shares
        const order = await alpacaPost('/v2/orders', {
          symbol: pick.alpacaSymbol,
          qty: String(qty),
          side,
          type: 'market',
          time_in_force: 'gtc',
        });

        // Mint EGTS receipt
        await base44.asServiceRole.functions.invoke('egtsProxy', {
          action: 'mint',
          assetId: pick.ticker,
          eventType: 'REBALANCE',
          allocationData: {
            targetWeight: targetW,
            marketState: pick.marketState,
            confidence: pick.confidence,
            momentumScore: pick.momentumScore,
            sharpe: pick.sharpe,
            tradeQty: qty,
            side,
            price,
            autoTrade: true,
          },
          triggeredBy: `CRYPTO_SCANNER:${user.email}`,
          metadata: { engineVersion: 'HEX6-BLE-v5.0', scanRank: ranked.indexOf(pick) + 1 },
        });

        // Save to HEX6Memory for self-learning
        await base44.asServiceRole.entities.HEX6Memory.create({
          memory_type: 'trade',
          ticker: pick.ticker,
          params: JSON.stringify({ riskAversion, maxPositionPct }),
          metrics: JSON.stringify({ side, qty, price, tradeValue }),
          engine_params: JSON.stringify(pick),
          sharpe: pick.sharpe,
          cagr: pick.annualReturn,
          recorded_by: user.email,
          notes: `Auto crypto scan trade: ${side} ${qty} ${pick.alpacaSymbol} @ $${price}. Momentum: ${pick.momentumScore.toFixed(3)}`,
        });

        trades.push({
          ticker: pick.ticker,
          alpacaSymbol: pick.alpacaSymbol,
          side,
          qty,
          price,
          marketState: pick.marketState,
          momentumScore: pick.momentumScore,
          sharpe: pick.sharpe,
          orderId: order.id,
          status: order.status,
        });
      } catch (err) {
        errors.push({ ticker: pick.ticker, error: err.message });
      }
    }

    return Response.json({
      success: true,
      scanned: scanResults.length,
      topPicks,
      trades,
      errors,
      portfolioValue,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});