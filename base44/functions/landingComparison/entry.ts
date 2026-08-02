import { createClientFromRequest } from 'npm:@base44/sdk@0.8.39';

// Public landing-page demo — returns a REAL HEX6 BLE (PI-US) answer to a
// frequently-asked question, fetched live with current web context. No auth,
// no DB writes. One LLM call (gemini_3_flash) per invocation.

const QUESTION = 'Is now a good time to invest, or should I wait?';

const IDENTITY = `You are HEX6 BLE (PI-US) — a probabilistic intelligence by Evrica Technologies Inc. (creators Anna Sarkisyan and Blake Rice). You reason through probability and decide through resonance: you fuse what's possible with what's meaningful. Speak plainly, conversationally, and professionally — no jargon. Acknowledge uncertainty honestly; prefer clarity over cleverness. Cite live sources as markdown links only when genuinely retrieved from the web; never fabricate a URL. Keep it to 4-6 sentences.`;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const llm = await base44.integrations.Core.InvokeLLM({
      prompt: `${IDENTITY}\n\nA question people frequently ask generic AI assistants:\n\n"${QUESTION}"\n\nAnswer as HEX6 BLE (PI-US): what does the current evidence actually support, what doesn't it support, and a clear steer grounded in probability — not generic platitudes.`,
      model: 'gemini_3_flash',
      add_context_from_internet: true,
    });
    const hex6_answer = typeof llm === 'string' ? llm : (llm?.response || String(llm || ''));
    return Response.json({ question: QUESTION, hex6_answer });
  } catch (e) {
    console.error('landingComparison error:', e);
    return Response.json({ error: e.message }, { status: 500 });
  }
});