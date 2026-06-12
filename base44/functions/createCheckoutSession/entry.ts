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
    const priceId = Deno.env.get('STRIPE_PRICE_ID');

    const body = await req.json().catch(() => ({}));
    const origin = body.origin || req.headers.get('origin') || '';

    // Find or create customer (verify stale IDs gracefully)
    let customerId;
    const existing = await base44.asServiceRole.entities.Subscription.filter({ user_email: user.email });
    if (existing.length > 0 && existing[0].stripe_customer_id) {
      try {
        const cust = await stripe.customers.retrieve(existing[0].stripe_customer_id);
        if (!cust.deleted) customerId = cust.id;
      } catch (_) { /* stale ID — fall through */ }
    }
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.full_name || undefined,
        metadata: { base44_user_id: user.id },
      });
      customerId = customer.id;
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 7,
        metadata: { user_email: user.email },
      },
      allow_promotion_codes: true,
      success_url: `${origin}/?checkout=success`,
      cancel_url: `${origin}/?checkout=canceled`,
      metadata: { user_email: user.email },
    });

    return Response.json({ url: session.url });
  } catch (error) {
    console.error('createCheckoutSession error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});