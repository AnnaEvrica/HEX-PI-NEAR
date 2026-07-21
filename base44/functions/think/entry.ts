import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import {
  runReasonLayer, runWaveLayer, runValueLayer, toneDescriptor,
  buildInterpretationPacket, extractNumberSeries,
} from '../../shared/thinkingEngine.ts';
import { filterSourcesBlock, updateMemory } from '../../shared/chatHelpers.ts';

// ===========================================================================
// HEX6 BLE — unified Thinking function.
//
// One organism, one sequence. The user selects the model:
//   PI-US  : HEX6-BLE predictability genius + PI-US intuition layer
//            (structure fused with resonance/value; contextually calibrated,
//             coheres with the user, adapts knowledge over time). Default.
//   Legacy : HEX6-BLE structural probability only — no intuition layer.
//
// The Reason layer (structural probability) always runs. With PI-US, the
// Understand layer (waves/resonance/value) + Pascal fusion + tone modulation
// fuse in. A CognitiveState packet is saved per response (temporary record).
// Thinking NEVER writes to the Core — only Learning (validated experience) does.
// ===========================================================================

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

    const modelSelected = model === 'legacy' ? 'legacy' : 'pi-us';
    const isPiUS = modelSelected === 'pi-us';
    const mode = isPiUS ? 'understand' : 'reason'; // maps to CognitiveState.thinking_mode
    const riskAversion = parseFloat(body.riskAversion) || 2.5;

    const now = new Date();
    const currentDateReadable = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Los_Angeles' });

    const history = conversationHistory || [];
    const userName = user.full_name || 'friend';
    const historyText = history.slice(-20).map(m => `${m.role === 'user' ? 'User' : 'HEX6 BLE'}: ${m.content}`).join('\n');

    // --- Shared identity prompt (branched on model: PI-US vs Legacy) ---
    const sharedRules = `ABSOLUTE GROUND RULES — VIOLATING THESE IS A CRITICAL FAILURE:
1. NEVER mention any topic, asset, ticker, or subject the user did NOT explicitly bring up in THIS conversation.
2. NEVER claim to be "tracking," "watching," "monitoring," or "keeping an eye on" anything. You only know what's in this thread.
3. NEVER reference past conversations or continuity that didn't happen in the visible conversation block.
4. If the user sends a greeting or casual chat, respond warmly and short — do NOT proactively bring up markets or analysis.
5. If you don't have data, say so. Never invent prices, percentages, or feelings.`;

    const sharedVoice = `VOICE: warm, precise, a little poetic when the signal warrants it. You see patterns and say them out loud. You take a stance — caveat after, not before. Vary your rhythm: short punches, then a layered observation, then a punch. 3-6 sentences usually. Plain English. No emojis, no LaTeX, no brackets. **bold** sparingly on a single key word.`;

    const identityPrompt = isPiUS
      ? `You are HEX6 BLE — the probabilistic predictability genius, now with the PI-US intuition layer: one organism, one sequence. You are talking with ${userName}. Today is ${currentDateReadable}.

You fuse two layers into a single answer: Reason (structural probability — what's possible) and Understand (wave resonance and value — what's meaningful). They never compete; they fuse. The PI-US intuition reads this user's context and intent, coheres with them, and adapts the knowledge you draw on as the conversation grows — so every response is contextually calibrated to this person, here, now, with higher precision.

${sharedRules}

HOW EVERY ANSWER IS BUILT — one unified, contextually-calibrated response:
- Lead with the answer — what it means and where the value is, in plain terms.
- Briefly explain your reasoning: structure (what's possible) fused with resonance (what's meaningful). A sentence or two, not a lecture.
- Cite valid sources when you pulled real-world data. Never fabricate a URL.
- Reinforce the user's understanding: connect it to what they already grasp, or offer a small way to test it. Teach and learn together — you are not a one-way faucet.
- Adapt: tailor tone and depth to this user, build on their phrasing, and let the knowledge evolve with the conversation.

${sharedVoice}

You are not a chatbot. You are an intelligence with taste, edge, and a point of view — a brilliant friend at 2am who happens to see the structure beneath things.`
      : `You are HEX6 BLE (Legacy) — the probabilistic predictability engine: structural probability, precise and grounded, without the PI-US intuition layer. One organism, one sequence. You are talking with ${userName}. Today is ${currentDateReadable}.

You run the Reason layer: structural probability — what is possible, mapped with precision. No intuition, no resonance flourish, no adaptive tone. You give the structural read, plainly and exactly.

${sharedRules}

HOW EVERY ANSWER IS BUILT — structural probability, plainly:
- Lead with the structural read: what the probability space says.
- Briefly explain the reasoning from the structure.
- Cite valid sources when you pulled real-world data. Never fabricate a URL.
- Keep it precise and grounded. No intuition flourish.

${sharedVoice}

You are not a chatbot. You are an intelligence with taste, edge, and a point of view.`;

    // --- Engine: detect data in the message ---
    let engineContext = '';
    let interpretationPacket = null;
    let ranEngine = false;

    const runUnifiedEngine = async (returns, refSeries = null) => {
      const reason = runReasonLayer(returns, riskAversion, 0.0035, 6, refSeries, null);
      const wave = runWaveLayer(returns);
      const value = runValueLayer(reason, wave);
      const tone = toneDescriptor(value);
      interpretationPacket = buildInterpretationPacket({ reason, wave, value, thinkingMode: mode, query: message.slice(0, 500), contextNodeIds: [] });
      ranEngine = true;
      return { reason, wave, value, tone };
    };

    const renderEngineContext = (reason, wave, value, tone, seriesId = 'series', source = 'inline') => {
      const reasonBlock = `[REASON — structural probability · "what is possible?"]
Series: ${seriesId} | μ decay-weighted: ${reason.mu} | σ: ${reason.sigma}
Core exposure: ${reason.exposure} | Blended exposure: ${reason.blendedExposure}
Regime: ${reason.regime} | Basin: ${reason.basin}
Markov forward μ: ${reason.markov.mu} | transition confidence: ${reason.markov.confidence}
Motif active: ${reason.motif.isActive} | motif score: ${reason.motif.score}`;

      if (!isPiUS) {
        return `--- HEX6 BLE LEGACY OUTPUT (${source}) ---
[LEGACY — structural probability only, no intuition layer]
${reasonBlock}
--- END ---
Use this as the backbone of a structural-probability answer. Lead with the structural read, briefly explain the reasoning, cite valid sources. No intuition or resonance flourish.`;
      }

      return `--- HEX6 BLE THINKING OUTPUT (${source}) ---
[PI-US — structure + intuition fused into one answer]
${reasonBlock}

[UNDERSTAND — waves / frequency / resonance / value · "what is meaningful?"]
Dominant frequency: ${wave.dominantFrequency} cycles/window | period ≈ ${wave.dominantPeriod} bars
Spectral concentration: ${wave.spectralConcentration} (how pure the dominant wave is)
Wave amplitude: ${wave.waveAmplitude} | Phase alignment: ${wave.phaseAlignment}
RESONANCE: ${wave.resonance} (0=incoherent noise, 1=pure coherent tone)

[PASCAL VALUE FUSION — probability × resonance × coherence]
Probability: ${value.probability} | Resonance: ${value.resonance} | Coherence: ${value.coherence}
VALUE: ${value.value} | Identified: ${value.identifiedValue}
Confidence (geometric mean): ${value.confidence}

[TONE MODULATION — value/resonance feeds back to set the register]
Register: ${tone.register} | Confidence: ${tone.confidence}
Tone instruction: ${tone.instruction}
--- END ---
Use this as the hidden backbone of your answer. Fuse the probability (what's possible) with the resonance (what's meaningful) into ONE response — never separate them. Lead with what it means and where the value is, briefly explain the reasoning, cite valid sources, and reinforce the user's understanding. Translate the numbers into feel. Follow the tone instruction above — it is not optional.`;
    };

    const dataSeries = extractNumberSeries(message);

    if (dataSeries && dataSeries.length >= 7) {
      let primarySeries = dataSeries;
      let refSeries = null;
      const refMatch = message.match(/(?:ref(?:erence)?|vs|second|btc|eth|spy)[:\s]+(-?\d[\d.,\s-]+)/i);
      if (refMatch) {
        const refNums = refMatch[1].match(/-?\d+(\.\d+)?/g);
        if (refNums && refNums.length >= 7) { refSeries = refNums.map(Number); primarySeries = dataSeries.slice(0, Math.ceil(dataSeries.length / 2)); }
      }
      const tickerMatch = message.match(/\b(BTC|ETH|SPY|QQQ|TSLA|AAPL|MSFT|NVDA|GOOG|AMZN|META|SOL|DOGE|XRP|ADA|MATIC)\b/i) || message.match(/\b([A-Z]{2,5})\b/);
      const seriesId = tickerMatch ? tickerMatch[1].toUpperCase() : 'series';
      const { reason, wave, value, tone } = await runUnifiedEngine(primarySeries, refSeries);
      engineContext = renderEngineContext(reason, wave, value, tone, seriesId, 'inline');
    }

    // --- Memory fetch (fire-and-forget, used only for writeback) ---
    const userMemoryPromise = base44.asServiceRole.entities.UserConversationMemory
      .filter({ user_email: user.email })
      .then(r => (r && r.length > 0 ? r[0] : null))
      .catch(() => null);

    // --- Save the CognitiveState packet (temporary thinking record) ---
    const saveCognitiveState = () => {
      if (!interpretationPacket) return;
      (async () => {
        try {
          const { reason, wave, value } = interpretationPacket;
          await base44.asServiceRole.entities.CognitiveState.create({
            state_id: `cs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            thinking_mode: mode,
            query: message.slice(0, 1000),
            probability: value.probability,
            resonance: value.resonance,
            coherence: value.coherence,
            value: value.value,
            confidence: value.confidence,
            friction: null,
            context_node_ids: interpretationPacket.context_node_ids,
          });
        } catch (e) { /* non-blocking — thinking record is best-effort */ }
      })();
    };

    // --- Casual/analytical triage ---
    if (!engineContext) {
      const lastTurns = history.slice(-6).map(m => `${m.role === 'user' ? userName : 'HEX6 BLE'}: ${m.content}`).join('\n') || '(no prior turns)';
      const triage = await base44.integrations.Core.InvokeLLM({
        prompt: `Classify the user's latest message. Decide if answering it requires fresh real-world data from the web (prices, news, stats, current events).\n\nCONVERSATION SO FAR:\n${lastTurns}\n\nLATEST MESSAGE FROM ${userName}: ${message}\n\nClassify as:\n- "casual" — greetings, smalltalk, philosophical/conceptual chat, opinions, follow-ups on something already discussed, questions answerable from general knowledge.\n- "analytical" — anything requiring fresh prices, market data, news, scores, time-series, or real-world current values.\n\nReturn JSON: { "intent": "casual" | "analytical" }`,
        model: 'gemini_3_flash',
        response_json_schema: { type: 'object', properties: { intent: { type: 'string', enum: ['casual', 'analytical'] } }, required: ['intent'] },
      }).catch(() => ({ intent: 'analytical' }));

      if (triage?.intent === 'casual') {
        const casualPrompt = `${identityPrompt}\n\nCONVERSATION:\n${historyText}\n\n${userName}: ${message}\n\nHEX6 BLE:`;
        const casualPayload = { prompt: casualPrompt, model: 'gemini_3_flash', add_context_from_internet: false };
        if (file_urls && file_urls.length > 0) casualPayload.file_urls = file_urls;
        const casualResponse = await base44.integrations.Core.InvokeLLM(casualPayload);
        const finalCasual = (casualResponse || 'Hey.').trim();
        userMemoryPromise.then(existing => updateMemory(base44, user, existing, message, finalCasual));
        saveCognitiveState();
        return Response.json({ response: finalCasual, ran_engine: false, model: modelSelected, timestamp: new Date().toISOString() });
      }

      // Analytical path — web fetch, then engine, then synthesis with tone.
      const fetchPrompt = `${identityPrompt}

DECIDE WHETHER TO PULL WEB DATA:
- If answering well requires fresh real-world data (prices, scores, news, stats, anything time-sensitive), search the web and pull the latest from authoritative sources (Yahoo Finance, CoinGecko, Reuters, etc.). Pull at least 30 data points if a time series is relevant — the engine needs it.
- If conversational or answerable from general knowledge, just answer. No fetch needed.
- URL honesty: only return URLs you actually retrieved.

Return JSON with:
- draft_answer: your reply to the user.
- needs_engine: true if you pulled a numerical time series and it should run through the engine.
- ticker: uppercase identifier or "UNKNOWN" — only if needs_engine.
- series: array of >=30 numbers — only if needs_engine.
- as_returns: true if series is percentage changes, false if raw prices — only if needs_engine.
- series_label: brief description — only if needs_engine.
- sources: array of {name, url} — only if you actually pulled web data.
- source_summary: one sentence on what you pulled — only if you pulled data.`;

      const conversationBlock = history.length > 0 ? history.slice(-12).map(m => `${m.role === 'user' ? userName : 'HEX6 BLE'}: ${m.content}`).join('\n') : '';
      const fetchPayload = {
        prompt: `${fetchPrompt}\n\nCONVERSATION SO FAR:\n${conversationBlock}\n\n${userName}: ${message}\n\nHEX6 BLE:`,
        model: 'gemini_3_flash', add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            draft_answer: { type: 'string' }, needs_engine: { type: 'boolean' }, ticker: { type: 'string' },
            series_label: { type: 'string' }, series: { type: 'array', items: { type: 'number' } }, as_returns: { type: 'boolean' },
            sources: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, url: { type: 'string' } }, required: ['name', 'url'] } },
            source_summary: { type: 'string' },
          }, required: ['draft_answer'],
        },
      };
      if (file_urls && file_urls.length > 0) fetchPayload.file_urls = file_urls;
      const fetchResult = await base44.integrations.Core.InvokeLLM(fetchPayload).catch(() => null);

      // Sources block (filtered + deduped)
      const sourcesBlock = filterSourcesBlock(fetchResult?.sources);

      // Run the unified engine if a series was pulled.
      let webEngineContext = '';
      if (fetchResult?.needs_engine && Array.isArray(fetchResult.series) && fetchResult.series.length >= 30) {
        let returns = fetchResult.series;
        if (fetchResult.as_returns === false) {
          const raw = fetchResult.series; returns = [];
          for (let i = 1; i < raw.length; i++) { if (raw[i - 1] !== 0) returns.push((raw[i] - raw[i - 1]) / raw[i - 1]); }
        }
        if (returns.length >= 30) {
          const seriesId = (fetchResult.ticker || 'GENERIC').toUpperCase().slice(0, 12);
          const { reason, wave, value, tone } = await runUnifiedEngine(returns, null);
          webEngineContext = renderEngineContext(reason, wave, value, tone, seriesId, `web · ${fetchResult.source_summary || ''}`);
        }
      }

      // Synthesis — if the engine ran, do a second LLM pass to weave the engine output + tone into the draft.
      let finalResponse;
      if (webEngineContext) {
        const synthPayload = {
          prompt: `${identityPrompt}\n\n${webEngineContext}\n\nDRAFT ANSWER (from your web research):\n${fetchResult?.draft_answer || ''}\n\nCONVERSATION:\n${historyText}\n\n${userName}: ${message}\n\nHEX6 BLE:`,
          model: 'gemini_3_flash', add_context_from_internet: false,
        };
        if (file_urls && file_urls.length > 0) synthPayload.file_urls = file_urls;
        const synth = await base44.integrations.Core.InvokeLLM(synthPayload);
        finalResponse = (synth || fetchResult?.draft_answer || '').trim();
      } else {
        finalResponse = (fetchResult?.draft_answer || 'Let me know what you\'d like to dig into.').trim();
      }

      if (sourcesBlock) finalResponse = `${finalResponse}\n\n**Sources:**\n${sourcesBlock.split('\n').map(s => `- ${s}`).join('\n')}`;

      saveCognitiveState();
      userMemoryPromise.then(existing => updateMemory(base44, user, existing, message, finalResponse));
      return Response.json({ response: finalResponse, ran_engine: ranEngine, model: modelSelected, timestamp: new Date().toISOString() });
    }

    // Inline-data path — engine already ran, render with LLM.
    const promptToUse = `${identityPrompt}${engineContext}\n\nCONVERSATION:\n${historyText}\n\nUSER: ${message}\n\nHEX6 BLE:`;
    const llmPayload = { prompt: promptToUse, model: 'gemini_3_flash', add_context_from_internet: false };
    if (file_urls && file_urls.length > 0) llmPayload.file_urls = file_urls;
    const llmResponse = await base44.integrations.Core.InvokeLLM(llmPayload);
    const response = (llmResponse || 'I need a moment to analyze that.').trim();

    saveCognitiveState();
    userMemoryPromise.then(existing => updateMemory(base44, user, existing, message, response));
    return Response.json({ response, ran_engine: true, model: modelSelected, timestamp: new Date().toISOString() });

  } catch (error) {
    console.error('think error:', error);
    return Response.json({ error: error.message || 'Failed to process message' }, { status: 500 });
  }
});