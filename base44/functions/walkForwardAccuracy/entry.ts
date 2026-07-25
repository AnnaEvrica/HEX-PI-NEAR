// walkForwardAccuracy — walk-forward backtest that measures how well the
// engine's Probability (exposure) and Value (Pascal support) metrics calibrate
// to realized outcomes — not just directional accuracy.
//
// For each out-of-sample step it trains on the expanding prefix, runs the full
// Reason + Wave + Validation layers, records predicted probability / value /
// direction, then compares to the realized next return.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    let { series, as_returns, ticker, trainRatio = 0.8, riskAversion = 2.5 } = body;

    // Fetch a real series if only a ticker was supplied. Yahoo Finance first —
    // deterministic and leak-free. LLM web-search fetch is a last resort only,
    // because it can return smoothed/truncated snapshots that inflate accuracy.
    if ((!series || series.length < 30) && ticker) {
      try {
        const yh = await fetchYahooReturns(ticker, 730);
        if (yh?.returns?.length >= 30) { series = yh.returns; as_returns = true; }
      } catch (_e) { /* fall through to LLM fetch */ }
    }
    if ((!series || series.length < 30) && ticker) {
      const fr = await base44.integrations.Core.InvokeLLM({
        prompt: `Pull the last 2 years of daily closing prices for ${ticker} (about 500 data points) from an authoritative source (Yahoo Finance, CoinGecko, etc.). Return JSON with "series" (array of raw daily prices, oldest first, as many as you can retrieve up to 500, minimum 200), "as_returns" (false), and "source_summary".`,
        model: 'gemini_3_flash',
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            series: { type: 'array', items: { type: 'number' } },
            as_returns: { type: 'boolean' },
            source_summary: { type: 'string' },
          },
          required: ['series'],
        },
      }).catch(() => null);
      if (fr?.series && fr.series.length >= 30) { series = fr.series; as_returns = (fr.as_returns === true); }
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

    const preds = [];
    for (let i = 0; i < test.length; i++) {
      const window = returns.slice(0, split + i);
      const reason = runReasonLayer(window, riskAversion);
      const wave = runWaveLayer(window);
      const validation = runValidationLayer(reason, wave);
      const predictedDir = reason.mu > 0 ? 1 : reason.mu < 0 ? -1 : 0;
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
});