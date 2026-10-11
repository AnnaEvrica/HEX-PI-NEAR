import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { answerQuestion } from '../../shared/landingAnswer.ts';

// Public landing-page endpoint — a visitor types a question, Hex answers it
// through the same retrieval + synthesis pipeline the chat function uses,
// with verified source links appended. No auth required (public landing page).

export default async function(req: Request): Promise<Response> {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' } });
    }
    const body = await req.json().catch(() => null);
    const question = typeof body?.question === 'string' ? body.question.trim() : '';
    if (!question) return Response.json({ error: 'Question required' }, { status: 400 });
    if (question.length > 500) return Response.json({ error: 'Question too long (500 characters max)' }, { status: 400 });

    const base44 = createClientFromRequest(req);
    const { answer, sources } = await answerQuestion(base44, question);
    return Response.json({ answer, sources });
  } catch (e) {
    console.error('landingAsk error:', e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}