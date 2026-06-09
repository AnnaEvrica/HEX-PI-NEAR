import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@17.3.1';

// This function looks up a Stripe promotion code and redirects the user
// to a new checkout session with that discount pre-applied.
// Use it for "1st month free" or any other Stripe coupon-backed promo.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const code = (body.code || '').trim().toUpperCase();
    const origin = body.origin || req.headers.get('origin') || '';

    if (!code) {
      return Response.json({ error: 'No promo code provided' }, { status: 400 });
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
    const priceId = Deno.env.get('STRIPE_PRICE_ID');

    // Look up the promotion code in Stripe
    const promoCodes = await stripe.promotionCodes.list({ code, active: true, limit: 1 });
    if (!promoCodes.data.length) {
      return Response.json({ error: 'Invalid or expired promo code' }, { status: 400 });
    }
    const promoCodeObj = promoCodes.data[0];

    // Find or create Stripe customer
    let customerId;
    const existing = await base44.asServiceRole.entities.Subscription.filter({ user_email: user.email });
    if (existing.length > 0 && existing[0].stripe_customer_id) {
      customerId = existing[0].stripe_customer_id;
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.full_name || undefined,
        metadata: { base44_user_id: user.id },
      });
      customerId = customer.id;
    }

    // Create a new checkout session with the promo pre-applied
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 7,
        metadata: { user_email: user.email },
      },
      discounts: [{ promotion_code: promoCodeObj.id }],
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