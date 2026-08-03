import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import Stripe from 'npm:stripe@17.3.0';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    // Retry me() once — token propagation can lag after OAuth redirect on mobile.
    let user = null;
    try {
      user = await base44.auth.me();
    } catch (_meErr) {
      await new Promise((r) => setTimeout(r, 2000));
      user = await base44.auth.me();
    }
    if (!user || !user.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const secretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!secretKey) {
      return Response.json({ error: 'Stripe not configured' }, { status: 500 });
    }

    const stripe = new Stripe(secretKey);

    const subs = await base44.asServiceRole.entities.Subscription.filter({ user_email: user.email });
    const sub = subs.find((s) => s.stripe_customer_id);
    if (!sub) {
      return Response.json({ error: 'No active subscription found. Start a free trial first.' }, { status: 200 });
    }

    // Ensure a portal configuration exists (self-bootstrap so it works without dashboard setup).
    const configs = await stripe.billingPortal.configurations.list({ limit: 1, active: true });
    let configId = configs.data[0]?.id;
    if (!configId) {
      const cfg = await stripe.billingPortal.configurations.create({
        features: {
          customer_update: { enabled: true, allowed_updates: ['email', 'address'] },
          subscription_cancel: { enabled: true, mode: 'at_period_end' },
          payment_method_update: { enabled: true },
        },
      });
      configId = cfg.id;
    }

    const body = await req.json().catch(() => ({}));
    const origin = body?.origin || new URL(req.url).origin;
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${origin}/app?billing=return`,
      configuration: configId,
    });

    return Response.json({ url: session.url });
  } catch (error) {
    // Surface the real error. A stale DB record pointing at a deleted Stripe
    // customer shows up as "No such customer" — give a clear, actionable message.
    const msg = /no such customer/i.test(error.message)
      ? 'Your billing record is out of sync with Stripe. Please start a fresh free trial.'
      : error.message;
    return Response.json({ error: msg }, { status: 200 });
  }
}