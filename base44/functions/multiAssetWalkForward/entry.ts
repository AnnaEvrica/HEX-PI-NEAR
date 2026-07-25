// multiAssetWalkForward — end-to-end walk-forward backtest of the ENTIRE
// HEX6-BLE / PI-US process (Reason → Wave → Validation = the "new and final
// layers") across a diverse basket of real assets, not just BTC.
//
// Deterministic by design: real daily returns are pulled straight from Yahoo
// Finance (no LLM fetch, no web-search credits — the non-determinism that
// previously made walk-forward accuracy vary run-to-run is removed). The same
// pinned series is scored every time, so the accuracy numbers are comparable
// across scenarios and across runs.
//
// For each out-of-sample step it trains on the expanding prefix, runs the full
// Reason + Wave + Validation stack, and records the Validation layer's
// identified direction (the final-layer output), probability, support (Pascal
// value), and confidence — then compares to the realized next return.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { runReasonLayer, runWaveLayer, runValidationLayer } from '../../shared/thinkingEngine.ts';
import { fetchYahooReturns } from '../../shared/marketDataClient.ts';

function pearson(a, b) {
  const n = Math.min(a.length, b.length);
  if (n < 3) return 0;
  const ma = a.slice(0, n).reduce((s, x) => s + x, 0) / n;
  const mb = b.slice(0, n).reduce((s, x) => s + x, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { const ai = a[i] - ma, bi = b[i] - mb; num += ai * bi; da += ai * ai; db += bi * bi; }
  return (da === 0 || db === 0) ? 0 : num / Math.sqrt(da * db);
}
const mean = (a) => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
const r2 = (x, d = 4) => x === null || x === undefined ? null : Number(x.toFixed(d));

// A diverse basket spanning asset classes / market regimes / "scenarios".
const DEFAULT_BASKET = [
  { ticker: 'BTC',  class: 'crypto' },
  { ticker: 'ETH',  class: 'crypto' },
  { ticker: 'SOL',  class: 'crypto' },
  { ticker: 'SPY',  class: 'equity_index' },
  { ticker: 'QQQ',  class: 'equity_index' },
  { ticker: 'AAPL', class: 'single_equity' },
  { ticker: 'TSLA', class: 'single_equity' },
  { ticker: 'NVDA', class: 'single_equity' },
  { ticker: 'GLD',  class: 'commodity' },     // gold
  { ticker: 'TLT',  class: 'bonds' },          // 20yr treasury
  { ticker: 'UUP',  class: 'fx' },             // US dollar index
];

async function scoreOne(ticker, assetClass, lookbackDays, trainRatio, riskAversion) {
  const md = await fetchYahooReturns(ticker, lookbackDays);
  const returns = md.returns;
  if (!returns || returns.length < 40) {
    return { ticker, assetClass, error: 'insufficient data', dataPoints: returns?.length || 0 };
  }

  const split = Math.max(20, Math.floor(returns.length * trainRatio));
  const test = returns.slice(split);
  const preds = [];
  for (let i = 0; i < test.length; i++) {
    const window = returns.slice(0, split + i);
    const reason = runReasonLayer(window, riskAversion);
    const wave = runWaveLayer(window);
    const validation = runValidationLayer(reason, wave);
    const dir = validation.identifiedDirection;
    const predictedDir = dir === 'UP' ? 1 : dir === 'DOWN' ? -1 : 0;
    const actualDir = test[i] > 0 ? 1 : test[i] < 0 ? -1 : 0;
    preds.push({
      probability: validation.probability,
      value: validation.support,
      confidence: validation.confidence,
      predictedDir, actualDir, realized: test[i],
    });
  }

  const valid = preds.filter(p => p.predictedDir !== 0 && p.actualDir !== 0);
  const directionalAccuracy = valid.length ? valid.filter(p => p.predictedDir === p.actualDir).length / valid.length : null;

  const probs = preds.map(p => p.probability);
  const vals = preds.map(p => p.value);
  const rets = preds.map(p => p.realized);
  const probabilityCalibration = pearson(probs, rets);
  const valueCalibration = pearson(vals, rets);

  // Final-layer discrimination: does high Pascal support select better trades?
  const byVal = [...preds].sort((a, b) => a.value - b.value);
  const half = Math.floor(preds.length / 2);
  const lowVal = byVal.slice(0, half).filter(p => p.actualDir !== 0);
  const highVal = byVal.slice(half).filter(p => p.actualDir !== 0);
  const highValueAccuracy = highVal.length ? highVal.filter(p => p.predictedDir === p.actualDir).length / highVal.length : null;
  const lowValueAccuracy = lowVal.length ? lowVal.filter(p => p.predictedDir === p.actualDir).length / lowVal.length : null;

  // Confidence tier discrimination.
  const byConf = [...preds].sort((a, b) => a.confidence - b.confidence);
  const lowConf = byConf.slice(0, half).filter(p => p.actualDir !== 0);
  const highConf = byConf.slice(half).filter(p => p.actualDir !== 0);
  const highConfAcc = highConf.length ? highConf.filter(p => p.predictedDir === p.actualDir).length / highConf.length : null;
  const lowConfAcc = lowConf.length ? lowConf.filter(p => p.predictedDir === p.actualDir).length / lowConf.length : null;

  // Only-act-when-supported filter: accuracy on high-support calls vs baseline.
  const supportThreshold = 0.05;
  const supported = valid.filter(p => p.value >= supportThreshold);
  const supportedAccuracy = supported.length ? supported.filter(p => p.predictedDir === p.actualDir).length / supported.length : null;

  return {
    ticker, assetClass,
    dataPoints: returns.length,
    trainSize: split,
    testSize: test.length,
    directionalAccuracy: r2(directionalAccuracy),
    friction: directionalAccuracy !== null ? r2(1 - directionalAccuracy) : null,
    probabilityCalibration: r2(probabilityCalibration),
    valueCalibration: r2(valueCalibration),
    highValueAccuracy: r2(highValueAccuracy),
    lowValueAccuracy: r2(lowValueAccuracy),
    valueEdge: (highValueAccuracy != null && lowValueAccuracy != null) ? r2(highValueAccuracy - lowValueAccuracy) : null,
    highConfidenceAccuracy: r2(highConfAcc),
    lowConfidenceAccuracy: r2(lowConfAcc),
    supportedAccuracy: r2(supportedAccuracy),
    supportedCount: supported.length,
    avgConfidence: r2(mean(preds.map(p => p.confidence))),
    latestPrice: md.latestPrice,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { trainRatio = 0.8, riskAversion = 2.5, lookbackDays = 730, basket } = body;
    const list = Array.isArray(basket) && basket.length > 0
      ? basket.map((t) => (typeof t === 'string' ? { ticker: t, class: 'custom' } : t))
      : DEFAULT_BASKET;

    const results = [];
    for (const item of list) {
      try {
        results.push(await scoreOne(item.ticker, item.class, lookbackDays, trainRatio, riskAversion));
      } catch (e) {
        results.push({ ticker: item.ticker, assetClass: item.class, error: String(e.message || e) });
      }
    }

    const clean = results.filter(r => r.directionalAccuracy != null);
    const beat = clean.filter(r => r.directionalAccuracy > 0.5).length;
    const meanAcc = clean.length ? clean.reduce((s, r) => s + r.directionalAccuracy, 0) / clean.length : 0;
    const meanValCal = clean.length ? clean.reduce((s, r) => s + (r.valueCalibration || 0), 0) / clean.length : 0;
    const meanProbCal = clean.length ? clean.reduce((s, r) => s + (r.probabilityCalibration || 0), 0) / clean.length : 0;
    const positiveValueEdge = clean.filter(r => r.valueEdge != null && r.valueEdge > 0).length;

    return Response.json({
      version: '5.5',
      description: 'End-to-end Reason→Wave→Validation walk-forward across asset classes (Yahoo-pinned series, deterministic).',
      trainRatio, riskAversion, lookbackDays,
      summary: {
        assetsScored: clean.length,
        assetsBeatingCoin: beat,
        meanDirectionalAccuracy: r2(meanAcc),
        meanValueCalibration: r2(meanValCal),
        meanProbabilityCalibration: r2(meanProbCal),
        assetsWithPositiveValueEdge: positiveValueEdge,
      },
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Failed' }, { status: 500 });
  }
});