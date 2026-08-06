import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';

// Public contact/inquiry endpoint — the landing page is public, so this
// accepts unauthenticated submissions. Inputs are validated and length-capped
// server-side; the inquiry is stored (Inquiry entity) and mirrored to Discord
// so the team sees it immediately without any mail-client dependency.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const name = (body.name || '').trim();
    const email = (body.email || '').trim();
    const subject = (body.subject || '').trim();
    const message = (body.message || '').trim();

    if (!name || !email || !subject || !message) {
      return Response.json({ error: 'All fields are required.' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return Response.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }
    if (name.length > 100 || subject.length > 120 || message.length > 2000) {
      return Response.json({ error: 'Input exceeds the allowed length.' }, { status: 400 });
    }

    await base44.asServiceRole.entities.Inquiry.create({ name, email, subject, message });

    const webhook = secrets.get('DISCORD_WEBHOOK_URL');
    if (webhook) {
      try {
        await fetch(webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: `📬 **New inquiry — HEX6 BLE**\n**From:** ${name} <${email}>\n**Subject:** ${subject}\n${message.slice(0, 1500)}`,
          }),
        });
      } catch (_e) { /* Discord mirror is best-effort; the inquiry is already stored */ }
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message || 'Failed to send inquiry' }, { status: 500 });
  }
}