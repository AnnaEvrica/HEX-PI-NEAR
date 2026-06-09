import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Secret lifetime promo codes for friends & family
const LIFETIME_CODES = ['EVRICA_FAMILY', 'HEX6_FRIEND', 'EVRICA_VIP'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const code = (body.code || '').trim().toUpperCase();

    if (!code) {
      return Response.json({ error: 'No promo code provided' }, { status: 400 });
    }

    if (!LIFETIME_CODES.includes(code)) {
      return Response.json({ valid: false, error: 'Invalid promo code' }, { status: 400 });
    }

    // Check if already has a subscription
    const existing = await base44.asServiceRole.entities.Subscription.filter({ user_email: user.email });

    const farFuture = new Date('2099-12-31T23:59:59Z').toISOString();

    if (existing.length > 0) {
      await base44.asServiceRole.entities.Subscription.update(existing[0].id, {
        status: 'active',
        stripe_subscription_id: `lifetime_${user.email}`,
        current_period_end: farFuture,
        cancel_at_period_end: false,
        trial_end: null,
      });
    } else {
      await base44.asServiceRole.entities.Subscription.create({
        user_email: user.email,
        status: 'active',
        stripe_subscription_id: `lifetime_${user.email}`,
        current_period_end: farFuture,
        cancel_at_period_end: false,
      });
    }

    return Response.json({ ok: true, lifetime: true });
  } catch (error) {
    console.error('applyLifetimePromo error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});