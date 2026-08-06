// Walk-forward ablation for the OHLCV confluence layer.
// Production HEX remains untouched: this is a shadow experiment with no LLM
// calls, no persistence, and no fitted parameters.
import { predictFromSequence } from './hex6Engine.ts';
import { buildChartContext, confluenceAgrees } from './chartContext.ts';
import { runHybridArchetypeExperiment } from './hybridArchetypes.ts';

const round = (x: number | null, n = 4) => x == null || !Number.isFinite(x) ? null : Number(x.toFixed(n));
const mean = (xs: number[]) => xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

export interface ExperimentBarSet {
  ticker: string;
  closes: number[];
  highs: number[];
  lows: number[];
  volumes: number[];
  timestamps: number[];
}

type Variant = 'baseline' | 'soft_confluence' | 'strict_confluence';
const VARIANTS: Variant[] = ['baseline', 'soft_confluence', 'strict_confluence'];

function exposureFor(variant: Variant, direction: number, conviction: number, agrees: boolean | null) {
  const base = direction * clamp(conviction, 0.1, 1);
  if (variant === 'baseline') return base;
  if (variant === 'strict_confluence') return agrees === true ? base : 0;
  return base * (agrees === true ? 1 : agrees === false ? 0.25 : 0.5);
}

function metrics(returns: number[], horizon: number, hits: number[], active: number) {
  if (!returns.length) return null;
  const annual = 365 / horizon;
  const m = mean(returns);
  const variance = mean(returns.map((x) => (x - m) ** 2));
  const downside = returns.filter((x) => x < 0);
  const downsideDev = Math.sqrt(mean(downside.map((x) => x ** 2)));
  const sharpe = variance > 0 ? m / Math.sqrt(variance) * Math.sqrt(annual) : 0;
  const sortino = downsideDev > 0 ? m / downsideDev * Math.sqrt(annual) : 0;
  let equity = 1, peak = 1, mdd = 0;
  for (const r of returns) { equity *= 1 + r; peak = Math.max(peak, equity); mdd = Math.min(mdd, equity / peak - 1); }
  const years = returns.length * horizon / 365;
  const cagr = years > 0 && equity > 0 ? equity ** (1 / years) - 1 : -1;
  const calmar = mdd < 0 ? cagr / Math.abs(mdd) : 0;
  return {
    observations: returns.length,
    coverage: round(active / returns.length),
    directional_accuracy: round(hits.length ? mean(hits) : null),
    total_return: round(equity - 1), cagr: round(cagr), sharpe: round(sharpe),
    sortino: round(sortino), max_drawdown: round(mdd), calmar: round(calmar),
  };
}

// Deterministic moving-block bootstrap: probability the candidate's mean
// portfolio return exceeds baseline while preserving short volatility clusters.
function bootstrapProbability(candidate: number[], baseline: number[], seed: number, reps = 400, block = 7) {
  const n = Math.min(candidate.length, baseline.length);
  if (n < 30) return null;
  let state = seed >>> 0;
  const rand = () => { state = (1664525 * state + 1013904223) >>> 0; return state / 4294967296; };
  let wins = 0;
  for (let r = 0; r < reps; r++) {
    let diff = 0, count = 0;
    while (count < n) {
      const start = Math.floor(rand() * Math.max(1, n - block));
      for (let j = 0; j < block && count < n; j++, count++) diff += candidate[start + j] - baseline[start + j];
    }
    if (diff > 0) wins++;
  }
  return round(wins / reps);
}

