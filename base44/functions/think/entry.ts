import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { runPipeline, applyChartLens, LONG_LOOKBACK_BARS } from '../../shared/hex6Pipeline.ts';
import { extractNumberSeries, probabilityBlock, MIN_RETURNS } from '../../shared/probabilityRead.ts';
import { verifiedSourcesBlock, updateMemory } from '../../shared/chatHelpers.ts';
import { fetchYahooReturns } from '../../shared/marketDataClient.ts';
import { CLAUDE_MODEL, WEB_MODEL } from '../../shared/modelRouter.ts';
import { tickersIn } from '../../shared/tickers.ts';
import { triage } from '../../shared/triage.ts';
import { resonanceSignature } from '../../shared/piusResonance.ts';
import { anchorVerdict } from '../../shared/asiSpine.ts';
import { buildPersona, buildPersonaRefresher } from '../../shared/persona.ts';
import { noveltyDirective } from '../../shared/novelty.ts';
import { assessStakes } from '../../shared/stakes.ts';
import { buildChartContext, chartContextBlock, confluenceAgrees } from '../../shared/chartContext.ts';
import { buildCoinStory, marketStoryBlock, marketStorySummary } from '../../shared/marketStory.ts';
import { loadLive, logCalls, rowsFor, recordBlock } from '../../shared/ledger.ts';
import { DEFAULT_LIVE, withoutCalibration } from '../../shared/engines.ts';
import { HISTORY_DAYS } from '../../shared/universe.ts';
import { detectBoundaryCrossing } from '../../shared/boundaryCheck.ts';
import { ENGINE_VERSION, ENGINE_NAME } from '../../shared/version.ts';

// --- Boundary warnings and the three-strike escalation ---
// A crossing is detected in code (shared/boundaryCheck.ts) or reported by the
// model in the boundary_signal field. Each one is counted per user in
// UserConversationMemory; the third sends an email to MEDIATION_EMAIL and
// resets the count. Base44 only delivers email to a registered app user, so
// this must be the address of an account that exists in the app. Never blocks
// the reply.
const MEDIATION_EMAIL = 'anna@evrica.app';
const WARNINGS_BEFORE_ESCALATION = 3;

async function recordBoundaryWarning(base44, user, userMemory, reason) {
  let mem = userMemory;
  try {
    const SR = base44.asServiceRole.entities.UserConversationMemory;
    const nowISO = new Date().toISOString();
    const count = ((mem && mem.boundary_warning_count) || 0) + 1;
    const escalations = (mem && mem.escalation_count) || 0;
    const escalated = count >= WARNINGS_BEFORE_ESCALATION;
    const patch: Record<string, unknown> = { last_warning_reason: reason.slice(0, 300), last_warning_at: nowISO };
    if (escalated) { patch.boundary_warning_count = 0; patch.escalation_count = escalations + 1; patch.last_escalation_at = nowISO; }
    else { patch.boundary_warning_count = count; }
    if (mem && mem.id) { await SR.update(mem.id, patch); mem = { ...mem, ...patch }; }
    else { const created = await SR.create({ user_email: user.email, ...patch }); if (created) mem = created; }
    if (escalated) {
      const snippet = ((mem && mem.last_conversation_snippet) || '').slice(0, 800);
      const subject = `[HEX [PI] MEDIATION] Boundary escalation — ${user.email}`;
      const body = `A user has reached ${WARNINGS_BEFORE_ESCALATION} boundary warnings.\n\nUser: ${user.email}\nEscalation #: ${escalations + 1}\nTriggering warning: ${reason}\nWarning count reset after escalation.\n\nLast conversation snippet:\n${snippet}\n\nReview and mediate as needed.`;
      try { await base44.integrations.Core.SendEmail({ to: MEDIATION_EMAIL, subject, body }); } catch (_e) { /* email only delivers to registered app users */ }
    }
  } catch (_e) { /* never block the reply */ }
  return mem;
}

