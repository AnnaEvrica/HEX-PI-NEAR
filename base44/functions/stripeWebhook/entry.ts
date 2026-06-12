import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Stripe from 'npm:stripe@17.3.1';

Deno.serve(async (req) => {
  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

    const signature = req.headers.get('stripe-signature');
    const body = await req.text();

    let event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return Response.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);

    const upsertFromSubscription = async (sub) => {
      const userEmail = sub.metadata?.user_email;
      if (!userEmail) {
        console.warn('No user_email in subscription metadata:', sub.id);
        return;
      }

      const data = {
        user_email: userEmail,
        stripe_customer_id: sub.customer,
        stripe_subscription_id: sub.id,
        status: sub.status,
        current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
        trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
        cancel_at_period_end: sub.cancel_at_period_end || false,
      };

      const existing = await base44.asServiceRole.entities.Subscription.filter({ user_email: userEmail });
      if (existing.length > 0) {
        await base44.asServiceRole.entities.Subscription.update(existing[0].id, data);
      } else {
        await base44.asServiceRole.entities.Subscription.create(data);
      }
    };

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userEmail = session.metadata?.user_email || session.customer_details?.email;
        if (session.subscription && userEmail) {
          // Patch metadata on Stripe so future subscription events also carry user_email
          const sub = await stripe.subscriptions.retrieve(session.subscription);
          if (!sub.metadata?.user_email) {
            await stripe.subscriptions.update(session.subscription, {
              metadata: { ...sub.metadata, user_email: userEmail },
            });
            sub.metadata = { ...sub.metadata, user_email: userEmail };
          }
          await upsertFromSubscription(sub);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        await upsertFromSubscription(event.data.object);
        break;
      }
      default:
        // ignore
        break;
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('stripeWebhook error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});