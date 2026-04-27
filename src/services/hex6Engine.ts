/**
 * HEX6 BLE v5.0 — State-Conditioned Exposure Field Model (SCEFM)
 * Institutional Portfolio Allocation Engine
 *
 * TypeScript translation of the proprietary Python HEX6 BLE engine.
 * Mathematical formulas and constants are preserved exactly.
 *
 * EGTS = Evrica Global Token Standard.
 * Async export: output is fed directly into mintEgtsAssetFromPie() from egtsService.
 */

import { mintEgtsAssetFromPie } from './egtsService';

// ---------------------------------------------------------------------------
// Statistical Utilities (replaces numpy / scipy.stats)
// ---------------------------------------------------------------------------

/** Arithmetic mean of an array */
function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/** Sample standard deviation (ddof=1, matches numpy std(ddof=1)) */
function stdDev(arr: number[], ddof = 1): number {
  const m = mean(arr);
  const variance = arr.reduce((sum, x) => sum + (x - m) ** 2, 0) / (arr.length - ddof);
  return Math.sqrt(variance);
}

/**
 * Inverse CDF of the Student's t-distribution (two-tailed approximation).
 * Matches scipy.stats.t.ppf(0.95, df) used in calculate_exposure_field.
 *
 * Uses a rational approximation of the normal quantile for large df,
 * and a Hill (1970) series approximation for small df.
 */
function tPpf(p: number, df: number): number {
  // For large df, t ≈ normal quantile (very accurate above df ~30)
  if (df >= 30) {
    return normalPpf(p);
  }

  // Abramowitz & Stegun / Hill approximation for small df
  const a = 1 / (df - 0.5);
  const b = 48 / (a * a);
  const c = ((20700 * a / b - 98) * a - 16) * a + 96.36;
  const d = ((94.5 / (b + c) - 3) / b + 1) * Math.sqrt(a * Math.PI / 2) * df;
  let x = d * normalPpf(p);
  const x2 = x * x;
  if (x2 > 0.5 * df + 0.2) {
    x = Math.pow(2 * df * (1 - (1 - a) * x2 / (df + 1 / x2)) - df, 0.5);
  }
  return x;
}

