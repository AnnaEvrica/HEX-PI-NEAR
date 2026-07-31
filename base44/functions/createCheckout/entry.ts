import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@17.3.0';
import { findStripeCustomerSubscription, pickBestSubscription, subscriptionAction } from '../../shared/subscriptionState.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !user.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    // The frontend knows the real app origin; req.url inside a function is the platform API endpoint, not the app.
    const appOrigin = body?.origin || new URL(req.url).origin;

    const secretKey = Deno.env.get('STRIPE_SECRET_KEY');
    const priceId = Deno.env.get('STRIPE_PRICE_ID');
    if (!secretKey || !priceId) {
      return Response.json({ error: 'Stripe not configured' }, { status: 500 });
    }

    const stripe = new Stripe(secretKey);

    // Avoid duplicate subscriptions: check DB first, then Stripe directly (webhook may not have fired).
    // Block if ANY non-canceled subscription exists (DB) — prevents double checkout when a
    // prior session left a sub in incomplete/past_due/unpaid state.
    const existing = await base44.asServiceRole.entities.Subscription.filter({ user_email: user.email });
    const existingSubscription = pickBestSubscription(existing);
    const existingAction = subscriptionAction(existingSubscription?.status);
    if (existingSubscription && existingAction === 'access') {
      return Response.json({ url: null, already_subscribed: true, status: existingSubscription.status });
    }
    if (existingSubscription && existingAction === 'billing') {
      return Response.json({ url: null, requires_billing_update: true, status: existingSubscription.status });
    }
    let stripeCustomer = null;
    try {
      const found = await findStripeCustomerSubscription(stripe, user.email);
      stripeCustomer = found.customer;
      const liveStripe = found.subscription;
      const liveAction = subscriptionAction(liveStripe?.status);
      if (liveStripe && liveAction !== 'checkout') {
        const trialEnd = liveStripe.trial_end ? new Date(liveStripe.trial_end * 1000).toISOString() : null;
        const periodEnd = liveStripe.current_period_end ? new Date(liveStripe.current_period_end * 1000).toISOString() : null;
        const payload = {
          stripe_customer_id: stripeCustomer.id,
          stripe_subscription_id: liveStripe.id,
          status: liveStripe.status,
          current_period_end: periodEnd,
          trial_end: trialEnd,
          cancel_at_period_end: liveStripe.cancel_at_period_end || false,
        };
        if (existingSubscription) {
          await base44.asServiceRole.entities.Subscription.update(existingSubscription.id, payload);
        } else {
          await base44.asServiceRole.entities.Subscription.create({ user_email: user.email, ...payload });
        }
        return liveAction === 'access'
          ? Response.json({ url: null, already_subscribed: true, status: liveStripe.status })
          : Response.json({ url: null, requires_billing_update: true, status: liveStripe.status });
      }
    } catch (_e) {
      // Stripe lookup failed — checkout creation below will surface a useful error if Stripe is unavailable.
    }

    const origin = appOrigin;
    const customerDetails = stripeCustomer ? { customer: stripeCustomer.id } : { customer_email: user.email };

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: { trial_period_days: 7 },
      ...customerDetails,
      success_url: `${origin}/app?checkout=success`,
      cancel_url: `${origin}/app?checkout=cancel`,
      allow_promotion_codes: true,
    });

    return Response.json({ url: session.url });
  } catch (error) {
    // Return 200 with the real Stripe message so the frontend's
    // `res.data?.error` branch can surface the actual cause — a 500 makes the
    // SDK throw and the user sees a generic "500" instead of the reason.
    return Response.json({ error: error.message }, { status: 200 });
  }
}