// Descriptive market observations for one or several tickers: chart structure,
// the levels that would confirm or break a direction read, and how the
// tickers in a basket move together. Nothing here changes a probability.
import type { ChartContext } from './chartContext.ts';
import type { Hex6PipelineResult } from './hex6Pipeline.ts';

export type SignalCard = { evidence: string; role: 'structure' | 'contingency' };
export type CoinStory = { ticker: string; direction: 'UP' | 'DOWN'; at_usual_odds: boolean; cards: SignalCard[]; contingency: string; returns: number[] };

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
  const cards: SignalCard[] = (context?.signals || []).slice(0, 4).map((evidence) => ({ role: 'structure' as const, evidence }));
  const direction = pipeline.read?.direction ?? 'UP';
  const atUsualOdds = !pipeline.read || pipeline.read.direction_at_base;
  const confirmation = direction === 'UP' ? context?.prior_high : context?.prior_low;
  const invalidation = direction === 'UP' ? context?.prior_low : context?.prior_high;
  const contingency = atUsualOdds && context?.prior_high != null && context?.prior_low != null
    ? `Nearest levels: ${context.prior_high.toFixed(2)} above, ${context.prior_low.toFixed(2)} below.`
    : confirmation == null || invalidation == null
    ? 'No structural level is close enough to mark a confirmation or a break yet.'
    : direction === 'UP'
      ? `Confirmation: hold above ${confirmation.toFixed(2)}; invalidation: lose ${invalidation.toFixed(2)}.`
      : `Confirmation: hold below ${confirmation.toFixed(2)}; invalidation: reclaim ${invalidation.toFixed(2)}.`;
  cards.push({ role: 'contingency', evidence: contingency });
  const returns = closes.slice(-91).slice(1).map((price, index) => Math.log(price / closes.slice(-91)[index]));
  return { ticker, direction, at_usual_odds: atUsualOdds, cards, contingency, returns };
}

export function buildBasketStory(stories: CoinStory[]) {
  if (stories.length < 2) return null;
  const leadScores = stories.map((candidate) => {
    const relationships = stories.filter((other) => other.ticker !== candidate.ticker).map((other) => correlation(candidate.returns.slice(0, -1), other.returns.slice(1))).filter((value): value is number => value != null);
    return { ticker: candidate.ticker, score: relationships.length ? mean(relationships) : 0, n: relationships.length };
  }).sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
  const leader = leadScores[0];
  const leaning = stories.filter((story) => !story.at_usual_odds);
  const aligned = leaning.filter((story) => story.direction === leaning[0]?.direction).map((story) => story.ticker);
  return {
    leader: leader.n && Math.abs(leader.score) >= 0.2 ? leader : null,
    alignment: !leaning.length
      ? 'every direction read in the basket sits at its usual odds'
      : aligned.length === stories.length ? `all ${stories.length} direction reads depart the same way (${leaning[0].direction})` : `${aligned.join(', ')} depart the same way (${leaning[0].direction}); the rest of the basket sits at its usual odds or differs`,
  };
}

export function marketStorySummary(stories: CoinStory[]) {
  const basket = buildBasketStory(stories);
  // User-facing: plain chart structure and the confirmation/invalidation levels.
  const coins = stories.map((story) => {
    const structure = story.cards.find((card) => card.role === 'structure')?.evidence || 'structure unavailable';
    return `**${story.ticker} — ${story.at_usual_odds ? 'direction at its usual odds' : story.direction}**: ${structure} ${story.contingency}`;
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
  return `MARKET OBSERVATIONS (computed from the bars; they describe structure and never change a probability):\n${coinBlocks}${basket ? `\nBASKET: ${basket.alignment}${basket.leader ? `; lead-lag candidate ${basket.leader.ticker} (one-day correlation ${basket.leader.score.toFixed(2)} across ${basket.leader.n} relationships; association only, never causal proof).` : '; no lead-lag relationship cleared the observation threshold.'}` : ''}\nUse these as evidence in one plain account: what the chart is doing → what would confirm or break the read. Keep the facts exact but say them in everyday words; do not add claims about beta, volatility, skew, leadership, or causality unless an observation explicitly contains them. If no lead-lag candidate clears threshold, say there is no measured basket leader. Do not turn these observations or the basket relationship into additional probability or certainty.`;
}