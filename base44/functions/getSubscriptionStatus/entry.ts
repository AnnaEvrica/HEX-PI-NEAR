import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subs = await base44.asServiceRole.entities.Subscription.filter({ user_email: user.email });
    if (subs.length === 0) {
      return Response.json({ hasSubscription: false, status: null });
    }

    const sub = subs[0];
    const activeStatuses = ['trialing', 'active'];
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