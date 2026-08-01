// walkForwardAccuracy — walk-forward backtest that measures how well the
// engine's Probability (exposure) and Value (Pascal support) metrics calibrate
// to realized outcomes — not just directional accuracy.
//
// For each out-of-sample step it trains on the expanding prefix, runs the full
// Reason + Wave + Validation layers, records predicted probability / value /
// direction, then compares to the realized next return.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { runReasonLayer, runWaveLayer, runValidationLayer } from '../../shared/thinkingEngine.ts';
import { fetchYahooReturns, fetchWeatherReturns } from '../../shared/marketDataClient.ts';
import { fitScope, zeroShot } from '../../shared/zeroScope.ts';

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

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    let { series, as_returns, ticker, trainRatio = 0.8, riskAversion = 2.5, reasonOnly = false, domain } = body;

    // Fetch real daily returns directly; no LLM retrieval or integration credits.
    if ((!series || series.length < 30) && domain === 'weather') {
      const weather = await fetchWeatherReturns();
      series = weather.returns;
      as_returns = true;
      ticker = 'WEATHER_NYC';
    }
    if ((!series || series.length < 30) && ticker) {
      const market = await fetchYahooReturns(ticker, 730);
      series = market.returns;
      as_returns = true;
    }

    if (!series || series.length < 30) {
      return Response.json({ error: 'Need a series of >=30 numbers or a ticker to fetch.' }, { status: 400 });
    }

    // Convert to returns if raw prices.
    let returns = series.map(Number);
    if (as_returns === false) {
      const r = [];
      for (let i = 1; i < returns.length; i++) { if (returns[i - 1] !== 0) r.push((returns[i] - returns[i - 1]) / returns[i - 1]); }
      returns = r;
    }
    if (returns.length < 30) return Response.json({ error: 'Series too short after conversion.' }, { status: 400 });

    const split = Math.max(20, Math.floor(returns.length * trainRatio));
    const test = returns.slice(split);
    if (test.length < 5) return Response.json({ error: 'Not enough out-of-sample points.' }, { status: 400 });

    // Pre-compute calibration pairs from the training set — the scope's
    // zeroing history. For each bar j, run the engine on returns[0..j-1]
    // and pair its mu with the realized return at j. No look-ahead.
    const calibPairs = [];
    const magCalibPairs = [];
    if (reasonOnly) {
      for (let j = 20; j < split; j++) {
        const r = runReasonLayer(returns.slice(0, j), riskAversion);
        calibPairs.push({ predictedMu: r.mu, realized: returns[j] });
        magCalibPairs.push({ predictedMu: r.sigma, realized: Math.abs(returns[j]) });
      }
    }

    const preds = [];
    for (let i = 0; i < test.length; i++) {
      const window = returns.slice(0, split + i);
      const reason = runReasonLayer(window, riskAversion);
      const predictedDir = reason.mu > 0 ? 1 : reason.mu < 0 ? -1 : 0;
      const actualDir = test[i] > 0 ? 1 : test[i] < 0 ? -1 : 0;
      if (reasonOnly) {
        const scope = fitScope(calibPairs);
        const magScope = fitScope(magCalibPairs);
        const calibratedMu = zeroShot(reason.mu, scope);
        const calibratedMag = zeroShot(reason.sigma, magScope);
        preds.push({ predictedDir, actualDir, realized: test[i], predictedMu: reason.mu, predictedSigma: reason.sigma, calibratedMu, calibratedMag });
        calibPairs.push({ predictedMu: reason.mu, realized: test[i] });
        magCalibPairs.push({ predictedMu: reason.sigma, realized: Math.abs(test[i]) });
        continue;
      }
      const wave = runWaveLayer(window);
      const validation = runValidationLayer(reason, wave);
      preds.push({
        probability: validation.probability,
        value: validation.support,
        confidence: validation.confidence,
        predictedDir, actualDir, realized: test[i],
      });
    }

    const valid = preds.filter(p => p.predictedDir !== 0 && p.actualDir !== 0);
    const directionalAccuracy = valid.length ? valid.filter(p => p.predictedDir === p.actualDir).length / valid.length : null;
    // Per-direction separation: each direction evaluated on its own, no pooling.
    // The hypercube operates within the asset's own space-time; UP and DOWN calls
    // are scored independently to reveal asymmetric edge.
    const upPreds = valid.filter(p => p.predictedDir === 1);
    const downPreds = valid.filter(p => p.predictedDir === -1);
    const upAccuracy = upPreds.length ? upPreds.filter(p => p.actualDir === 1).length / upPreds.length : null;
    const downAccuracy = downPreds.length ? downPreds.filter(p => p.actualDir === -1).length / downPreds.length : null;

    if (reasonOnly) {
      const eligible = preds.filter(p => p.actualDir !== 0);
      // Ratio gate: the hexagram's precision discriminator (mu/sigma).
      const ratios = preds.map(p => p.predictedSigma > 1e-8 ? Math.abs(p.predictedMu / p.predictedSigma) : 0);
      const halfR = Math.floor(preds.length / 2);
      const byRatio = preds.map((p, i) => ({ ...p, ratio: ratios[i] })).sort((a, b) => a.ratio - b.ratio);
      const lowRatio = byRatio.slice(0, halfR).filter(p => p.actualDir !== 0);
      const highRatio = byRatio.slice(halfR).filter(p => p.actualDir !== 0);
      const highRatioAccuracy = highRatio.length ? highRatio.filter(p => p.predictedDir === p.actualDir).length / highRatio.length : null;
      const lowRatioAccuracy = lowRatio.length ? lowRatio.filter(p => p.predictedDir === p.actualDir).length / lowRatio.length : null;
      // Magnitude: sigma → |realized| (volatility clustering signal).
      const absRets = preds.map(p => Math.abs(p.realized));
      const magnitudeCalibration = pearson(preds.map(p => p.predictedSigma), absRets);
      // Scope-calibrated point + magnitude accuracy.
      const calibratedMae = mean(preds.map(p => Math.abs(p.calibratedMu - p.realized)));
      const calibratedMagnitudeMae = mean(preds.map(p => Math.abs(p.calibratedMag - Math.abs(p.realized))));
      return Response.json({
        ticker: ticker || 'SUPPLIED',
        mode: 'HEX6_BLE_REASON_ONLY',
        seriesLength: returns.length,
        trainSize: split,
        testSize: test.length,
        predictionsEvaluated: valid.length,
        coverage: r2(eligible.length ? valid.length / eligible.length : 0),
        directionalAccuracy: r2(directionalAccuracy),
        upAccuracy: r2(upAccuracy),
        downAccuracy: r2(downAccuracy),
        upPredictions: upPreds.length,
        downPredictions: downPreds.length,
        avgRatio: r2(mean(ratios)),
        highRatioAccuracy: r2(highRatioAccuracy),
        lowRatioAccuracy: r2(lowRatioAccuracy),
        gatedCoverage: r2((highRatio.length + lowRatio.length) > 0 ? highRatio.length / (highRatio.length + lowRatio.length) : 0),
        magnitudeCalibration: r2(magnitudeCalibration),
        calibratedMae: r2(calibratedMae, 6),
        calibratedMagnitudeMae: r2(calibratedMagnitudeMae, 6),
        timestamp: new Date().toISOString(),
      });
    }

    const probs = preds.map(p => p.probability);
    const vals = preds.map(p => p.value);
    const rets = preds.map(p => p.realized);

    // Calibration: do higher probability / value predictions yield higher realized returns?
    const probabilityCalibration = pearson(probs, rets);
    const valueCalibration = pearson(vals, rets);

    // Tier analysis: does a higher value/probability discriminate better trades?
    const half = Math.floor(preds.length / 2);
    const byVal = [...preds].sort((a, b) => a.value - b.value);
    const lowVal = byVal.slice(0, half).filter(p => p.actualDir !== 0);
    const highVal = byVal.slice(half).filter(p => p.actualDir !== 0);
    const highValueAccuracy = highVal.length ? highVal.filter(p => p.predictedDir === p.actualDir).length / highVal.length : null;
    const lowValueAccuracy = lowVal.length ? lowVal.filter(p => p.predictedDir === p.actualDir).length / lowVal.length : null;

    const byProb = [...preds].sort((a, b) => a.probability - b.probability);
    const lowProb = byProb.slice(0, half).filter(p => p.actualDir !== 0);
    const highProb = byProb.slice(half).filter(p => p.actualDir !== 0);
    const highProbabilityAccuracy = highProb.length ? highProb.filter(p => p.predictedDir === p.actualDir).length / highProb.length : null;
    const lowProbabilityAccuracy = lowProb.length ? lowProb.filter(p => p.predictedDir === p.actualDir).length / lowProb.length : null;
    const highProbabilityReturn = highProb.length ? mean(highProb.map(p => p.realized)) : null;
    const lowProbabilityReturn = lowProb.length ? mean(lowProb.map(p => p.realized)) : null;

    return Response.json({
      ticker: ticker || 'SUPPLIED',
      seriesLength: returns.length,
      trainSize: split,
      testSize: test.length,
      directionalAccuracy: r2(directionalAccuracy),
      upAccuracy: r2(upAccuracy),
      downAccuracy: r2(downAccuracy),
      upPredictions: upPreds.length,
      downPredictions: downPreds.length,
      probabilityCalibration: r2(probabilityCalibration),
      valueCalibration: r2(valueCalibration),
      highValueAccuracy: r2(highValueAccuracy),
      lowValueAccuracy: r2(lowValueAccuracy),
      highProbabilityAccuracy: r2(highProbabilityAccuracy),
      lowProbabilityAccuracy: r2(lowProbabilityAccuracy),
      highProbabilityReturn: r2(highProbabilityReturn, 6),
      lowProbabilityReturn: r2(lowProbabilityReturn, 6),
      friction: directionalAccuracy !== null ? r2(1 - directionalAccuracy) : null,
      version: '5.5',
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}