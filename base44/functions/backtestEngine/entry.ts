/**
 * backtestEngine — Runs HEX6 BLE v5.0 SCEFM over a historical date range.
 * Returns equity curve, Sharpe, drawdown, CAGR, Calmar vs SPY benchmark.
 * Mints one EGTS receipt per backtest run for auditability.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// ── Statistical helpers ──────────────────────────────────────────────────────

function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr) {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1));
}

function normalPpf(p) {
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383577518672690e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pLow = 0.02425, pHigh = 1 - pLow;
  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  } else if (p <= pHigh) {
    const q = p - 0.5, r = q*q;
    return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q / (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
  }
  const q = Math.sqrt(-2 * Math.log(1-p));
  return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
}

function tPpf(p, df) {
  if (df >= 30) return normalPpf(p);
  const a = 1/(df-0.5), b = 48/(a*a);
  const c = ((20700*a/b-98)*a-16)*a+96.36;
  const d = ((94.5/(b+c)-3)/b+1)*Math.sqrt(a*Math.PI/2)*df;
  let x = d * normalPpf(p);
  const x2 = x*x;
  if (x2 > 0.5*df+0.2) x = Math.pow(2*df*(1-(1-a)*x2/(df+1/x2))-df, 0.5);
  return x;
}

// ── HEX6 BLE Engine (inline, no local imports) ───────────────────────────────

class Hex6BLEEngine {
  constructor(window = 6, riskAversion = 2.5, frictionBps = 35) {
    this.window = window;
    this.riskAversion = riskAversion;
    this.friction = frictionBps / 10000;
    this.hive = {};
  }

  encodeState(returns) {
    return parseInt(returns.slice(-this.window).map(r => r > 0 ? '1' : '0').join(''), 2);
  }

  trainHive(assetReturns) {
    for (let i = this.window; i < assetReturns.length; i++) {
      const state = this.encodeState(assetReturns.slice(i - this.window, i));
      const target = assetReturns[i];
      if (!this.hive[state]) this.hive[state] = [];
      this.hive[state].push(target);
    }
  }

  getStateDistribution(currentReturns) {
    const state = this.encodeState(currentReturns.slice(-this.window));
    const dist = this.hive[state];
    if (!dist || dist.length < 3) return [0, 1e-6, 0];
    return [mean(dist), stdDev(dist), dist.length];
  }

  calculateExposureField(mu, sigma, n) {
    if (sigma === 0 || n < 3) return 0;
    const tCrit = tPpf(0.95, n - 1);
    const muLb = mu - tCrit * (sigma / Math.sqrt(n)) - this.friction;
    if (muLb <= 0) return 0;
    return Math.min(Math.max((muLb / sigma ** 2) / this.riskAversion, 0), 1);
  }

  allocate(assetData) {
    const exposures = {};
    let totalExp = 0;
    for (const [asset, returns] of Object.entries(assetData)) {
      const [mu, sig, n] = this.getStateDistribution(returns);
      const exp = this.calculateExposureField(mu, sig, n);
      exposures[asset] = exp;
      totalExp += exp;
    }
    if (totalExp > 1) for (const k of Object.keys(exposures)) exposures[k] /= totalExp;
    const cash = 1 - Object.values(exposures).reduce((a, b) => a + b, 0);
    return { exposures, cash, totalExp: Math.min(totalExp, 1) };
  }
}

// ── Backtest logic ────────────────────────────────────────────────────────────

function runBacktest({ returnsMap, trainWindow = 120, stepDays = 21, riskAversion = 2.5, frictionBps = 35 }) {
  const assets = Object.keys(returnsMap);
  const minLen = Math.min(...assets.map(a => returnsMap[a].length));
  if (minLen < trainWindow + 10) throw new Error('Insufficient data for backtest');

  const equityCurve = [1.0];
  const dates = [];
  const weightHistory = [];

  for (let i = trainWindow; i < minLen - 1; i += stepDays) {
    const engine = new Hex6BLEEngine(6, riskAversion, frictionBps);
    for (const asset of assets) {
      engine.trainHive(returnsMap[asset].slice(0, i));
    }
    const assetData = {};
    for (const asset of assets) {
      assetData[asset] = returnsMap[asset].slice(i - 30, i);
    }
    const { exposures, cash } = engine.allocate(assetData);
    const step = Math.min(stepDays, minLen - 1 - i);
    let periodReturn = 0;
    for (const asset of assets) {
      const w = exposures[asset] || 0;
      const sliceReturns = returnsMap[asset].slice(i, i + step);
      const compounded = sliceReturns.reduce((acc, r) => acc * (1 + r), 1) - 1;
      periodReturn += w * compounded;
    }
    const prev = equityCurve[equityCurve.length - 1];
    equityCurve.push(prev * (1 + periodReturn));
    dates.push(i);
    weightHistory.push({ day: i, weights: { ...exposures, CASH: cash } });
  }

  // Performance metrics
  const totalReturn = equityCurve[equityCurve.length - 1] - 1;
  const years = (minLen - trainWindow) / 252;
  const cagr = Math.pow(equityCurve[equityCurve.length - 1], 1 / years) - 1;

  const dailyReturns = [];
  for (let i = 1; i < equityCurve.length; i++) {
    dailyReturns.push(equityCurve[i] / equityCurve[i - 1] - 1);
  }
  const sharpe = dailyReturns.length > 1
    ? (mean(dailyReturns) / stdDev(dailyReturns)) * Math.sqrt(252 / stepDays)
    : 0;

  let peak = equityCurve[0], maxDrawdown = 0;
  for (const v of equityCurve) {
    if (v > peak) peak = v;
    const dd = (peak - v) / peak;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  const calmar = maxDrawdown > 0 ? cagr / maxDrawdown : 0;

  return { equityCurve, dates, weightHistory, totalReturn, cagr, sharpe, maxDrawdown, calmar, years };
}

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { returnsMap, benchmarkReturns, riskAversion = 2.5, frictionBps = 35, label = 'BACKTEST' } = body;

    if (!returnsMap || Object.keys(returnsMap).length === 0) {
      return Response.json({ error: 'returnsMap required' }, { status: 400 });
    }

    const result = runBacktest({ returnsMap, riskAversion, frictionBps });

    // Benchmark (SPY) stats
    let benchStats = null;
    if (benchmarkReturns && benchmarkReturns.length > 10) {
      const bEquity = [1.0];
      for (const r of benchmarkReturns) bEquity.push(bEquity[bEquity.length - 1] * (1 + r));
      const bTotal = bEquity[bEquity.length - 1] - 1;
      const bYears = benchmarkReturns.length / 252;
      const bCagr = Math.pow(1 + bTotal, 1 / bYears) - 1;
      const bSharpe = benchmarkReturns.length > 1
        ? (mean(benchmarkReturns) / stdDev(benchmarkReturns)) * Math.sqrt(252)
        : 0;
      let bPeak = 1, bMdd = 0;
      for (const v of bEquity) {
        if (v > bPeak) bPeak = v;
        const dd = (bPeak - v) / bPeak;
        if (dd > bMdd) bMdd = dd;
      }
      benchStats = { cagr: bCagr, sharpe: bSharpe, maxDrawdown: bMdd, equityCurve: bEquity };
    }

    // Mint EGTS receipt for this backtest run
    const receiptPayload = {
      id: crypto.randomUUID(),
      asset_id: `BACKTEST_${Object.keys(returnsMap).join('_')}`,
      event_type: 'MANUAL',
      allocation_data: {
        label,
        cagr: result.cagr,
        sharpe: result.sharpe,
        maxDrawdown: result.maxDrawdown,
        calmar: result.calmar,
        totalReturn: result.totalReturn,
        years: result.years,
        assets: Object.keys(returnsMap),
        riskAversion,
        frictionBps,
      },
      triggered_by: user.email || 'BACKTEST_ENGINE',
      metadata: { engineVersion: 'HEX6-BLE-v5.0-BACKTEST', runAt: new Date().toISOString() },
      crypto_hash: Array.from(new Uint8Array(
        await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify({ label, result: result.cagr })))
      )).map(b => b.toString(16).padStart(2, '0')).join(''),
      schema_version: '1.0.0',
      is_verified: true,
    };

    const supaUrl = Deno.env.get('SUPABASE_URL');
    const supaKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (supaUrl && supaKey) {
      await fetch(`${supaUrl}/rest/v1/egts_receipts`, {
        method: 'POST',
        headers: {
          'apikey': supaKey,
          'Authorization': `Bearer ${supaKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify(receiptPayload),
      });
    }

    return Response.json({ ...result, benchmark: benchStats });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});