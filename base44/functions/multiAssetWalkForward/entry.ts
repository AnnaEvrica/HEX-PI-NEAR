// multiAssetWalkForward — end-to-end walk-forward backtest that treats the
// two operators as SEPARATE modules, the way the architecture intends:
//
//   HEX6-BLE  → PROBABILITY (the directional / structural prediction).
//               Direction is called from the Reason layer (reason.mu) only.
//               Probability = |blendedExposure| (HEX6-BLE's confidence in the lean).
//
//   PI-US     → VALUE via RESONANCE (wave.resonance) — it does NOT call
//               direction. We measure whether resonance discriminates good
//               trades (value calibration + resonance-tier accuracy) and
//               whether dual-operator AGREEMENT (high prob AND high resonance)
//               sharpens the read. Pascal's fused "support" is reported only
//               as a diagnostic, never as the directional predictor.
//
// Deterministic: real daily returns pulled straight from Yahoo Finance (no
// LLM fetch, no web-search credits) so the pinned series is scored identically
// every run — comparable across scenarios and across runs.
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

function tierAccuracy(rows, sortByField, highSide) {
  const sorted = [...rows].sort((a, b) => a[sortByField] - b[sortByField]);
  const half = Math.floor(sorted.length / 2);
  const low = sorted.slice(0, half).filter(p => p.actualDir !== 0);
  const high = sorted.slice(half).filter(p => p.actualDir !== 0);
  const lowAcc = low.length ? low.filter(p => p.predictedDir === p.actualDir).length / low.length : null;
  const highAcc = high.length ? high.filter(p => p.predictedDir === p.actualDir).length / high.length : null;
  return { lowAcc, highAcc };
}

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
    // --- HEX6-BLE: probability + direction ---
    const reason = runReasonLayer(window, riskAversion);
    // --- PI-US: resonance-based value (no direction) ---
    const wave = runWaveLayer(window);
    // Pascal validation computed for diagnostic only (support/confidence),
    // never used to call direction.
    const validation = runValidationLayer(reason, wave);

    const predictedDir = reason.mu > 0 ? 1 : reason.mu < 0 ? -1 : 0;       // HEX6-BLE only
    const actualDir = test[i] > 0 ? 1 : test[i] < 0 ? -1 : 0;
    const probability = Math.min(1, Math.abs(reason.blendedExposure || reason.exposure || 0)); // HEX6-BLE
    const resonance = wave.resonance || 0;                                   // PI-US value

    preds.push({
      probability, resonance,
      pascalSupport: validation.support,
      predictedDir, actualDir, realized: test[i],
    });
  }

  const valid = preds.filter(p => p.predictedDir !== 0 && p.actualDir !== 0);
  const directionalAccuracy = valid.length ? valid.filter(p => p.predictedDir === p.actualDir).length / valid.length : null;

  // --- HEX6-BLE probability calibration ---
  const probabilityCalibration = pearson(preds.map(p => p.probability), preds.map(p => p.realized));
  const probTier = tierAccuracy(preds, 'probability');
  const probabilityEdge = (probTier.highAcc != null && probTier.lowAcc != null) ? probTier.highAcc - probTier.lowAcc : null;

  // --- PI-US resonance (value) calibration ---
  const resonanceCalibration = pearson(preds.map(p => p.resonance), preds.map(p => p.realized));
  const resTier = tierAccuracy(preds, 'resonance');
  const resonanceEdge = (resTier.highAcc != null && resTier.lowAcc != null) ? resTier.highAcc - resTier.lowAcc : null;

  // --- Dual-operator agreement: high prob AND high resonance vs baseline ---
  const medProb = median(preds.map(p => p.probability));
  const medRes = median(preds.map(p => p.resonance));
  const agreed = valid.filter(p => p.probability >= medProb && p.resonance >= medRes);
  const agreedAccuracy = agreed.length ? agreed.filter(p => p.predictedDir === p.actualDir).length / agreed.length : null;
  const conflicted = valid.filter(p => (p.probability >= medProb && p.resonance < medRes) || (p.probability < medProb && p.resonance >= medRes));
  const conflictedAccuracy = conflicted.length ? conflicted.filter(p => p.predictedDir === p.actualDir).length / conflicted.length : null;

  return {
    ticker, assetClass,
    dataPoints: returns.length,
    trainSize: split,
    testSize: test.length,
    // HEX6-BLE module
    directionalAccuracy: r2(directionalAccuracy),
    friction: directionalAccuracy !== null ? r2(1 - directionalAccuracy) : null,
    probabilityCalibration: r2(probabilityCalibration),
    highProbabilityAccuracy: r2(probTier.highAcc),
    lowProbabilityAccuracy: r2(probTier.lowAcc),
    probabilityEdge: r2(probabilityEdge),
    // PI-US module
    resonanceCalibration: r2(resonanceCalibration),
    highResonanceAccuracy: r2(resTier.highAcc),
    lowResonanceAccuracy: r2(resTier.lowAcc),
    resonanceValueEdge: r2(resonanceEdge),
    // Dual-operator
    agreedAccuracy: r2(agreedAccuracy),
    agreedCount: agreed.length,
    conflictedAccuracy: r2(conflictedAccuracy),
    conflictedCount: conflicted.length,
    avgProbability: r2(mean(preds.map(p => p.probability))),
    avgResonance: r2(mean(preds.map(p => p.resonance))),
    latestPrice: md.latestPrice,
  };
}

function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
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
    const meanProbCal = clean.length ? clean.reduce((s, r) => s + (r.probabilityCalibration || 0), 0) / clean.length : 0;
    const meanResCal = clean.length ? clean.reduce((s, r) => s + (r.resonanceCalibration || 0), 0) / clean.length : 0;
    const positiveResonanceEdge = clean.filter(r => r.resonanceValueEdge != null && r.resonanceValueEdge > 0).length;
    const agreedBeats = clean.filter(r => r.agreedAccuracy != null && r.directionalAccuracy != null && r.agreedAccuracy > r.directionalAccuracy).length;

    return Response.json({
      version: '5.5',
      architecture: 'HEX6-BLE (probability/direction) + PI-US (resonance value) measured as separate modules.',
      trainRatio, riskAversion, lookbackDays,
      summary: {
        assetsScored: clean.length,
        assetsBeatingCoin: beat,
        meanDirectionalAccuracy: r2(meanAcc),
        meanProbabilityCalibration_HEX6: r2(meanProbCal),
        meanResonanceCalibration_PIUS: r2(meanResCal),
        assetsWithPositiveResonanceEdge: positiveResonanceEdge,
        assetsWhereAgreementBeatsBaseline: agreedBeats,
      },
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Failed' }, { status: 500 });
  }
});