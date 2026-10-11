// Shared landing-page answer pipeline: delegates to the same engine the chat
// function uses (answerPipeline.ts). One engine, one prompt, one voice. The
// only difference from the chat function: no auth, no memory, no cognitive
// state, no ledger, no boundary escalation. Just the engine's answer with
// verified source links.
import { runAnswerPipeline } from './answerPipeline.ts';

export async function answerQuestion(base44, question: string): Promise<{ answer: string; sources: any[] }> {
  const result = await runAnswerPipeline(base44, {
    message: question,
    userName: 'friend',
    logToLedger: false,
  });
  return { answer: result.response, sources: result.sources };
}