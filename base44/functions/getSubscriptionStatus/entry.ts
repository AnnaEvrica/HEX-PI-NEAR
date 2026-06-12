import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@17.3.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
    const subs = await base44.asServiceRole.entities.Subscription.filter({ user_email: user.email });

    // No local record — check Stripe directly by email
    if (subs.length === 0) {
      // Search Stripe for any active subscription for this customer
      const customers = await stripe.customers.list({ email: user.email, limit: 5 });
      for (const customer of customers.data) {
        const stripeSubs = await stripe.subscriptions.list({ customer: customer.id, limit: 5 });
        for (const s of stripeSubs.data) {
          if (['active', 'trialing'].includes(s.status)) {
            // Create local record
            const data = {
              user_email: user.email,
              stripe_customer_id: customer.id,
              stripe_subscription_id: s.id,
              status: s.status,
              current_period_end: s.current_period_end ? new Date(s.current_period_end * 1000).toISOString() : null,
              trial_end: s.trial_end ? new Date(s.trial_end * 1000).toISOString() : null,
              cancel_at_period_end: s.cancel_at_period_end || false,
            };
            await base44.asServiceRole.entities.Subscription.create(data);
            return Response.json({ hasSubscription: true, status: s.status, ...data });
          }
        }
      }
      return Response.json({ hasSubscription: false, status: null });
    }

    const sub = subs[0];

    // If we have a Stripe subscription ID, verify current status directly with Stripe
    if (sub.stripe_subscription_id && !sub.stripe_subscription_id.startsWith('lifetime_')) {
      try {
        const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
        const freshStatus = stripeSub.status;
        const isActive = ['active', 'trialing'].includes(freshStatus);

        // Always sync local DB with real Stripe status
        if (freshStatus !== sub.status || stripeSub.cancel_at_period_end !== sub.cancel_at_period_end) {
          await base44.asServiceRole.entities.Subscription.update(sub.id, {
            status: freshStatus,
            current_period_end: stripeSub.current_period_end ? new Date(stripeSub.current_period_end * 1000).toISOString() : null,
            trial_end: stripeSub.trial_end ? new Date(stripeSub.trial_end * 1000).toISOString() : null,
            cancel_at_period_end: stripeSub.cancel_at_period_end || false,
          });
        }

        return Response.json({
          hasSubscription: isActive,
          status: freshStatus,
          stripe_subscription_id: sub.stripe_subscription_id,
          stripe_customer_id: sub.stripe_customer_id,
          trial_end: stripeSub.trial_end ? new Date(stripeSub.trial_end * 1000).toISOString() : null,
          current_period_end: stripeSub.current_period_end ? new Date(stripeSub.current_period_end * 1000).toISOString() : null,
          cancel_at_period_end: stripeSub.cancel_at_period_end || false,
        });
      } catch (stripeErr) {
        console.error('Stripe lookup failed:', stripeErr.message);
        // Fall through to local record
      }
    }

    // Lifetime or Stripe lookup failed — use local record
    const activeStatuses = ['active', 'trialing'];
    const isActive = activeStatuses.includes(sub.status);

    return Response.json({
      hasSubscription: isActive,
      status: sub.status,
      stripe_subscription_id: sub.stripe_subscription_id,
      stripe_customer_id: sub.stripe_customer_id,
      trial_end: sub.trial_end,
      current_period_end: sub.current_period_end,
      cancel_at_period_end: sub.cancel_at_period_end ?? false,
    });
  } catch (error) {
    console.error('getSubscriptionStatus error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});