// ===========================================================================
// CHART CONTEXT — what the chart is doing: volume, averages, prior levels and
// value area, computed from the daily bars the market fetch already returns.
//
// It is a second, independent description. It never changes a probability:
// it either lines up with the direction read or points the other way, and
// both are said plainly.
//
// Arithmetic on data already in memory. No model calls, no extra fetches.
// ===========================================================================

export interface ChartContext {
  trend: 'up' | 'down' | 'choppy';
  sma20: number | null;
  sma50: number | null;
  above_sma20: boolean;
  above_sma50: boolean;
  relative_volume: number | null;   // latest volume ÷ 20-bar average
  volume_confirms: boolean | null;  // volume expanding in the direction price moved
  divergence: boolean;              // new extreme with volume failing to confirm
  prior_high: number | null;
  prior_low: number | null;
  poc: number | null;               // volume profile point of control
  vah: number | null;
  val: number | null;
  inside_value: boolean | null;
  value_location: 'above' | 'inside' | 'below' | 'unknown';
  bias: 'bullish' | 'bearish' | 'neutral';
  signals: string[];
}

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / (xs.length || 1);
const sma = (xs: number[], n: number) => (xs.length >= n ? mean(xs.slice(-n)) : null);

// Volume profile over the recent window: bucket closes by price, weight each
// bucket by the volume that traded there. POC = the most-traded price; the
// value area is the tightest band around it holding ~70% of volume.
function volumeProfile(closes: number[], volumes: number[], bars = 90, bins = 24) {
  const c = closes.slice(-bars);
  const v = volumes.slice(-bars);
  if (c.length < 20) return { poc: null, vah: null, val: null };
  const lo = Math.min(...c);
  const hi = Math.max(...c);
  if (!(hi > lo)) return { poc: null, vah: null, val: null };
  const width = (hi - lo) / bins;
  const buckets = new Array(bins).fill(0);
  for (let i = 0; i < c.length; i++) {
    const idx = Math.min(bins - 1, Math.floor((c[i] - lo) / width));
    buckets[idx] += v[i] || 1;
  }
  const total = buckets.reduce((s, x) => s + x, 0);
  let pocIdx = 0;
  for (let i = 1; i < bins; i++) if (buckets[i] > buckets[pocIdx]) pocIdx = i;

  // Expand outward from the POC until 70% of volume is enclosed.
  let low = pocIdx, high = pocIdx, acc = buckets[pocIdx];
  while (acc < total * 0.7 && (low > 0 || high < bins - 1)) {
    const below = low > 0 ? buckets[low - 1] : -1;
    const above = high < bins - 1 ? buckets[high + 1] : -1;
    if (above >= below) { high++; acc += buckets[high]; } else { low--; acc += buckets[low]; }
  }
  const priceAt = (i: number) => lo + width * (i + 0.5);
  return { poc: priceAt(pocIdx), vah: lo + width * (high + 1), val: lo + width * low };
}

/**
 * Build the confluence read from raw OHLCV.
 * All inputs are chronological, oldest → newest.
 */
