import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@17.3.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !user.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    // The frontend knows the real app origin; req.url inside a function is the platform API endpoint, not the app.
    const appOrigin = body?.origin || new URL(req.url).origin;

    const secretKey = Deno.env.get('STRIPE_SECRET_KEY');
    const priceId = Deno.env.get('STRIPE_PRICE_ID');
    if (!secretKey || !priceId) {
      return Response.json({ error: 'Stripe not configured' }, { status: 500 });
    }

    const stripe = new Stripe(secretKey);

    // Avoid duplicate subscriptions: check DB first, then Stripe directly (webhook may not have fired).
    // Block if ANY non-canceled subscription exists (DB) — prevents double checkout when a
    // prior session left a sub in incomplete/past_due/unpaid state.
    const existing = await base44.asServiceRole.entities.Subscription.filter({ user_email: user.email });
    const live = existing.find((s) => s.status && s.status !== 'canceled' && s.status !== 'incomplete');
    if (live) {
      return Response.json({ url: null, already_subscribed: true });
    }
    try {
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      if (customers.data.length > 0) {
        // List ALL subscriptions (not just 1) — a customer can have more than one.
        const stripeSubs = await stripe.subscriptions.list({ customer: customers.data[0].id, limit: 50 });
        const liveStripe = stripeSubs.data.find((s) => s.status && s.status !== 'canceled' && s.status !== 'incomplete');
        if (liveStripe) {
          // Self-heal: the webhook may not have written the DB record yet (e.g. it
          // isn't registered, or is lagging). Write it here so getSubscriptionStatus
          // finds an active/trialing record immediately and the gate lets the user in
          // instead of looping back to the paywall.
          try {
            const trialEnd = liveStripe.trial_end ? new Date(liveStripe.trial_end * 1000).toISOString() : null;
            const periodEnd = liveStripe.current_period_end ? new Date(liveStripe.current_period_end * 1000).toISOString() : null;
            const byEmail = existing.find((s) => s.user_email === user.email);
            const payload = {
              stripe_customer_id: customers.data[0].id,
              stripe_subscription_id: liveStripe.id,
              status: liveStripe.status,
              current_period_end: periodEnd,
              trial_end: trialEnd,
              cancel_at_period_end: liveStripe.cancel_at_period_end || false,
            };
            if (byEmail) {
              await base44.asServiceRole.entities.Subscription.update(byEmail.id, payload);
            } else {
              await base44.asServiceRole.entities.Subscription.create({ user_email: user.email, ...payload });
            }
          } catch (_e) { /* non-blocking — live status still returned */ }
          return Response.json({ url: null, already_subscribed: true });
        }
      }
    } catch (_e) {
      // ignore — proceed to create checkout
    }

    const origin = appOrigin;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: { trial_period_days: 7 },
      customer_email: user.email,
      success_url: `${origin}/app?checkout=success`,
      cancel_url: `${origin}/app?checkout=cancel`,
      allow_promotion_codes: true,
    });

    return Response.json({ url: session.url });
  } catch (error) {
    // Return 200 with the real Stripe message so the frontend's
    // `res.data?.error` branch can surface the actual cause — a 500 makes the
    // SDK throw and the user sees a generic "500" instead of the reason.
    return Response.json({ error: error.message }, { status: 200 });
  }
});