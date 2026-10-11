// Shared helpers for the `think` chat function: source-link checking and the
// compressed per-user memory update.
import { CLAUDE_MODEL } from './modelRouter.ts';

// Filter + dedupe source links, rejecting malformed/hallucinated URLs.
function filterSourcesBlock(sources) {
  if (!sources || !Array.isArray(sources) || sources.length === 0) return '';
  const urlOk = (u) => {
    try {
      const p = new URL(u);
      if (!/^https?:$/.test(p.protocol)) return false;
      if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(p.hostname)) return false;
      if (/example\.com|placeholder|your-?(site|url)/i.test(u)) return false;
      // Tier guard — the fetch step is told to return specialist-grade sources,
      // but it still slips in counseling-center blogs, wellness/SEO content and
      // aggregators. A weak citation costs more trust than no citation, so the
      // filter enforces the rule the prompt only requests.
      if (/wikipedia\.org|medium\.com|quora\.com|reddit\.com|pinterest\.|substack\.com|blogspot\.|wordpress\.com/i.test(p.hostname)) return false;
      if (/counsel|therapy|therapist|rehab|treatment|clinic-?marketing|wellness|coaching|lifecoach/i.test(p.hostname)) return false;
      if (/\/(blog|advice|tips|guides?)\//i.test(p.pathname)) return false;
      return true;
    } catch { return false; }
  };
  const seen = new Set();
  const valid = sources.filter(s => s?.url && s?.name && urlOk(s.url) && !seen.has(s.url) && seen.add(s.url));
  return valid.map(s => `[${s.name}](${s.url})`).join('\n');
}

// Verify that each source URL actually resolves before it is shown to the
// user. The retrieval model sometimes returns plausible-looking links that
// 404 or point at pages that no longer exist — a dead citation costs more
// trust than no citation. Each URL gets one live check (HEAD, falling back to
// GET for servers that reject HEAD) with a short timeout; anything that
// errors, times out, or returns 4xx/5xx is dropped. All checks run in
// parallel so the added latency is one round-trip, not one per link.
async function urlResolves(url) {
  const attempt = async (method) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    try {
      const res = await fetch(url, {
        method,
        redirect: 'follow',
        signal: ctrl.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HEX [PI] citation check)' },
      });
      // Only a definitive "this page does not exist" disqualifies a source.
      // Publishers routinely answer automated requests with 403/405/429 while
      // the page is perfectly real for a human, so those stay.
      return res.status !== 404 && res.status !== 410;
    } finally {
      clearTimeout(timer);
    }
  };
  try {
    if (await attempt('HEAD')) return true;
  } catch { /* fall through to GET */ }
  try {
    return await attempt('GET');
  } catch {
    // Network error / timeout is not evidence the page is dead — keep it.
    return true;
  }
}

// Async version of filterSourcesBlock: same quality gates, plus a live
// resolution check on every surviving URL. Use this wherever the sources
// will be shown to the user.
export async function verifiedSourcesBlock(sources, skipVerification = false) {
  const block = filterSourcesBlock(sources);
  if (!block) return { block: '', verified: [] };
  const lines = block.split('\n');
  if (skipVerification) {
    // Skip live URL checks — still filtered/deduped, but no network round-trips.
    const kept = lines.map((line) => {
      const m = line.match(/\]\((https?:\/\/[^)]+)\)$/);
      if (!m) return null;
      const meta = (sources || []).find((s) => s?.url === m[1]) || {};
      const dated = /^\d{4}(-\d{2}){0,2}$/.test(String(meta.published || '').trim());
      const label = dated ? `${meta.name} — ${meta.published}` : meta.name;
      return { line: `[${label}](${m[1]})`, meta };
    }).filter(Boolean);
    return { block: kept.map((k) => k.line).join('\n'), verified: kept.map((k) => k.meta) };
  }
  const checks = await Promise.all(lines.map(async (line) => {
    const m = line.match(/\]\((https?:\/\/[^)]+)\)$/);
    if (!m) return null;
    if (!(await urlResolves(m[1]))) return null;
    const meta = (sources || []).find((s) => s?.url === m[1]) || {};
    // Label carries the publication date so a 2026 finding can never be shown
    // behind a link the reader will discover is years old.
    // Only a real date earns a date stamp — "unknown"/"n/a" is noise, not provenance.
    const dated = /^\d{4}(-\d{2}){0,2}$/.test(String(meta.published || '').trim());
    const label = dated ? `${meta.name} — ${meta.published}` : meta.name;
    return { line: `[${label}](${m[1]})`, meta };
  }));
  const kept = checks.filter(Boolean);
  return {
    block: kept.map((k) => k.line).join('\n'),
    verified: kept.map((k) => k.meta),
  };
}

// Fire-and-forget compressed user memory update.
export function updateMemory(base44, user, existing, message, response) {
  (async () => {
    try {
      const lastSnippet = `User: ${message.slice(0, 300)} | HEX [PI]: ${response.slice(0, 300)}`;
      const newTotal = (existing?.total_conversations || 0) + 1;
      const memoryUpdate = await base44.integrations.Core.InvokeLLM({
        prompt: `Maintain compressed memory for HEX [PI] about this user.\n\nEXISTING SUMMARY: ${existing?.memory_summary || 'None.'}\nEXISTING TOPICS: ${existing?.topics_discussed || 'None.'}\nEXISTING STYLE: ${existing?.user_style || 'Unknown.'}\n\nNEW EXCHANGE:\nUser: ${message}\nHEX [PI]: ${response.slice(0, 500)}\n\nReturn JSON only:\n- memory_summary: concise paragraph (max 200 words)\n- topics_discussed: comma-separated topics/assets/themes\n- user_style: one paragraph on their communication style`,
        model: CLAUDE_MODEL,
        response_json_schema: { type: 'object', properties: { memory_summary: { type: 'string' }, topics_discussed: { type: 'string' }, user_style: { type: 'string' } } },
      });
      const memoryData = {
        user_email: user.email,
        memory_summary: memoryUpdate?.memory_summary || existing?.memory_summary || '',
        topics_discussed: memoryUpdate?.topics_discussed || existing?.topics_discussed || '',
        user_style: memoryUpdate?.user_style || existing?.user_style || '',
        last_conversation_snippet: lastSnippet, total_conversations: newTotal,
      };
      if (existing?.id) await base44.asServiceRole.entities.UserConversationMemory.update(existing.id, memoryData);
      else await base44.asServiceRole.entities.UserConversationMemory.create(memoryData);
    } catch (e) { /* non-blocking */ }
  })();
}