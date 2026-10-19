// spineAlert — fires automatically when a VerdictSpine record is created with
// disagreement_flag=true (a direction read the chart structure contradicts). Posts a
// rich Discord alert to the signals channel. Runs straight off the automation
// payload — no DB round-trip, no LLM, so the alert cost scales with drift,
// not with verdict volume.

import { secrets } from 'base44:runtime';
import { postsAllowed } from '../../shared/deployment.ts';

export default async function(req) {
  try {
    const body = await req.json();
    const { data } = body;
    if (!data || data.disagreement_flag !== true) return Response.json({ skipped: true });
    if (!postsAllowed()) return Response.json({ skipped: true, reason: 'test deployment: nothing is posted' });

    const webhook = secrets.get('DISCORD_SIGNALS_WEBHOOK_URL');
    if (!webhook) return Response.json({ skipped: true, reason: 'no signals webhook' });

    let validators = [];
    try {
      validators = typeof data.validators === 'string'
        ? JSON.parse(data.validators || '[]')
        : (Array.isArray(data.validators) ? data.validators : []);
    } catch { /* empty */ }
    const disagree = validators.filter((v) => v.agrees === false);

    const f = (name, val) => ({ name, value: String(val == null ? '—' : val), inline: true });
    const embed = {
      title: 'ASI Spine — drift flagged',
      description: "A direction read was anchored that the chart structure contradicts.",
      color: 16753920, // accent orange
      fields: [
        f('Verdict', data.verdict_id),
        f('Source', data.source_type),
        {
          name: 'Disagreeing validators',
          value: disagree.length
            ? disagree.map((v) => `• **${v.id}** — ${v.check}`).join('\n')
            : 'none',
          inline: false,
        },
        f('Chain head', (data.chain_hash || '').slice(0, 16) + '…'),
        f('Anchored at', data.anchored_at),
      ],
      timestamp: new Date().toISOString(),
    };

    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'ASI Spine', embeds: [embed] }),
    });

    return Response.json({ sent: true, verdict_id: data.verdict_id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}