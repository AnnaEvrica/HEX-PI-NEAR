import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { CLAUDE_MODEL, WEB_MODEL } from '../../shared/modelRouter.ts';
import { buildPersona } from '../../shared/persona.ts';
import { verifiedSourcesBlock } from '../../shared/chatHelpers.ts';

// Public landing-page feed — 4 questions across categories, each answered
// through the same retrieval + synthesis pipeline the chat function uses:
// Gemini retrieves live facts + sources, every link is live-checked, then
// Claude writes the reply in the HEX persona with verified citations appended.
// One card ("Prediction") also carries the live engine probability read.
// Cached for 6 hours so a busy landing page costs a handful of model calls a day.

const CACHE_MS = 6 * 60 * 60 * 1000;
let cached: { at: number; data: any } | null = null;

// Curated questions across categories. The first is the prediction card —
// its question is replaced by the latest real engine query at runtime.
const CURATED = [
  { category: 'Prediction', question: 'What is the engine reading on the market right now?' },
  { category: 'Markets', question: 'Is now a good time to buy Bitcoin, or should I wait?' },
  { category: 'Macro', question: 'Are we heading into a recession?' },
  { category: 'Technology', question: 'Will AI replace human judgement in financial decisions?' },
];

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

async function answerQuestion(base44, question: string): Promise<{ answer: string; sources: any[] }> {
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

  // 3. Synthesis — Claude writes the reply in the HEX persona with the retrieved data.
  const synthResult: any = await base44.integrations.Core.InvokeLLM({
    prompt: `${buildPersona()}

DATA (retrieved this turn):
${fetchResult?.factual_summary || 'No external data retrieved.'}
${sourceLedger ? `\n\n${sourceLedger}` : ''}

CITATION FORM: Never write a bare source name or "Sources:" list — the verified, clickable source links are appended automatically beneath your reply. Attribute inside the sentence in plain words ("per the Fed's own release") and let the appended links carry the addresses.

FINAL LOCK — check every line before you write "response":
1. No lists, no headers, no service-desk offers, no signing off with your name.
2. Never attach confidence, conviction, or strength to a probability.
3. One number per sentence. Short sentences. Leave breath.

Question: ${question}

Response:`,
    model: CLAUDE_MODEL,
    response_json_schema: {
      type: 'object',
      properties: {
        response: { type: 'string' },
      },
      required: ['response'],
    },
  }).catch(() => null);

  const answer = (synthResult && typeof synthResult === 'object' && synthResult.response)
    ? unwrapSynth(synthResult.response)
    : (fetchResult?.factual_summary || 'Unable to generate a response at this time.');

  return { answer: answer.trim(), sources: verified.verified };
}

export default async function(req: Request): Promise<Response> {
  try {
    if (cached && Date.now() - cached.at < CACHE_MS) {
      return Response.json({ ...cached.data, cached: true });
    }

    const base44 = createClientFromRequest(req);

    // --- Pull the latest real engine prediction (CognitiveState) ---
    let prediction: any = null;
    try {
      const page = await base44.asServiceRole.entities.CognitiveState.filter(
        {},
        { sort: '-created_date', limit: 50 }
      );
      const items = (page && Array.isArray(page.items)) ? page.items : (Array.isArray(page) ? page : []);
      prediction = items.reduce((best: any, r: any) =>
        (!best || (r.edge || 0) > (best.edge || 0)) ? r : best, null);
    } catch { /* non-blocking */ }

    // --- Build the feed: 4 cards across categories ---
    const questions = [];

    // 1. Prediction card — real engine query + probability, answered through the pipeline.
    const predQuestion = prediction?.query || CURATED[0].question;
    const predAnswer = await answerQuestion(base44, predQuestion);
    questions.push({
      category: CURATED[0].category,
      question: predQuestion,
      answer: predAnswer.answer,
      sources: predAnswer.sources,
      probability: prediction?.probability ?? null,
      direction: prediction?.predicted_direction ?? null,
      base_rate: prediction?.base_rate ?? null,
      edge: prediction?.edge ?? null,
    });

    // 2–4. Other categories — curated questions through the same pipeline.
    for (let i = 1; i < CURATED.length; i++) {
      const result = await answerQuestion(base44, CURATED[i].question);
      questions.push({
        category: CURATED[i].category,
        question: CURATED[i].question,
        answer: result.answer,
        sources: result.sources,
      });
    }

    const data = { questions };
    cached = { at: Date.now(), data };
    return Response.json(data);
  } catch (e) {
    console.error('landingSignals error:', e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}