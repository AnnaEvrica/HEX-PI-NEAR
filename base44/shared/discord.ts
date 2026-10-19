// One way to post to Discord, used by every function that does.
// 'signals' prefers DISCORD_SIGNALS_WEBHOOK_URL and falls back to
// DISCORD_WEBHOOK_URL. Returns false when no webhook is set or the post fails.
import { postsAllowed } from './deployment.ts';

const LIMIT = 2000;

export async function postDiscord(content: string): Promise<boolean> {
  const webhook = Deno.env.get('DISCORD_SIGNALS_WEBHOOK_URL') || Deno.env.get('DISCORD_WEBHOOK_URL');
  if (!webhook || !content) return false;
  if (!postsAllowed()) { console.log('[discord] test deployment: post not sent'); return false; }
  const body = content.length > LIMIT ? content.slice(0, LIMIT - 12) + '\n…(truncated)' : content;
  try {
    const res = await fetch(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: body }) });
    return res.ok;
  } catch {
    return false;
  }
}
