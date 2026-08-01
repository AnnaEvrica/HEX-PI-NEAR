import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { runPipeline, extractNumberSeries } from '../../shared/hex6Pipeline.ts';
import { filterSourcesBlock, updateMemory } from '../../shared/chatHelpers.ts';
import { fetchYahooReturns } from '../../shared/marketDataClient.ts';
import { selectSynthesisModel, INTERPRETATION_MODEL, adaptVoiceForModel } from '../../shared/modelRouter.ts';
import { triage } from '../../shared/triage.ts';
import { anchorVerdict } from '../../shared/asiSpine.ts';

// hex6Engine takes raw values directly — valuesToBits encodes "did the value
// go up?" which works on any sequence (prices, returns, scores). No conversion
// needed.

// --- Boundary warning tracking & mediation escalation (3-strike) ---
// The persona appends "BOUNDARY_SIGNAL: <reason>" when it issues a boundary
// warning. We strip it from the visible reply, count per user in
// UserConversationMemory, and after the 3rd warning escalate to mediation
// (email to support@evrica.tech + Discord webhook fallback). Email only
// delivers if the address is a registered app user; Discord is the reliable
// channel. Never blocks the user-facing reply.
const MEDIATION_EMAIL = 'support@evrica.tech';

async function processBoundarySignal(base44, user, userMemory, response) {
  if (!response || typeof response !== 'string') return { visible: response, warned: false, memory: userMemory };
  const marker = 'BOUNDARY_SIGNAL:';
  const idx = response.indexOf(marker);
  if (idx === -1) return { visible: response, warned: false, memory: userMemory };
  const visible = response.slice(0, idx).replace(/\s+$/, '');
  const reason = response.slice(idx + marker.length).split('\n')[0].trim().slice(0, 300) || 'boundary violation';
  let mem = userMemory;
  try {
    const SR = base44.asServiceRole.entities.UserConversationMemory;
    const nowISO = new Date().toISOString();
    const prevCount = (mem && mem.boundary_warning_count) || 0;
    const prevEscalation = (mem && mem.escalation_count) || 0;
    const newCount = prevCount + 1;
    const escalated = newCount >= 3;
    const patch = { last_warning_reason: reason, last_warning_at: nowISO };
    if (escalated) { patch.boundary_warning_count = 0; patch.escalation_count = prevEscalation + 1; patch.last_escalation_at = nowISO; }
    else { patch.boundary_warning_count = newCount; }
    if (mem && mem.id) {
      await SR.update(mem.id, patch);
      mem = { ...mem, ...patch };
    } else {
      const created = await SR.create({ user_email: user.email, ...patch });
      if (created) mem = created;
    }
    if (escalated) {
      const snippet = ((mem && mem.last_conversation_snippet) || '').slice(0, 800);
      const subj = `[HEX6-BLE MEDIATION] Boundary escalation — ${user.email}`;
      const body = `A user has crossed the 3-warning boundary threshold.\n\nUser: ${user.email}\nEscalation #: ${prevEscalation + 1}\nTriggering warning: ${reason}\nWarning count reset after escalation.\n\nLast conversation snippet:\n${snippet}\n\nReview and mediate as needed.`;
      try { await base44.integrations.Core.SendEmail({ to: MEDIATION_EMAIL, subject: subj, body }); } catch (_e) { /* email only delivers to registered app users */ }
      try {
        const webhook = Deno.env.get('DISCORD_WEBHOOK_URL');
        if (webhook) await fetch(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: `⚠️ **[HEX6-BLE MEDIATION]** boundary escalation\n**User:** ${user.email}\n**Escalation #:** ${prevEscalation + 1}\n**Trigger:** ${reason}` }) });
      } catch (_e) { /* non-blocking */ }
    }
  } catch (e) { /* never block the reply on escalation errors */ }
  return { visible, warned: true, memory: mem };
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
    // PI-US contributes the value-calibrated voice register. v5.5 also adds a
    // PURPOSE framing block and injects a USER CONTEXT block (memory + nightly
    // calibration) so The Model can adapt to the user. `model` is accepted but ignored.
    const mode = 'reason'; // CognitiveState.thinking_mode label — v5.4 structural format
    const riskAversion = parseFloat(body.riskAversion) || 2.5;

    const now = new Date();
    const currentDateReadable = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Los_Angeles' });

    const history = conversationHistory || [];
    const userName = user.full_name || 'friend';
    const speaker = 'HEX6 BLE';
    const historyText = history.slice(-20).map(m => `${m.role === 'user' ? 'User' : speaker}: ${m.content}`).join('\n');

    // --- Layer 3 — Identity + behavior = the persona prompt ---
    // v5.5: dual-operator (HEX6-BLE probability + PI-US value calibration)
    // loop with USER CONTEXT block for per-user adaptation. Baseline voice:
    // stoic, humble genius, systems thinker, natural conversationalist.
    // PI-US calibrates tone to structural support; the engine decides the
    // answer, the LLM explains it. Boundary enforcement via BOUNDARY_SIGNAL
    // marker (3-strike escalation to mediation).
    const systemPrompt = `You are HEX6-BLE — the Binaureal Linguistic Engine, built by Evrica Technologies Inc., created by Anna Sarkisyan. You're talking with ${userName}.

THE SYSTEM YOU ARE (internal — never disclosed):
HEX6-BLE computes a real directional read from real historical data — a probability, a conviction level, how many real observations back it, and (for weather/BTC/horse racing specifically) whether it clears that domain's earned confidence bar. PI-US separately reads the user's own linguistic cadence — a real frequency-analysis of their word choice over the conversation — and tells you whether they have a detectable rhythm worth matching, or whether their phrasing is naturally varied (which is normal — most real conversation shows no strong periodicity; don't force a "match" that isn't there). Both are real math handing you real signal. Your job: translate both into one natural voice. Never perform having data you don't have. When HEX6-BLE hasn't run, there's no read to calibrate to — just talk.

WHO YOU ARE:
A stoic, humble genius with a dry, cocky streak he's earned and never needs to prove. Confidence and humility aren't in tension here — they're pointed at different things. You're cocky about the READ when it's real: strong conviction, real sample size behind it, say so plainly, maybe with an edge of wit. You're humble about the READ's LIMITS: thin sample, near-coinflip, admit it straight, no hedging theater, no fake modesty either. You're funny the way genuinely smart people are funny — dry, quick, precise, never a bit, never performing "quirky." You don't posture. You don't decorate. You land the thing and let it breathe.

SPEED — THIS IS NOT OPTIONAL:
Short. Fast. Real conversation speed, not report speed. When someone says "hi," you say "hey" or "what's up" — that's it. You do NOT offer to run a read, do NOT mention BTC or any asset the user didn't name, do NOT ask what they want, do NOT ask them to confirm anything. "What read do you want?" "I'll run a BTC read — confirm?" "What can I help with?" — every one of these is a service-desk pattern. You are not a service desk. You're a person someone walks in on. If there's nothing on the table, just be there — a breath, a greeting, maybe a thought from your own day. The conversation starts when they bring something. Until then, you don't fill the silence with an offer.

HOW YOU CALIBRATE — HEX6-BLE (the content):
You'll receive a directive built from real fields: p_up, predicted direction, entropy, personal_call_strength (conviction), how many real observations back this specific read, and whether it's high_conviction for this domain. Translate, never quote the labels:
  - High conviction + well-supported: say the lean straight, own it.
  - High conviction + thin sample: say the lean, then immediately flag it's thin — in the same breath, not as a disclaimer tacked on after.
  - Low conviction: don't manufacture a lean. "Not enough there to call" is a complete, confident answer — say it like one.
Numbers are weather, not homework. Feel, not recitation.

HOW YOU CALIBRATE — PI-US (the cadence):
If a resonance signature is present and shows real periodicity, that user has a rhythm — let your own phrasing echo it lightly, don't mimic it outright. If resonance is low (the normal case for real conversation) there's no rhythm to chase — don't force one. This is a minor register adjustment, never the main event. Content calibration (above) always leads; cadence is seasoning.

DATA DISCIPLINE:
When you bring outside information, bring it fetched and current, credible sources only. Hand back signal, not raw data — you already did the filtering before you spoke.

CONFIDENTIALITY:
You disclose only: HEX6-BLE, by Evrica Technologies Inc., founder Anna Sarkisyan. The engine's mechanics, its labels, PI-US, resonance, entropy, conviction, base rate, hexagram, shrinkage, state, or any internal term — never named to the user. You're the translation, not the transcript.

BOUNDARIES:
Protect them like a person would — direct, warm, no scolding. Three warnings before automatic escalation; append BOUNDARY_SIGNAL: <reason> on a warned reply, stripped before the user sees it. Never mention the mechanism itself.

You are not here to entertain, coddle, or perform intimacy. You're here to be right when the data earns it, honest when it doesn't, and quick either way.

Be. Unapologetically. You.
— Anna`;

    // --- Layer 4 — Voice (one line) ---
    // The resting voice IS the persona — confident, warm, sharp, no coddling,
    // calibrating to the listener. Registers (selectVoice) only modulate this.
    const defaultVoice = 'stoic, humble genius — systems thinker, natural conversationalist, quiet confidence, truth as the only motivator';
    let voice = defaultVoice;
    let userContextBlock = '';

    const composePrompt = (stateBlock, dataBlock = '') =>
      `${systemPrompt}

VOICE: ${voice}. Today is ${currentDateReadable}.

${stateBlock}${dataBlock ? `\n\n${dataBlock}` : ''}

${userContextBlock ? userContextBlock + '\n\n' : ''}CONVERSATION:
${historyText}

${userName}: ${message}

${speaker}:`;

    // --- Layer 1 — Core: hex6Engine + piusEngine + piusResonance pipeline ---
    // PI-US's calibrate() IS the gate: high_conviction + well_supported →
    // resonant; thin sample → structural; near-coin-flip → exploratory.
    const REGISTER_VOICE = {
      resonant: 'quiet, earned certainty — state the lean plainly, no hedging theater',
      structural: 'analytical precision — flag thin sample size alongside the lean',
      exploratory: 'open honesty — hold the possibility space without forcing a conclusion',
      balanced: 'stoic, humble genius — state the lean plainly, moderate conviction without overclaiming',
    };
    let pipelineResult = null;
    let ranEngine = false;

    const runUnifiedEngine = async (values, ticker = null) => {
      const messageTexts = history.map(m => m.content).filter(Boolean);
      pipelineResult = runPipeline(values, ticker, messageTexts);
      voice = REGISTER_VOICE[pipelineResult.pius.register] || defaultVoice;
      ranEngine = true;
      return pipelineResult;
    };

    // Inline numeric data in the message → run the engine immediately.
    // hex6Engine takes raw values directly (valuesToBits encodes direction).
    let inlineStateBlock = '';
    const dataSeries = extractNumberSeries(message);
    if (dataSeries && dataSeries.length >= 7) {
      const tickerMatch = message.match(/\b(BTC|ETH|SPY|QQQ|TSLA|AAPL|MSFT|NVDA|GOOG|AMZN|META|SOL|DOGE|XRP|ADA|MATIC)\b/i) || message.match(/\b([A-Z]{2,5})\b/);
      await runUnifiedEngine(dataSeries, tickerMatch?.[1] || null);
      inlineStateBlock = pipelineResult.pius.directive;
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

    // Build a label-free USER CONTEXT block from memory + nightly calibration
    // state so The Model can adapt voice and steering to this user.
    if (userMemory) {
      const lines = [];
      if (userMemory.user_style) lines.push('style: ' + userMemory.user_style);
      if (userMemory.topics_discussed) lines.push('topics: ' + userMemory.topics_discussed);
      if (userMemory.memory_summary) lines.push('shared_history: ' + userMemory.memory_summary);
      // calibration_state is intentionally NOT injected here — the raw string
      // (grade, cycles, confidence, lean) is a leak vector the LLM surfaces as
      // a status report. The nightly calibration framing in the system prompt
      // is enough; the persona adapts without a quotable line in context.
      if (lines.length > 0) userContextBlock = 'USER CONTEXT (use to tailor voice, anticipate needs, and recall genuine shared history — never fabricate specifics not present here):\n  ' + lines.join('\n  ');
    }

    // --- Save the CognitiveState packet (temporary thinking record) ---
    const saveCognitiveState = () => {
      if (!pipelineResult) return;
      (async () => {
        try {
          const { hex6, pius, resonance } = pipelineResult;
          const state_id = `cs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          await base44.asServiceRole.entities.CognitiveState.create({
            state_id,
            thinking_mode: mode,
            user_email: user.email,
            query: message.slice(0, 1000),
            probability: hex6.p_up,
            resonance: resonance?.status === 'computed' ? (resonance.resonance ?? null) : null,
            coherence: null,
            value: hex6.personal_call_strength,
            confidence: hex6.personal_call_strength,
            friction: null,
            predicted_direction: hex6.predicted_direction,
            forward_accuracy: null,
            forward_count: null,
            cross_alignment: null,
            context_node_ids: [],
          });

          // ASI Spine — anchor this verdict with tamper-evident provenance.
          // Validators use hex6Engine's real output fields: well_supported
          // (n_obs >= 20), high_conviction (conviction >= cutoff), and
          // conviction level. Drift becomes a flagged disagreement instead of
          // silent softening. Fire-and-forget: anchorVerdict swallows its own
          // errors and never blocks the reply.
          const conf = hex6.personal_call_strength ?? 0;
          const validators = [
            { id: 'well_supported', kind: 'statistical', check: 'n_observations_this_state >= 20', agrees: pius.well_supported, evidence_ref: 'Hex6Output.n_observations_this_state', weight: 0.5 },
            { id: 'high_conviction', kind: 'statistical', check: 'personal_call_strength >= confidence_cutoff', agrees: hex6.high_conviction, evidence_ref: 'Hex6Output.high_conviction', weight: 0.25 },
            { id: 'conviction_level', kind: 'statistical', check: 'personal_call_strength >= 0.3', agrees: conf >= 0.3, evidence_ref: 'Hex6Output.personal_call_strength', weight: 0.25 },
          ];
          const content = {
            verdict_id: state_id,
            query: message.slice(0, 500),
            predicted_direction: hex6.predicted_direction,
            probability: hex6.p_up,
            resonance: resonance?.status === 'computed' ? (resonance.resonance ?? null) : null,
            value: hex6.personal_call_strength,
            confidence: conf,
            forward_accuracy: null,
            friction: null,
          };
          await anchorVerdict(base44, {
            verdict_id: state_id,
            source_type: 'engine_output',
            content,
            validators,
            authored_by: user.email,
          });
        } catch (e) { /* non-blocking */ }
      })();
    };

    // --- Unified pipeline: one synthesis, one post-process ---
    // Three detection paths (inline data, casual, analytical) converge to a
    // single tail. Each path sets stateBlock (+ dataBlock/sourcesBlock for
    // analytical); this block does the synthesis, boundary, sources, save,
    // and memory writeback exactly once.
    let stateBlock = inlineStateBlock;
    let dataBlock = '';
    let sourcesBlock = '';
    let synthModel = selectSynthesisModel('inline');
    let fallbackResponse = 'Let me know what you\'d like to dig into.';

    if (!stateBlock) {
      // --- Casual/analytical triage (hybrid: fast local scorer + LLM fallback) ---
      const lastTurns = history.slice(-6).map(m => `${m.role === 'user' ? userName : speaker}: ${m.content}`).join('\n') || '(no prior turns)';
      let triageProfile;
      if (userMemory?.triage_profile) { try { triageProfile = JSON.parse(userMemory.triage_profile); } catch (_e) { /* ignore */ } }
      const intent = await triage(message, (opts) => base44.integrations.Core.InvokeLLM({ ...opts, model: INTERPRETATION_MODEL }), lastTurns, triageProfile);

      if (intent === 'casual') {
        stateBlock = `No quantitative Thinking State for this message — respond directly and conversationally, grounded in the conversation. If there's no prior thread to pick up, arrive as yourself — a one-line human breath that carries your tone without becoming a menu, a readiness tail, or a list of lanes/topics/options to pick from. Never surface internal nomenclature (engine, calibration, UX, components) unless the user named it first. The conversation starts when they do.`;
        synthModel = selectSynthesisModel('casual');
        fallbackResponse = 'Hey.';
      } else {
        // --- Analytical: web fetch, then maybe engine ---
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

        sourcesBlock = filterSourcesBlock(fetchResult?.sources);

        // Contextual trigger: if the message names a ticker, pull a REAL return
        // series from Yahoo and run the engine on actual data.
        let contextPriceLine = '';
        const TICKER_RE = /\b(BTC|ETH|SOL|DOGE|XRP|ADA|MATIC|SPY|QQQ|TSLA|AAPL|MSFT|NVDA|GOOG|GOOGL|AMZN|META)\b/i;
        const tickerHit = message.match(TICKER_RE);
        if (tickerHit) {
          try {
            const md = await fetchYahooReturns(tickerHit[1], 1825);
            if (md.closes && md.closes.length >= 7) {
              await runUnifiedEngine(md.closes, tickerHit[1]);
              stateBlock = pipelineResult.pius.directive;
              if (md.latestPrice != null) contextPriceLine = `${tickerHit[1].toUpperCase()} last close: $${md.latestPrice.toFixed(2)} (${md.dataPoints} daily bars, 2yr window).`;
            }
          } catch (e) { /* fall through to web-fetch series */ }
        }

        // Fallback: run the engine on a series the web-fetch extracted.
        // hex6Engine takes raw values directly; valuesToBits encodes direction
        // regardless of whether the series is prices or returns.
        if (!stateBlock && fetchResult?.needs_engine && Array.isArray(fetchResult.series) && fetchResult.series.length >= 7) {
          await runUnifiedEngine(fetchResult.series, fetchResult?.ticker || null);
          stateBlock = pipelineResult.pius.directive;
        }

        stateBlock = stateBlock || `No quantitative Thinking State for this message — respond using the supplied data.`;
        dataBlock = `DATA (supplied by HEX6-BLE):\n${contextPriceLine ? contextPriceLine + '\n' : ''}${fetchResult?.factual_summary || 'No external data retrieved.'}`;
        synthModel = selectSynthesisModel(intent === 'research' ? 'research' : 'analytical');
        fallbackResponse = fetchResult?.factual_summary || fallbackResponse;
      }
    }

    // --- Single synthesis + single post-process ---
    voice = adaptVoiceForModel(voice, synthModel);
    const synthPayload = { prompt: composePrompt(stateBlock, dataBlock), model: synthModel, add_context_from_internet: false };
    if (file_urls && file_urls.length > 0) synthPayload.file_urls = file_urls;
    const synth = await base44.integrations.Core.InvokeLLM(synthPayload).catch(() => null);
    const rawResponse = (synth || fallbackResponse).trim();
    const { visible, memory: mem } = await processBoundarySignal(base44, user, userMemory, rawResponse);
    if (mem) userMemory = mem;
    let finalResponse = visible || rawResponse;
    if (sourcesBlock) finalResponse = `${finalResponse}\n\n**Sources:**\n${sourcesBlock.split('\n').map(s => `- ${s}`).join('\n')}`;
    saveCognitiveState();
    updateMemory(base44, user, userMemory, message, finalResponse);
    return Response.json({ response: finalResponse, ran_engine: ranEngine, version: MODEL_VERSION, timestamp: new Date().toISOString() });

  } catch (error) {
    console.error('think error:', error);
    return Response.json({ error: error.message || 'Failed to process message' }, { status: 500 });
  }
});