import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { WEB_MODEL, CLAUDE_MODEL } from '../../shared/modelRouter.ts';
import { IDENTITY_LINE, CONFIDENTIALITY_LINE } from '../../shared/persona.ts';

// Public landing-page demo — a live answer to one frequently asked question,
// written by Claude from facts retrieved on the web this turn. No auth, no database writes.
//
// The answer is cached in memory for six hours, so a busy landing page costs
// a handful of model calls a day instead of one per visitor.

const QUESTION = 'Is now a good time to invest, or should I wait?';
const CACHE_MS = 6 * 60 * 60 * 1000;
let cached: { at: number; answer: string } | null = null;

const IDENTITY = `${IDENTITY_LINE} ${CONFIDENTIALITY_LINE} Speak plainly, conversationally and professionally — no jargon. Say what the current evidence supports and what it does not, and name the uncertainty honestly. This is general information, not personal investment advice: do not tell the reader what to buy, sell or hold, and state no probability or statistic you did not retrieve this turn. Cite live sources as markdown links only when genuinely retrieved from the web; never fabricate a URL. Keep it to 4-6 sentences.`;

Deno.serve(async (req) => {
  try {
    if (cached && Date.now() - cached.at < CACHE_MS) {
      return Response.json({ question: QUESTION, hex6_answer: cached.answer, cached: true });
    }
    const base44 = createClientFromRequest(req);
    // The web model retrieves; Claude writes. Same division as the chat function.
    const text = (r) => (typeof r === 'string' ? r : (r?.response || ''));
    const facts = text(await base44.integrations.Core.InvokeLLM({
      prompt: `Retrieval step. Today is ${new Date().toISOString().slice(0, 10)}. Gather the current, primary-source facts a careful answer to this question needs, each with its date and the exact page it came from as a markdown link. Facts only, no advice, no conclusions.\n\nQuestion: "${QUESTION}"`,
      model: WEB_MODEL,
      add_context_from_internet: true,
    }));
    const hex6_answer = text(await base44.integrations.Core.InvokeLLM({
      prompt: `${IDENTITY}\n\nA question people frequently ask generic AI assistants:\n\n"${QUESTION}"\n\nFACTS RETRIEVED THIS TURN (the only figures and links you may use):\n${facts || 'None retrieved.'}\n\nAnswer as HEX [PI]: what the current evidence supports, what it does not, and what would change the picture.`,
      model: CLAUDE_MODEL,
    }));
    if (hex6_answer) cached = { at: Date.now(), answer: hex6_answer };
    return Response.json({ question: QUESTION, hex6_answer });
  } catch (e) {
    console.error('landingComparison error:', e);
    return Response.json({ error: e.message }, { status: 500 });
  }
});
