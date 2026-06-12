import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@17.3.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const code = (body.code || '').trim();
    const origin = body.origin || req.headers.get('origin') || '';

    if (!code) {
      return Response.json({ error: 'No promo code provided' }, { status: 400 });
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
    const priceId = Deno.env.get('STRIPE_PRICE_ID');

    // Look up the promotion code in Stripe (try uppercase first, then original)
    let finalPromo = null;
    for (const attempt of [code.toUpperCase(), code]) {
      const result = await stripe.promotionCodes.list({ code: attempt, active: true, limit: 1 });
      if (result.data.length) { finalPromo = result.data[0]; break; }
    }
    if (!finalPromo) {
      return Response.json({ error: 'Invalid or expired promo code' }, { status: 400 });
    }

    // Find or create Stripe customer (handle stale IDs gracefully)
    let customerId;
    const existing = await base44.asServiceRole.entities.Subscription.filter({ user_email: user.email });
    if (existing.length > 0 && existing[0].stripe_customer_id) {
      try {
        const cust = await stripe.customers.retrieve(existing[0].stripe_customer_id);
        if (!cust.deleted) {
          customerId = cust.id;
        }
      } catch (_) {
        // stale ID — fall through to create new customer
      }
    }
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.full_name || undefined,
        metadata: { base44_user_id: user.id },
      });
      customerId = customer.id;
    }

    // NOTE: Stripe does NOT allow combining discounts with trial_period_days on the same session.
    // When a promo code is used, we skip the trial — the coupon itself IS the benefit.
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        metadata: { user_email: user.email },
      },
      discounts: [{ promotion_code: finalPromo.id }],
      success_url: `${origin}/?checkout=success`,
      cancel_url: `${origin}/?checkout=canceled`,
      metadata: { user_email: user.email },
    });

    return Response.json({ url: session.url });
  } catch (error) {
    console.error('applyPromoCode error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});