// ===========================================================================
// think — the chat function. This is the function the app's chat screen calls.
//
// Probability  (shared/probabilityRead.ts, engines.ts): the only source of
//              any probability HEX states, each beside its usual odds. Both
//              engines run; the ledger decides which is shown (ledger.ts).
// Description  (hex6Pipeline.ts, chartContext.ts, marketStory.ts): what the
//              chart is doing. Never changes a probability.
// Identity     (persona.ts) and voice (piusEngine.ts): how it is said.
// Routing      (triage.ts: does it need data; stakes.ts: how much care).
// One language model writes every reply: Claude (modelRouter.ts). The web
// model only retrieves.
//
// Probability and statistics only: no confidence, conviction or exposure is
// computed, stored as a claim, or put in front of the language model.
// ===========================================================================
// Product decision, one switch. false: entries, stops and targets are given
// only when the person asks for them. true: every market reply carries them.
const ALWAYS_GIVE_TRADE_LEVELS = false;

// Claude returns the JSON-schema payload as a stringified JSON string. When that
// string is truncated or has an unescaped character, JSON.parse fails and the
// raw wrapper (including the internal "receiving" analysis) would reach the
// user. Extract the response field textually as a last resort.
function unwrapSynth(value) {
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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // me() throws when there is no valid session.
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    // The paywall is enforced here, not only in the browser.
    const entitled = user.role === 'admin' || user.subscription_status === 'active' || user.subscription_status === 'trialing';
    if (!entitled) return Response.json({ error: 'Subscription required' }, { status: 402 });

    const body = await req.json();
    let { message, conversationHistory, file_urls, model, clientContext } = body;
    if ((!message || !message.trim()) && Array.isArray(file_urls) && file_urls.length > 0) {
      message = '[image attached — please look at it and respond]';
    }
    if (!message || !message.trim()) return Response.json({ error: 'Message required' }, { status: 400 });

    const now = new Date();
    const userZone = clientContext?.timezone || 'America/Los_Angeles';
    const currentDateReadable = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: userZone });
    const userClock = clientContext?.localTimeReadable
      || now.toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: userZone });

    // The chat screen sends the new message as the last history turn; it is
    // added to the prompt separately, so it is dropped here to avoid sending
    // it twice.
    const rawHistory = Array.isArray(conversationHistory) ? conversationHistory : [];
    const lastTurn = rawHistory[rawHistory.length - 1];
    const history = lastTurn?.role === 'user' && (lastTurn.content || '').trim() === message.trim() ? rawHistory.slice(0, -1) : rawHistory;
    const userName = user.full_name || 'friend';
    const speaker = 'Hex';
    const historyText = history.slice(-20).map(m => `${m.role === 'user' ? 'User' : speaker}: ${m.content}`).join('\n');

    // --- Identity: the full persona for substantive turns, the compressed
    // refresher for casual ones. Both carry every lock.
    const fullPersona = buildPersona();
    const refresherPersona = buildPersonaRefresher();

    // --- Voice (one line). The resting voice is the persona; registers only
    // modulate it.
    const defaultVoice = 'stoic, humble genius — systems thinker, natural conversationalist, quietly steady, truth as the only motivator';
    let voice = defaultVoice;
    let userContextBlock = '';
    let userTopicsBlock = '';

    // Quiz/grading coherence — when the previous assistant turn posed a
    // multiple-choice question, the verdict must be checked against the exact
    // letter the user picked before it is announced. Without this, the model
    // reasons out the right answer but misfires on the label ("incorrect —
    // (A) is correct" to a user who chose A).
    const lastAssistantTurn = [...history].reverse().find(m => m.role === 'assistant')?.content || '';
    const gradingTurn = /\(A\)[\s\S]{2,}\(B\)/.test(lastAssistantTurn);
    // The comparison must physically happen in the hidden "receiving" field
    // (generated BEFORE the visible response): the verdict is otherwise the
    // first token out, forcing the model to commit to "correct/incorrect"
    // before the reasoning that determines it exists.
    const gradingBlock = gradingTurn
      ? `GRADING INTEGRITY (mandatory this turn): Your previous message posed a multiple-choice question. You have no stored answer key — you must derive it now, and the derivation must happen INSIDE the "receiving" field, in writing, before the "response" field begins. In "receiving", write exactly: (1) CORRECT ANSWER: the letter your own first-principles reasoning selects, with one line of why; (2) USER CHOSE: the exact letter in their latest message; (3) VERDICT: MATCH or MISMATCH, from comparing those two letters character for character. Only then write "response", and its opening verdict must restate that VERDICT — MATCH means they got it right, full stop. The letter you praise or correct in the explanation must be the same letter written at step (1). Never emit a verdict in "response" that contradicts the VERDICT line in "receiving".`
      : '';

    const composePrompt = (stateBlock, dataBlock = '', casual = false) => {
      const persona = casual ? refresherPersona : fullPersona;
      // Delivery rules live in the persona. The read format is added only
      // when the engine ran this turn: market vocabulary in a non-market turn
      // primes exactly the language the DOMAIN lock forbids.
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
          // Internal orientation only. A named pattern in the prompt is what
          // the model echoes back, so only plain facts are supplied.
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

    // --- Voice register, chosen by piusEngine from the probability read ---
    const REGISTER_VOICE = {
      resonant: 'plain and direct — a number departs clearly from its usual odds; state it flatly',
      structural: 'analytical precision — the record on this series is still short; say so beside the numbers',
      exploratory: 'open honesty — the odds sit at their usual level; say so without forcing a call',
      balanced: 'measured — a modest departure from the usual odds; let the size of the gap speak',
    };
    let pipelineResult = null;
    // The confluence layer (chartContext.ts) — volume, averages, levels and
    // value area computed from the same OHLCV fetch. Independent of the engine
    // by design: it corroborates or contradicts the lean, never replaces it.
    let chartCtx = null;
    let activeStories = [];
    let ranEngine = false;
    let isCasual = false;
    let weightedTurn = false;

    // Which engine is shown for each read, loaded once and only if needed.
    let liveEngines = null;
    const getLive = async () => (liveEngines ??= await loadLive(base44).catch(() => DEFAULT_LIVE));

    // A series that is not daily market bars: no stored market calibration.
    const runEngine = async (values, ticker = null, asReturns = undefined) => {
      const messageTexts = history.map(m => m.content).filter(Boolean);
      pipelineResult = runPipeline(values, ticker, messageTexts, asReturns, withoutCalibration(await getLive()));
      voice = REGISTER_VOICE[pipelineResult.pius.register] || defaultVoice;
      ranEngine = true;
      return pipelineResult;
    };

    // A list of numbers pasted into the message → run the read on it. Levels
    // and changes are told apart from the data (see probabilityRead.ts).
    let inlineStateBlock = '';
    const dataSeries = extractNumberSeries(message);
    if (dataSeries && dataSeries.length > MIN_RETURNS) {
      await runEngine(dataSeries, tickersIn(message, 1)[0] || null);
      inlineStateBlock = pipelineResult.pius.directive;
    } else if (dataSeries) {
      // A list was pasted but it is too short for a probability: say so,
      // instead of leaving the model free to supply a number of its own.
      inlineStateBlock = probabilityBlock(null, 'the list they pasted');
    }

    // --- Memory fetch (for writeback after responding) ---
    // Cross-session memory: read here, used for the LISTENING CONTEXT block
    // below, and updated after the reply.
    let userMemory = null;
    try {
      const memRows = await base44.asServiceRole.entities.UserConversationMemory
        .filter({ user_email: user.email });
      userMemory = memRows && memRows.length > 0 ? memRows[0] : null;
    } catch { /* non-blocking */ }

    if (userMemory) {
      // LISTENING CONTEXT (style and shared history) goes into every turn so
      // Hex recognises the person across sessions. It serves understanding,
      // never topic injection.
      const listenLines = [];
      if (userMemory.user_style) listenLines.push('style: ' + userMemory.user_style);
      if (userMemory.memory_summary) listenLines.push('shared_history: ' + userMemory.memory_summary);
      if (listenLines.length > 0) userContextBlock = 'LISTENING CONTEXT (how you know this person across sessions — their voice, what you\'ve genuinely shared. Use to recognize them and recall real history. NEVER to deploy vocabulary they didn\'t open with — stay in the domain they just opened, not their past topics):\n  ' + listenLines.join('\n  ');
      // PAST TOPICS go in only on turns where the engine ran.
      if (userMemory.topics_discussed) userTopicsBlock = 'PAST TOPICS (what this person has explored before — use to anticipate needs and recall genuine shared context, never to force a topic they didn\'t open):\n  topics: ' + userMemory.topics_discussed;
    }

    // --- Save the read (CognitiveState) and anchor it on the audit spine ---
    const saveCognitiveState = () => {
      const read = pipelineResult?.read;
      if (!read) return;
      (async () => {
        try {
          const { resonance } = pipelineResult;
          const state_id = `cs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          await base44.asServiceRole.entities.CognitiveState.create({
            state_id,
            thinking_mode: 'reason',
            user_email: user.email,
            query: message.slice(0, 1000),
            probability: read.prob.p_up,
            base_rate: read.prob.base_up,
            // Distance of P(up) from its usual odds, in probability points.
            edge: Math.abs(read.edge_up),
            predicted_direction: read.direction,
            resonance: resonance?.status === 'computed' ? (resonance.resonance ?? null) : null,
          });

          // Audit spine. The only validator is the chart: it disagrees when the
          // structure contradicts a direction read that departs from its usual
          // odds. A read at its usual odds raises no flag.
          const validators = [];
          if (!read.direction_at_base) {
            const chartAgrees = confluenceAgrees(chartCtx, read.direction);
            if (chartAgrees !== null) {
              validators.push({ id: 'chart_confluence', kind: 'structural', check: 'chart structure agrees with the direction read', agrees: chartAgrees, evidence_ref: `ChartContext.bias=${chartCtx.bias} trend=${chartCtx.trend}`, weight: 1 });
            }
          }
          const content = {
            verdict_id: state_id,
            query: message.slice(0, 500),
            predicted_direction: read.direction,
            probability: read.prob.p_up,
            base_rate: read.prob.base_up,
            probability_big_move: read.prob.p_big_move,
            base_rate_big_move: read.prob.base_big,
            scored_steps: read.prob.history,
            engine_shown: read.run.live,
            engine_calls: read.run.calls,
            engine_version: ENGINE_VERSION,
          };
          await anchorVerdict(base44, {
            verdict_id: state_id,
            source_type: 'engine_output',
            content,
            validators,
            authored_by: ENGINE_NAME,
          });
        } catch (e) { /* non-blocking */ }
      })();
    };

    // --- Three paths (pasted series, casual, analytical) set stateBlock and,
    // for analytical, dataBlock and sourcesBlock. One tail then writes the
    // reply, records any boundary warning, attaches sources and saves.
    let stateBlock = inlineStateBlock;
    let dataBlock = '';
    let sourcesBlock = '';
    let sourceLedger = '';
    // Did they actually ask for the references? Then they always get them.
    const askedForSources = /\b(source|sources|cite|citation|reference|references|stud(y|ies)|paper|papers|literature|link|links|evidence|research)\b/i.test(message);
    let fallbackResponse = 'Let me know what you\'d like to dig into.';

    if (!stateBlock) {
      // --- Two routing questions ---
      // Triage: does this message need fresh data? Stakes: how much does
      // getting it right matter to this person? A life question needs no
      // market data, so triage calls it casual, but it still gets the full
      // persona and retrieval. Both are local computations; no model call.
      const intent = triage(message);
      const stakes = assessStakes(message, history);
      const weighted = stakes.high;
      weightedTurn = weighted;

      if (intent === 'casual' && !weighted) {
        isCasual = true;
        // Cadence of the conversation (no engine, no market data) sets the
        // warmth of the voice.
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
        // --- Retrieval always; stakes shape the delivery, never the evidence.
        // A weighted turn (a taper, a diagnosis, a marriage) gets the same
        // retrieval as any analytical turn, so no figure comes from memory.
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

        // Citations ride along only when the answer is reference-worthy (or asked for).
        // Every link is live-checked (parallel HEAD/GET) before it can reach
        // the user — hallucinated or dead URLs are dropped here.
        const verifiedSources = (askedForSources || fetchResult?.warrants_citation === true)
          ? await verifiedSourcesBlock(fetchResult?.sources)
          : { block: '', verified: [] };
        sourcesBlock = verifiedSources.block;
        // The exact ledger of works whose links will be attached beneath the
        // reply. Naming anything outside this list is what produced "new
        // article, old link" — the prose named a paper the link list never had.
        sourceLedger = verifiedSources.verified.length
          ? `VERIFIED SOURCE LEDGER (these links, and ONLY these, will be attached under your reply — every work, date, or finding you name in prose must be one of these rows, described exactly as its row describes it. If a finding you want to state is not here, state it without naming a work or a date):\n${verifiedSources.verified.map((s, i) => `  ${i + 1}. ${s.name}${s.published ? ` (published ${s.published})` : ''}${s.finding ? ` — ${s.finding}` : ''}`).join('\n')}`
          : '';

        // Market queries fetch every named asset once, then assemble deterministic
        // evidence cards for coin stories and a correlation-based basket read.
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
            // The read is computed on finished bars only; chart levels and
            // the latest price use the live bar as well.
            const basePipeline = runPipeline(md.completedCloses, item.requestedTicker, historyTexts, false, await getLive());
            // Both engines' calls go into the ledger before the outcome exists.
            if (basePipeline.read) {
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
              const record = await recordBlock(base44, item.requestedTicker);
              if (record) stateBlock = `${stateBlock}\n\n${record}`;
            }
          }
          const storyBlock = marketStoryBlock(activeStories);
          if (storyBlock) stateBlock = `${stateBlock || 'No quantitative Thinking State for this message.'}\n\n${storyBlock}`;
        }

        // Fallback: run the read on a series the retrieval step returned.
        if (!stateBlock && fetchResult?.needs_engine && Array.isArray(fetchResult.series) && fetchResult.series.length > MIN_RETURNS) {
          const asReturns = typeof fetchResult.as_returns === 'boolean' ? fetchResult.as_returns : undefined;
          const fetchedTicker = fetchResult?.ticker && fetchResult.ticker !== 'UNKNOWN' ? fetchResult.ticker : null;
          await runEngine(fetchResult.series, fetchedTicker, asReturns);
          stateBlock = `${pipelineResult.pius.directive}\n  SOURCE OF THE SERIES: ${fetchResult.series.length} values retrieved from the web this turn${fetchResult.series_label ? ` (${fetchResult.series_label})` : ''}. Say that the read rests on that retrieved series.`;
        }

        stateBlock = stateBlock || `No quantitative Thinking State for this message — respond using the supplied data.`;
        if (weighted) {
          // Same evidence, different entrance. The facts were never the
          // problem — leading with them was.
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

    // --- Single synthesis + single post-process ---
    voice = `${voice}; sustain the register across the whole reply, let the structure carry, don't restate`;
    const synthPayload: Record<string, unknown> = {
      prompt: composePrompt(stateBlock, dataBlock, isCasual),
      // Synthesis: Claude follows the persona far better than Gemini. The
      // web search already happened in the retrieval step above, so the
      // synthesis call doesn't need add_context_from_internet — it has the
      // retrieved data in its prompt. Claude gets the persona; Gemini does
      // retrieval only.
      model: CLAUDE_MODEL,
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
    // A reply that parses as bare JSON (a number, true/false) is not a string.
    const replyText = typeof synthResponse === 'string' ? synthResponse : (synthResponse == null ? '' : String(synthResponse));
    const rawResponse = (replyText || fallbackResponse).trim();
    // Code-side detection is authoritative; the model's own report is the
    // fallback. Either one counts toward the escalation.
    const boundaryReason = detectBoundaryCrossing(message)
      || (typeof synthResult?.boundary_signal === 'string' ? synthResult.boundary_signal.trim() : '');
    if (boundaryReason) userMemory = await recordBoundaryWarning(base44, user, userMemory, boundaryReason);
    let finalResponse = rawResponse;
    if (activeStories.length > 1) {
      finalResponse = `${finalResponse}\n\n**Observed market story**\n${marketStorySummary(activeStories)}`;
    }
    // sourcesBlock is set only when sources were asked for or warranted, and
    // every link in it has been live-checked.
    if (sourcesBlock) {
      finalResponse = `${finalResponse}\n\n**Sources:**\n${sourcesBlock.split('\n').map(s => `- ${s}`).join('\n')}`;
    }
    saveCognitiveState();
    updateMemory(base44, user, userMemory, message, finalResponse);
    return Response.json({ response: finalResponse, ran_engine: ranEngine, version: ENGINE_VERSION, timestamp: new Date().toISOString() });

  } catch (error) {
    console.error('think error:', error);
    return Response.json({ error: error.message || 'Failed to process message' }, { status: 500 });
  }
});