export function runConfluenceExperiment(series: ExperimentBarSet[], frictionBps = 10) {
  const horizonResults: Record<string, any> = {};
  const cost = frictionBps / 10000;

  for (const horizon of [1, 3]) {
    const byVariant: Record<Variant, Map<number, number[]>> = {
      baseline: new Map(), soft_confluence: new Map(), strict_confluence: new Map(),
    };
    const hitByVariant: Record<Variant, number[]> = { baseline: [], soft_confluence: [], strict_confluence: [] };
    const activeByVariant: Record<Variant, number> = { baseline: 0, soft_confluence: 0, strict_confluence: 0 };
    const priorExposure: Record<string, Record<Variant, number>> = {};
    const assetSummary: Record<string, any> = {};

    for (const bars of series) {
      const n = bars.closes.length;
      const start = Math.max(120, Math.floor(n * 0.6)); // untouched final 40%
      const rawOutcomes: number[] = [];
      priorExposure[bars.ticker] = { baseline: 0, soft_confluence: 0, strict_confluence: 0 };
      const local: Record<Variant, number[]> = { baseline: [], soft_confluence: [], strict_confluence: [] };

      for (let i = start; i + horizon < n; i += horizon) {
        const raw = predictFromSequence('BTC', bars.closes.slice(i - 6, i + 1));
        const rawDirection = raw.predicted_direction === 'UP' ? 1 : -1;
        const recentAccuracy = rawOutcomes.slice(-30);
        const antiPredictive = recentAccuracy.length >= 15 && mean(recentAccuracy) < 0.45;
        const direction = antiPredictive ? -rawDirection : rawDirection;
        const ctx = buildChartContext(
          bars.closes.slice(0, i + 1), bars.highs.slice(0, i + 1),
          bars.lows.slice(0, i + 1), bars.volumes.slice(0, i + 1),
        );
        const agrees = confluenceAgrees(ctx, direction === 1 ? 'UP' : 'DOWN');
        const realized = bars.closes[i + horizon] / bars.closes[i] - 1;
        const actualDirection = realized > 0 ? 1 : realized < 0 ? -1 : 0;
        const timestamp = bars.timestamps[i] || i;

        for (const variant of VARIANTS) {
          const exposure = exposureFor(variant, direction, raw.personal_call_strength, agrees);
          const turnover = Math.abs(exposure - priorExposure[bars.ticker][variant]);
          const strategyReturn = exposure * realized - turnover * cost;
          priorExposure[bars.ticker][variant] = exposure;
          local[variant].push(strategyReturn);
          if (!byVariant[variant].has(timestamp)) byVariant[variant].set(timestamp, []);
          byVariant[variant].get(timestamp)!.push(strategyReturn);
          if (Math.abs(exposure) > 0.001) {
            activeByVariant[variant]++;
            if (actualDirection !== 0) hitByVariant[variant].push(Math.sign(exposure) === actualDirection ? 1 : 0);
          }
        }

        // Update calibration only after this prediction has been scored. The
        // calibration target is always the next daily move, including inside
        // the non-overlapping three-day evaluation.
        const nextDayDirection = bars.closes[i + 1] > bars.closes[i] ? 1 : bars.closes[i + 1] < bars.closes[i] ? -1 : 0;
        if (nextDayDirection !== 0) {
          rawOutcomes.push(rawDirection === nextDayDirection ? 1 : 0);
          if (rawOutcomes.length > 30) rawOutcomes.shift();
        }
      }

      assetSummary[bars.ticker] = Object.fromEntries(VARIANTS.map((v) => [v, metrics(local[v], horizon, [], local[v].filter((x) => x !== 0).length)]));
    }

    const portfolioReturns: Record<Variant, number[]> = { baseline: [], soft_confluence: [], strict_confluence: [] };
    for (const variant of VARIANTS) {
      const dates = [...byVariant[variant].keys()].sort((a, b) => a - b);
      portfolioReturns[variant] = dates.map((d) => mean(byVariant[variant].get(d) || []));
    }
    const variantMetrics = Object.fromEntries(VARIANTS.map((v) => [v,
      metrics(portfolioReturns[v], horizon, hitByVariant[v], activeByVariant[v] / series.length)
    ]));
    for (const variant of ['soft_confluence', 'strict_confluence'] as Variant[]) {
      variantMetrics[variant].probability_mean_return_beats_baseline = bootstrapProbability(
        portfolioReturns[variant], portfolioReturns.baseline, 6000 + horizon * 10 + variant.length,
      );
    }

    // Promotion score rewards return quality and penalizes drawdown. A candidate
    // must also clear bootstrap evidence; no winner is forced from noisy data.
    const eligible = (['soft_confluence', 'strict_confluence'] as Variant[]).filter((v) =>
      variantMetrics[v].probability_mean_return_beats_baseline >= 0.9 &&
      variantMetrics[v].sharpe > variantMetrics.baseline.sharpe &&
      variantMetrics[v].max_drawdown >= variantMetrics.baseline.max_drawdown
    );
    eligible.sort((a, b) => (variantMetrics[b].sharpe + variantMetrics[b].calmar) - (variantMetrics[a].sharpe + variantMetrics[a].calmar));

    horizonResults[`${horizon}d`] = {
      variants: variantMetrics,
      asset_breakdown: assetSummary,
      promotion_candidate: eligible[0] || null,
      verdict: eligible[0]
        ? `${eligible[0]} cleared the pre-registered risk and bootstrap gates`
        : 'no confluence variant earned promotion; keep it in shadow mode',
    };
  }

  const archetypes = runHybridArchetypeExperiment(series);
  return {
    design: {
      universe: series.map((s) => s.ticker), horizons: [1, 3], out_of_sample: 'final 40%',
      friction_bps: frictionBps, bootstrap_repetitions: 400,
      variants: {
        baseline: 'HEX direction sized by conviction',
        soft_confluence: 'same direction; full size on agreement, half on neutral, quarter on conflict',
        strict_confluence: 'same direction; participate only when chart and engine agree',
      },
      safeguards: ['no future data in signals', 'non-overlapping 3-day outcomes', 'no fitted thresholds', 'production remains unchanged'],
    },
    horizons: horizonResults,
    archetypes,
  };
}