// Stripe webhook handler — updates user subscription status based on Stripe events.
// Listens for: checkout.session.completed, customer.subscription.{created,updated,deleted}, invoice.paid, invoice.payment_failed
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Stripe from 'npm:stripe@14.0.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

// Map a Stripe subscription object → User entity update payload
function buildUserUpdateFromSubscription(sub) {
  const update = {
    subscription_status: sub.status, // trialing | active | past_due | canceled | incomplete
    stripe_subscription_id: sub.id,
  };
  if (sub.trial_end) {
    update.trial_ends_at = new Date(sub.trial_end * 1000).toISOString();
  }
  if (sub.current_period_end) {
    update.current_period_end = new Date(sub.current_period_end * 1000).toISOString();
  }
  return update;
}

// Find a user by email or stripe customer id and update them.
// Returns the user found or null.
async function findAndUpdateUser(base44, { email, customerId, update }) {
  let user = null;

  if (customerId) {
    const byCustomer = await base44.asServiceRole.entities.User.filter({ stripe_customer_id: customerId });
    if (byCustomer && byCustomer.length > 0) user = byCustomer[0];
  }

  if (!user && email) {
    const byEmail = await base44.asServiceRole.entities.User.filter({ email });
    if (byEmail && byEmail.length > 0) user = byEmail[0];
  }

  if (!user) {
    console.warn('[stripe-webhook] no user found', { email, customerId });
    return null;
  }

  // Always attach customer id when we have one
  if (customerId && !user.stripe_customer_id) update.stripe_customer_id = customerId;

  await base44.asServiceRole.entities.User.update(user.id, update);
  console.log('[stripe-webhook] updated user', user.email, update);
  return user;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const signature = req.headers.get('stripe-signature');
    const body = await req.text();

    if (!signature || !webhookSecret) {
      return Response.json({ error: 'Missing signature or webhook secret' }, { status: 400 });
    }

    // Deno requires async signature verification
    let event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      console.error('[stripe-webhook] signature verification failed:', err.message);
      return Response.json({ error: `Webhook signature failed: ${err.message}` }, { status: 400 });
    }

    console.log('[stripe-webhook] event:', event.type);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const email = session.customer_email || session.customer_details?.email;
        const customerId = session.customer;
        const subscriptionId = session.subscription;

        // Fetch subscription to get accurate trial/period info
        let update = { stripe_customer_id: customerId };
        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          update = { ...update, ...buildUserUpdateFromSubscription(sub) };
        }
        await findAndUpdateUser(base44, { email, customerId, update });
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const customerId = sub.customer;
        const update = buildUserUpdateFromSubscription(sub);
        await findAndUpdateUser(base44, { customerId, update });
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const customerId = sub.customer;
        await findAndUpdateUser(base44, {
          customerId,
          update: { subscription_status: 'canceled' },
        });
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const customerId = invoice.customer;
        await findAndUpdateUser(base44, {
          customerId,
          update: { subscription_status: 'past_due' },
        });
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object;
        const customerId = invoice.customer;
        if (invoice.subscription) {
          const sub = await stripe.subscriptions.retrieve(invoice.subscription);
          await findAndUpdateUser(base44, {
            customerId,
            update: buildUserUpdateFromSubscription(sub),
          });
        }
        break;
      }

      default:
        // Acknowledge unhandled events so Stripe doesn't retry
        break;
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('[stripe-webhook] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});