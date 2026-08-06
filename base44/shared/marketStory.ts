import type { ChartContext } from './chartContext.ts';
import type { Hex6PipelineResult } from './hex6Pipeline.ts';

export type SignalCard = { id: string; evidence: string; role: 'state' | 'structure' | 'lookback' | 'contingency' };
export type CoinStory = { ticker: string; direction: 'UP' | 'DOWN'; cards: SignalCard[]; contingency: string; returns: number[] };

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const correlation = (a: number[], b: number[]) => {
  const n = Math.min(a.length, b.length);
  if (n < 30) return null;
  const x = a.slice(-n), y = b.slice(-n), mx = mean(x), my = mean(y);
  const numerator = x.reduce((sum, value, index) => sum + (value - mx) * (y[index] - my), 0);
  const denominator = Math.sqrt(x.reduce((sum, value) => sum + (value - mx) ** 2, 0) * y.reduce((sum, value) => sum + (value - my) ** 2, 0));
  return denominator ? numerator / denominator : null;
};

export function buildCoinStory(ticker: string, pipeline: Hex6PipelineResult, context: ChartContext | null, closes: number[]): CoinStory {
  const perception = pipeline.perception;
  const cards: SignalCard[] = [];
  if (perception) {
    cards.push({ id: `hex-${perception.state}`, role: 'state', evidence: `${perception.i_ching.name} (#${perception.i_ching.king_wen}) in HEX state ${perception.state}` });
    const fs = perception.fine_structure_137;
    cards.push({ id: `fs137-${fs.phase}`, role: 'lookback', evidence: fs.return == null ? '137-bar observation unavailable' : `137-bar ${fs.phase} phase: ${(fs.return * 100).toFixed(1)}% trailing move` });
  }
  for (const signal of (context?.signals || []).slice(0, 4)) cards.push({ id: `chart-${cards.length}`, role: 'structure', evidence: signal });
  const direction = pipeline.hex6.predicted_direction;
  const confirmation = direction === 'UP' ? context?.prior_high : context?.prior_low;
  const invalidation = direction === 'UP' ? context?.prior_low : context?.prior_high;
  const contingency = confirmation == null || invalidation == null
    ? 'Await a decisive structural break before treating the next-move lean as confirmed.'
    : direction === 'UP'
      ? `Confirmation: hold above ${confirmation.toFixed(2)}; invalidation: lose ${invalidation.toFixed(2)}.`
      : `Confirmation: hold below ${confirmation.toFixed(2)}; invalidation: reclaim ${invalidation.toFixed(2)}.`;
  cards.push({ id: 'contingency', role: 'contingency', evidence: contingency });
  const returns = closes.slice(-91).slice(1).map((price, index) => Math.log(price / closes.slice(-91)[index]));
  return { ticker, direction, cards, contingency, returns };
}

export function buildBasketStory(stories: CoinStory[]) {
  if (stories.length < 2) return null;
  const leadScores = stories.map((candidate) => {
    const relationships = stories.filter((other) => other.ticker !== candidate.ticker).map((other) => correlation(candidate.returns.slice(0, -1), other.returns.slice(1))).filter((value): value is number => value != null);
    return { ticker: candidate.ticker, score: relationships.length ? mean(relationships) : 0, n: relationships.length };
  }).sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
  const leader = leadScores[0];
  const aligned = stories.filter((story) => story.direction === stories[0].direction).map((story) => story.ticker);
  return {
    leader: leader.n && Math.abs(leader.score) >= 0.2 ? leader : null,
    alignment: aligned.length === stories.length ? `all ${stories.length} stories lean ${stories[0].direction}` : `${aligned.join(', ')} share the opening lean; the basket is mixed`,
  };
}

export function marketStorySummary(stories: CoinStory[]) {
  const basket = buildBasketStory(stories);
  const coins = stories.map((story) => {
    const state = story.cards.find((card) => card.role === 'state')?.evidence || 'state unavailable';
    const lookback = story.cards.find((card) => card.role === 'lookback')?.evidence || '137-bar observation unavailable';
    const structure = story.cards.find((card) => card.role === 'structure')?.evidence || 'structure unavailable';
    return `**${story.ticker} — ${story.direction}**: ${state}; ${lookback}; ${structure} ${story.contingency}`;
  });
  const basketLine = basket?.leader
    ? `**Basket relationship:** ${basket.alignment}; lead-lag candidate ${basket.leader.ticker} (${basket.leader.score.toFixed(2)} one-day correlation; association only).`
    : basket ? `**Basket relationship:** ${basket.alignment}; no lead-lag relationship cleared the observation threshold.` : '';
  return [...coins, basketLine].filter(Boolean).join('\n');
}

export function marketStoryBlock(stories: CoinStory[]) {
  if (!stories.length) return '';
  const basket = buildBasketStory(stories);
  const coinBlocks = stories.map((story) => `${story.ticker}: ${story.cards.map((card) => `[${card.role}] ${card.evidence}`).join(' | ')}`).join('\n');
  return `MARKET STORY RAIL (deterministic observations, not a confidence multiplier):\n${coinBlocks}${basket ? `\nBASKET: ${basket.alignment}${basket.leader ? `; lead-lag candidate ${basket.leader.ticker} (one-day correlation ${basket.leader.score.toFixed(2)} across ${basket.leader.n} relationships; association only, never causal proof).` : '; no lead-lag relationship cleared the observation threshold.'}` : ''}\nUse the cards as evidence in one coherent account: state → structure → 137-bar context → confirmation/invalidation. Quote card facts exactly; do not add claims about beta, volatility, skew, leadership, or causality unless a card explicitly contains them. If no lead-lag candidate clears threshold, say there is no measured basket leader. Do not turn the story, archetype, or basket relationship into additional probability or certainty.`;
}