import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import Stripe from 'npm:stripe@17.3.0';
import { findStripeCustomerSubscription, isAccessAllowed, isTransitionalStatus, pickBestSubscription, subscriptionAction } from '../../shared/subscriptionState.ts';

const STALE_MS = 60 * 60 * 1000; // 1h — trust the webhook-maintained DB record within this window

// Best-effort pricing for the paywall; null on any failure (never blocks the response).
async function fetchPricing(secretKey, priceId) {
  if (!secretKey || !priceId) return null;
  try {
    const stripe = new Stripe(secretKey);
    const price = await stripe.prices.retrieve(priceId);
    if (price && price.unit_amount != null) {
      return { amount: price.unit_amount / 100, currency: price.currency, interval: price.recurring?.interval || null };
    }
  } catch (_e) { /* optional */ }
  return null;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !user.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const SR = base44.asServiceRole.entities.Subscription;
    const secretKey = Deno.env.get('STRIPE_SECRET_KEY');
    const priceId = Deno.env.get('STRIPE_PRICE_ID');

    const subs = await SR.filter({ user_email: user.email });

    // --- Existing record: at most ONE Stripe call, usually zero. ---
    if (subs && subs.length > 0) {
      let s = pickBestSubscription(subs);

      // Only hit Stripe when the record is stale or in a transitional state that
      // can shift without a clean webhook event. Active/trialing + fresh → trust DB.
      const fresh = s.updated_date && (Date.now() - new Date(s.updated_date).getTime() < STALE_MS);
      const needsSync = secretKey && s.stripe_subscription_id && (!fresh || isTransitionalStatus(s.status));
      if (needsSync) {
        try {
          const stripe = new Stripe(secretKey);
          const live = await stripe.subscriptions.retrieve(s.stripe_subscription_id);
          const livePeriodEnd = live.current_period_end ? new Date(live.current_period_end * 1000).toISOString() : null;
          const liveTrialEnd = live.trial_end ? new Date(live.trial_end * 1000).toISOString() : null;
          const liveCancel = !!live.cancel_at_period_end;
          if (live.status !== s.status || liveCancel !== !!s.cancel_at_period_end) {
            try { await SR.update(s.id, { status: live.status, current_period_end: livePeriodEnd, trial_end: liveTrialEnd, cancel_at_period_end: liveCancel }); } catch (_e) { /* non-blocking */ }
            s = { ...s, status: live.status, current_period_end: livePeriodEnd, trial_end: liveTrialEnd, cancel_at_period_end: liveCancel };
          }
        } catch (_e) { /* Stripe unreachable — fall back to DB status */ }
      }

      // Active/trialing users never see the paywall → skip pricing entirely (zero extra calls).
      const accessAllowed = isAccessAllowed(s.status);
      return Response.json({
        has_subscription: true,
        status: s.status,
        action: subscriptionAction(s.status),
        access_allowed: accessAllowed,
        trial_end: s.trial_end,
        current_period_end: s.current_period_end,
        cancel_at_period_end: s.cancel_at_period_end,
        pricing: accessAllowed ? null : await fetchPricing(secretKey, priceId),
      });
    }

    // --- No DB record: self-heal in ONE Stripe call (customer + expanded subscriptions). ---
    // This catches the post-checkout window before the webhook writes the DB row,
    // so the gate's poll succeeds immediately instead of flashing the paywall.
    if (secretKey) {
      try {
        const stripe = new Stripe(secretKey);
        const { customer, subscription: ss } = await findStripeCustomerSubscription(stripe, user.email);
        if (customer && ss) {
            const trialEnd = ss.trial_end ? new Date(ss.trial_end * 1000).toISOString() : null;
            const periodEnd = ss.current_period_end ? new Date(ss.current_period_end * 1000).toISOString() : null;
            try {
              await SR.create({
                user_email: user.email,
                stripe_customer_id: customer.id,
                stripe_subscription_id: ss.id,
                status: ss.status,
                current_period_end: periodEnd,
                trial_end: trialEnd,
                cancel_at_period_end: ss.cancel_at_period_end || false,
              });
            } catch (_e) { /* duplicate/race — live status still returned */ }
            const accessAllowed = isAccessAllowed(ss.status);
            return Response.json({ has_subscription: true, status: ss.status, action: subscriptionAction(ss.status), access_allowed: accessAllowed, trial_end: trialEnd, current_period_end: periodEnd, cancel_at_period_end: ss.cancel_at_period_end || false, pricing: accessAllowed ? null : await fetchPricing(secretKey, priceId) });
        }
      } catch (_e) { /* Stripe unreachable — fall through to paywall */ }
    }

    // True new user → paywall. Pricing is the single call here.
    return Response.json({ has_subscription: false, status: null, action: 'checkout', access_allowed: false, pricing: await fetchPricing(secretKey, priceId) });
  } catch (error) {
    // 200 + error payload so the SubscriptionGate can surface the real cause.
    return Response.json({ error: error.message }, { status: 200 });
  }
}