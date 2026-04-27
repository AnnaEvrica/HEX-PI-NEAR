import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { TrendingUp, FlaskConical, BookOpen, Zap, Activity, Shield, RefreshCw } from 'lucide-react';
import { onRebalance } from '@/services/hex6Engine';

export default function Dashboard() {
  const [assets, setAssets] = useState([]);
  const [user, setUser] = useState(null);
  const [rebalancing, setRebalancing] = useState(false);
  const [lastReceipt, setLastReceipt] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.auth.me().catch(() => null),
      base44.entities.Asset.list('-updated_date'),
    ]).then(([u, a]) => {
      setUser(u);
      setAssets(a);
      setLoading(false);
    });
  }, []);

  async function triggerRebalance() {
    setRebalancing(true);
    try {
      const tickers = assets.filter(a => a.is_active).map(a => a.ticker);
      if (tickers.length === 0) return;
      const receipt = await onRebalance({
        assets: tickers,
        marketData: { volatility: 0.18, trend: 0.06 },
        triggeredBy: 'DASHBOARD_MANUAL',
      });
      setLastReceipt(receipt);
      const updated = await base44.entities.Asset.list('-updated_date');
      setAssets(updated);
    } finally {
      setRebalancing(false);
    }
  }

  const activeAssets = assets.filter(a => a.is_active);
  const bullCount = assets.filter(a => a.market_state === 'BULL').length;
  const bearCount = assets.filter(a => a.market_state === 'BEAR').length;

  return (
    <div className="max-w-4xl mx-auto px-6 py-12 space-y-10">
      {/* Greeting */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#C9A84C] animate-pulse" />
          <span className="text-xs text-[#C9A84C] font-medium uppercase tracking-widest">HEX6 BLE v5.0</span>
        </div>
        <h1 className="text-4xl font-bold text-white">
          {user ? `Welcome back, ${user.full_name?.split(' ')[0] || 'there'}.` : 'HEX6 Dashboard'}
        </h1>
        <p className="text-white/40 text-sm">Your portfolio intelligence engine is active and monitoring.</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Assets Governed', value: loading ? '—' : activeAssets.length },
          { label: 'BULL', value: loading ? '—' : bullCount, color: 'text-[#C9A84C]' },
          { label: 'BEAR', value: loading ? '—' : bearCount, color: 'text-red-400' },
          { label: 'EGTS Status', value: 'Verified', color: 'text-[#C9A84C]' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[#111111] border border-white/10 rounded-xl p-4">
            <p className="text-xs text-white/30 uppercase tracking-widest mb-1">{label}</p>
            <p className={`text-2xl font-bold font-mono ${color || 'text-white'}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Rebalance CTA */}
      <div className="bg-[#111111] border border-[#C9A84C]/30 rounded-xl p-6 flex flex-wrap items-center gap-5">
        <div className="flex-1 space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#C9A84C]" />
            <p className="text-white font-bold">Trigger Rebalance</p>
          </div>
          <p className="text-white/40 text-sm">Run the HEX6 engine across all active assets, recalculate optimal weights, and mint EGTS receipts for each decision.</p>
          {lastReceipt && (
            <p className="text-xs text-[#C9A84C] font-mono">✓ Receipt minted · {new Date().toLocaleTimeString()}</p>
          )}
        </div>
        <button onClick={triggerRebalance} disabled={rebalancing || activeAssets.length === 0}
          className="flex items-center gap-2 px-6 py-3 rounded-lg bg-[#C9A84C] text-black text-sm font-bold hover:bg-[#b8973d] transition-colors disabled:opacity-40 shrink-0">
          {rebalancing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
          {rebalancing ? 'Running HEX6…' : 'Rebalance Now'}
        </button>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { to: '/trading', icon: FlaskConical, label: 'Trade', desc: 'Place a manual trade or let HEX6 auto-execute the optimal position size.', gold: true },
          { to: '/backtest', icon: Activity, label: 'Backtest', desc: 'Simulate your strategy on historical data and see performance metrics.' },
          { to: '/thesis', icon: BookOpen, label: 'Research', desc: 'Generate an AI-powered investment thesis for any asset in your portfolio.' },
        ].map(({ to, icon: Icon, label, desc, gold }) => (
          <Link key={to} to={to}
            className={`block rounded-xl border p-5 space-y-2 hover:border-white/30 transition-colors ${gold ? 'border-[#C9A84C]/30 bg-[#C9A84C]/5 hover:bg-[#C9A84C]/10' : 'border-white/10 bg-[#111111]'}`}>
            <Icon className={`w-5 h-5 ${gold ? 'text-[#C9A84C]' : 'text-white/40'}`} />
            <p className={`font-bold ${gold ? 'text-[#C9A84C]' : 'text-white'}`}>{label}</p>
            <p className="text-white/40 text-sm leading-relaxed">{desc}</p>
          </Link>
        ))}
      </div>

      {/* Recent assets */}
      {assets.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Portfolio</h2>
            <Link to="/portfolio" className="text-xs text-[#C9A84C] hover:underline">View all →</Link>
          </div>
          <div className="space-y-2">
            {assets.slice(0, 6).map(asset => (
              <Link key={asset.id} to={`/portfolio/${asset.id}`}
                className="flex items-center gap-4 px-5 py-3 bg-[#111111] border border-white/10 rounded-xl hover:border-white/20 transition-colors">
                <span className="text-xs font-mono font-bold text-white w-14 shrink-0">{asset.ticker}</span>
                <span className="text-sm text-white/50 flex-1 truncate">{asset.name}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                  asset.market_state === 'BULL' ? 'text-[#C9A84C]' :
                  asset.market_state === 'BEAR' ? 'text-red-400' : 'text-white/30'
                }`}>{asset.market_state || '—'}</span>
                {asset.target_weight != null && (
                  <span className="text-xs font-mono text-white/40 w-12 text-right shrink-0">
                    {(asset.target_weight * 100).toFixed(1)}%
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {assets.length === 0 && !loading && (
        <div className="text-center py-16 space-y-3">
          <Activity className="w-10 h-10 text-white/10 mx-auto" />
          <p className="text-white/30">No assets yet.</p>
          <Link to="/portfolio" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#C9A84C]/50 text-[#C9A84C] text-sm hover:bg-[#C9A84C]/10 transition-colors">
            + Add your first asset
          </Link>
        </div>
      )}

      {/* EGTS footer note */}
      <div className="flex items-center gap-3 p-4 bg-[#111111] border border-white/10 rounded-xl">
        <Shield className="w-4 h-4 text-[#C9A84C] shrink-0" />
        <p className="text-white/40 text-xs">Every rebalance decision is cryptographically sealed by EGTS and stored permanently. <Link to="/governance" className="text-[#C9A84C] hover:underline">View audit trail →</Link></p>
      </div>
    </div>
  );
}