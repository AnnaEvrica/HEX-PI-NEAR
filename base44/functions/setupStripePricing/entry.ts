import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@17.3.0';

// Admin-only: verifies the Stripe price is $19.99/month. If the current
// STRIPE_PRICE_ID is missing or wrong, creates a correct price and returns
// the new ID so the builder can update the secret.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const secretKey = Deno.env.get('STRIPE_SECRET_KEY');
    const currentPriceId = Deno.env.get('STRIPE_PRICE_ID');
    if (!secretKey) return Response.json({ error: 'STRIPE_SECRET_KEY not set' }, { status: 500 });

    const stripe = new Stripe(secretKey);

    // Check current price
    if (currentPriceId) {
      try {
        const price = await stripe.prices.retrieve(currentPriceId);
        const amount = price.unit_amount / 100;
        const interval = price.recurring?.interval;
        if (amount === 19.99 && interval === 'month') {
          return Response.json({ status: 'ok', price_id: currentPriceId, amount, interval, message: 'Price is already $19.99/month' });
        }
        // Mismatch — fall through to create the correct $19.99/month price
      } catch (_e) {
        // Price ID invalid — will create new below
      }
    }

    // Find or create product
    const products = await stripe.products.list({ limit: 100 });
    let product = products.data.find(p => p.name === 'HEX6 BLE');
    if (!product) {
      product = await stripe.products.create({ name: 'HEX6 BLE' });
    }

    // Create $19.99/month price
    const newPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: 1999,
      currency: 'usd',
      recurring: { interval: 'month' },
    });

    return Response.json({
      status: 'created',
      price_id: newPrice.id,
      amount: 19.99,
      interval: 'month',
      message: 'Created $19.99/month price. Update STRIPE_PRICE_ID secret to this price_id.',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}