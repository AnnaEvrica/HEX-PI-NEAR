import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { CLAUDE_MODEL } from '../../shared/modelRouter.ts';
import { IDENTITY_LINE, CONFIDENTIALITY_LINE } from '../../shared/persona.ts';

// Public landing-page feed — the 3 most popular questions asked to the engine
// today (grouped into their 3 most popular topic areas), plus 1 live prediction.
// Cached for 6 hours so a busy landing page costs a handful of model calls a day.

const CACHE_MS = 6 * 60 * 60 * 1000;
let cached: { at: number; data: any } | null = null;

const FALLBACK_QUESTIONS = [
  { topic: 'Markets', question: 'Is now a good time to invest, or should I wait?', answer: 'The current evidence is mixed. Track the primary sources for the latest data, and weigh your own risk tolerance before committing.' },
  { topic: 'Technology', question: 'Will AI replace human judgement in decision-making?', answer: 'AI augments judgement but does not replace it. The best outcomes come from human insight paired with probabilistic tools that quantify uncertainty.' },
  { topic: 'Macro', question: 'Are we heading into a recession?', answer: 'Recession risk depends on multiple indicators moving together. Watch yields, employment, and consumer spending for the clearest signals.' },
];

export default async function(req: Request): Promise<Response> {
  try {
    if (cached && Date.now() - cached.at < CACHE_MS) {
      return Response.json({ ...cached.data, cached: true });
    }

    const base44 = createClientFromRequest(req);

    // --- Pull recent engine outputs (CognitiveState records) ---
    let queries: string[] = [];
    let prediction: any = null;
    try {
      const page = await base44.asServiceRole.entities.CognitiveState.filter(
        {},
        { sort: '-created_date', limit: 200 }
      );
      const items = (page && Array.isArray(page.items)) ? page.items : (Array.isArray(page) ? page : []);
      const today = new Date().toISOString().slice(0, 10);
      const todayItems = items.filter((r: any) => {
        if (!r.query) return false;
        const created = r.created_date ? new Date(r.created_date).toISOString().slice(0, 10) : today;
        return created === today;
      });
      const source = todayItems.length >= 3 ? todayItems : items;
      queries = source.map((r: any) => r.query).filter(Boolean);
      prediction = source.reduce((best: any, r: any) =>
        (!best || (r.edge || 0) > (best.edge || 0)) ? r : best, null);
    } catch { /* use fallbacks */ }

    // --- One Claude call: categorize, pick top 3, write answers ---
    let questions = FALLBACK_QUESTIONS;
    if (queries.length > 0) {
      const qlist = queries.slice(0, 50).map((q, i) => `${i + 1}. ${q}`).join('\n');
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `${IDENTITY_LINE} ${CONFIDENTIALITY_LINE}

You are given questions people asked an AI assistant today. Identify the 3 most popular topic areas. For each, pick the single most representative question and write a concise 2-3 sentence answer. Speak plainly, no jargon. This is general information, not personal advice. Do not state a probability or statistic you cannot support.

Questions asked today:
${qlist}

Return JSON with a "questions" array (exactly 3 items). Each item has "topic" (2-3 words), "question" (the representative question), and "answer" (2-3 sentences).`,
        model: CLAUDE_MODEL,
        response_json_schema: {
          type: 'object',
          properties: {
            questions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  topic: { type: 'string' },
                  question: { type: 'string' },
                  answer: { type: 'string' },
                },
                required: ['topic', 'question', 'answer'],
              },
            },
          },
          required: ['questions'],
        },
      });
      if (result?.questions?.length) questions = result.questions.slice(0, 3);
    }

    const data: any = {
      questions,
      prediction: prediction ? {
        question: prediction.query,
        probability: prediction.probability,
        direction: prediction.predicted_direction,
        base_rate: prediction.base_rate,
        edge: prediction.edge,
      } : null,
    };
    cached = { at: Date.now(), data };
    return Response.json(data);
  } catch (e) {
    console.error('landingSignals error:', e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}