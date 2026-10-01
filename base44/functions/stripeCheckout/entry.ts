import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const apiKey = secrets.get('STRIPE_SECRET_KEY');
    const priceId = secrets.get('STRIPE_PRICE_ID');
    if (!apiKey || !priceId) {
      return Response.json({ error: 'Stripe not configured' }, { status: 500 });
    }

    const origin = req.headers.get('origin')
      || (req.headers.get('referer') || '').replace(/\/app.*$/, '')
      || 'https://hex6-ble.base44.app';
    const successUrl = `${origin}/app?checkout=success`;
    const cancelUrl = `${origin}/app?checkout=cancelled`;

    const params = new URLSearchParams();
    params.append('mode', 'subscription');
    params.append('line_items[0][price]', priceId);
    params.append('line_items[0][quantity]', '1');
    params.append('success_url', successUrl);
    params.append('cancel_url', cancelUrl);
    params.append('customer_email', user.email);
    params.append('metadata[user_email]', user.email);
    params.append('subscription_data[metadata][user_email]', user.email);

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    const session = await response.json();

    if (session.error) {
      return Response.json({ error: session.error.message }, { status: 400 });
    }

    return Response.json({ url: session.url });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}