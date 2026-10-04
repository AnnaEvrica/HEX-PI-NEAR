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

    // The return address is taken from the request only when it is one of the
    // app's own hosts; anything else falls back to the default. This stops a
    // forged Origin header from sending a paying customer to another site.
    const DEFAULT_ORIGIN = 'https://hex6-ble.base44.app';
    const ALLOWED_HOSTS = ['hex6-ble.base44.app', 'hex6-ble.com', 'www.hex6-ble.com'];
    const claimed = req.headers.get('origin') || (req.headers.get('referer') || '').replace(/\/app.*$/, '');
    let origin = DEFAULT_ORIGIN;
    try {
      const u = new URL(claimed);
      if (u.protocol === 'https:' && (ALLOWED_HOSTS.includes(u.hostname) || u.hostname.endsWith('.base44.app'))) origin = u.origin;
    } catch { /* keep the default */ }
    const successUrl = `${origin}/app?checkout=success`;
    const cancelUrl = `${origin}/app?checkout=cancelled`;

    // 7-day free trial, then the monthly price ($19.99, set on the Stripe
    // price STRIPE_PRICE_ID). The card is collected at checkout and first
    // charged when the trial ends. One trial per person: someone who has
    // subscribed before goes straight to the paid plan.
    const TRIAL_DAYS = 7;
    const hadSubscription = !!user.stripe_subscription_id || !!user.trial_ends_at;

    const params = new URLSearchParams();
    params.append('mode', 'subscription');
    params.append('line_items[0][price]', priceId);
    params.append('line_items[0][quantity]', '1');
    params.append('success_url', successUrl);
    params.append('cancel_url', cancelUrl);
    if (user.stripe_customer_id) params.append('customer', user.stripe_customer_id);
    else params.append('customer_email', user.email);
    if (!hadSubscription) params.append('subscription_data[trial_period_days]', String(TRIAL_DAYS));
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