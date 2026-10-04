// Triage for the chat function: does this message need fresh data?
//
// A local, deterministic classifier. No model call.
//   research    a request to write something long
//   analytical  a ticker, a pasted series, a market cue, or a demand for
//               sources or current facts: answered from retrieval
//   casual      everything else: answered conversationally
// How much care a casual message gets is decided separately (stakes.ts).

import { mentionsTicker } from './tickers.ts';

export type TriageIntent = 'casual' | 'analytical' | 'research';

const NUM_SERIES_RE = /(-?\d+(\.\d+)?[\s,;:|~-]){5,}/;
const RESEARCH_RE = /\b(write|draft|compose|ghostwrite|article|paper|report|essay|whitepaper|memoir|thesis|manifesto|blog|newsletter|outline|deep-?dive)\b/i;
const GREETING_RE = /^(hi|hey+|hello+|yo|sup|howdy|gm|good (morning|evening|night|afternoon)|what'?s up|how are you|how'?s it going|how are things|thanks|thank you|thx|cool|nice|ok(ay)?|sounds good|got it|makes sense|lol|haha|bye|goodbye|see you|appreciate)\b/i;
const MARKET_CUE_RE = /\b(price|prices|chart|trend|trends|forecast|outlook|analy[sz]e|analy[sz]is|probability|edge|support|resistance|regime|sentiment|volatility|momentum|rally|drop|crash|pump|dump|breakout|correlation|beta|sharpe|drawdown|backtest|signal|setup|position|entry|exit|allocation|hedge|risk|return|returns|yield|spread|premium|discount|oversold|overbought)\b/i;

// EVIDENCE DEMAND — the user explicitly wants sources, or is asking for a
// fact that must be CURRENT. Either one requires retrieval: without it the
// model answers from memory, which is exactly how a stale figure gets stated
// as today's number and how a citation-worthy answer arrives with no links.
const EVIDENCE_RE = /\b(source|sources|cite|citation|reference|references|stud(y|ies)|research|paper|papers|literature|evidence|data|statistic|statistics|according to)\b/i;
const CURRENCY_RE = /\b(latest|current|currently|today|right now|as of|this (week|month|year)|up[- ]to[- ]date|recent|news|price|rate|rates)\b/i;

export function triage(message: string): TriageIntent {
  const msg = (message || '').trim();
  if (!msg) return 'casual';

  // Long-form generation requests are lexical and stable.
  if (RESEARCH_RE.test(msg) && msg.length > 12) return 'research';

  // A ticker or a pasted numeric series is a hard signal.
  if (mentionsTicker(msg) || NUM_SERIES_RE.test(msg)) return 'analytical';

  // A short greeting or acknowledgement with no market intent.
  if (msg.length <= 48 && GREETING_RE.test(msg) && !MARKET_CUE_RE.test(msg)) return 'casual';

  if (MARKET_CUE_RE.test(msg)) return 'analytical';

  // A question asking for sources, or for a fact that has to be current, must
  // be answered from retrieval and never from the model's memory.
  if (EVIDENCE_RE.test(msg) || CURRENCY_RE.test(msg)) return 'analytical';

  // Conversational, philosophical and life questions need no fresh data.
  return 'casual';
}
