import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { CLAUDE_MODEL } from '../../shared/modelRouter.ts';
import { IDENTITY_LINE, CONFIDENTIALITY_LINE } from '../../shared/persona.ts';

// Public landing-page feed — popular prompts of the day across diverse life
// categories (personal growth, relationships, health, career, technology,
// predictions). Built from recent real engine queries + Claude-generated
// prompts to fill categories. Cached for 6 hours.

const CACHE_MS = 6 * 60 * 60 * 1000;
let cached: { at: number; data: any } | null = null;

const CATEGORIES = [
  'Personal Growth',
  'Relationships',
  'Health & Wellness',
  'Career',
  'Technology',
  'Predictions',
];

const FALLBACK_PROMPTS = [
  { category: 'Personal Growth', prompt: 'How do I break a pattern of self-sabotage?' },
  { category: 'Relationships', prompt: 'When is the right time to walk away from a friendship?' },
  { category: 'Health & Wellness', prompt: 'What actually works for building sustainable habits?' },
  { category: 'Career', prompt: 'Should I take the stable job or bet on the startup?' },
  { category: 'Technology', prompt: 'Will AI replace creative work within five years?' },
  { category: 'Predictions', prompt: 'What is the engine reading on Bitcoin right now?' },
];

export default async function(req: Request): Promise<Response> {
  try {
    if (cached && Date.now() - cached.at < CACHE_MS) {
      return Response.json({ ...cached.data, cached: true });
    }

    const base44 = createClientFromRequest(req);

    // --- Pull recent real queries from the engine ---
    let realQueries: string[] = [];
    let prediction: any = null;
    try {
      const page = await base44.asServiceRole.entities.CognitiveState.filter(
        {},
        { sort: '-created_date', limit: 100 }
      );
      const items = (page && Array.isArray(page.items)) ? page.items : (Array.isArray(page) ? page : []);
      realQueries = items.map((r: any) => r.query).filter(Boolean);
      prediction = items.reduce((best: any, r: any) =>
        (!best || (r.edge || 0) > (best.edge || 0)) ? r : best, null);
    } catch { /* non-blocking */ }

    // --- One Claude call: generate diverse prompts across categories ---
    let prompts = FALLBACK_PROMPTS;
    if (realQueries.length > 0 || true) {
      const realList = realQueries.slice(0, 30).map((q, i) => `${i + 1}. ${q}`).join('\n');
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `${IDENTITY_LINE} ${CONFIDENTIALITY_LINE}

You are generating the "popular prompts of the day" for the HEX [PI] landing page. These are questions visitors can click to test the engine.

Categories (use exactly these): ${CATEGORIES.join(', ')}.

${realQueries.length > 0 ? `Recent real questions people asked the engine:\n${realList}\n` : ''}

Generate 8 prompts — at least one per category. Make them specific, engaging, and answerable with real data or genuine reasoning. Not generic ("How do I be happy?") but concrete ("What's the probability that the Fed cuts rates before year-end?"). Vary the tone — some direct, some curious, some provocative.

Return JSON with a "prompts" array. Each item: {category (one of the categories above), prompt (the question)}.`,
        model: CLAUDE_MODEL,
        response_json_schema: {
          type: 'object',
          properties: {
            prompts: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  category: { type: 'string' },
                  prompt: { type: 'string' },
                },
                required: ['category', 'prompt'],
              },
            },
          },
          required: ['prompts'],
        },
      });
      if (result?.prompts?.length) prompts = result.prompts.slice(0, 8);
    }

    const data: any = {
      prompts,
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