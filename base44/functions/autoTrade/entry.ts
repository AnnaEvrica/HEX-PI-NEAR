/**
 * autoTrade — HEX6-driven paper trading auto-execution.
 * 1. Fetches real market data via Yahoo Finance
 * 2. Runs the HEX6 BLE v5.0 engine to get target weight
 * 3. Computes qty from Alpaca account portfolio value + target weight
 * 4. Places a market order on Alpaca (paper trading)
 * 5. Mints an EGTS receipt via egtsProxy
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const BASE_URL = (Deno.env.get('ALPACA_BASE_URL') || 'https://paper-api.alpaca.markets')
  .replace(/\/v2\/?$/, '')
  .replace(/\/$/, '');

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
  if (!res.ok) throw new Error(`Alpaca (${res.status}): ${await res.text()}`);
  return res.json();
}

async function fetchYahooReturns(ticker, lookbackDays = 365) {
  const now = Math.floor(Date.now() / 1000);
  const period1 = now - lookbackDays * 86400;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?period1=${period1}&period2=${now}&interval=1d&events=history`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Yahoo Finance error for ${ticker}: ${res.status}`);
  const json = await res.json();
  const closes = json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
  const valid = closes.filter((c) => c != null);
  const returns = [];
  for (let i = 1; i < valid.length; i++) {
    if (valid[i] && valid[i - 1]) returns.push(Math.log(valid[i] / valid[i - 1]));
  }
  return { returns, latestPrice: valid[valid.length - 1] ?? null };
}

// Minimal HEX6 BLE engine — state-conditioned exposure field model
function hex6Engine(returns, riskAversion = 2.5) {
  if (!returns || returns.length < 10) return { targetWeight: 0.05, marketState: 'UNKNOWN', confidence: 'low' };

  const n = returns.length;
  const mean = returns.reduce((s, r) => s + r, 0) / n;
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);
  const recent = returns.slice(-20);
  const recentMean = recent.reduce((s, r) => s + r, 0) / recent.length;
  const recentStd = Math.sqrt(recent.reduce((s, r) => s + (r - recentMean) ** 2, 0) / recent.length);
  const annualReturn = mean * 252;
  const annualVol = std * Math.sqrt(252);

  // Detect market state
  let marketState = 'LATERAL';
  if (recentMean > std * 0.3) marketState = 'BULL';
  else if (recentMean < -std * 0.3) marketState = 'BEAR';
  else if (recentStd > std * 1.5) marketState = 'VOLATILE';

  // Kelly-inspired exposure
  const kelly = annualVol > 0 ? annualReturn / (riskAversion * annualVol ** 2) : 0;
  const targetWeight = Math.max(0, Math.min(1, kelly));

  // State adjustment
  const adjusted =
    marketState === 'BEAR' ? targetWeight * 0.3 :
    marketState === 'VOLATILE' ? targetWeight * 0.5 :
    marketState === 'BULL' ? Math.min(targetWeight * 1.2, 1) :
    targetWeight;

  const confidence = Math.abs(recentMean) > std * 0.5 ? 'high' : Math.abs(recentMean) > std * 0.2 ? 'medium' : 'low';

  return { targetWeight: parseFloat(adjusted.toFixed(4)), marketState, confidence, annualReturn, annualVol };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { ticker, riskAversion = 2.5 } = await req.json();
    if (!ticker) return Response.json({ error: 'ticker required' }, { status: 400 });
    // Strict ticker validation — prevents path traversal / URL manipulation into the Yahoo Finance fetch.
    if (!/^[A-Z0-9.-]{1,10}$/.test(ticker)) return Response.json({ error: 'invalid ticker' }, { status: 400 });

    // 1. Fetch market data
    let returns = [], latestPrice = null, synthetic = false;
    try {
      const md = await fetchYahooReturns(ticker);
      returns = md.returns;
      latestPrice = md.latestPrice;
    } catch {
      returns = Array.from({ length: 300 }, () => (Math.random() - 0.48) * 0.025);
      latestPrice = null;
      synthetic = true;
    }

    // 2. Run HEX6 engine
    const engine = hex6Engine(returns, riskAversion);

    // 3. Get Alpaca account portfolio value
    const account = await alpacaGet('/v2/account');
    const portfolioValue = parseFloat(account.portfolio_value || account.equity || 0);
    const price = latestPrice || 100; // fallback if price unavailable

    // 4. Compute target dollar allocation and quantity
    const targetDollars = portfolioValue * engine.targetWeight;
    const qty = parseFloat((targetDollars / price).toFixed(4));

    // 5. Determine direction vs current position
    const positions = await alpacaGet('/v2/positions');
    const current = positions.find((p) => p.symbol === ticker.toUpperCase());
    const currentQty = parseFloat(current?.qty || 0);
    const currentValue = parseFloat(current?.market_value || 0);
    const currentWeight = portfolioValue > 0 ? currentValue / portfolioValue : 0;

    const delta = engine.targetWeight - currentWeight;
    const side = delta > 0.005 ? 'buy' : delta < -0.005 ? 'sell' : null;
    const tradeQty = parseFloat(Math.abs((delta * portfolioValue) / price).toFixed(4));

    if (!side || tradeQty < 0.001) {
      return Response.json({
        skipped: true,
        reason: `Already near target weight (current: ${(currentWeight * 100).toFixed(2)}%, target: ${(engine.targetWeight * 100).toFixed(2)}%)`,
        engine,
        synthetic,
      });
    }

    // 6. Place order
    const order = await alpacaPost('/v2/orders', {
      symbol: ticker.toUpperCase(),
      qty: String(tradeQty),
      side,
      type: 'market',
      time_in_force: 'day',
    });

    // 7. Mint EGTS receipt
    const receiptRes = await base44.asServiceRole.functions.invoke('egtsProxy', {
      action: 'mint',
      assetId: ticker,
      eventType: 'REBALANCE',
      allocationData: {
        targetWeight: engine.targetWeight,
        marketState: engine.marketState,
        confidence: engine.confidence,
        annualReturn: engine.annualReturn,
        annualVol: engine.annualVol,
        tradeQty,
        side,
        price,
        autoTrade: true,
      },
      triggeredBy: `AUTO_TRADE:${user.email}`,
      metadata: { engineVersion: 'HEX6-BLE-v5.0', synthetic },
    });

    return Response.json({
      success: true,
      order,
      engine,
      trade: { side, qty: tradeQty, price, targetDollars },
      currentWeight,
      synthetic,
      receipt: receiptRes.data,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});