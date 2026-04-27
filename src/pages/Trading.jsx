import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { TrendingUp, TrendingDown, RefreshCw, AlertTriangle, Activity } from 'lucide-react';

export default function Trading() {
  const [assets, setAssets] = useState([]);
  const [account, setAccount] = useState(null);
  const [positions, setPositions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [orderForm, setOrderForm] = useState({ symbol: '', qty: '', side: 'buy', type: 'market' });
  const [submitting, setSubmitting] = useState(false);
  const [orderMsg, setOrderMsg] = useState(null);

  useEffect(() => {
    base44.entities.Asset.list().then(setAssets);
    loadAccount();
  }, []);

  async function loadAccount() {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('alpacaTrading', { action: 'getAccount' });
      if (res.data?.error) throw new Error(res.data.error);
      setAccount(res.data?.account || null);

      const [posRes, ordRes] = await Promise.all([
        base44.functions.invoke('alpacaTrading', { action: 'getPositions' }),
        base44.functions.invoke('alpacaTrading', { action: 'getOrders' }),
      ]);
      setPositions(posRes.data?.positions || []);
      setOrders(ordRes.data?.orders || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function submitOrder(e) {
    e.preventDefault();
    setSubmitting(true);
    setOrderMsg(null);
    try {
      const res = await base44.functions.invoke('alpacaTrading', {
        action: 'placeOrder',
        symbol: orderForm.symbol.toUpperCase(),
        qty: parseFloat(orderForm.qty),
        side: orderForm.side,
        type: orderForm.type,
      });
      if (res.data?.error) throw new Error(res.data.error);
      setOrderMsg({ type: 'success', text: `Order placed: ${orderForm.side.toUpperCase()} ${orderForm.qty} ${orderForm.symbol.toUpperCase()}` });
      setOrderForm({ symbol: '', qty: '', side: 'buy', type: 'market' });
      await loadAccount();
    } catch (err) {
      setOrderMsg({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  const fmt = (v) => parseFloat(v || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  const pct = (v) => `${parseFloat(v || 0).toFixed(2)}%`;

  return (
    <div className="max-w-4xl mx-auto px-6 py-12 space-y-10">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <h1 className="text-4xl font-bold text-white">Live Trading</h1>
          <p className="text-sm text-white/40">Alpaca Markets API · Paper & Live execution</p>
        </div>
        <button onClick={loadAccount} disabled={loading}
          className="p-2.5 rounded-lg border border-white/10 text-white/40 hover:text-white transition-colors disabled:opacity-40">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-black border border-red-900/50 rounded-xl text-sm text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
          {error.includes('ALPACA') && (
            <span className="text-red-600 ml-2">— Set ALPACA_API_KEY and ALPACA_SECRET_KEY in app secrets.</span>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-white/10 border-t-[#C9A84C] rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Account */}
          {account && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Portfolio Value', value: fmt(account.portfolio_value) },
                { label: 'Buying Power', value: fmt(account.buying_power) },
                { label: 'Cash', value: fmt(account.cash) },
                { label: 'Status', value: account.status?.toUpperCase() },
              ].map(({ label, value }) => (
                <div key={label} className="bg-[#111111] border border-white/10 rounded-xl p-4">
                  <p className="text-xs text-white/30 uppercase tracking-widest mb-1">{label}</p>
                  <p className="text-lg font-bold font-mono text-[#C9A84C]">{value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Place Order */}
          <div className="bg-[#111111] border border-white/10 rounded-xl p-6 space-y-5">
            <h2 className="text-xs font-bold text-white/40 uppercase tracking-widest">Place Order</h2>
            <form onSubmit={submitOrder} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <label className="text-xs text-white/30 uppercase tracking-widest block mb-1.5">Symbol</label>
                <input required value={orderForm.symbol}
                  onChange={(e) => setOrderForm({ ...orderForm, symbol: e.target.value.toUpperCase() })}
                  placeholder="AAPL"
                  list="asset-list"
                  className="w-full bg-black border border-white/10 rounded-lg px-3 py-2.5 text-sm font-mono text-white placeholder-white/20 focus:outline-none focus:border-[#C9A84C]/50" />
                <datalist id="asset-list">
                  {assets.map((a) => <option key={a.ticker} value={a.ticker} />)}
                </datalist>
              </div>
              <div>
                <label className="text-xs text-white/30 uppercase tracking-widest block mb-1.5">Qty</label>
                <input required type="number" min="0.001" step="any" value={orderForm.qty}
                  onChange={(e) => setOrderForm({ ...orderForm, qty: e.target.value })}
                  placeholder="1"
                  className="w-full bg-black border border-white/10 rounded-lg px-3 py-2.5 text-sm font-mono text-white placeholder-white/20 focus:outline-none focus:border-[#C9A84C]/50" />
              </div>
              <div>
                <label className="text-xs text-white/30 uppercase tracking-widest block mb-1.5">Side</label>
                <select value={orderForm.side} onChange={(e) => setOrderForm({ ...orderForm, side: e.target.value })}
                  className="w-full bg-black border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#C9A84C]/50">
                  <option value="buy" className="bg-black">Buy</option>
                  <option value="sell" className="bg-black">Sell</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-white/30 uppercase tracking-widest block mb-1.5">Type</label>
                <select value={orderForm.type} onChange={(e) => setOrderForm({ ...orderForm, type: e.target.value })}
                  className="w-full bg-black border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#C9A84C]/50">
                  <option value="market" className="bg-black">Market</option>
                  <option value="limit" className="bg-black">Limit</option>
                </select>
              </div>
              <div className="col-span-2 sm:col-span-4">
                <button type="submit" disabled={submitting}
                  className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-colors disabled:opacity-40 ${
                    orderForm.side === 'sell'
                      ? 'bg-red-900/60 border border-red-800/50 text-red-300 hover:bg-red-900/80'
                      : 'bg-[#C9A84C] text-black hover:bg-[#b8973d]'
                  }`}>
                  {submitting ? 'Submitting…' : `${orderForm.side === 'sell' ? 'Sell' : 'Buy'} ${orderForm.symbol || '—'}`}
                </button>
              </div>
            </form>
            {orderMsg && (
              <p className={`text-sm ${orderMsg.type === 'success' ? 'text-[#C9A84C]' : 'text-red-400'}`}>
                {orderMsg.text}
              </p>
            )}
          </div>

          {/* Positions */}
          <div className="space-y-3">
            <h2 className="text-2xl font-bold text-white">Positions</h2>
            {positions.length === 0 ? (
              <div className="py-10 text-center">
                <Activity className="w-6 h-6 text-white/10 mx-auto mb-2" />
                <p className="text-white/30 text-sm">No open positions.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {positions.map((pos) => {
                  const pl = parseFloat(pos.unrealized_pl || 0);
                  return (
                    <div key={pos.symbol} className="flex items-center gap-4 px-5 py-4 bg-[#111111] border border-white/10 rounded-xl">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono font-bold text-white">{pos.symbol}</span>
                          <span className="text-xs text-white/30">{pos.qty} shares</span>
                        </div>
                        <p className="text-xs text-white/30 mt-0.5">Avg {fmt(pos.avg_entry_price)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-mono font-bold text-white">{fmt(pos.market_value)}</p>
                        <p className={`text-xs font-mono flex items-center gap-0.5 justify-end ${pl >= 0 ? 'text-[#C9A84C]' : 'text-red-400'}`}>
                          {pl >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {fmt(pos.unrealized_pl)} ({pct(pos.unrealized_plpc * 100)})
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent Orders */}
          <div className="space-y-3">
            <h2 className="text-2xl font-bold text-white">Recent Orders</h2>
            {orders.length === 0 ? (
              <p className="text-white/30 text-sm py-4">No recent orders.</p>
            ) : (
              <div className="space-y-2">
                {orders.slice(0, 10).map((order) => (
                  <div key={order.id} className="flex items-center gap-4 px-5 py-3 bg-[#111111] border border-white/10 rounded-xl">
                    <span className={`text-xs font-mono font-bold w-10 ${order.side === 'buy' ? 'text-[#C9A84C]' : 'text-red-400'}`}>
                      {order.side?.toUpperCase()}
                    </span>
                    <span className="text-sm font-mono text-white">{order.symbol}</span>
                    <span className="text-xs text-white/30">{order.qty} @ {order.type}</span>
                    <span className="flex-1" />
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      order.status === 'filled' ? 'text-[#C9A84C]' :
                      order.status === 'canceled' ? 'text-white/20' : 'text-white/50'
                    }`}>{order.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}