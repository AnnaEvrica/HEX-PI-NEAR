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

// Standard normal CDF — to derive the engine's implied directional probability
// P(next return > 0) = Φ(μ/σ) from the reason layer's state-bin statistics.
// This is the engine's HONEST directional probability, distinct from exposure
// (a Kelly-sized position capped at 1 and scaled by risk aversion — not a
// probability). Grading exposure as a probability is meaningless; this is not.
function erf(x) {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
}
function normalCdf(x) { return 0.5 * (1 + erf(x / Math.SQRT2)); }

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
      // Engine's implied directional probability: P(next > 0) = Φ(μ/σ).
      // When the engine has no edge (INSUFFICIENT_DATA → σ=0) it is honestly 0.5.
      const pUp = (reason.sigma && reason.sigma > 0) ? normalCdf(reason.mu / reason.sigma) : 0.5;
      preds.push({
        probability: validation.probability,
        pUp,
        value: validation.support,
        confidence: validation.confidence,
        predictedDir, actualDir, realized: test[i],
      });
    }

    const valid = preds.filter(p => p.predictedDir !== 0 && p.actualDir !== 0);
    const directionalAccuracy = valid.length ? valid.filter(p => p.predictedDir === p.actualDir).length / valid.length : null;

    // --- Probability-based accuracy (proper scoring of the engine's P(up)) ---
    // Brier score: mean((pUp - outcome)²). 0.25 = a coin-flip forecaster; lower
    // is better, 0 = perfect. This is the honest "accuracy based on probability."
    const scored = preds.filter(p => p.actualDir !== 0);
    const outcomes = scored.map(p => p.actualDir > 0 ? 1 : 0);
    const brier = scored.length ? scored.reduce((s, p, i) => s + (p.pUp - outcomes[i]) ** 2, 0) / scored.length : null;
    const brierSkill = brier !== null ? (0.25 - brier) / 0.25 : null; // >0 beats random
    // Reliability: bucket pUp into deciles, compare mean(pUp) vs mean(outcome).
    // A perfectly calibrated engine has mean(pUp) == mean(outcome) in every bucket.
    const buckets = Array.from({ length: 10 }, (_, b) => ({ lo: b / 10, hi: (b + 1) / 10, ps: [], os: [] }));
    for (let i = 0; i < scored.length; i++) {
      const p = scored[i].pUp;
      const bIdx = Math.min(9, Math.floor(p * 10));
      buckets[bIdx].ps.push(p); buckets[bIdx].os.push(outcomes[i]);
    }
    const reliability = buckets
      .filter(b => b.ps.length > 0)
      .map(b => ({ forecast: r2(mean(b.ps)), observed: r2(mean(b.os)), count: b.ps.length }));
    const maxReliabilityGap = reliability.length ? Math.max(...reliability.map(b => Math.abs(b.forecast - b.observed))) : null;
    // Log-loss: -mean(o·ln p + (1-o)·ln(1-p)); 0.693 = random.
    let logLoss = null;
    if (scored.length) {
      let s = 0;
      for (let i = 0; i < scored.length; i++) {
        const p = Math.min(0.999, Math.max(0.001, scored[i].pUp));
        s += outcomes[i] * Math.log(p) + (1 - outcomes[i]) * Math.log(1 - p);
      }
      logLoss = -s / scored.length;
    }
    // Resolution: does a confident call (pUp away from 0.5) hit more often?
    const confident = scored.filter(p => Math.abs(p.pUp - 0.5) > 0.1);
    const confidentAccuracy = confident.length ? confident.filter(p => (p.pUp > 0.5 ? 1 : 0) === (p.actualDir > 0 ? 1 : 0)).length / confident.length : null;

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
      brierScore: r2(brier, 4),
      brierSkill: r2(brierSkill, 4),
      logLoss: r2(logLoss, 4),
      maxReliabilityGap: r2(maxReliabilityGap, 4),
      confidentAccuracy: r2(confidentAccuracy),
      reliability,
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