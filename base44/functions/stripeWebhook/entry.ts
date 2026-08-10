import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@17.3.0';

// Webhook endpoint — no user auth. Authenticity verified via Stripe signature.
Deno.serve(async (req) => {
  try {
    const secretKey = Deno.env.get('STRIPE_SECRET_KEY');
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    if (!secretKey || !webhookSecret) {
      return Response.json({ error: 'Stripe not configured' }, { status: 500 });
    }

    const stripe = new Stripe(secretKey);
    const body = await req.text();
    const sig = req.headers.get('stripe-signature');

    let event: Stripe.Event;
    try {
      // Deno crypto is async — must use constructEventAsync, not the sync constructEvent.
      event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
    } catch (err) {
      return Response.json({ error: `Invalid signature: ${err.message}` }, { status: 400 });
    }

    // Past this point the event is authentic, so Stripe must always get a 2xx.
    // A thrown bookkeeping error previously surfaced as a 500 — that is what put
    // this endpoint into Stripe's failing state even though delivery was fine.
    // Errors are logged instead; getSubscriptionStatus reads Stripe directly as
    // the source of truth, so a missed write self-heals on the next status check.
    try {
      const base44 = createClientFromRequest(req);
      const SR = base44.asServiceRole.entities.Subscription;

      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          const email = session.customer_email || session.customer_details?.email;
          const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
          if (!email || !subId) break;

          const sub = await stripe.subscriptions.retrieve(subId);
          const payload = {
            user_email: email,
            stripe_customer_id: typeof session.customer === 'string' ? session.customer : session.customer?.id,
            stripe_subscription_id: subId,
            status: sub.status,
            current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
            trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
            cancel_at_period_end: sub.cancel_at_period_end,
          };

          // Idempotent upsert: by subscription id first, then by email.
          const bySub = await SR.filter({ stripe_subscription_id: subId });
          if (bySub.length > 0) {
            await SR.update(bySub[0].id, payload);
          } else {
            const byEmail = await SR.filter({ user_email: email });
            if (byEmail.length > 0) {
              await SR.update(byEmail[0].id, payload);
            } else {
              await SR.create(payload);
            }
          }
          break;
        }

        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
          const sub = event.data.object as Stripe.Subscription;
          const existing = await SR.filter({ stripe_subscription_id: sub.id });
          if (existing.length > 0) {
            await SR.update(existing[0].id, {
              status: sub.status,
              current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
              trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
              cancel_at_period_end: sub.cancel_at_period_end,
            });
          }
          break;
        }

        case 'invoice.paid': {
          const invoice = event.data.object as Stripe.Invoice;
          if (invoice.subscription) {
            const subId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription.id;
            const existing = await SR.filter({ stripe_subscription_id: subId });
            if (existing.length > 0) {
              await SR.update(existing[0].id, { status: 'active' });
            }
          }
          break;
        }

        default:
          // Events we don't act on — acknowledge only.
          break;
      }
    } catch (handlerError) {
      console.error('stripeWebhook handler error:', event.type, handlerError?.message || handlerError);
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('stripeWebhook fatal:', error?.message || error);
    return Response.json({ received: true, error: error.message });
  }
});