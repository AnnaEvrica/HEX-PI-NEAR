import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
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
    if (subs.length === 0 || !subs[0].stripe_subscription_id) {
      return Response.json({ error: 'No active subscription found' }, { status: 404 });
    }

    const sub = subs[0];

    // Cancel at period end (not immediately)
    try {
      await stripe.subscriptions.update(sub.stripe_subscription_id, {
        cancel_at_period_end: true,
      });
    } catch (stripeErr) {
      console.error('Stripe update failed:', stripeErr.message);
      // If subscription doesn't exist in Stripe (e.g. stale ID), mark locally as canceled
      if (stripeErr.code === 'resource_missing') {
        await base44.asServiceRole.entities.Subscription.update(sub.id, {
          status: 'canceled',
          cancel_at_period_end: true,
        });
        return Response.json({ ok: true, cancel_at_period_end: true, note: 'Marked locally' });
      }
      throw stripeErr;
    }

    // Update local record
    await base44.asServiceRole.entities.Subscription.update(sub.id, {
      cancel_at_period_end: true,
    });

    return Response.json({ ok: true, cancel_at_period_end: true });
  } catch (error) {
    console.error('cancelSubscription error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});