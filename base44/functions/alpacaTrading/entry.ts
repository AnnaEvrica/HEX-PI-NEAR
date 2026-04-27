/**
 * alpacaTrading — Alpaca Markets API proxy
 * Supports: getAccount, getPositions, getOrders, placeOrder
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const BASE_URL = (Deno.env.get('ALPACA_BASE_URL') || 'https://paper-api.alpaca.markets').replace(/\/v2\/?$/, '').replace(/\/$/, '');

function alpacaHeaders() {
  const key = Deno.env.get('ALPACA_API_KEY');
  const secret = Deno.env.get('ALPACA_SECRET_KEY');
  if (!key || !secret) throw new Error('ALPACA_API_KEY and ALPACA_SECRET_KEY secrets are required');
  return {
    'APCA-API-KEY-ID': key,
    'APCA-API-SECRET-KEY': secret,
    'Content-Type': 'application/json',
  };
}

async function alpacaGet(path) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, { headers: alpacaHeaders() });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Alpaca [${url}] (${res.status}): ${text}`);
  }
  return res.json();
}

async function alpacaPost(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: alpacaHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Alpaca API error (${res.status}): ${text}`);
  }
  return res.json();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const { action } = body;

    if (action === 'getAccount') {
      const account = await alpacaGet('/v2/account');
      return Response.json({ account });
    }

    if (action === 'getPositions') {
      const positions = await alpacaGet('/v2/positions');
      return Response.json({ positions });
    }

    if (action === 'getOrders') {
      const orders = await alpacaGet('/v2/orders?status=all&limit=20&direction=desc');
      return Response.json({ orders });
    }

    if (action === 'placeOrder') {
      const { symbol, qty, side, type } = body;
      if (!symbol || !qty || !side) {
        return Response.json({ error: 'symbol, qty, side required' }, { status: 400 });
      }
      const order = await alpacaPost('/v2/orders', {
        symbol,
        qty: String(qty),
        side,
        type: type || 'market',
        time_in_force: type === 'limit' ? 'gtc' : 'day',
      });
      return Response.json({ order });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});