/** Rational approximation of the standard normal inverse CDF (Beasley-Springer-Moro) */
function normalPpf(p: number): number {
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.383577518672690e2, -3.066479806614716e1, 2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416,
  ];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
           ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= pHigh) {
    const q = p - 0.5;
    const r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
           (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
            ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
}

// ---------------------------------------------------------------------------
// HEX6 BLE Engine Class
// ---------------------------------------------------------------------------

type AssetData = Record<string, number[]>;
type Portfolio = Record<string, number>;
type Hive = Record<number, number[]>;

export interface Hex6AllocationResult {
  portfolio: Portfolio;
  exposures: Portfolio;
  marketStates: Record<string, number>;
  totalExposure: number;
  cashResidual: number;
}

export class Hex6BLEEngine {
  private window: number;
  private riskAversion: number;
  private friction: number;
  /** The HIVE: state-conditioned historical distribution store */
  private hive: Hive;

  constructor(
    window = 6,
    riskAversion = 2.5,
    frictionBps = 35
  ) {
    this.window = window;
    this.riskAversion = riskAversion;
    this.friction = frictionBps / 10000.0; // bps → decimal
    this.hive = {};
  }

  // -------------------------------------------------------------------------
  // Layer 1: Symbolic State Encoding (STSA)
  // -------------------------------------------------------------------------

  /**
   * Encode the last `window` returns as a binary integer.
   * 1 if return > 0, else 0. Matches Python _encode_state exactly.
   */
  private encodeState(returns: number[]): number {
    const slice = returns.slice(-this.window);
    const binary = slice.map((r) => (r > 0 ? '1' : '0')).join('');
    return parseInt(binary, 2);
  }

  // -------------------------------------------------------------------------
  // Training: Build HIVE from historical returns
  // -------------------------------------------------------------------------

  /**
   * Train the HIVE with historical asset returns.
   * Equivalent to Python train_hive().
   */
  trainHive(assetReturns: number[]): void {
    for (let i = this.window; i < assetReturns.length; i++) {
      const state = this.encodeState(assetReturns.slice(i - this.window, i));
      const target = assetReturns[i];
      if (this.hive[state] === undefined) {
        this.hive[state] = [];
      }
      this.hive[state].push(target);
    }
  }

  // -------------------------------------------------------------------------
  // Layer 2: State-Conditioned Distribution
  // -------------------------------------------------------------------------

  /**
   * Return [mu, sigma] for the current state's historical distribution.
   * Falls back to [0, 1e-6] if state is unseen or has fewer than 3 samples.
   * Matches Python get_state_distribution() exactly.
   */
  private getStateDistribution(currentReturns: number[]): [number, number] {
    const state = this.encodeState(currentReturns.slice(-this.window));
    const dist = this.hive[state];

    if (!dist || dist.length < 3) {
      return [0, 1e-6];
    }

    const mu = mean(dist);
    const sigma = stdDev(dist, 1); // ddof=1
    return [mu, sigma];
  }

  // -------------------------------------------------------------------------
  // Layer 3: Exposure Field Generator E(S_t) → [0, 1]
  // -------------------------------------------------------------------------

  /**
   * Compute the exposure scalar for a given (mu, sigma, n_samples).
   *
   * Formula:
   *   t_crit = t.ppf(0.95, df=n-1)
   *   mu_lb  = mu - (t_crit * sigma / sqrt(n)) - friction
   *   if mu_lb <= 0: return 0.0
   *   edge   = mu_lb / sigma²
   *   exposure = clip(edge / riskAversion, 0, 1)
   *
   * Matches Python calculate_exposure_field() exactly.
   */
  private calculateExposureField(mu: number, sigma: number, nSamples: number): number {
    if (sigma === 0 || nSamples < 3) {
      return 0.0;
    }

    const tCrit = tPpf(0.95, nSamples - 1);
    const muLb = mu - tCrit * (sigma / Math.sqrt(nSamples)) - this.friction;

    if (muLb <= 0) {
      return 0.0; // Asymptotically zero exposure
    }

    // Kelly-criterion inspired exposure mapping
    const edge = muLb / sigma ** 2;
    const exposure = Math.min(Math.max(edge / this.riskAversion, 0.0), 1.0); // clip [0, 1]
    return exposure;
  }

  // -------------------------------------------------------------------------
  // Layer 4: Portfolio Optimizer
  // -------------------------------------------------------------------------

  /**
   * Generate the full portfolio weight vector for all assets.
   * Constrains total exposure to ≤ 1.0 (no leverage in base model).
   * Appends USDC_Reserve as cash residual.
   *
   * Matches Python generate_portfolio_vector() exactly.
   */
  generatePortfolioVector(assetData: AssetData): Hex6AllocationResult {
    const exposures: Portfolio = {};
    const marketStates: Record<string, number> = {};
    let totalExp = 0.0;

    for (const [asset, returns] of Object.entries(assetData)) {
      const [mu, sig] = this.getStateDistribution(returns);
      const state = this.encodeState(returns.slice(-this.window));
      const n = (this.hive[state] ?? []).length;
      const exp = this.calculateExposureField(mu, sig, n);

      exposures[asset] = exp;
      marketStates[asset] = state;
      totalExp += exp;
    }

    // Constrain to 1.0 — no leverage in base model
    if (totalExp > 1.0) {
      for (const k of Object.keys(exposures)) {
        exposures[k] /= totalExp;
      }
    }

    const cashResidual = 1.0 - Object.values(exposures).reduce((a, b) => a + b, 0);
    exposures['USDC_Reserve'] = cashResidual;

    return {
      portfolio: exposures,
      exposures,
      marketStates,
      totalExposure: totalExp > 1.0 ? 1.0 : totalExp,
      cashResidual,
    };
  }
}

// ---------------------------------------------------------------------------
// Public API: calculateTargetAllocation (async — wired to EGTS)
// ---------------------------------------------------------------------------

export interface AllocationInput {
  /** Asset returns time series: { BTC: [0.01, -0.02, ...], ETH: [...] } */
  assetData: AssetData;
  /** Historical returns for training the HIVE (same assets, longer window) */
  historicalData: AssetData;
  /** Who triggered this allocation (for EGTS receipt) */
  triggeredBy?: string;
  /** Engine config overrides */
  config?: {
    window?: number;
    riskAversion?: number;
    frictionBps?: number;
  };
}

export interface AllocationOutput {
  portfolio: Portfolio;
  totalExposure: number;
  cashResidual: number;
  marketStates: Record<string, number>;
  egtsReceipts: unknown[];
  engineVersion: string;
}

/**
 * calculateTargetAllocation
 *
 * Main entry point for the HEX6 BLE v5.0 engine.
 * Trains the HIVE, generates the portfolio vector, and mints
 * an EGTS receipt for every asset allocation decision.
 *
 * @param input  AllocationInput
 * @returns      AllocationOutput with portfolio weights + EGTS receipts
 */
export async function calculateTargetAllocation(input: AllocationInput): Promise<AllocationOutput> {
  const { assetData, historicalData, triggeredBy = 'HEX6_BLE_v5', config = {} } = input;

  const engine = new Hex6BLEEngine(
    config.window ?? 6,
    config.riskAversion ?? 2.5,
    config.frictionBps ?? 35
  );

  // Train the HIVE on historical data
  for (const [asset, returns] of Object.entries(historicalData)) {
    engine.trainHive(returns);
  }

  // Generate portfolio allocation vector
  const result = engine.generatePortfolioVector(assetData);

  // Mint EGTS receipts for every allocation decision (governance loop)
  const egtsReceipts = await Promise.all(
    Object.entries(result.portfolio)
      .filter(([asset]) => asset !== 'USDC_Reserve')
      .map(([asset, weight]) =>
        mintEgtsAssetFromPie({
          assetId: asset,
          eventType: 'ALLOCATION',
          allocationData: {
            targetWeight: weight,
            totalExposure: result.totalExposure,
            cashResidual: result.cashResidual,
            marketState: result.marketStates[asset] ?? null,
            engineLayer: 'SCEFM-L4',
          },
          triggeredBy,
          metadata: {
            engineVersion: 'HEX6-BLE-v5.0',
            window: config.window ?? 6,
            riskAversion: config.riskAversion ?? 2.5,
            frictionBps: config.frictionBps ?? 35,
          },
        })
      )
  );

  return {
    portfolio: result.portfolio,
    totalExposure: result.totalExposure,
    cashResidual: result.cashResidual,
    marketStates: result.marketStates,
    egtsReceipts,
    engineVersion: 'HEX6-BLE-v5.0-SCEFM',
  };
}