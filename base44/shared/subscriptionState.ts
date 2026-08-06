const STATUS_ORDER = ['active', 'trialing', 'past_due', 'unpaid', 'paused', 'incomplete', 'canceled', 'incomplete_expired'];
const ACCESS_STATUSES = new Set(['active', 'trialing']);
const BILLING_STATUSES = new Set(['past_due', 'unpaid', 'paused', 'incomplete']);

export function isAccessAllowed(status) {
  return ACCESS_STATUSES.has(status);
}

export function subscriptionAction(status) {
  if (ACCESS_STATUSES.has(status)) return 'access';
  if (BILLING_STATUSES.has(status)) return 'billing';
  return 'checkout';
}

export function subscriptionRank(status) {
  const rank = STATUS_ORDER.indexOf(status);
  return rank === -1 ? STATUS_ORDER.length : rank;
}

export function pickBestSubscription(subscriptions) {
  return [...(subscriptions || [])].sort((a, b) => {
    const statusDifference = subscriptionRank(a.status) - subscriptionRank(b.status);
    if (statusDifference !== 0) return statusDifference;
    return Number(b.created || 0) - Number(a.created || 0);
  })[0] || null;
}

export function isTransitionalStatus(status) {
  return BILLING_STATUSES.has(status);
}

export async function findStripeCustomerSubscription(stripe, email) {
  const customers = await stripe.customers.list({ email, limit: 100 });
  const candidates = [];
  for (const customer of customers.data) {
    const subscriptions = await stripe.subscriptions.list({ customer: customer.id, status: 'all', limit: 100 });
    for (const subscription of subscriptions.data) candidates.push({ customer, subscription });
  }
  candidates.sort((a, b) => {
    const statusDifference = subscriptionRank(a.subscription.status) - subscriptionRank(b.subscription.status);
    if (statusDifference !== 0) return statusDifference;
    return Number(b.subscription.created || 0) - Number(a.subscription.created || 0);
  });
  return candidates[0] || { customer: customers.data[0] || null, subscription: null };
}