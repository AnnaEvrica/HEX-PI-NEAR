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
    const hasDbSub = subs && subs.length > 0;

    // Fallback: if no DB record (webhook may not have fired), query Stripe directly.
    // Self-heals — returns the live status AND backfills the missing record.
    if (!hasDbSub) {
      const secretKey = Deno.env.get('STRIPE_SECRET_KEY');
      if (secretKey) {
        try {
          const stripe = new Stripe(secretKey);
          const customers = await stripe.customers.list({ email: user.email, limit: 1 });
          if (customers.data.length > 0) {
            const customer = customers.data[0];
            const stripeSubs = await stripe.subscriptions.list({ customer: customer.id, limit: 1 });
            if (stripeSubs.data.length > 0) {
              const ss = stripeSubs.data[0];
              const trialEnd = ss.trial_end ? new Date(ss.trial_end * 1000).toISOString() : null;
              const periodEnd = ss.current_period_end ? new Date(ss.current_period_end * 1000).toISOString() : null;
              try {
                await base44.asServiceRole.entities.Subscription.create({
                  user_email: user.email,
                  stripe_customer_id: customer.id,
                  stripe_subscription_id: ss.id,
                  status: ss.status,
                  current_period_end: periodEnd,
                  trial_end: trialEnd,
                  cancel_at_period_end: ss.cancel_at_period_end || false,
                });
              } catch (_e) {
                // duplicate / race — ignore; live status still returned
              }
              return Response.json({
                has_subscription: true,
                status: ss.status,
                trial_end: trialEnd,
                current_period_end: periodEnd,
                cancel_at_period_end: ss.cancel_at_period_end || false,
                pricing,
              });
            }
          }
        } catch (_e) {
          // Stripe query failed — fall through
        }
      }
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