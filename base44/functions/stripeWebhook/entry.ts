import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';

async function verifyStripeSignature(
  body: string,
  signatureHeader: string | null,
  secret: string
): Promise<boolean> {
  if (!signatureHeader || !secret) return false;
  const parts = signatureHeader.split(',');
  const tPart = parts.find((p) => p.startsWith('t='));
  const sigs = parts.filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
  if (!tPart || sigs.length === 0) return false;

  const timestamp = tPart.slice(2);
  const signedPayload = `${timestamp}.${body}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(signedPayload)
  );
  const expected = Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return sigs.some((s) => s === expected);
}

const VALID_STATUSES = ['trialing', 'active', 'past_due', 'canceled', 'incomplete'];

function normalizeStatus(stripeStatus: string): string {
  if (VALID_STATUSES.includes(stripeStatus)) return stripeStatus;
  if (stripeStatus === 'incomplete_expired' || stripeStatus === 'unpaid') return 'past_due';
  if (stripeStatus === 'paused') return 'active';
  return 'canceled';
}

async function syncUserSubscription(
  base44: any,
  email: string,
  data: {
    status: string;
    customerId: string;
    subscriptionId: string;
    currentPeriodEnd: string | null;
    trialEnd: string | null;
    cancelAtPeriodEnd: boolean;
  }
) {
  const users = await base44.asServiceRole.entities.User.filter({ email });
  const user = Array.isArray(users) ? users[0] : users?.items?.[0];
  if (!user) return;

  await base44.asServiceRole.entities.User.update(user.id, {
    subscription_status: normalizeStatus(data.status),
    stripe_customer_id: data.customerId,
    stripe_subscription_id: data.subscriptionId,
    current_period_end: data.currentPeriodEnd,
    trial_ends_at: data.trialEnd,
  });

  const existing = await base44.asServiceRole.entities.Subscription.filter({
    user_email: email,
  });
  const existingRec = Array.isArray(existing) ? existing[0] : existing?.items?.[0];

  const recordData = {
    stripe_customer_id: data.customerId,
    stripe_subscription_id: data.subscriptionId,
    status: normalizeStatus(data.status),
    current_period_end: data.currentPeriodEnd,
    trial_end: data.trialEnd,
    cancel_at_period_end: data.cancelAtPeriodEnd,
  };

  if (existingRec) {
    await base44.asServiceRole.entities.Subscription.update(existingRec.id, recordData);
  } else {
    await base44.asServiceRole.entities.Subscription.create({
      user_email: email,
      ...recordData,
    });
  }
}

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.text();
    const sig = req.headers.get('stripe-signature');
    const secret = secrets.get('STRIPE_WEBHOOK_SECRET');

    if (!(await verifyStripeSignature(body, sig, secret))) {
      return Response.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const event = JSON.parse(body);

    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object;
        const email = s.customer_details?.email || s.metadata?.user_email;
        if (email) {
          await syncUserSubscription(base44, email, {
            status: 'active',
            customerId: s.customer,
            subscriptionId: s.subscription,
            currentPeriodEnd: null,
            trialEnd: null,
            cancelAtPeriodEnd: false,
          });
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const status =
          event.type === 'customer.subscription.deleted' ? 'canceled' : sub.status;
        // Find user by customer ID first, fall back to metadata
        let email = sub.metadata?.user_email;
        if (!email && sub.customer) {
          const users = await base44.asServiceRole.entities.User.filter({
            stripe_customer_id: sub.customer,
          });
          const u = Array.isArray(users) ? users[0] : users?.items?.[0];
          if (u) email = u.email;
        }
        if (email) {
          await syncUserSubscription(base44, email, {
            status,
            customerId: sub.customer,
            subscriptionId: sub.id,
            currentPeriodEnd: sub.current_period_end
              ? new Date(sub.current_period_end * 1000).toISOString()
              : null,
            trialEnd: sub.trial_end
              ? new Date(sub.trial_end * 1000).toISOString()
              : null,
            cancelAtPeriodEnd: sub.cancel_at_period_end,
          });
        }
        break;
      }
      default:
        break;
    }

    return Response.json({ received: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}