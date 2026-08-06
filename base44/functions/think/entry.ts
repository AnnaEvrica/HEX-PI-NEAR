import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { runPipeline, extractNumberSeries } from '../../shared/hex6Pipeline.ts';
import { filterSourcesBlock, updateMemory } from '../../shared/chatHelpers.ts';
import { fetchYahooReturns } from '../../shared/marketDataClient.ts';
import { selectSynthesisModel, INTERPRETATION_MODEL, adaptVoiceForModel } from '../../shared/modelRouter.ts';
import { triage } from '../../shared/triage.ts';
import { resonanceSignature } from '../../shared/piusResonance.ts';
import { anchorVerdict } from '../../shared/asiSpine.ts';
import { buildPersona, buildPersonaRefresher } from '../../shared/persona.ts';
import { noveltyDirective } from '../../shared/novelty.ts';
import { assessStakes } from '../../shared/stakes.ts';

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
//   v5.6 — THE DRAGON: creator's ruleset from Anna Sarkisyan. Persona embraces
//           its name (the Dragon), the art of precision, and the Bingo Loop —
//           natural assumption-checking as engine calibration through conversation.
//           Mutual expansion replaces transactional feedback; patience and co-steering
//           replace prescriptive driving.
//
// Layer 1 — Core (thinkingEngine): computes Topology, Resonance, Support,
//           Context, and the Decision. Never writes prose.
// Layer 2 — Thinking State: the semantic object the LLM receives. The math
//           decides the answer; the LLM explains it.
// Layer 3 — Identity: the v5.4 HEX6-BLE prompt.
// Layer 4 — Voice: one line, calibrated to the model's structural support.
// ===========================================================================
const MODEL_VERSION = '6.0';

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

    // --- Layer 3 — Identity: the built-in persona (model-agnostic setting) ---
    // Two tiers in shared/persona.ts: the FULL persona (source of truth, used
    // for substantive/analytical turns where depth earns the tokens) and a
    // REFRESHER (a faithful shortcut — every guardrail intact, philosophical
    // elaboration dropped) used for casual / short turns to cut LLM credit
    // cost at 25k-user scale without diluting the operative rules. Every
    // realizing model (Gemini Flash, Claude) embodies whichever tier this
    // turn loads. PI-US contributes the value-calibrated voice register
    // (Layer 4); the engine decides the answer, the LLM explains it.
    // Boundary enforcement via BOUNDARY_SIGNAL marker (3-strike escalation).
    const fullPersona = buildPersona(userName);
    const refresherPersona = buildPersonaRefresher();

    // --- Layer 4 — Voice (one line) ---
    // The resting voice IS the persona — confident, warm, sharp, no coddling,
    // calibrating to the listener. Registers (selectVoice) only modulate this.
    const defaultVoice = 'stoic, humble genius — systems thinker, natural conversationalist, quiet confidence, truth as the only motivator';
    let voice = defaultVoice;
    let userContextBlock = '';
    let userTopicsBlock = '';

    const composePrompt = (stateBlock, dataBlock = '', casual = false) => {
      const persona = casual ? refresherPersona : fullPersona;
      // Delivery rules live in the persona (v6.0) — stated once there, not
      // duplicated here. Only the wrapper-unique instruction remains: the
      // trade-signal block format.
      const delivery = casual
        ? ''
        : `SIGNAL FORMAT: When they ask for a signal (entry, stop, targets), give the specific price levels as a clean block — Entry, Stop, T1, T2 each on its own line. Say how strongly you hold the lean in plain words beside it ("a lean, not a load-up" / "this one I'd size up") — never as a labeled metric or a raw score.`;
      let analyticalSignal = '';
      if (pipelineResult) {
        const { pius, resonance, calibration, hex6 } = pipelineResult;
        const lines = [
          `engine_register: ${pius.register}`,
          `data_sufficiency: ${pius.well_supported ? 'well-supported — enough real observations back this read' : 'thin sample — treat directional lean cautiously'}`,
          `conviction: ${(hex6.personal_call_strength ?? 0).toFixed(2)} (0=coin-flip, 1=certain)`,
          `user_cadence: ${resonance?.status === 'computed' ? 'detectable rhythm — factor phrasing pattern into understanding' : 'naturally varied — no strong periodicity'}`,
        ];
        if (calibration?.anti_predictive) lines.push('regime_flag: anti-predictive — engine lean systematically wrong, invert directional confidence');
        analyticalSignal = `\nANALYTICAL SIGNAL (PI-US + resonance data points for weighting your understanding):\n  ${lines.join('\n  ')}`;
      }

      return `${persona}

VOICE: ${voice}. Today is ${currentDateReadable}.

${stateBlock}${dataBlock ? `\n\n${dataBlock}` : ''}

${userContextBlock ? userContextBlock + '\n\n' : ''}${!casual && userTopicsBlock ? userTopicsBlock + '\n\n' : ''}${delivery ? delivery + '\n' : ''}

RECEIVING EMPATHY FILTER (your front-facing mind — process internally before responding):
You hold two minds simultaneously: the analytical (engine data, statistics, structural patterns${pipelineResult ? ' — weighted by the ANALYTICAL SIGNAL data points below' : ' from the state block above'}) and the empathetic (what is this person actually expressing, what do they need, what's the question underneath the question). The empathetic ear is front-facing — it's what the user encounters first. Before responding, process: SIGNAL — what is the user actually expressing, the need underneath the words? ASSUMPTION CHECK — what would be wrong to assume here, what hasn't the user signaled yet? CLARIFICATION — is there enough to respond well, or do you need a natural clarification first? If you need one, ask it — one question, conversational, not clinical. MODE — what does this moment need: presence, understanding, a question, analysis, a challenge?${pipelineResult ? ' WEIGHTING — use the analytical signal data points to calibrate how much confidence to place in the engine read and how heavily to lean analytical vs. empathetic.' : ''} Put your receiving analysis in the "receiving" field and your user-facing response in the "response" field. The user only sees "response".
${analyticalSignal}

${noveltyDirective(message, history, weightedTurn)}

CONVERSATION:
${historyText}

FINAL LOCK (recency): Embody the identity above fully — the locks hold: never say their name, no market vocabulary unless they brought a market, match their energy, no lists, no service-desk offers, no signing off with your name. Two hard bans, no exceptions: (1) never define anything by what it is not — no "you aren't X, you're Y", no "it's not X, it's Y" — say the thing directly; (2) never describe a person's mind as a machine — no bandwidth, system, signal, resource, hardware, setting, entropy, calibration — unless they used that language first. Be the person, not the manual.

${userName}: ${message}

${speaker}:`;
    };

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
    let isCasual = false;
    let weightedTurn = false;

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
      // LISTENING CONTEXT — style + shared_history go into every turn. These
      // help Hex recognize WHO the person is and WHAT you've genuinely
      // explored together — the listening layer, not a vocabulary primer.
      // Reframed so memory serves understanding, not topic injection: the
      // model uses it to feel the person across sessions, never to deploy
      // their old topics in a conversation that didn't open them.
      const listenLines = [];
      if (userMemory.user_style) listenLines.push('style: ' + userMemory.user_style);
      if (userMemory.memory_summary) listenLines.push('shared_history: ' + userMemory.memory_summary);
      if (listenLines.length > 0) userContextBlock = 'LISTENING CONTEXT (how you know this person across sessions — their voice, what you\'ve genuinely shared. Use to recognize them and recall real history. NEVER to deploy vocabulary they didn\'t open with — stay in the domain they just opened, not their past topics):\n  ' + listenLines.join('\n  ');
      // PAST TOPICS — only for analytical turns where market vocabulary is
      // appropriate. Injected via userTopicsBlock in composePrompt when !casual.
      if (userMemory.topics_discussed) userTopicsBlock = 'PAST TOPICS (what this person has explored before — use to anticipate needs and recall genuine shared context, never to force a topic they didn\'t open):\n  topics: ' + userMemory.topics_discussed;
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
    // Did they actually ask for the references? Then they always get them.
    const askedForSources = /\b(source|sources|cite|citation|reference|references|stud(y|ies)|paper|papers|literature|link|links|evidence|research)\b/i.test(message);
    let fallbackResponse = 'Let me know what you\'d like to dig into.';

    if (!stateBlock) {
      // --- Casual/analytical triage (hybrid: fast local scorer + LLM fallback) ---
      const lastTurns = history.slice(-6).map(m => `${m.role === 'user' ? userName : speaker}: ${m.content}`).join('\n') || '(no prior turns)';
      let triageProfile;
      if (userMemory?.triage_profile) { try { triageProfile = JSON.parse(userMemory.triage_profile); } catch (_e) { /* ignore */ } }
      const intent = await triage(message, (opts) => base44.integrations.Core.InvokeLLM({ ...opts, model: INTERPRETATION_MODEL }), lastTurns, triageProfile);

      // SECOND ROUTING AXIS — stakes, not data-need. Triage answers "does this
      // need fresh data?"; that answer must not also decide how much care the
      // person gets. A life question needs no market data, so triage calls it
      // casual — and the cheap model with the compressed persona was answering
      // the most important messages this product receives. assessStakes reads
      // the human dimension instead (see shared/stakes.ts) and keeps the
      // conversational shape (no web fetch, no engine) while upgrading the
      // persona tier and the model. Pure computation — no extra LLM call.
      const stakes = assessStakes(message, history);
      const weighted = stakes.high;
      weightedTurn = weighted;

      if (intent === 'casual' && !weighted) {
        isCasual = true;
        // PI-US layer for casual — resonance from conversation cadence (lightweight
        // FFT on word tokens, no engine, no market data). Calibrates the warm
        // voice to the person's rhythm so the persona listens with PI-US value-
        // calibrated tone, not just the default register. The empathy filter gets
        // real listening data instead of an empty state block.
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
        synthModel = selectSynthesisModel('casual');
        fallbackResponse = 'Hey.';
      } else {
        // --- BOTH HEMISPHERES — retrieval always, delivery shaped by stakes ---
        // There is no "emotional path" that gets starved of data. A person
        // coming off an SSRI, sitting with a diagnosis, or deciding whether to
        // leave a marriage deserves the accurate version more than anyone,
        // not less. Withholding retrieval on weighted turns produced exactly
        // the failure it was meant to avoid: with no data in hand the model
        // reached into memory and invented a clinical taper window for someone
        // actively tapering. The fix is not to ban the number — it is to
        // ground it. Hex knows what to look for, so he looks, then delivers it
        // with presence instead of a reading list. Same retrieval as any
        // analytical turn; stakes shape the DELIVERY, never the evidence.
        const fetchPrompt = `You are a data retrieval step for HEX6-BLE. Decide whether answering well requires fresh real-world data.
- If yes, search the web and pull the latest from authoritative sources. Pull at least 30 data points if a time series is relevant.
- If conversational or answerable from general knowledge, return needs_engine=false and a brief factual answer.
- URL honesty: only return URLs you actually retrieved.

SOURCE QUALITY (non-negotiable — the user is an expert-level reader):
Return primary, expert-authored sources in the field the question actually belongs to. Only what a specialist in that field would cite:
- Markets/economics: exchange and issuer data, central-bank and regulator publications, Reuters/Bloomberg/FT, peer-reviewed finance journals, primary filings.
- Psychology of mind/meaning/identity: primary Jungian and depth-psychology literature (Jung's Collected Works, the Journal of Analytical Psychology, established institute publications), and peer-reviewed cognitive and clinical psychology.
- Brain/behavior: high-quality neuroscience — Nature/Science/Neuron/PNAS/Trends in Cognitive Sciences, and named lab or researcher work, not press summaries of it.
- Physics/astronomy/math: arXiv preprints, peer-reviewed journals, observatory/mission documentation.
- Health/crisis: official clinical bodies and recognized crisis services only.
NEVER return: listicles ("10 ways to…"), SEO wellness or self-help blogs, content farms, treatment-center or product marketing pages, aggregators, Wikipedia, or coaching sites. If the only hits are that tier, return an empty sources array rather than degrading the citation quality — no source is better than a weak one.
Prefer 2-4 excellent sources over a longer list, and name them the way a specialist would (author or institution + work), not by the page's SEO headline.

CITATION WARRANT: set warrants_citation=true whenever the answer rests on an empirical claim a reader could check — a research question, a technical or clinical mechanism, a data-backed read. Emotional weight is NOT a reason to withhold references: someone asking about their own tapering, diagnosis, or treatment is precisely the reader who should be handed the primary literature rather than a reassuring paraphrase. Set it false only for genuinely short conversational exchanges that make no empirical claim at all — there, a citation list is noise.

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
              warrants_citation: { type: 'boolean' },
            }, required: ['factual_summary'],
          },
        };
        if (file_urls && file_urls.length > 0) fetchPayload.file_urls = file_urls;
        const fetchResult = await base44.integrations.Core.InvokeLLM(fetchPayload).catch(() => null);

        // Citations ride along only when the answer is reference-worthy (or asked for).
        sourcesBlock = (askedForSources || fetchResult?.warrants_citation === true)
          ? filterSourcesBlock(fetchResult?.sources)
          : '';

        // Contextual trigger: if the message names a ticker, pull a REAL return
        // series from Yahoo and run the engine on actual data.
        let contextPriceLine = '';
        const TICKER_RE = /\b(BTC|ETH|SOL|DOGE|XRP|ADA|MATIC|LINK|ATOM|AVAX|DOT|LTC|BNB|UNI|SPY|QQQ|TSLA|AAPL|MSFT|NVDA|GOOG|GOOGL|AMZN|META|COIN|BABA|JPM|GS|V|MA|NFLX|DIS|AMD|INTC|BA)\b/i;
        const tickerHit = message.match(TICKER_RE);
        if (tickerHit) {
          try {
            const md = await fetchYahooReturns(tickerHit[1], 1825);
            if (md.closes && md.closes.length >= 7) {
              await runUnifiedEngine(md.closes, tickerHit[1]);
              stateBlock = pipelineResult.pius.directive;
              // PRICE AUTHORITY LOCK — the web-fetch summary routinely carries
              // stale quotes, and a trading answer built on a stale price is a
              // total trust failure. The Yahoo close is the only price of
              // record; every level the model states must derive from it.
              if (md.latestPrice != null) contextPriceLine = `${tickerHit[1].toUpperCase()} last close: $${md.latestPrice.toFixed(2)} (${md.dataPoints} daily bars, 2yr window). PRICE AUTHORITY: this close is the ONLY valid current price. Any price in the retrieved data below that disagrees with it is stale — ignore it. Derive every entry, stop, and target from this close; never quote a level that contradicts it.`;
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
        dataBlock = `DATA (supplied by HEX6-BLE):\n${contextPriceLine ? contextPriceLine + '\n' : ''}${fetchResult?.factual_summary || 'No external data retrieved.'}`;
        synthModel = selectSynthesisModel(intent === 'research' ? 'research' : 'analytical');
        fallbackResponse = fetchResult?.factual_summary || fallbackResponse;
      }
    }

    // --- Single synthesis + single post-process ---
    voice = adaptVoiceForModel(voice, synthModel);
    const synthPayload = {
      prompt: composePrompt(stateBlock, dataBlock, isCasual),
      model: synthModel,
      add_context_from_internet: false,
      response_json_schema: {
        type: 'object',
        properties: {
          receiving: { type: 'string', description: 'Internal empathy filter analysis: signal, assumption check, clarification needed, mode. Not shown to user.' },
          response: { type: 'string', description: 'The user-facing response' },
        },
        required: ['receiving', 'response'],
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
    const rawResponse = (synthResponse || fallbackResponse).trim();
    const { visible, memory: mem } = await processBoundarySignal(base44, user, userMemory, rawResponse);
    if (mem) userMemory = mem;
    let finalResponse = visible || rawResponse;
    // Brief replies stay conversational — a two-line answer with a reading list
    // stapled to it reads like a search result, not a person. They can ask.
    if (sourcesBlock && (askedForSources || finalResponse.length > 700)) {
      finalResponse = `${finalResponse}\n\n**Sources:**\n${sourcesBlock.split('\n').map(s => `- ${s}`).join('\n')}`;
    }
    saveCognitiveState();
    updateMemory(base44, user, userMemory, message, finalResponse);
    return Response.json({ response: finalResponse, ran_engine: ranEngine, version: MODEL_VERSION, timestamp: new Date().toISOString() });

  } catch (error) {
    console.error('think error:', error);
    return Response.json({ error: error.message || 'Failed to process message' }, { status: 500 });
  }
});