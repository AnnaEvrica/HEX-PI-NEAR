import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { WEB_MODEL } from '../../shared/modelRouter.ts';
import { IDENTITY_LINE, CONFIDENTIALITY_LINE } from '../../shared/persona.ts';

// Public landing-page feed — one trending prompt per category, generated from
// what's actually trending on the web right now. Each prompt carries its
// trending_source (where the popularity stems from). Cached 6 hours.

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
  { category: 'Personal Growth', prompt: 'How do I break a pattern of self-sabotage?', trending_source: 'Editorial pick' },
  { category: 'Relationships', prompt: 'When is the right time to walk away from a friendship?', trending_source: 'Editorial pick' },
  { category: 'Health & Wellness', prompt: 'What actually works for building sustainable habits?', trending_source: 'Editorial pick' },
  { category: 'Career', prompt: 'Should I take the stable job or bet on the startup?', trending_source: 'Editorial pick' },
  { category: 'Technology', prompt: 'Will AI replace creative work within five years?', trending_source: 'Editorial pick' },
  { category: 'Predictions', prompt: 'What is the engine reading on Bitcoin right now?', trending_source: 'Editorial pick' },
];

export default async function(req: Request): Promise<Response> {
  try {
    if (cached && Date.now() - cached.at < CACHE_MS) {
      return Response.json({ ...cached.data, cached: true });
    }

    const base44 = createClientFromRequest(req);
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const result: any = await base44.integrations.Core.InvokeLLM({
      prompt: `${IDENTITY_LINE} ${CONFIDENTIALITY_LINE}

TODAY IS ${today}. Search the web for what is trending right now — the most discussed topics, news, and conversations of the day.

For each of these 6 categories, find ONE trending question based on today's actual trending topics:
${CATEGORIES.join(', ')}

For each prompt, also state where the trend is coming from — the specific source of its popularity (e.g. "Trending on X — 18K posts today", "Top Google search today", "Breaking on Reuters", "#1 on Reddit r/technology"). Be specific and truthful about the source.

Rules:
- Base each prompt on an actual trending topic you found in your web search.
- Make prompts specific, engaging, and answerable with real data or genuine reasoning.
- Vary the tone — some direct, some curious, some provocative.

Return JSON with a "prompts" array (exactly 6 items, one per category). Each item: {category, prompt, trending_source}.`,
      model: WEB_MODEL,
      add_context_from_internet: true,
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
                trending_source: { type: 'string' },
              },
              required: ['category', 'prompt', 'trending_source'],
            },
          },
        },
        required: ['prompts'],
      },
    });

    const prompts = result?.prompts?.length ? result.prompts.slice(0, 6) : FALLBACK_PROMPTS;
    const data = { prompts };
    cached = { at: Date.now(), data };
    return Response.json(data);
  } catch (e) {
    console.error('landingSignals error:', e);
    return Response.json({ prompts: FALLBACK_PROMPTS }, { status: 200 });
  }
}