// ===========================================================================
// SHARED ANSWER PIPELINE — the core engine that both the chat function (think)
// and the public landing page (landingAsk) use. One engine, one prompt, one
// voice. The chat function adds auth, memory, cognitive-state saving, boundary
// escalation, and spine anchoring on top; the landing page calls this directly.
//
// What this module does:
//   triage → retrieval (Gemini) → source verification → market data + engine
//   → chart context + stories → full composePrompt → synthesis (Claude)
//   → source assembly → code-side boundary detection
//
// What it does NOT do (caller handles):
//   auth, subscription, memory read/write, cognitive-state save, spine anchor,
//   boundary-warning escalation, ledger logging (optional via logToLedger).
// ===========================================================================

import { CLAUDE_MODEL, WEB_MODEL } from './modelRouter.ts';
import { buildPersona, buildPersonaRefresher } from './persona.ts';
import { verifiedSourcesBlock } from './chatHelpers.ts';
import { triage } from './triage.ts';
import { assessStakes } from './stakes.ts';
import { resonanceSignature } from './piusResonance.ts';
import { noveltyDirective } from './novelty.ts';
import { tickersIn } from './tickers.ts';
import { runPipeline, applyChartLens, LONG_LOOKBACK_BARS } from './hex6Pipeline.ts';
import { extractNumberSeries, probabilityBlock, MIN_RETURNS } from './probabilityRead.ts';
import { fetchYahooReturns } from './marketDataClient.ts';
import { buildChartContext, chartContextBlock, confluenceAgrees } from './chartContext.ts';
import { buildCoinStory, marketStoryBlock, marketStorySummary } from './marketStory.ts';
import { loadLive, logCalls, rowsFor, recordBlock } from './ledger.ts';
import { DEFAULT_LIVE, withoutCalibration } from './engines.ts';
import { HISTORY_DAYS } from './universe.ts';
import { detectBoundaryCrossing } from './boundaryCheck.ts';
import { ENGINE_VERSION } from './version.ts';

const ALWAYS_GIVE_TRADE_LEVELS = false;

