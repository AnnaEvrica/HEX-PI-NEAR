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
      return Response.json({ error: 'No subscription found' }, { status: 404 });
    }

    const sub = subs[0];

    // Re-enable — remove cancel_at_period_end
    await stripe.subscriptions.update(sub.stripe_subscription_id, {
      cancel_at_period_end: false,
    });

    await base44.asServiceRole.entities.Subscription.update(sub.id, {
      cancel_at_period_end: false,
    });

    return Response.json({ ok: true, cancel_at_period_end: false });
  } catch (error) {
    console.error('reactivateSubscription error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});