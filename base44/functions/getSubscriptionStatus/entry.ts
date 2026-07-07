import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@17.3.0';

const PRIORITY = ['active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'canceled'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !user.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Pricing info for the paywall (best-effort; never blocks the response).
    let pricing = null;
    try {
      const secretKey = Deno.env.get('STRIPE_SECRET_KEY');
      const priceId = Deno.env.get('STRIPE_PRICE_ID');
      if (secretKey && priceId) {
        const stripe = new Stripe(secretKey);
        const price = await stripe.prices.retrieve(priceId);
        if (price && price.unit_amount != null) {
          pricing = {
            amount: price.unit_amount / 100,
            currency: price.currency,
            interval: price.recurring?.interval || null,
          };
        }
      }
    } catch (_e) {
      // ignore — pricing is optional
    }

    const subs = await base44.asServiceRole.entities.Subscription.filter({ user_email: user.email });
    if (!subs || subs.length === 0) {
      return Response.json({ has_subscription: false, pricing });
    }

    subs.sort((a, b) => PRIORITY.indexOf(a.status) - PRIORITY.indexOf(b.status));
    const s = subs[0];
    return Response.json({
      has_subscription: true,
      status: s.status,
      trial_end: s.trial_end,
      current_period_end: s.current_period_end,
      cancel_at_period_end: s.cancel_at_period_end,
      pricing,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});