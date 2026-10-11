import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { runAnswerPipeline } from '../../shared/answerPipeline.ts';
import { updateMemory } from '../../shared/chatHelpers.ts';
import { anchorVerdict } from '../../shared/asiSpine.ts';
import { confluenceAgrees } from '../../shared/chartContext.ts';
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
// think — the chat function. Delegates the core answer pipeline to
// answerPipeline.ts (the same engine the landing page uses), then adds the
// user-specific layers: memory, cognitive-state saving, boundary escalation,
// and spine anchoring.
// ===========================================================================
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const entitled = user.role === 'admin' || user.subscription_status === 'active' || user.subscription_status === 'trialing';
    if (!entitled) return Response.json({ error: 'Subscription required' }, { status: 402 });

    const body = await req.json();
    let { message, conversationHistory, file_urls, model, clientContext } = body;
    if ((!message || !message.trim()) && Array.isArray(file_urls) && file_urls.length > 0) {
      message = '[image attached — please look at it and respond]';
    }
    if (!message || !message.trim()) return Response.json({ error: 'Message required' }, { status: 400 });

    // --- Memory fetch (for writeback after responding) ---
    let userMemory = null;
    try {
      const memRows = await base44.asServiceRole.entities.UserConversationMemory
        .filter({ user_email: user.email });
      userMemory = memRows && memRows.length > 0 ? memRows[0] : null;
    } catch { /* non-blocking */ }

    // --- Run the shared engine pipeline ---
    const result = await runAnswerPipeline(base44, {
      message,
      history: Array.isArray(conversationHistory) ? conversationHistory : [],
      clientContext,
      file_urls,
      userName: user.full_name || 'friend',
      userMemory,
      logToLedger: true,
    });

    // --- Boundary warning escalation (user-specific) ---
    if (result.boundaryReason) {
      userMemory = await recordBoundaryWarning(base44, user, userMemory, result.boundaryReason);
    }

    // --- Save the read (CognitiveState) and anchor it on the audit spine ---
    const { pipelineResult, chartCtx } = result;
    const read = pipelineResult?.read;
    if (read) {
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
            edge: Math.abs(read.edge_up),
            predicted_direction: read.direction,
            resonance: resonance?.status === 'computed' ? (resonance.resonance ?? null) : null,
          });

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
    }

    updateMemory(base44, user, userMemory, message, result.response);
    return Response.json({ response: result.response, ran_engine: result.ranEngine, version: ENGINE_VERSION, timestamp: new Date().toISOString() });

  } catch (error) {
    console.error('think error:', error);
    return Response.json({ error: error.message || 'Failed to process message' }, { status: 500 });
  }
});