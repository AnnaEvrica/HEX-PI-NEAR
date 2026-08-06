import { predictFromSequence } from './hex6Engine.ts';
import { buildChartContext, confluenceAgrees, ChartContext } from './chartContext.ts';
import type { ExperimentBarSet } from './confluenceExperiment.ts';

const mean = (xs: number[]) => xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;
const round = (x: number | null, n = 4) => x == null || !Number.isFinite(x) ? null : Number(x.toFixed(n));

export interface PerceptionLens {
  state: number;
  grid: { x: number; y: number; z: number; label: string };
  momentum_shape: string;
  structural_family: string;
  volume_regime: 'expanding' | 'normal' | 'thin' | 'unknown';
  value_location: 'above' | 'inside' | 'below' | 'unknown';
  confluence: 'aligned' | 'mixed' | 'contested';
  prediction_status: 'STRUCTURE_ALIGNED' | 'STRUCTURE_MIXED' | 'STRUCTURE_CONTESTED';
  qualified_confidence: number | null;
  archetype_id: string;
}

function bitsFor(state: number) {
  return state.toString(2).padStart(6, '0').split('').map(Number);
}

function momentumShape(state: number) {
  const bits = bitsFor(state);
  const early = bits.slice(0, 3).reduce((s, x) => s + x, 0);
  const late = bits.slice(3).reduce((s, x) => s + x, 0);
  if (early <= 1 && late >= 2) return 'bullish_reversal';
  if (early >= 2 && late <= 1) return 'bearish_reversal';
  if (late > early) return 'upward_acceleration';
  if (late < early) return 'downward_acceleration';
  return late >= 2 ? 'up_persistence' : late <= 1 ? 'down_persistence' : 'balanced_rotation';
}

export function classifyHybridArchetype(
  state: number,
  ctx: ChartContext | null,
  direction: 'UP' | 'DOWN',
  conviction = 0,
): PerceptionLens {
  const x = (state >> 4) & 3;
  const y = (state >> 2) & 3;
  const z = state & 3;
  const agrees = confluenceAgrees(ctx, direction);
  const confluence = agrees === true ? 'aligned' : agrees === false ? 'contested' : 'mixed';
  const volume = ctx?.relative_volume == null ? 'unknown' : ctx.relative_volume >= 1 ? 'expanding' : ctx.relative_volume < 0.7 ? 'thin' : 'normal';
  const location = ctx?.value_location || 'unknown';
  let family = 'mixed_rotation';
  if (ctx?.divergence) family = 'exhaustion';
  else if (agrees === true && location !== 'inside' && volume === 'expanding') family = 'expansion';
  else if (agrees === true && ctx?.trend !== 'choppy') family = 'trend_confirmation';
  else if (agrees === false) family = 'contested_transition';
  else if (ctx?.trend === 'choppy' && location === 'inside') family = 'compression';

  const shape = momentumShape(state);
  return {
    state, grid: { x, y, z, label: `${x}:${y}:${z}` }, momentum_shape: shape,
    structural_family: family, volume_regime: volume, value_location: location,
    confluence, prediction_status: agrees === true ? 'STRUCTURE_ALIGNED' : agrees === false ? 'STRUCTURE_CONTESTED' : 'STRUCTURE_MIXED',
    // The ablation improved move quality, not directional hit rate. Preserve
    // conviction as raw HEX evidence; structural alignment is descriptive.
    qualified_confidence: null,
    archetype_id: `${family}|${shape}|${volume}|${location}`,
  };
}

type Observation = { state: number; family: string; lens: string; correct: number; brier: number; signedMove: number; absoluteMove: number };

