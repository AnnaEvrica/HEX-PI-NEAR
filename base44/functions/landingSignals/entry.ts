import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { WEB_MODEL } from '../../shared/modelRouter.ts';
import { IDENTITY_LINE, CONFIDENTIALITY_LINE } from '../../shared/persona.ts';

// Public landing-page feed — popular prompts of the day, generated from
// what's actually trending on the web right now across diverse life
// categories. Cached for 6 hours so trends refresh throughout the day.

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
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // --- Single web-search call: find today's trending topics, generate prompts ---
    const result: any = await base44.integrations.Core.InvokeLLM({
      prompt: `${IDENTITY_LINE} ${CONFIDENTIALITY_LINE}

TODAY IS ${today}. Search the web for what is trending right now — the most discussed topics, news, and conversations of the day.

Generate 8 prompts based on today's trending topics. Each prompt must be a real question a visitor could ask Hex. Cover at least one prompt per category: ${CATEGORIES.join(', ')}.

Rules:
- Base prompts on actual trending topics you found in your web search — not generic evergreen questions.
- Make them specific, engaging, and answerable with real data or genuine reasoning.
- Not generic ("How do I be happy?") but concrete and tied to what's happening today.
- Vary the tone — some direct, some curious, some provocative.

Return JSON with a "prompts" array. Each item: {category (one of the categories above), prompt (the question)}.`,
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
              },
              required: ['category', 'prompt'],
            },
          },
        },
        required: ['prompts'],
      },
    });

    const prompts = result?.prompts?.length ? result.prompts.slice(0, 8) : FALLBACK_PROMPTS;
    const data = { prompts };
    cached = { at: Date.now(), data };
    return Response.json(data);
  } catch (e) {
    console.error('landingSignals error:', e);
    return Response.json({ prompts: FALLBACK_PROMPTS }, { status: 200 });
  }
}