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
    if (subs.length === 0) {
      return Response.json({ error: 'No subscription record found' }, { status: 404 });
    }

    const sub = subs[0];

    // Only call Stripe if we have a real subscription ID
    if (sub.stripe_subscription_id && !sub.stripe_subscription_id.startsWith('lifetime_')) {
      try {
        await stripe.subscriptions.update(sub.stripe_subscription_id, {
          cancel_at_period_end: true,
        });
      } catch (stripeErr) {
        console.error('Stripe update failed:', stripeErr.message);
        // Fall through and mark locally anyway
      }
    }

    // Always update local record
    await base44.asServiceRole.entities.Subscription.update(sub.id, {
      cancel_at_period_end: true,
    });

    return Response.json({ ok: true, cancel_at_period_end: true });
  } catch (error) {
    console.error('cancelSubscription error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});