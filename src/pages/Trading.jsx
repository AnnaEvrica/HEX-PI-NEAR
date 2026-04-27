import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { TrendingUp, TrendingDown, RefreshCw, AlertTriangle, Activity, Zap, Settings, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

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

  const [autoTicker, setAutoTicker] = useState('');
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoResult, setAutoResult] = useState(null);

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
      setOrderMsg({ type: 'success', text: `Done! ${orderForm.side.toUpperCase()} ${orderForm.qty} ${orderForm.symbol.toUpperCase()} order placed.` });
      setOrderForm({ symbol: '', qty: '', side: 'buy', type: 'market' });
      await loadAccount();
    } catch (err) {
      setOrderMsg({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  async function runAutoTrade() {
    if (!autoTicker.trim()) return;
    setAutoRunning(true);
    setAutoResult(null);
    try {
      const res = await base44.functions.invoke('autoTrade', {
        ticker: autoTicker.toUpperCase(),
        riskAversion: 2.5,
      });
      if (res.data?.error) throw new Error(res.data.error);
      setAutoResult(res.data);
      await loadAccount();
    } catch (err) {
      setAutoResult({ error: err.message });
    } finally {
      setAutoRunning(false);
    }
  }

  const fmt = (v) => parseFloat(v || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  const pct = (v) => `${parseFloat(v || 0).toFixed(2)}%`;

  return (
    <div className="max-w-4xl mx-auto px-6 py-12 space-y-10">
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <h1 className="text-4xl font-bold text-white">Trade</h1>
          <p className="text-sm text-white/40">Manual trades or let HEX6 find and execute the best opportunities for you.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/settings" className="p-2.5 rounded-lg border border-white/10 text-white/40 hover:text-white transition-colors" title="API Settings">
            <Settings className="w-4 h-4" />
          </Link>
          <button onClick={loadAccount} disabled={loading}
            className="p-2.5 rounded-lg border border-white/10 text-white/40 hover:text-white transition-colors disabled:opacity-40">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-5 bg-[#111111] border border-amber-800/40 rounded-xl space-y-3">
          <div className="flex items-center gap-2 text-amber-400 text-sm font-medium">
            <AlertTriangle className="w-4 h-4" />
            Alpaca not connected
          </div>
          <p className="text-white/40 text-sm">You need to connect your Alpaca API keys to trade.</p>
          <Link to="/settings" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#C9A84C] text-black text-sm font-bold hover:bg-[#b8973d] transition-colors">
            <Settings className="w-4 h-4" /> Connect Alpaca
          </Link>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-white/10 border-t-[#C9A84C] rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {account && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Portfolio Value', value: fmt(account.portfolio_value), highlight: true },
                { label: 'Buying Power', value: fmt(account.buying_power) },
                { label: 'Cash', value: fmt(account.cash) },
                { label: 'Status', value: account.status?.toUpperCase() },
              ].map(({ label, value, highlight }) => (
                <div key={label} className={`rounded-xl border p-4 ${highlight ? 'border-[#C9A84C]/30 bg-[#C9A84C]/5' : 'border-white/10 bg-[#111111]'}`}>
                  <p className="text-xs text-white/30 uppercase tracking-widest mb-1">{label}</p>
                  <p className={`text-lg font-bold font-mono ${highlight ? 'text-[#C9A84C]' : 'text-white'}`}>{value}</p>
                </div>
              ))}
            </div>
          )}

          {/* AUTO-TRADE */}
          <div className="bg-[#111111] border border-[#C9A84C]/30 rounded-xl p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#C9A84C] flex items-center justify-center">
                <Zap className="w-4 h-4 text-black" />
              </div>
              <div>
                <p className="text-white font-bold">HEX6 Auto-Trade</p>
                <p className="text-white/40 text-xs">Enter a ticker — HEX6 runs the engine, calculates the right size, and places the trade automatically.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <input
                value={autoTicker}
                onChange={e => setAutoTicker(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && runAutoTrade()}
                placeholder="Enter ticker (e.g. AAPL, BTC-USD)"
                list="auto-asset-list"
                className="flex-1 bg-black border border-white/10 rounded-lg px-4 py-3 text-sm font-mono text-white placeholder-white/20 focus:outline-none focus:border-[#C9A84C]/50"
              />
              <datalist id="auto-asset-list">
                {assets.map(a => <option key={a.ticker} value={a.ticker} />)}
              </datalist>
              <button onClick={runAutoTrade} disabled={autoRunning || !autoTicker.trim()}
                className="px-6 py-3 rounded-lg bg-[#C9A84C] text-black text-sm font-bold hover:bg-[#b8973d] transition-colors disabled:opacity-40 whitespace-nowrap">
                {autoRunning ? 'Running HEX6…' : '⚡ Auto-Trade'}
              </button>
            </div>

            {autoResult && (
              <div className={`rounded-xl border p-5 space-y-3 ${autoResult.error ? 'border-red-800/40 bg-red-950/10' : autoResult.skipped ? 'border-white/10' : 'border-[#C9A84C]/20 bg-[#C9A84C]/5'}`}>
                {autoResult.error && <p className="text-sm text-red-400">{autoResult.error}</p>}
                {autoResult.skipped && (
                  <div className="flex items-center gap-2 text-white/50 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-white/30" />
                    No trade needed — {autoResult.reason}
                  </div>
                )}
                {autoResult.success && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-[#C9A84C] text-sm font-medium">
                      <CheckCircle2 className="w-4 h-4" />
                      Trade executed by HEX6
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        ['Direction', autoResult.trade?.side?.toUpperCase()],
                        ['Quantity', autoResult.trade?.qty],
                        ['Market State', autoResult.engine?.marketState],
                        ['Target Weight', autoResult.engine?.targetWeight != null ? `${(autoResult.engine.targetWeight * 100).toFixed(1)}%` : '—'],
                      ].map(([label, value]) => (
                        <div key={label} className="bg-black/40 rounded-lg p-2.5">
                          <p className="text-xs text-white/30 mb-0.5">{label}</p>
                          <p className="text-sm font-mono font-bold text-white">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Manual trade */}
          <div className="bg-[#111111] border border-white/10 rounded-xl p-6 space-y-5">
            <h2 className="text-sm font-bold text-white/40 uppercase tracking-widest">Manual Trade</h2>
            <form onSubmit={submitOrder} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <label className="text-xs text-white/30 uppercase tracking-widest block mb-1.5">Symbol</label>
                <input required value={orderForm.symbol}
                  onChange={e => setOrderForm({ ...orderForm, symbol: e.target.value.toUpperCase() })}
                  placeholder="AAPL" list="asset-list"
                  className="w-full bg-black border border-white/10 rounded-lg px-3 py-2.5 text-sm font-mono text-white placeholder-white/20 focus:outline-none focus:border-[#C9A84C]/50" />
                <datalist id="asset-list">
                  {assets.map(a => <option key={a.ticker} value={a.ticker} />)}
                </datalist>
              </div>
              <div>
                <label className="text-xs text-white/30 uppercase tracking-widest block mb-1.5">Qty</label>
                <input required type="number" min="0.001" step="any" value={orderForm.qty}
                  onChange={e => setOrderForm({ ...orderForm, qty: e.target.value })}
                  placeholder="1"
                  className="w-full bg-black border border-white/10 rounded-lg px-3 py-2.5 text-sm font-mono text-white placeholder-white/20 focus:outline-none focus:border-[#C9A84C]/50" />
              </div>
              <div>
                <label className="text-xs text-white/30 uppercase tracking-widest block mb-1.5">Side</label>
                <select value={orderForm.side} onChange={e => setOrderForm({ ...orderForm, side: e.target.value })}
                  className="w-full bg-black border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#C9A84C]/50">
                  <option value="buy" className="bg-black">Buy</option>
                  <option value="sell" className="bg-black">Sell</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-white/30 uppercase tracking-widest block mb-1.5">Type</label>
                <select value={orderForm.type} onChange={e => setOrderForm({ ...orderForm, type: e.target.value })}
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
                  {submitting ? 'Placing order…' : `${orderForm.side === 'sell' ? '↓ Sell' : '↑ Buy'} ${orderForm.symbol || '—'}`}
                </button>
              </div>
            </form>
            {orderMsg && (
              <p className={`text-sm ${orderMsg.type === 'success' ? 'text-[#C9A84C]' : 'text-red-400'}`}>{orderMsg.text}</p>
            )}
          </div>

          {/* Positions */}
          <div className="space-y-3">
            <h2 className="text-xl font-bold text-white">Open Positions</h2>
            {positions.length === 0 ? (
              <div className="py-10 text-center">
                <Activity className="w-6 h-6 text-white/10 mx-auto mb-2" />
                <p className="text-white/30 text-sm">No open positions yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {positions.map(pos => {
                  const pl = parseFloat(pos.unrealized_pl || 0);
                  return (
                    <div key={pos.symbol} className="flex items-center gap-4 px-5 py-4 bg-[#111111] border border-white/10 rounded-xl">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono font-bold text-white">{pos.symbol}</span>
                          <span className="text-xs text-white/30">{pos.qty} units</span>
                        </div>
                        <p className="text-xs text-white/30 mt-0.5">Avg entry {fmt(pos.avg_entry_price)}</p>
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
            <h2 className="text-xl font-bold text-white">Recent Orders</h2>
            {orders.length === 0 ? (
              <p className="text-white/30 text-sm py-4">No recent orders.</p>
            ) : (
              <div className="space-y-2">
                {orders.slice(0, 10).map(order => (
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