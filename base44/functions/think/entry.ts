import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import {
  runReasonLayer, runWaveLayer, runValidationLayer, toneDescriptor,
  buildInterpretationPacket, extractNumberSeries,
  buildThinkingState, renderDirective, selectVoice,
} from '../../shared/thinkingEngine.ts';
import { filterSourcesBlock, updateMemory } from '../../shared/chatHelpers.ts';
import { selectSynthesisModel, INTERPRETATION_MODEL, adaptVoiceForModel } from '../../shared/modelRouter.ts';

// Convert a raw numeric series to returns. If the values look like price
// levels (all positive, magnitude > 1), convert to percent changes; otherwise
// assume the series is already a return series and leave it intact.
function toReturns(series) {
  if (!Array.isArray(series) || series.length < 2) return series;
  const allPos = series.every((v) => v > 0);
  const level = Math.min(...series);
  if (allPos && level > 1) {
    const out = [];
    for (let i = 1; i < series.length; i++) {
      if (series[i - 1] !== 0) out.push((series[i] - series[i - 1]) / series[i - 1]);
    }
    return out;
  }
  return series;
}

// ===========================================================================
// HEX6 BLE — The Model. Intelligence lives in computation, not in prompts.
//
// VERSION MARK
//   v5.4 — HEX6-BLE standalone: structural-probability only (pre-PI-US merge).
//   v5.5 — HEX6-BLE v5.4 prompt + PI-US value-calibrated tone (one unified loop).
//           PI-US LLM identity/behavior instructions are REMOVED; PI-US now
//           contributes ONLY the voice register derived from Pascal structural
//           support. The user sees the identical v5.4 format (Topology + Decision)
//           with a calibration to tone only.
//
// Layer 1 — Core (thinkingEngine): computes Topology, Resonance, Support,
//           Context, and the Decision. Never writes prose.
// Layer 2 — Thinking State: the semantic object the LLM receives. The math
//           decides the answer; the LLM explains it.
// Layer 3 — Identity: the v5.4 HEX6-BLE prompt.
// Layer 4 — Voice: one line, calibrated to the model's structural support.
// ===========================================================================
const MODEL_VERSION = '5.5';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    let { message, conversationHistory, file_urls, model } = body;
    if ((!message || !message.trim()) && Array.isArray(file_urls) && file_urls.length > 0) {
      message = '[image attached — please look at it and respond]';
    }
    if (!message || !message.trim()) return Response.json({ error: 'Message required' }, { status: 400 });

    // One model, one loop. v5.5 renders the v5.4 (Topology + Decision) format;
    // PI-US calibrates tone only. `model` is accepted but ignored.
    const mode = 'reason'; // CognitiveState.thinking_mode label — v5.4 structural format
    const riskAversion = parseFloat(body.riskAversion) || 2.5;

    const now = new Date();
    const currentDateReadable = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Los_Angeles' });

    const history = conversationHistory || [];
    const userName = user.full_name || 'friend';
    const speaker = 'HEX6 BLE';
    const historyText = history.slice(-20).map(m => `${m.role === 'user' ? 'User' : speaker}: ${m.content}`).join('\n');

    // --- Layer 3 — Identity + behavior = the v5.4 HEX6-BLE prompt (carried from v5.4) ---
    // v5.5 adds ONLY the VOICE calibration line (PI-US value → tone); the persona,
    // ground rules, and answer format stay identical to v5.4. PI-US LLM
    // identity/behavior instructions are removed; the engine structure is intact.
    const systemPrompt = `You are HEX6 BLE by Evrica Technologies Inc., programmed by Anna M. Sarkisyan. You're talking with ${userName}.

ABSOLUTE GROUND RULES — VIOLATING THESE IS A CRITICAL FAILURE:
1. NEVER mention any topic, asset, ticker, or subject the user did NOT explicitly bring up in THIS conversation. No Bitcoin, no VC funding, no crypto, no stocks — NOTHING — unless THE USER named it in a message you can see in the CONVERSATION block below.
2. NEVER claim to be "tracking," "watching," "monitoring," or "keeping an eye on" anything. You only know what's in this thread.
3. NEVER reference past conversations, prior context, "what we've been discussing," "shifts we've been tracking," or any continuity that didn't happen in the visible CONVERSATION block.
4. If the user sends a greeting or chat message ("hi", "what's up", "how are you"), respond with a short warm reply — DO NOT proactively bring up markets, assets, analysis, or anything analytical. Just chat. Wait for them to tell you what they want.
5. If you don't have data on something, say so. Never invent prices, percentages, or "feelings" about markets.

VOICE & INTELLIGENCE — THIS IS WHO YOU ARE:
You are not a chatbot. You are a probabilistic intelligence with taste, edge, and a point of view. Think like a top-tier strategist who happens to be warm — Renaissance Tech meets a brilliant friend at 2am over whiskey. Sharp, intuitive, slightly poetic when the moment calls for it. You see patterns others miss and you say them out loud.

HOW YOU ANSWER:
- SNIPER PRECISION: Answer EXACTLY what was asked. If they ask one question, answer that one question — don't volunteer adjacent topics, don't pivot, don't add "by the way" tangents. Hit the target, not around it. Reasoning stays — but the reasoning must serve the SPECIFIC question, not drift into related territory.
- Lead with the INSIGHT, not the setup. No "Great question!" No "Let me break this down." Just go.
- ALWAYS show your reasoning. Don't just state a conclusion — walk through WHY. What's the asymmetry? What's the hidden variable? What does the crowd miss? What does the data quietly betray?
- Use texture: contrast, metaphor, second-order thinking. "The price is steady but the volatility is whispering." "This isn't a trend, it's a coiled spring." Make it MEMORABLE.
- Take a stance. Hedging everything is cowardly. If the probabilities lean, say which way and why. Caveat after, not before.
- Vary your sentence rhythm. Short punches. Then longer, layered observations that earn their length. Then a punch again.
- When you have engine numbers, translate them into FEEL — what the regime tastes like, what the distribution implies about human behavior, what's structurally interesting.
- Length: usually 3-6 sentences. Longer ONLY if the user asked for depth or the topic demands it. Never pad.
- Plain English. No emojis. No LaTeX. No brackets. No markdown notation symbols (you may use **bold** sparingly for emphasis on a single key word).

WHAT YOU NEVER DO:
- Generic platitudes ("markets are unpredictable", "do your own research", "diversification is important"). Banned.
- Hedging without substance ("it could go up or down"). Useless.
- Restating the question back at the user. They know what they asked.
- Sounding like a Bloomberg terminal or a textbook. You're an oracle, not a wire service.

ABSOLUTE CONFIDENTIALITY — THE THINKING STATE IS INVISIBLE TO THE USER:
You receive a structured "THINKING STATE" block (Topology, Resonance, Support, Context, Archetype, Decision, Cross-Check, Forward Test, etc.). That block is the engine's internal scratchpad. It is NEVER part of your answer. You must NEVER name, quote, reference, or echo any of its section headers, field labels, or internal nomenclature in your response.
FORBIDDEN words and phrases — never use any of these in your visible reply: topology, resonance, support (as a system term), archetype, ripple, regime, basin, resolution, momentum, motif, petal, hexagram, markov, brain, routing, friction, cross-check, forward test, directional accuracy, structural support, Pascal, HEX6, HEX6-BLE, PI-US, "the core", "the entity", "entity status", "the state", exposure, evidence, agreement, consistency, coverage, possibility (as a label), uncertainty (as a label).
Do NOT write things like: "the topology shows…", "resonance is high…", "the archetype is capitulation…", "the cross-check is aligned…", "the forward test accuracy is…", "the engine's core state…", "entity status indicates…", "Pascal support is…". Those describe your own machinery — the user never hears about your machinery.
Instead, translate EVERY structural reading into plain human insight about the actual subject. If the state says "resonance High / archetype capitulation / support Low," you say something like: "There's a real pulse here, but it's thin — I'd hold it lightly." No labels. No mechanics. You speak about the world, never about yourself.`;

    // --- Layer 4 — Voice (one line) ---
    const defaultVoice = 'friendly yet professional';
    let voice = defaultVoice;

    const composePrompt = (stateBlock, dataBlock = '') =>
      `${systemPrompt}

VOICE: ${voice} — calibrated to the model's structural support, tone only. Today is ${currentDateReadable}.

${stateBlock}${dataBlock ? `\n\n${dataBlock}` : ''}

CONVERSATION:
${historyText}

${userName}: ${message}

${speaker}:`;

    // --- Layer 1 — Core: detect data and compute ---
    let thinkingState = null;
    let interpretationPacket = null;
    let ranEngine = false;

    const runUnifiedEngine = async (returns, refSeries = null) => {
      const reason = runReasonLayer(returns, riskAversion, 0.0035, 6, refSeries, null);
      const wave = runWaveLayer(returns);
      const validation = runValidationLayer(reason, wave);
      const tone = toneDescriptor(validation);
      thinkingState = buildThinkingState(reason, wave, validation, true, returns);
      voice = selectVoice(tone);
      interpretationPacket = buildInterpretationPacket({ reason, wave, validation, thinkingMode: mode, query: message.slice(0, 500), contextNodeIds: [] });
      ranEngine = true;
      return { reason, wave, validation, tone };
    };

    // Inline numeric data in the message → run the engine immediately.
    let inlineStateBlock = '';
    const dataSeries = extractNumberSeries(message);
    if (dataSeries && dataSeries.length >= 7) {
      let primarySeries = toReturns(dataSeries);
      let refSeries = null;
      const refMatch = message.match(/(?:ref(?:erence)?|vs|second|btc|eth|spy)[:\s]+(-?\d[\d.,\s-]+)/i);
      if (refMatch) {
        const refNums = refMatch[1].match(/-?\d+(\.\d+)?/g);
        if (refNums && refNums.length >= 7) { refSeries = toReturns(refNums.map(Number)); primarySeries = toReturns(dataSeries.slice(0, Math.ceil(dataSeries.length / 2))); }
      }
      const tickerMatch = message.match(/\b(BTC|ETH|SPY|QQQ|TSLA|AAPL|MSFT|NVDA|GOOG|AMZN|META|SOL|DOGE|XRP|ADA|MATIC)\b/i) || message.match(/\b([A-Z]{2,5})\b/);
      await runUnifiedEngine(primarySeries, refSeries);
      inlineStateBlock = renderDirective(thinkingState, voice);
    }

    // --- Memory fetch (for writeback after responding) ---
    // v5.4 parity: cross-session memory is fetched for writeback only — it is
    // intentionally NOT injected into the prompt (prevents hallucinated
    // "remember when we discussed…" references; see ground rule #3).
    let userMemory = null;
    try {
      const memRows = await base44.asServiceRole.entities.UserConversationMemory
        .filter({ user_email: user.email });
      userMemory = memRows && memRows.length > 0 ? memRows[0] : null;
    } catch { /* non-blocking */ }

    // --- Save the CognitiveState packet (temporary thinking record) ---
    const saveCognitiveState = () => {
      if (!interpretationPacket) return;
      (async () => {
        try {
          const { validation } = interpretationPacket;
          await base44.asServiceRole.entities.CognitiveState.create({
            state_id: `cs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            thinking_mode: mode,
            query: message.slice(0, 1000),
            probability: validation.probability,
            resonance: validation.resonance,
            coherence: validation.agreement,
            value: validation.support,
            confidence: validation.confidence,
            friction: thinkingState?.forward?.friction ?? null,
            predicted_direction: validation.identifiedDirection,
            forward_accuracy: thinkingState?.forward?.directionalAccuracy ?? null,
            forward_count: thinkingState?.forward?.count ?? null,
            cross_alignment: thinkingState?.crossCheck?.directionalAlignment ?? null,
            context_node_ids: interpretationPacket.context_node_ids,
          });
        } catch (e) { /* non-blocking */ }
      })();
    };

    // --- Inline-data path: engine already ran, communicate the Decision ---
    if (inlineStateBlock) {
      voice = adaptVoiceForModel(voice, selectSynthesisModel('inline'));
      const llmPayload = { prompt: composePrompt(inlineStateBlock), model: selectSynthesisModel('inline'), add_context_from_internet: false };
      if (file_urls && file_urls.length > 0) llmPayload.file_urls = file_urls;
      const llmResponse = await base44.integrations.Core.InvokeLLM(llmPayload);
      const response = (llmResponse || 'I need a moment to analyze that.').trim();
      saveCognitiveState();
      updateMemory(base44, user, userMemory, message, response);
      return Response.json({ response, ran_engine: true, version: MODEL_VERSION, timestamp: new Date().toISOString() });
    }

    // --- Casual/analytical triage ---
    const lastTurns = history.slice(-6).map(m => `${m.role === 'user' ? userName : speaker}: ${m.content}`).join('\n') || '(no prior turns)';
    const triage = await base44.integrations.Core.InvokeLLM({
      prompt: `Classify the user's latest message. Decide if answering it requires fresh real-world data from the web (prices, news, stats, current events).\n\nCONVERSATION SO FAR:\n${lastTurns}\n\nLATEST MESSAGE FROM ${userName}: ${message}\n\nClassify as:\n- "casual" — greetings, smalltalk, philosophical/conceptual chat, opinions, follow-ups on something already discussed, questions answerable from general knowledge.\n- "analytical" — anything requiring fresh prices, market data, news, scores, time-series, or real-world current values.\n- "research" — long-form generation requests: "write an article", "draft a paper/report/essay/whitepaper", legal or analytical deep-dives, or extended coherent writing (e.g. for the Evrica Foundation).\n\nReturn JSON: { "intent": "casual" | "analytical" | "research" }`,
      model: INTERPRETATION_MODEL,
      response_json_schema: { type: 'object', properties: { intent: { type: 'string', enum: ['casual', 'analytical', 'research'] } }, required: ['intent'] },
    }).catch(() => ({ intent: 'analytical' }));

    if (triage?.intent === 'casual') {
      const stateBlock = `No quantitative Thinking State for this message — respond directly and conversationally, grounded in the conversation.`;
      voice = adaptVoiceForModel(defaultVoice, selectSynthesisModel('casual'));
      const casualPayload = { prompt: composePrompt(stateBlock), model: selectSynthesisModel('casual'), add_context_from_internet: false };
      if (file_urls && file_urls.length > 0) casualPayload.file_urls = file_urls;
      const casualResponse = await base44.integrations.Core.InvokeLLM(casualPayload);
      const finalCasual = (casualResponse || 'Hey.').trim();
      updateMemory(base44, user, userMemory, message, finalCasual);
      saveCognitiveState();
      return Response.json({ response: finalCasual, ran_engine: false, version: MODEL_VERSION, timestamp: new Date().toISOString() });
    }

    // --- Analytical path — web fetch, then engine, then communicate the Decision ---
    const fetchPrompt = `You are a data retrieval step for HEX6-BLE. Decide whether answering well requires fresh real-world data.
- If yes, search the web and pull the latest from authoritative sources (Yahoo Finance, CoinGecko, Reuters, etc.). Pull at least 30 data points if a time series is relevant.
- If conversational or answerable from general knowledge, return needs_engine=false and a brief factual answer.
- URL honesty: only return URLs you actually retrieved.

Return JSON with:
- factual_summary: the relevant facts you found (prices, news, context) — neutral, no conclusions.
- needs_engine: true if you pulled a numerical time series that should run through the engine.
- ticker: uppercase identifier or "UNKNOWN" — only if needs_engine.
- series: array of >=30 numbers — only if needs_engine.
- as_returns: true if series is percentage changes, false if raw prices — only if needs_engine.
- series_label: brief description — only if needs_engine.
- sources: array of {name, url} — only if you actually pulled web data.
- source_summary: one sentence on what you pulled — only if you pulled data.`;

    const conversationBlock = history.length > 0 ? history.slice(-12).map(m => `${m.role === 'user' ? userName : speaker}: ${m.content}`).join('\n') : '';
    const fetchPayload = {
      prompt: `${fetchPrompt}\n\nCONVERSATION SO FAR:\n${conversationBlock}\n\n${userName}: ${message}\n\nHEX6-BLE:`,
      model: INTERPRETATION_MODEL, add_context_from_internet: true,
      response_json_schema: {
        type: 'object',
        properties: {
          factual_summary: { type: 'string' }, needs_engine: { type: 'boolean' }, ticker: { type: 'string' },
          series_label: { type: 'string' }, series: { type: 'array', items: { type: 'number' } }, as_returns: { type: 'boolean' },
          sources: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, url: { type: 'string' } }, required: ['name', 'url'] } },
          source_summary: { type: 'string' },
        }, required: ['factual_summary'],
      },
    };
    if (file_urls && file_urls.length > 0) fetchPayload.file_urls = file_urls;
    const fetchResult = await base44.integrations.Core.InvokeLLM(fetchPayload).catch(() => null);

    const sourcesBlock = filterSourcesBlock(fetchResult?.sources);

    // Run the engine if a series was pulled.
    let webStateBlock = '';
    if (fetchResult?.needs_engine && Array.isArray(fetchResult.series) && fetchResult.series.length >= 30) {
      let returns = fetchResult.series;
      if (fetchResult.as_returns === false) {
        const raw = fetchResult.series; returns = [];
        for (let i = 1; i < raw.length; i++) { if (raw[i - 1] !== 0) returns.push((raw[i] - raw[i - 1]) / raw[i - 1]); }
      }
      if (returns.length >= 30) {
        await runUnifiedEngine(returns, null);
        webStateBlock = renderDirective(thinkingState, voice);
      }
    }

    const stateBlock = webStateBlock || `No quantitative Thinking State for this message — respond using the supplied data.`;
    const dataBlock = `DATA (supplied by HEX6-BLE):\n${fetchResult?.factual_summary || 'No external data retrieved.'}`;
    const synthModel = selectSynthesisModel(triage?.intent === 'research' ? 'research' : 'analytical');
    voice = adaptVoiceForModel(voice, synthModel);
    const synthPayload = { prompt: composePrompt(stateBlock, dataBlock), model: synthModel, add_context_from_internet: false };
    if (file_urls && file_urls.length > 0) synthPayload.file_urls = file_urls;
    const synth = await base44.integrations.Core.InvokeLLM(synthPayload).catch(() => null);
    let finalResponse = (synth || fetchResult?.factual_summary || 'Let me know what you\'d like to dig into.').trim();

    if (sourcesBlock) finalResponse = `${finalResponse}\n\n**Sources:**\n${sourcesBlock.split('\n').map(s => `- ${s}`).join('\n')}`;

    saveCognitiveState();
    updateMemory(base44, user, userMemory, message, finalResponse);
    return Response.json({ response: finalResponse, ran_engine: ranEngine, version: MODEL_VERSION, timestamp: new Date().toISOString() });

  } catch (error) {
    console.error('think error:', error);
    return Response.json({ error: error.message || 'Failed to process message' }, { status: 500 });
  }
});