export function buildChartContext(
  closes: number[],
  highs: number[] = [],
  lows: number[] = [],
  volumes: number[] = [],
): ChartContext | null {
  if (!Array.isArray(closes) || closes.length < 25) return null;

  const last = closes[closes.length - 1];
  const prev = closes[closes.length - 2];
  const s20 = sma(closes, 20);
  const s50 = sma(closes, 50);
  const s20Prior = closes.length >= 25 ? sma(closes.slice(0, -5), 20) : null;

  const above20 = s20 != null && last > s20;
  const above50 = s50 != null && last > s50;
  const rising = s20 != null && s20Prior != null && s20 > s20Prior;
  const falling = s20 != null && s20Prior != null && s20 < s20Prior;

  let trend: ChartContext['trend'] = 'choppy';
  if (above20 && above50 && rising) trend = 'up';
  else if (!above20 && !above50 && falling) trend = 'down';

  // Relative volume + confirmation (Chapter 4): does participation back the move?
  let relVol: number | null = null;
  let volumeConfirms: boolean | null = null;
  let divergence = false;
  if (volumes.length >= 21) {
    const avg = mean(volumes.slice(-21, -1));
    const latest = volumes[volumes.length - 1];
    if (avg > 0 && latest > 0) {
      relVol = latest / avg;
      const moved = last - prev;
      volumeConfirms = relVol >= 1.0 && Math.abs(moved) > 0;
      // Divergence: a fresh 20-bar extreme printed on below-average volume.
      const window = closes.slice(-20);
      const atHigh = last >= Math.max(...window);
      const atLow = last <= Math.min(...window);
      divergence = (atHigh || atLow) && relVol < 0.85;
    }
  }

  const priorHigh = highs.length >= 2 ? highs[highs.length - 2] : null;
  const priorLow = lows.length >= 2 ? lows[lows.length - 2] : null;

  const { poc, vah, val } = volumeProfile(closes, volumes.length === closes.length ? volumes : closes.map(() => 1));
  const insideValue = vah != null && val != null ? last <= vah && last >= val : null;
  const valueLocation: ChartContext['value_location'] = vah == null || val == null
    ? 'unknown'
    : last > vah ? 'above' : last < val ? 'below' : 'inside';

  // Bias: only the structural reads, stated plainly. Never a trade call.
  const signals: string[] = [];
  if (trend === 'up') signals.push('price above a rising 20 and 50 average — trend up');
  else if (trend === 'down') signals.push('price below a falling 20 and 50 average — trend down');
  else signals.push('averages tangled or price crossing them — choppy, lower-probability backdrop');

  if (relVol != null) {
    if (relVol >= 1.5) signals.push(`volume running ${relVol.toFixed(1)}x its 20-bar average — real participation behind the current move`);
    else if (relVol < 0.7) signals.push(`volume at ${relVol.toFixed(1)}x average — thin participation, the move is fragile`);
  }
  if (divergence) signals.push('a fresh 20-bar extreme printed on below-average volume — classic divergence, the move is losing steam');
  if (priorHigh != null && last > priorHigh) signals.push('trading above the prior bar high — buyers took a level sellers were defending');
  if (priorLow != null && last < priorLow) signals.push('trading below the prior bar low — sellers took the level');
  if (insideValue === false && poc != null) signals.push(`outside the value area with the point of control at ${poc.toFixed(2)} — either a snap back toward it or acceptance at a new level`);
  if (insideValue === true) signals.push('inside the value area — price is trading in accepted territory, no edge at the extremes');

  let bias: ChartContext['bias'] = 'neutral';
  const bullish = (trend === 'up' ? 1 : 0) + (above20 ? 1 : 0) + (priorHigh != null && last > priorHigh ? 1 : 0);
  const bearish = (trend === 'down' ? 1 : 0) + (!above20 ? 1 : 0) + (priorLow != null && last < priorLow ? 1 : 0);
  if (bullish >= 2 && bullish > bearish) bias = 'bullish';
  else if (bearish >= 2 && bearish > bullish) bias = 'bearish';

  return {
    trend, sma20: s20, sma50: s50, above_sma20: above20, above_sma50: above50,
    relative_volume: relVol, volume_confirms: volumeConfirms, divergence,
    prior_high: priorHigh, prior_low: priorLow, poc, vah, val, inside_value: insideValue,
    value_location: valueLocation, bias, signals,
  };
}

/**
 * Does the chart corroborate the engine's directional lean?
 * This is the number that gets anchored to the spine and accumulates —
 * persistent disagreement is a drift signal, not a footnote.
 */
export function confluenceAgrees(ctx: ChartContext | null, direction: 'UP' | 'DOWN'): boolean | null {
  if (!ctx || ctx.bias === 'neutral') return null;
  return (direction === 'UP' && ctx.bias === 'bullish') || (direction === 'DOWN' && ctx.bias === 'bearish');
}

/**
 * The prompt block. Structural observations only — never a trade instruction,
 * and never a price the model can improvise from.
 */
export function chartContextBlock(ctx: ChartContext | null, engineDirection?: 'UP' | 'DOWN'): string {
  if (!ctx) return '';
  const agree = engineDirection ? confluenceAgrees(ctx, engineDirection) : null;
  const verdict = !engineDirection
    ? 'The direction read sits at its usual odds, so there is no direction to compare the chart against. Describe the structure on its own.'
    : agree === true
    ? 'The chart structure lines up with the direction read. This is descriptive: it does not change the probability.'
    : agree === false
      ? 'The chart structure points the other way from the direction read. Say both plainly rather than picking a side quietly; the probability does not change.'
      : 'The chart structure is mixed — no strong corroboration either way.';
  const levels: string[] = [];
  if (ctx.sma20 != null) levels.push(`20-avg ${ctx.sma20.toFixed(2)}`);
  if (ctx.sma50 != null) levels.push(`50-avg ${ctx.sma50.toFixed(2)}`);
  if (ctx.poc != null) levels.push(`POC ${ctx.poc.toFixed(2)}`);
  if (ctx.vah != null && ctx.val != null) levels.push(`value area ${ctx.val.toFixed(2)}–${ctx.vah.toFixed(2)}`);
  if (ctx.prior_high != null) levels.push(`prior high ${ctx.prior_high.toFixed(2)}`);
  if (ctx.prior_low != null) levels.push(`prior low ${ctx.prior_low.toFixed(2)}`);

  return `CHART STRUCTURE (computed from real OHLCV — volume, levels, averages. These are the only structural levels you may cite; never invent one):
  ${ctx.signals.join('\n  ')}
  Levels of record: ${levels.join(' · ')}
  ${verdict}
  This is a next-move perception lens, not a default trading instruction. Describe what HEX sees and what would confirm or invalidate it; do not recommend positions, sizing, entries, stops, or targets unless the user explicitly asks for them. If they do explicitly ask, anchor every level to one of the structural levels above — never to an improvised round number.`;
}