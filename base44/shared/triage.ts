// Modular hybrid triage for The Model's chat loop.
//
// A fast local scorer classifies OBVIOUS messages with zero LLM round-trips
// (greetings → casual, tickers/pasted series/market cues → analytical,
// "write/draft/report" → research). AMBIGUOUS messages defer to an LLM call so
// The Model's own reasoning is never lost on edge cases — speed where it's
// safe, judgment where it matters.
//
// ADAPTIVE: the local seeds mirror the engine's own vocabulary (the tickers /
// cues HEX6-BLE actually validates). An optional learned `profile` — derived
// from CognitiveState outcomes by the nightly calibration job (tokens
// historically associated with ran_engine=true vs false) — extends the seeds,
// so the filter grows toward what the engine has actually treated as
// analytical vs casual over time.

export type TriageIntent = 'casual' | 'analytical' | 'research';

export interface TriageProfile {
  analytical_cues?: string[]; // tokens historically associated with ran_engine=true
  casual_cues?: string[];     // tokens historically associated with ran_engine=false
}

const TICKER_RE = /\b(BTC|ETH|SOL|DOGE|XRP|ADA|MATIC|SPY|QQQ|TSLA|AAPL|MSFT|NVDA|GOOG|GOOGL|AMZN|META|COIN|BABA|JPM|GS|V|MA|NFLX|DIS|AMD|INTC|BA|UNI|LINK|ATOM|AVAX|DOT|LTC|BNB)\b/i;
const NUM_SERIES_RE = /(-?\d+(\.\d+)?[\s,;:|~-]){5,}/;
const RESEARCH_RE = /\b(write|draft|compose|ghostwrite|article|paper|report|essay|whitepaper|memoir|thesis|manifesto|blog|newsletter|outline|deep-?dive)\b/i;
const GREETING_RE = /^(hi|hey+|hello+|yo|sup|howdy|gm|good (morning|evening|night|afternoon)|what'?s up|how are you|how'?s it going|how are things|thanks|thank you|thx|cool|nice|ok(ay)?|sounds good|got it|makes sense|lol|haha|bye|goodbye|see you|appreciate)\b/i;
const MARKET_CUE_RE = /\b(price|prices|chart|trend|trends|forecast|outlook|analy[sz]e|analy[sz]is|probability|edge|support|resistance|regime|sentiment|volatility|momentum|rally|drop|crash|pump|dump|breakout|correlation|beta|sharpe|drawdown|backtest|signal|setup|position|entry|exit|allocation|hedge|risk|return|returns|yield|spread|premium|discount|oversold|overbought)\b/i;

export function triageLocal(message: string, profile?: TriageProfile): TriageIntent | null {
  const msg = (message || '').trim();
  if (!msg) return null;
  const lower = msg.toLowerCase();

  const analyticalCues = (profile?.analytical_cues || []).map((c) => c.toLowerCase());
  const casualCues = (profile?.casual_cues || []).map((c) => c.toLowerCase());

  // Research — long-form generation requests are lexical and stable.
  if (RESEARCH_RE.test(msg) && msg.length > 12) return 'research';

  // Analytical — a ticker or a pasted numeric series is a hard signal.
  if (TICKER_RE.test(msg) || NUM_SERIES_RE.test(msg)) return 'analytical';

  // Learned analytical cues (engine outcome-derived).
  if (analyticalCues.some((c) => c && lower.includes(c))) return 'analytical';

  // Obvious casual — short greeting / acknowledgement with no market intent.
  if (msg.length <= 48 && GREETING_RE.test(msg) && !MARKET_CUE_RE.test(msg) && !analyticalCues.some((c) => c && lower.includes(c))) return 'casual';

  // Learned casual cues.
  if (msg.length <= 80 && casualCues.some((c) => c && lower.includes(c))) return 'casual';

  // Market cue present → analytical.
  if (MARKET_CUE_RE.test(msg)) return 'analytical';

  return null; // ambiguous → defer to the LLM (The Model's reasoning)
}

export async function triage(
  message: string,
  llm: (opts: { prompt: string; response_json_schema: object }) => Promise<{ intent: TriageIntent }>,
  historyText = '',
  profile?: TriageProfile
): Promise<TriageIntent> {
  const local = triageLocal(message, profile);
  if (local) return local;

  try {
    const r = await llm({
      prompt: `Classify the user's latest message. Decide if answering it requires fresh real-world data (prices, news, stats, current events, time-series).\n\nCONVERSATION SO FAR:\n${historyText || '(no prior turns)'}\n\nLATEST MESSAGE: ${message}\n\nClassify as:\n- "casual" — greetings, smalltalk, philosophical/conceptual chat, opinions, follow-ups, questions answerable from general knowledge.\n- "analytical" — anything requiring fresh prices, market data, news, scores, time-series, or real-world current values.\n- "research" — long-form generation: "write an article", "draft a report/essay/whitepaper", legal or analytical deep-dives.\n\nReturn JSON: { "intent": "casual" | "analytical" | "research" }`,
      response_json_schema: { type: 'object', properties: { intent: { type: 'string', enum: ['casual', 'analytical', 'research'] } }, required: ['intent'] },
    });
    return r?.intent || 'analytical';
  } catch (_e) {
    return 'analytical';
  }
}