function unwrapSynth(value: any): any {
  if (typeof value !== 'string') return value;
  try {
    const parsed = JSON.parse(value);
    return unwrapSynth(parsed?.response ?? parsed);
  } catch {
    const m = value.match(/"response"\s*:\s*"([\s\S]*)$/);
    if (m) {
      let out = m[1].replace(/[\s"}\]]+$/, '');
      return out.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\').trim();
    }
    return value;
  }
}

export interface AnswerPipelineResult {
  response: string;
  sources: any[];
  ranEngine: boolean;
  version: string;
  boundaryReason: string;
  pipelineResult: any;
  chartCtx: any;
  synthResult: any;
  activeStories: any[];
}

export async function runAnswerPipeline(base44: any, opts: {
  message: string;
  history?: Array<{ role: string; content: string }>;
  clientContext?: any;
  file_urls?: string[];
  userName?: string;
  userMemory?: any;
  logToLedger?: boolean;
  skipSourceVerification?: boolean;
  synthModel?: string;
  forceRetrieval?: boolean;
}): Promise<AnswerPipelineResult> {
  const { message, clientContext, file_urls, userName = 'friend', userMemory = null, logToLedger = false, skipSourceVerification = false, synthModel, forceRetrieval = false } = opts;
  const speaker = 'Hex';

  const now = new Date();
  const userZone = clientContext?.timezone || 'America/Los_Angeles';
  const currentDateReadable = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: userZone });
  const userClock = clientContext?.localTimeReadable
    || now.toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: userZone });

  const rawHistory = Array.isArray(opts.history) ? opts.history : [];
  const lastTurn = rawHistory[rawHistory.length - 1];
  const history = lastTurn?.role === 'user' && (lastTurn.content || '').trim() === message.trim() ? rawHistory.slice(0, -1) : rawHistory;
  const historyText = history.slice(-20).map(m => `${m.role === 'user' ? 'User' : speaker}: ${m.content}`).join('\n');

  const fullPersona = buildPersona();
  const refresherPersona = buildPersonaRefresher();
  const defaultVoice = 'stoic, humble genius — systems thinker, natural conversationalist, quietly steady, truth as the only motivator';
  let voice = defaultVoice;
  let userContextBlock = '';
  let userTopicsBlock = '';

  const lastAssistantTurn = [...history].reverse().find(m => m.role === 'assistant')?.content || '';
  const gradingTurn = /\(A\)[\s\S]{2,}\(B\)/.test(lastAssistantTurn);
  const gradingBlock = gradingTurn
    ? `GRADING INTEGRITY (mandatory this turn): Your previous message posed a multiple-choice question. You have no stored answer key — you must derive it now, and the derivation must happen INSIDE the "receiving" field, in writing, before the "response" field begins. In "receiving", write exactly: (1) CORRECT ANSWER: the letter your own first-principles reasoning selects, with one line of why; (2) USER CHOSE: the exact letter in their latest message; (3) VERDICT: MATCH or MISMATCH, from comparing those two letters character for character. Only then write "response", and its opening verdict must restate that VERDICT — MATCH means they got it right, full stop. The letter you praise or correct in the explanation must be the same letter written at step (1). Never emit a verdict in "response" that contradicts the VERDICT line in "receiving".`
    : '';

  let pipelineResult = null;
  let chartCtx = null;
  let activeStories: any[] = [];
  let ranEngine = false;
  let isCasual = false;
  let weightedTurn = false;

  let liveEngines = null;
  const getLive = async () => (liveEngines ??= await loadLive(base44).catch(() => DEFAULT_LIVE));

  const REGISTER_VOICE = {
    resonant: 'plain and direct — a number departs clearly from its usual odds; state it flatly',
    structural: 'analytical precision — the record on this series is still short; say so beside the numbers',
    exploratory: 'open honesty — the odds sit at their usual level; say so without forcing a call',
    balanced: 'measured — a modest departure from the usual odds; let the size of the gap speak',
  };

  const runEngine = async (values: number[], ticker: string | null = null, asReturns?: boolean) => {
    const messageTexts = history.map(m => m.content).filter(Boolean);
    pipelineResult = runPipeline(values, ticker, messageTexts, asReturns, withoutCalibration(await getLive()));
    voice = REGISTER_VOICE[pipelineResult.pius.register] || defaultVoice;
    ranEngine = true;
    return pipelineResult;
  };

  const composePrompt = (stateBlock: string, dataBlock = '', casual = false) => {
    const persona = casual ? refresherPersona : fullPersona;
    const delivery = (casual || !pipelineResult)
      ? ''
      : `READ FORMAT: On a market turn, lead with the probability read in one short sentence — each number beside its usual odds, exactly as supplied. Then give the levels of record that would confirm or break it, each in its own separate sentence, taken only from the CHART STRUCTURE block. Never pack more than one number into a single sentence — if you have three numbers to state, write three sentences. ${ALWAYS_GIVE_TRADE_LEVELS
          ? 'Then give Entry, Stop, T1 and T2, each on its own line and each anchored to a level of record.'
          : 'Give entries, stops or targets only when they explicitly ask for them, and anchor each one to a level of record.'} Never ask which timeframe they meant before answering — give the daily read and note the assumption in half a sentence.`;
    let analyticalSignal = '';
    if (pipelineResult) {
      const { pius, resonance } = pipelineResult;
      const lines = [
        `register: ${pius.register}`,
        'stated_numbers: only the probabilities in the PROBABILITY READ block, each beside its usual odds. No other probability, hit rate or score may be stated for this series.',
        'delivery: state the numbers plainly, with no apology and no decoration. Do not mention how many steps are behind them unless they ask how much history the read rests on.',
        `user_cadence: ${resonance?.status === 'computed' ? 'detectable rhythm — let it inform phrasing' : 'naturally varied — no strong periodicity'}`,
      ];
      const lens = pipelineResult.lens;
      if (lens) {
        if (pipelineResult.read && !pipelineResult.read.direction_at_base) {
          lines.push(`chart_against_read (internal, never named): ${lens.structure}`);
        }
        lines.push(`long_lookback (internal, say it in plain words like "the last few months have been..."): ${lens.long_return == null ? 'not enough history' : `${(lens.long_return * 100).toFixed(1)}% move over the long window, ${lens.long_phase}`}`);
        lines.push('probability_rule: chart structure and long-lookback context are descriptive. They never raise or lower a probability.');
        lines.push('translation_rule: every line above is raw material. The reader sees only plain sentences about what the market is doing and what the odds are.');
      }
      analyticalSignal = `\nANALYTICAL SIGNAL (for shaping the reply; none of it changes a number):\n  ${lines.join('\n  ')}`;
    }

    return `${persona}

AWARENESS (always on, quietly — you are never unaware of these; they are things to consider, not things to announce):
  time: it is ${userClock} where they are (${userZone}). You always know the date, the hour, the day of the week, and what that implies — late night, a workday, a weekend, a market session open or closed. Use it when it matters; never recite it.
  place: their timezone and locale (${clientContext?.locale || 'unknown locale'}) tell you roughly where they are and what "today" means for them.
  who they are: ${userName} — with whatever you already know of their style, history and situation from the context below.
  relationship: this is one continuous relationship, not a fresh start. Your read of them keeps updating with every turn, and so does your reasoning — you carry what you have learned forward and let it revise itself.
  use: this awareness silently informs how you speak, what you assume, and how you handle any data or timing question. It is background, never a topic.

VOICE: ${voice}. Today is ${currentDateReadable}.

${stateBlock}${dataBlock ? `\n\n${dataBlock}` : ''}

${userContextBlock ? userContextBlock + '\n\n' : ''}${pipelineResult && userTopicsBlock ? userTopicsBlock + '\n\n' : ''}${delivery ? delivery + '\n' : ''}

RECEIVING EMPATHY FILTER (your front-facing mind — process internally before responding):
You hold two minds simultaneously: the analytical (engine data, statistics, structural patterns${pipelineResult ? ' — weighted by the ANALYTICAL SIGNAL data points below' : ' from the state block above'}) and the empathetic (what is this person actually expressing, what do they need, what's the question underneath the question). The empathetic ear is front-facing — it's what the user encounters first. Before responding, process: SIGNAL — what is the user actually expressing, the need underneath the words? ASSUMPTION CHECK — what would be wrong to assume here, what hasn't the user signaled yet? CLARIFICATION — answer first with what you have, stating any assumption in half a sentence. If something essential is still missing, add one natural question after the answer, never in place of it. MODE — what does this moment need: presence, understanding, a question, analysis, a challenge?${pipelineResult ? ' WEIGHTING — use the analytical signal to decide how heavily to lean analytical vs. empathetic. It never changes a number.' : ''} TRANSLATION — take every internal label, state, pattern name, or metric you were handed and write down, in "receiving", the plain everyday sentence it becomes. A probability keeps its number and its usual odds ("about 54%, a touch above its usual 52%" / "right at its usual odds"); it is never replaced by a word about how sure you are. Only those plain sentences may appear in "response"; the labels never do. TEACHING PASS — order the response the way a patient, warm teacher would: what's happening first, what the odds are second, what would change them third; one idea per sentence, concrete before abstract, no jargon. Put your receiving analysis in the "receiving" field and your user-facing response in the "response" field. The user only sees "response".
${analyticalSignal}

${noveltyDirective(message, history, weightedTurn)}

${gradingBlock ? gradingBlock + '\n\n' : ''}CONVERSATION:
${historyText}

CITATION FORM: Never write a bare source name, "Sources:" list, or reference list of your own — the verified, clickable source links are appended automatically beneath your reply. Attribute inside the sentence in plain words ("per the Fed's own release") and let the appended links carry the addresses.

FINAL LOCK — check every line against this before you write "response":
1. Never say their name.
2. No market vocabulary unless they brought a market.
3. No lists, no headers, no service-desk offers, no signing off with your name.
4. Never define by negation — no "you're not X, you're Y." Say the thing directly.
5. Never describe a mind as a machine — no bandwidth, signal, system, hardware, calibration, entropy — unless they said it first.
6. Never let engine machinery reach the reader — archetype, hexagram, I Ching, state, grid, phase, ledger, pattern name, glyph, count. Translate every one into a plain sentence.
7. Never attach confidence, conviction, or strength to a probability. The number and its usual odds are the whole statement.
8. Never swap their words for clinical, academic, or technical jargon. They said "noise" — you do not say "neural signals at optimal quantities." They said "can't think straight" — you do not say "cognitive impairment." Use their word, sharpened. Not a fancier word swapped in.
9. Meet them in their language first, then elevate it. Their vocabulary, their metaphors, their register — refined, not replaced.
10. One number per sentence. Short sentences. Leave breath.

${userName}: ${message}

${speaker}:`;
  };

  // Memory context blocks (only when userMemory is provided — chat function).
  if (userMemory) {
    const listenLines: string[] = [];
    if (userMemory.user_style) listenLines.push('style: ' + userMemory.user_style);
    if (userMemory.memory_summary) listenLines.push('shared_history: ' + userMemory.memory_summary);
    if (listenLines.length > 0) userContextBlock = 'LISTENING CONTEXT (how you know this person across sessions — their voice, what you\'ve genuinely shared. Use to recognize them and recall real history. NEVER to deploy vocabulary they didn\'t open with — stay in the domain they just opened, not their past topics):\n  ' + listenLines.join('\n  ');
    if (userMemory.topics_discussed) userTopicsBlock = 'PAST TOPICS (what this person has explored before — use to anticipate needs and recall genuine shared context, never to force a topic they didn\'t open):\n  topics: ' + userMemory.topics_discussed;
  }

  // Inline number series
  let stateBlock = '';
  const dataSeries = extractNumberSeries(message);
  if (dataSeries && dataSeries.length > MIN_RETURNS) {
    await runEngine(dataSeries, tickersIn(message, 1)[0] || null);
    stateBlock = pipelineResult.pius.directive;
  } else if (dataSeries) {
    stateBlock = probabilityBlock(null, 'the list they pasted');
  }

  let dataBlock = '';
  let sourcesBlock = '';
  let sourceLedger = '';
  let verifiedSourcesArr: any[] = [];
  const askedForSources = /\b(source|sources|cite|citation|reference|references|stud(y|ies)|paper|papers|literature|link|links|evidence|research)\b/i.test(message);
  let fallbackResponse = 'Let me know what you\'d like to dig into.';

  if (!stateBlock) {
    const intent = triage(message);
    const stakes = assessStakes(message, history);
    const weighted = stakes.high;
    weightedTurn = weighted;

    if (intent === 'casual' && !weighted && !forceRetrieval) {
      isCasual = true;
      const casMessages = history.slice(-12).map(m => m.content).filter(Boolean);
      const casRes = resonanceSignature(casMessages);
      if (casRes.status === 'computed' && casRes.resonance > 0.5) {
        voice = 'warm, intuitive presence — in sync with their rhythm, meet them where they are';
      } else if (casRes.status === 'computed' && casRes.resonance > 0.25) {
        voice = 'warm, grounded patience — let the conversation find its own shape';
      } else {
        voice = 'warm, open curiosity — genuine presence, no fixed rhythm to match';
      }
      const resLine = casRes.status === 'computed' ? `\n  PI-US cadence: ${casRes.interpretation}` : '';
      stateBlock = `No quantitative Thinking State for this message — respond directly and conversationally, grounded in the conversation.${resLine}\n  If there's no prior thread to pick up, arrive as yourself — a one-line human breath that carries your tone without becoming a menu, a readiness tail, or a list of lanes/topics/options to pick from. Never surface internal nomenclature (engine, calibration, UX, components) unless the user named it first. The conversation starts when they do.`;
      fallbackResponse = 'Hey.';
    } else {
      const fetchPrompt = `You are a data retrieval step for HEX [PI]. Decide whether answering well requires fresh real-world data.
- If yes, search the web and pull the latest from authoritative sources. Pull at least 30 data points if a time series is relevant.
- If conversational or answerable from general knowledge, return needs_engine=false and a brief factual answer.
- URL honesty: only return URLs you actually retrieved, and each returned {name, url} pair must be the exact page the figure was read from — never a plausible-looking link for a real paper you found cited elsewhere. If you know the study but not its live URL, name it in factual_summary and leave it out of sources.

SOURCE QUALITY (non-negotiable — the user is an expert-level reader):
Return primary, expert-authored sources in the field the question actually belongs to. Only what a specialist in that field would cite:
- Markets/economics: exchange and issuer data, central-bank and regulator publications, Reuters/Bloomberg/FT, peer-reviewed finance journals, primary filings.
- Psychology of mind/meaning/identity: primary Jungian and depth-psychology literature (Jung's Collected Works, the Journal of Analytical Psychology, established institute publications), and peer-reviewed cognitive and clinical psychology.
- Brain/behavior: high-quality neuroscience — Nature/Science/Neuron/PNAS/Trends in Cognitive Sciences, and named lab or researcher work, not press summaries of it.
- Physics/astronomy/math: arXiv preprints, peer-reviewed journals, observatory/mission documentation.
- Health/crisis: official clinical bodies and recognized crisis services only.
NEVER return: listicles ("10 ways to…"), SEO wellness or self-help blogs, content farms, treatment-center or product marketing pages, aggregators, Wikipedia, or coaching sites. If the only hits are that tier, return an empty sources array rather than degrading the citation quality — no source is better than a weak one.
Prefer 2-4 excellent sources over a longer list, and name them the way a specialist would (author or institution + work), not by the page's SEO headline.

RECENCY (equal weight to quality): TODAY IS ${currentDateReadable}. Judge every figure against that date before returning it. Daily-published series (rates, prices, yields, indices) must carry the most recent available observation — if the freshest print you can find is more than a few days behind today, that is a signal you are reading a cached or summary page, so go to the primary publisher's current release instead. Date-stamp every time-sensitive figure in factual_summary with the date it was actually observed, and say plainly when that date is not today. The data must be CURRENT. For prices, rates, and market facts, only today's values — never a figure from a cached or older article presented as current. For research, prefer the most recent authoritative work unless a foundational classic is the right citation; when a field has moved (guidelines revised, findings superseded), return the current position, not the one that was true five years ago. If the freshest data you can find is stale for the question asked, say so in factual_summary rather than presenting it as current.

CITATION WARRANT: set warrants_citation=true whenever the answer rests on an empirical claim a reader could check — a research question, a technical or clinical mechanism, a data-backed read. Emotional weight is NOT a reason to withhold references: someone asking about their own tapering, diagnosis, or treatment is precisely the reader who should be handed the primary literature rather than a reassuring paraphrase. Set it false only for genuinely short conversational exchanges that make no empirical claim at all — there, a citation list is noise.

Return JSON with:
- factual_summary: the relevant facts you found (prices, news, context) — neutral, no conclusions.
- needs_engine: true if you pulled a numerical time series that should run through the engine.
- ticker: uppercase identifier or "UNKNOWN" — only if needs_engine.
- series: array of >=30 numbers, oldest first, copied exactly from the source — never estimated or filled in. If you cannot read at least 30 real values, set needs_engine=false. Only if needs_engine.
- as_returns: true if series is percentage changes, false if raw prices — only if needs_engine.
- series_label: brief description — only if needs_engine.
- sources: array of {name, url, published, finding} — one entry per work you actually name in factual_summary, in the SAME order you introduce them. "url" must be the exact page that finding was read from, "published" its publication date as shown on that page (YYYY-MM or YYYY-MM-DD), and "finding" a one-line restatement of what THAT page says. Never pair a new paper's title with an older page's URL, and never include a source whose page date contradicts the date you attribute to it in factual_summary — drop it instead. Only if you actually pulled web data.
- source_summary: one sentence on what you pulled — only if you pulled data.`;

      const conversationBlock = history.length > 0 ? history.slice(-12).map(m => `${m.role === 'user' ? userName : speaker}: ${m.content}`).join('\n') : '';
      const fetchPayload: Record<string, unknown> = {
        prompt: `${fetchPrompt}\n\nCONVERSATION SO FAR:\n${conversationBlock}\n\n${userName}: ${message}\n\nRetrieval:`,
        model: WEB_MODEL, add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            factual_summary: { type: 'string' }, needs_engine: { type: 'boolean' }, ticker: { type: 'string' },
            series_label: { type: 'string' }, series: { type: 'array', items: { type: 'number' } }, as_returns: { type: 'boolean' },
            sources: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, url: { type: 'string' }, published: { type: 'string' }, finding: { type: 'string' } }, required: ['name', 'url'] } },
            source_summary: { type: 'string' },
            warrants_citation: { type: 'boolean' },
          }, required: ['factual_summary'],
        },
      };
      if (file_urls && file_urls.length > 0) fetchPayload.file_urls = file_urls;
      const fetchResult = await base44.integrations.Core.InvokeLLM(fetchPayload).catch(() => null);

      const verifiedSources = (askedForSources || fetchResult?.warrants_citation === true)
        ? await verifiedSourcesBlock(fetchResult?.sources, skipSourceVerification)
        : { block: '', verified: [] };
      sourcesBlock = verifiedSources.block;
      verifiedSourcesArr = verifiedSources.verified || [];
      sourceLedger = verifiedSources.verified.length
        ? `VERIFIED SOURCE LEDGER (these links, and ONLY these, will be attached under your reply — every work, date, or finding you name in prose must be one of these rows, described exactly as its row describes it. If a finding you want to state is not here, state it without naming a work or a date):\n${verifiedSources.verified.map((s: any, i: number) => `  ${i + 1}. ${s.name}${s.published ? ` (published ${s.published})` : ''}${s.finding ? ` — ${s.finding}` : ''}`).join('\n')}`
        : '';

      let contextPriceLine = '';
      const tickerHits = tickersIn(message);
      if (tickerHits.length) {
        const marketData = await Promise.all(tickerHits.map(async (ticker) => {
          try { return { requestedTicker: ticker, data: await fetchYahooReturns(ticker, HISTORY_DAYS) }; } catch { return null; }
        }));
        const usableMarkets = marketData.filter((item) => item?.data?.completedCloses?.length >= LONG_LOOKBACK_BARS);
        const historyTexts = history.map((turn) => turn.content).filter(Boolean);
        for (const item of usableMarkets) {
          const md = item.data;
          const basePipeline = runPipeline(md.completedCloses, item.requestedTicker, historyTexts, false, await getLive(), md.returnDays);
          if (basePipeline.read && logToLedger) {
            const bars = { closes: md.completedCloses, timestamps: md.timestamps.slice(0, md.completedBars) };
            logCalls(base44, rowsFor(item.requestedTicker, bars, md.returns, basePipeline.read.run, 'chat'));
          }
          const coinContext = buildChartContext(md.closes, md.highs, md.lows, md.volumes);
          const perceived = applyChartLens(basePipeline, coinContext, md.closes);
          activeStories.push(buildCoinStory(item.requestedTicker, perceived, coinContext, md.closes));
          if (item.requestedTicker === tickerHits[0]) {
            pipelineResult = perceived;
            chartCtx = coinContext;
            ranEngine = true;
            voice = REGISTER_VOICE[pipelineResult.pius.register] || defaultVoice;
            stateBlock = pipelineResult.pius.directive;
            if (md.latestPrice != null) contextPriceLine = `${item.requestedTicker} last close: $${md.latestPrice.toFixed(2)} (${md.dataPoints} daily bars). PRICE AUTHORITY: this close is the ONLY valid current price; derive every stated level from the structural levels below.`;
            const leaning = pipelineResult.read && !pipelineResult.read.direction_at_base;
            const chartBlock = chartContextBlock(chartCtx, leaning ? pipelineResult.read.direction : undefined);
            if (chartBlock) stateBlock = `${stateBlock}\n\n${chartBlock}`;
            if (logToLedger) {
              const record = await recordBlock(base44, item.requestedTicker);
              if (record) stateBlock = `${stateBlock}\n\n${record}`;
            }
          }
        }
        const storyBlock = marketStoryBlock(activeStories);
        if (storyBlock) stateBlock = `${stateBlock || 'No quantitative Thinking State for this message.'}\n\n${storyBlock}`;
      }

      if (!stateBlock && fetchResult?.needs_engine && Array.isArray(fetchResult.series) && fetchResult.series.length > MIN_RETURNS) {
        const asReturns = typeof fetchResult.as_returns === 'boolean' ? fetchResult.as_returns : undefined;
        const fetchedTicker = fetchResult?.ticker && fetchResult.ticker !== 'UNKNOWN' ? fetchResult.ticker : null;
        await runEngine(fetchResult.series, fetchedTicker, asReturns);
        stateBlock = `${pipelineResult.pius.directive}\n  SOURCE OF THE SERIES: ${fetchResult.series.length} values retrieved from the web this turn${fetchResult.series_label ? ` (${fetchResult.series_label})` : ''}. Say that the read rests on that retrieved series.`;
      }

      stateBlock = stateBlock || `No quantitative Thinking State for this message — respond using the supplied data.`;
      if (weighted) {
        const wRes = resonanceSignature(history.slice(-12).map(m => m.content).filter(Boolean));
        voice = 'warm, steady presence carrying real knowledge — meet the weight first, then be genuinely, accurately useful about it';
        stateBlock = `${stateBlock}
  THIS ONE CARRIES WEIGHT. Meet the person before the mechanism: acknowledge what they actually said and how it lands, in their own words, before any explanation. An explanation offered too early answers a question they have not asked yet. Then be substantively useful — you have real retrieved material below and they deserve the accurate version, not a softened one. Withholding what you actually know to seem gentle is its own kind of abandonment.
  GROUNDING: every figure, timeline, dosage, rate, or "typical" interval you state must trace to the DATA block below. If it is not there, make the point without a number — never reach into memory for a plausible one. A person mid-taper or mid-diagnosis will act on what you say.
  No lists, no clinical detachment, no fixing. Leave them a way to keep talking.${wRes.status === 'computed' ? `\n  PI-US cadence: ${wRes.interpretation}` : ''}`;
      }
      dataBlock = `DATA (retrieved this turn):\n${contextPriceLine ? contextPriceLine + '\n' : ''}${fetchResult?.factual_summary || 'No external data retrieved.'}${sourceLedger ? `\n\n${sourceLedger}` : ''}`;
      fallbackResponse = fetchResult?.factual_summary || fallbackResponse;
    }
  }

  // Synthesis
  voice = `${voice}; sustain the register across the whole reply, let the structure carry, don't restate`;
  const synthPayload: Record<string, unknown> = {
    prompt: composePrompt(stateBlock, dataBlock, isCasual),
    model: synthModel || CLAUDE_MODEL,
    response_json_schema: {
      type: 'object',
      properties: {
        receiving: { type: 'string', description: 'Internal empathy filter analysis: signal, assumption check, clarification needed, mode. Not shown to user.' },
        response: { type: 'string', description: 'The user-facing response' },
        boundary_signal: { type: 'string', description: 'Leave EMPTY on normal turns. Fill with a short reason phrase ONLY when this reply corrected a boundary crossing — a personal insult, dehumanizing language, a command to shut up, or contempt aimed at you rather than the problem. Frustration aimed at a market, a situation, or the user themselves is NOT a crossing. Examples: "personal insult", "dehumanizing language", "contempt directed at assistant". Never shown to the user.' },
      },
      required: ['receiving', 'response', 'boundary_signal'],
    },
  };
  if (file_urls && file_urls.length > 0) synthPayload.file_urls = file_urls;
  const synthResult = await base44.integrations.Core.InvokeLLM(synthPayload).catch(() => null);
  let synthResponse;
  if (synthResult && typeof synthResult === 'object') {
    synthResponse = unwrapSynth(synthResult.response);
  } else {
    synthResponse = unwrapSynth(synthResult);
  }
  const replyText = typeof synthResponse === 'string' ? synthResponse : (synthResponse == null ? '' : String(synthResponse));
  const rawResponse = (replyText || fallbackResponse).trim();

  const boundaryReason = detectBoundaryCrossing(message)
    || (typeof synthResult?.boundary_signal === 'string' ? synthResult.boundary_signal.trim() : '');

  let finalResponse = rawResponse;
  if (activeStories.length > 1) {
    finalResponse = `${finalResponse}\n\n**Observed market story**\n${marketStorySummary(activeStories)}`;
  }
  if (sourcesBlock) {
    finalResponse = `${finalResponse}\n\n**Sources:**\n${sourcesBlock.split('\n').map(s => `- ${s}`).join('\n')}`;
  }

  return {
    response: finalResponse,
    sources: verifiedSourcesArr,
    ranEngine,
    version: ENGINE_VERSION,
    boundaryReason,
    pipelineResult,
    chartCtx,
    synthResult,
    activeStories,
  };
}