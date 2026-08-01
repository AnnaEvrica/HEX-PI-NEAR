// walkForwardAccuracy — walk-forward backtest measuring how well the
// hex6Engine's pre-trained state tables predict direction out-of-sample.
//
// For each out-of-sample step: encode the 6-bit state from the 7 most recent
// raw values (closes), look up the prediction in the pre-trained table, and
// compare to the realized next-bar return direction.
//
// Includes the forward learning loop (flip anti-predictive signals), per-direction
// accuracy, conviction-gated accuracy, and portfolio metrics (Sharpe/drawdown
// using conviction as exposure). Drops the old SCEFIT/scope/genetic/ratio-gate
// accessories that were coupled to the retired thinkingEngine's mu/sigma output.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import { predictFromSequence } from '../../shared/hex6Engine.ts';
import { mapTickerToDomain } from '../../shared/hex6Pipeline.ts';
import { fetchYahooReturns, fetchWeatherReturns } from '../../shared/marketDataClient.ts';

const mean = (a) => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
const r2 = (x, d = 4) => x === null || x === undefined ? null : Number(x.toFixed(d));

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    let { series, as_returns, ticker, trainRatio = 0.8, domain } = body;

    // Fetch real daily closes + returns. We use closes for state encoding
    // (hex6Engine's valuesToBits compares consecutive raw values, matching the
    // pre-trained tables) and returns for actual direction comparison.
    if ((!series || series.length < 30) && domain === 'weather') {
      const weather = await fetchWeatherReturns(40.71, -74.01, 1825);
      series = weather.closes;
      as_returns = false;
      ticker = 'WEATHER_NYC';
    }
    if ((!series || series.length < 30) && ticker) {
      const market = await fetchYahooReturns(ticker, 1825);
      series = market.closes;
      as_returns = false;
    }

    if (!series || series.length < 30) {
      return Response.json({ error: 'Need a series of >=30 numbers or a ticker to fetch.' }, { status: 400 });
    }

    // Ensure we have closes (for predictions) and returns (for actuals).
    let closes = series.map(Number);
    let returns;
    if (as_returns === false) {
      // Input is raw values — compute returns for actual direction.
      returns = [];
      for (let i = 1; i < closes.length; i++) {
        if (closes[i - 1] !== 0) returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
      }
    } else {
      // Input is already returns — use as both closes (state encoding will
      // compare consecutive returns) and returns (for actuals).
      returns = closes;
    }

    if (returns.length < 30) return Response.json({ error: 'Series too short after conversion.' }, { status: 400 });

    const resolvedDomain = mapTickerToDomain(ticker);
    const split = Math.max(20, Math.floor(returns.length * trainRatio));
    const test = returns.slice(split);
    if (test.length < 5) return Response.json({ error: 'Not enough out-of-sample points.' }, { status: 400 });

    const preds = [];
    const recentErrors = [];

    for (let i = 0; i < test.length; i++) {
      // 7 most recent closes up to and including the current bar.
      const recentCloses = closes.slice(0, split + i + 1).slice(-7);
      if (recentCloses.length < 7) continue;

      const hex6 = predictFromSequence(resolvedDomain, recentCloses);
      const rawDir = hex6.predicted_direction === 'UP' ? 1 : -1;
      const actualDir = test[i] > 0 ? 1 : test[i] < 0 ? -1 : 0;

      // Forward learning loop: track the engine's RAW directional accuracy.
      // When significantly anti-predictive (< 45% over 30 bars), flip the
      // prediction. Only fires on genuine inversion, not temporary streaks.
      if (rawDir !== 0 && actualDir !== 0) {
        recentErrors.push(rawDir - actualDir);
        if (recentErrors.length > 30) recentErrors.shift();
      }
      let predictedDir = rawDir;
      if (recentErrors.length >= 15) {
        const recentAcc = recentErrors.filter(e => e === 0).length / recentErrors.length;
        if (recentAcc < 0.45) predictedDir = -rawDir;
      }

      // Exposure: long-only, scaled by conviction when direction is UP.
      const exposure = predictedDir === 1 ? hex6.personal_call_strength : 0;

      preds.push({
        predictedDir, actualDir, rawDir, realized: test[i],
        conviction: hex6.personal_call_strength,
        highConviction: hex6.high_conviction,
        nObs: hex6.n_observations_this_state,
        pUp: hex6.p_up,
        baseRate: hex6.domain_base_rate,
        exposure,
      });
    }

    // --- Core accuracy metrics ---
    const valid = preds.filter(p => p.predictedDir !== 0 && p.actualDir !== 0);
    const directionalAccuracy = valid.length ? valid.filter(p => p.predictedDir === p.actualDir).length / valid.length : null;

    // Per-direction separation: UP and DOWN calls scored independently.
    const upPreds = valid.filter(p => p.predictedDir === 1);
    const downPreds = valid.filter(p => p.predictedDir === -1);
    const upAccuracy = upPreds.length ? upPreds.filter(p => p.actualDir === 1).length / upPreds.length : null;
    const downAccuracy = downPreds.length ? downPreds.filter(p => p.actualDir === -1).length / downPreds.length : null;

    // Conviction gate: does high-conviction predict better than low?
    const eligible = preds.filter(p => p.actualDir !== 0);
    const halfC = Math.floor(eligible.length / 2);
    const byConv = [...eligible].sort((a, b) => a.conviction - b.conviction);
    const lowConv = byConv.slice(0, halfC);
    const highConv = byConv.slice(halfC);
    const highConvictionAccuracy = highConv.length ? highConv.filter(p => p.predictedDir === p.actualDir).length / highConv.length : null;
    const lowConvictionAccuracy = lowConv.length ? lowConv.filter(p => p.predictedDir === p.actualDir).length / lowConv.length : null;

    // Sample support: does well-supported (n >= 20) predict better than thin?
    const wellSup = eligible.filter(p => p.nObs >= 20);
    const thinSup = eligible.filter(p => p.nObs < 20);
    const wellSupportedAccuracy = wellSup.length ? wellSup.filter(p => p.predictedDir === p.actualDir).length / wellSup.length : null;
    const thinSampleAccuracy = thinSup.length ? thinSup.filter(p => p.predictedDir === p.actualDir).length / thinSup.length : null;

    // Raw (pre-flip) accuracy — shows whether the forward learning loop helped.
    const rawValid = preds.filter(p => p.rawDir !== 0 && p.actualDir !== 0);
    const rawAccuracy = rawValid.length ? rawValid.filter(p => p.rawDir === p.actualDir).length / rawValid.length : null;

    // --- Brier score (base-rate corrected) ---
    // The honest null is p*(1-p) using the domain's OWN base rate, not 0.25.
    // BTC's base rate is ~0.598, so its null is 0.241 — a Brier of 0.235 looks
    // like skill against 0.25 but is noise against 0.241.
    const brierEligible = preds.filter(p => p.actualDir !== 0);
    const brierScore = brierEligible.length
      ? brierEligible.reduce((s, p) => s + Math.pow(p.pUp - (p.actualDir === 1 ? 1 : 0), 2), 0) / brierEligible.length
      : null;
    const domainBaseRate = brierEligible.length ? brierEligible[0].baseRate : 0.5;
    const brierNull = domainBaseRate * (1 - domainBaseRate);
    const brierSkillScore = (brierScore !== null && brierNull > 0) ? 1 - brierScore / brierNull : null;

    // --- Domain-aware confidence gate ---
    // Per the README: high_conviction gating HELPS BTC, HORSE_RACING, WEATHER
    // but HURTS NFL (unfiltered baseline is the best signal there).
    const GATED_DOMAINS = ['BTC', 'HORSE_RACING', 'WEATHER'];
    const gated = GATED_DOMAINS.includes(resolvedDomain)
      ? valid.filter(p => p.highConviction)
      : valid;
    const domainGatedAccuracy = gated.length ? gated.filter(p => p.predictedDir === p.actualDir).length / gated.length : null;

    // Portfolio metrics: conviction-scaled long-only exposure.
    const sharpe = (rets) => {
      if (rets.length < 3) return 0;
      const m = rets.reduce((s, x) => s + x, 0) / rets.length;
      const v = rets.reduce((s, x) => s + (x - m) ** 2, 0) / rets.length;
      const sd = Math.sqrt(v);
      return sd < 1e-8 ? 0 : (m / sd) * Math.sqrt(252);
    };
    const maxDd = (rets) => {
      let cum = 1, peak = 1, mdd = 0;
      for (const r of rets) { cum *= (1 + r); peak = Math.max(peak, cum); mdd = Math.min(mdd, cum / peak - 1); }
      return mdd;
    };
    const portfolioRets = preds.map(p => p.exposure * p.realized);
    const buyHoldRets = preds.map(p => p.realized);

    return Response.json({
      ticker: ticker || 'SUPPLIED',
      domain: resolvedDomain,
      mode: 'HEX6_PRE_TRAINED',
      seriesLength: closes.length,
      trainSize: split,
      testSize: test.length,
      predictionsEvaluated: valid.length,
      coverage: r2(eligible.length ? valid.length / eligible.length : 0),
      directionalAccuracy: r2(directionalAccuracy),
      domainGatedAccuracy: r2(domainGatedAccuracy),
      domainGatedCount: gated.length,
      domainGatedCoverage: r2(eligible.length ? gated.length / eligible.length : 0),
      brierScore: r2(brierScore),
      brierNull: r2(brierNull),
      brierSkillScore: r2(brierSkillScore),
      rawAccuracy: r2(rawAccuracy),
      upAccuracy: r2(upAccuracy),
      downAccuracy: r2(downAccuracy),
      upPredictions: upPreds.length,
      downPredictions: downPreds.length,
      highConvictionAccuracy: r2(highConvictionAccuracy),
      lowConvictionAccuracy: r2(lowConvictionAccuracy),
      wellSupportedAccuracy: r2(wellSupportedAccuracy),
      thinSampleAccuracy: r2(thinSampleAccuracy),
      avgConviction: r2(mean(preds.map(p => p.conviction))),
      portfolioSharpe: r2(sharpe(portfolioRets), 2),
      buyHoldSharpe: r2(sharpe(buyHoldRets), 2),
      portfolioMdd: r2(maxDd(portfolioRets), 2),
      buyHoldMdd: r2(maxDd(buyHoldRets), 2),
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}