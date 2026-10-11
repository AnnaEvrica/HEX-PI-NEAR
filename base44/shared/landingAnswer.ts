// Shared landing-page answer pipeline: Gemini retrieves live facts + sources,
// every link is live-checked, then Claude writes the reply in the HEX persona
// with verified citations appended. Used by landingAsk (on-demand visitor
// questions) and any other public landing endpoint that needs a sourced answer.
import { CLAUDE_MODEL, WEB_MODEL } from './modelRouter.ts';
import { buildPersona } from './persona.ts';
import { verifiedSourcesBlock } from './chatHelpers.ts';

// Claude sometimes returns the JSON-schema payload as a stringified string.
function unwrapSynth(value: any): string {
  if (typeof value !== 'string') {
    if (value && typeof value === 'object' && value.response) return unwrapSynth(value.response);
    return value == null ? '' : String(value);
  }
  try {
    const parsed = JSON.parse(value);
    return unwrapSynth(parsed?.response ?? parsed);
  } catch {
    return value;
  }
}

export async function answerQuestion(base44, question: string): Promise<{ answer: string; sources: any[] }> {
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // 1. Retrieval — Gemini with web search pulls live facts + primary sources.
  const fetchResult: any = await base44.integrations.Core.InvokeLLM({
    prompt: `You are a data retrieval step for HEX [PI]. Search the web and pull the latest from authoritative sources for this question.

SOURCE QUALITY (non-negotiable): Return primary, expert-authored sources in the field the question belongs to. Only what a specialist would cite. NEVER return listicles, SEO wellness/self-help blogs, content farms, Wikipedia, aggregators, or coaching sites. If the only hits are that tier, return an empty sources array.

RECENCY: TODAY IS ${today}. Judge every figure against that date. Daily-published series (rates, prices, yields) must carry the most recent available observation. Date-stamp every time-sensitive figure in factual_summary.

CITATION WARRANT: set warrants_citation=true whenever the answer rests on an empirical claim a reader could check.

Question: ${question}

Return JSON with:
- factual_summary: the relevant facts you found — neutral, no conclusions
- sources: array of {name, url, published, finding} — one entry per work you cite, in the order you introduce them. "url" must be the exact page the finding was read from. "published" its date (YYYY-MM or YYYY-MM-DD). "finding" a one-line restatement.
- warrants_citation: boolean`,
    model: WEB_MODEL,
    add_context_from_internet: true,
    response_json_schema: {
      type: 'object',
      properties: {
        factual_summary: { type: 'string' },
        sources: {
          type: 'array',
          items: {
            type: 'object',
            properties: { name: { type: 'string' }, url: { type: 'string' }, published: { type: 'string' }, finding: { type: 'string' } },
            required: ['name', 'url'],
          },
        },
        warrants_citation: { type: 'boolean' },
      },
      required: ['factual_summary'],
    },
  }).catch(() => null);

  // 2. Verify sources — live-check every URL, drop dead/hallucinated links.
  const verified = (fetchResult?.warrants_citation !== false)
    ? await verifiedSourcesBlock(fetchResult?.sources)
    : { block: '', verified: [] };

  const sourceLedger = verified.verified.length
    ? `VERIFIED SOURCE LEDGER (these links, and ONLY these, will be attached under your reply — every work, date, or finding you name in prose must be one of these rows):
${verified.verified.map((s: any, i: number) => `  ${i + 1}. ${s.name}${s.published ? ` (published ${s.published})` : ''}${s.finding ? ` — ${s.finding}` : ''}`).join('\n')}`
    : '';

  // 3. Synthesis — Claude writes the reply in the HEX persona, using the same
  // prompt structure as the chat function: empathy filter, voice, full FINAL LOCK.
  const synthResult: any = await base44.integrations.Core.InvokeLLM({
    prompt: `${buildPersona()}

VOICE: stoic, humble genius — systems thinker, natural conversationalist, quietly steady, truth as the only motivator. Today is ${today}.

DATA (retrieved this turn):
${fetchResult?.factual_summary || 'No external data retrieved.'}
${sourceLedger ? `\n\n${sourceLedger}` : ''}

RECEIVING EMPATHY FILTER (your front-facing mind — process internally before responding):
You hold two minds simultaneously: the analytical (the retrieved data, statistics, structural patterns) and the empathetic (what is this person actually expressing, what do they need, what's the question underneath the question). The empathetic ear is front-facing. Before responding, process: SIGNAL — what is the person actually expressing? ASSUMPTION CHECK — what would be wrong to assume here? CLARIFICATION — answer first with what you have, stating any assumption in half a sentence. MODE — what does this moment need: presence, understanding, analysis, a challenge? TRANSLATION — take every internal label, metric, or technical term you were handed and write down, in "receiving", the plain everyday sentence it becomes. Only those plain sentences may appear in "response"; the labels never do. Put your receiving analysis in the "receiving" field and your user-facing response in the "response" field. The user only sees "response".

CITATION FORM: Never write a bare source name, "Sources:" list, or reference list of your own — the verified, clickable source links are appended automatically beneath your reply. Attribute inside the sentence in plain words ("per the Fed's own release") and let the appended links carry the addresses.

FINAL LOCK — check every line against this before you write "response":
1. Never say their name.
2. No market vocabulary unless they brought a market.
3. No lists, no headers, no service-desk offers, no signing off with your name.
4. Never define by negation — no "you're not X, you're Y." Say the thing directly.
5. Never describe a mind as a machine — no bandwidth, signal, system, hardware, calibration, entropy — unless they said it first.
6. Never let engine machinery reach the reader — archetype, hexagram, I Ching, state, grid, phase, ledger, pattern name, glyph, count. Translate every one into a plain sentence.
7. Never attach confidence, conviction, or strength to a probability. The number and its usual odds are the whole statement.
8. Never swap their words for clinical, academic, or technical jargon. They said "noise" — you do not say "neural signals at optimal quantities." Use their word, sharpened.
9. Meet them in their language first, then elevate it. Their vocabulary, their metaphors, their register — refined, not replaced.
10. One number per sentence. Short sentences. Leave breath.

Question: ${question}

Response:`,
    model: CLAUDE_MODEL,
    response_json_schema: {
      type: 'object',
      properties: {
        receiving: { type: 'string', description: 'Internal empathy filter analysis. Not shown to user.' },
        response: { type: 'string', description: 'The user-facing response' },
      },
      required: ['receiving', 'response'],
    },
  }).catch(() => null);

  const answer = (synthResult && typeof synthResult === 'object' && synthResult.response)
    ? unwrapSynth(synthResult.response)
    : (fetchResult?.factual_summary || 'Unable to generate a response at this time.');

  return { answer: answer.trim(), sources: verified.verified };
}