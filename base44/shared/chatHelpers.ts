// Shared helpers used by both the unified `think` function and the legacy `hex6Chat`.
// Extracted to honor Law 2 (one intelligence) and the no-duplication platform rule.

// Filter + dedupe source links, rejecting malformed/hallucinated URLs.
export function filterSourcesBlock(sources) {
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
      if (/\/blog\//i.test(p.pathname)) return false;
      return true;
    } catch { return false; }
  };
  const seen = new Set();
  const valid = sources.filter(s => s?.url && s?.name && urlOk(s.url) && !seen.has(s.url) && seen.add(s.url));
  return valid.map(s => `[${s.name}](${s.url})`).join('\n');
}

// Fire-and-forget compressed user memory update.
export function updateMemory(base44, user, existing, message, response) {
  (async () => {
    try {
      const lastSnippet = `User: ${message.slice(0, 300)} | HEX6 BLE: ${response.slice(0, 300)}`;
      const newTotal = (existing?.total_conversations || 0) + 1;
      const memoryUpdate = await base44.integrations.Core.InvokeLLM({
        prompt: `Maintain compressed memory for HEX6 BLE about this user.\n\nEXISTING SUMMARY: ${existing?.memory_summary || 'None.'}\nEXISTING TOPICS: ${existing?.topics_discussed || 'None.'}\nEXISTING STYLE: ${existing?.user_style || 'Unknown.'}\n\nNEW EXCHANGE:\nUser: ${message}\nHEX6 BLE: ${response.slice(0, 500)}\n\nReturn JSON only:\n- memory_summary: concise paragraph (max 200 words)\n- topics_discussed: comma-separated topics/assets/themes\n- user_style: one paragraph on their communication style`,
        model: 'gemini_3_flash',
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