function summarize(rows: Observation[], globalAccuracy: number) {
  if (!rows.length) return null;
  const accuracy = mean(rows.map((r) => r.correct));
  return {
    n: rows.length,
    accuracy: round(accuracy),
    accuracy_lift: round(accuracy - globalAccuracy),
    brier: round(mean(rows.map((r) => r.brier))),
    avg_signed_move: round(mean(rows.map((r) => r.signedMove))),
    avg_absolute_move: round(mean(rows.map((r) => r.absoluteMove))),
    shrunk_accuracy: round((rows.reduce((s, r) => s + r.correct, 0) + 12 * globalAccuracy) / (rows.length + 12)),
  };
}

function grouped(rows: Observation[], key: (row: Observation) => string, globalAccuracy: number) {
  const groups = new Map<string, Observation[]>();
  for (const row of rows) {
    const k = key(row);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(row);
  }
  return Object.fromEntries([...groups.entries()].map(([k, value]) => [k, summarize(value, globalAccuracy)]));
}

export function runHybridArchetypeExperiment(series: ExperimentBarSet[]) {
  const horizons: Record<string, any> = {};
  for (const horizon of [1, 3]) {
    const rows: Observation[] = [];
    for (const bars of series) {
      const start = Math.max(120, Math.floor(bars.closes.length * 0.6));
      const recentRawAccuracy: number[] = [];
      for (let i = start; i + horizon < bars.closes.length; i += horizon) {
        const raw = predictFromSequence('BTC', bars.closes.slice(i - 6, i + 1));
        const rawDirection = raw.predicted_direction === 'UP' ? 1 : -1;
        const anti = recentRawAccuracy.length >= 15 && mean(recentRawAccuracy.slice(-30)) < 0.45;
        const direction = anti ? -rawDirection : rawDirection;
        const pUp = anti ? 1 - raw.p_up : raw.p_up;
        const ctx = buildChartContext(
          bars.closes.slice(0, i + 1), bars.highs.slice(0, i + 1),
          bars.lows.slice(0, i + 1), bars.volumes.slice(0, i + 1),
        );
        const lens = classifyHybridArchetype(raw.state, ctx, direction === 1 ? 'UP' : 'DOWN', raw.personal_call_strength);
        const realized = bars.closes[i + horizon] / bars.closes[i] - 1;
        const actual = realized > 0 ? 1 : realized < 0 ? -1 : 0;
        if (actual !== 0) {
          rows.push({
            state: raw.state, family: lens.structural_family, lens: lens.confluence,
            correct: direction === actual ? 1 : 0,
            brier: (pUp - (actual === 1 ? 1 : 0)) ** 2,
            signedMove: direction * realized, absoluteMove: Math.abs(realized),
          });
        }
        const nextDay = bars.closes[i + 1] > bars.closes[i] ? 1 : bars.closes[i + 1] < bars.closes[i] ? -1 : 0;
        if (nextDay !== 0) {
          recentRawAccuracy.push(rawDirection === nextDay ? 1 : 0);
          if (recentRawAccuracy.length > 30) recentRawAccuracy.shift();
        }
      }
    }
    const globalAccuracy = mean(rows.map((r) => r.correct));
    const cells = grouped(rows, (r) => `state_${r.state}`, globalAccuracy);
    const rankedCells = Object.entries(cells).filter(([, v]: any) => v.n >= 20)
      .sort((a: any, b: any) => b[1].shrunk_accuracy - a[1].shrunk_accuracy);
    horizons[`${horizon}d`] = {
      global: summarize(rows, globalAccuracy),
      perception_lenses: grouped(rows, (r) => r.lens, globalAccuracy),
      structural_families: grouped(rows, (r) => r.family, globalAccuracy),
      strongest_grid_cells: Object.fromEntries(rankedCells.slice(0, 10)),
      weakest_grid_cells: Object.fromEntries(rankedCells.slice(-10).reverse()),
    };
  }
  return {
    space_grid: '64 HEX states mapped exactly into a 4×4×4 grid: oldest pair × middle pair × newest pair',
    archetype_method: 'momentum geometry defines the cell; PDF-derived trend, volume, divergence, and value-area structure define the family; outcomes remain held out',
    horizons,
  };
}