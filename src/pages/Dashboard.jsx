import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Activity, Shield, TrendingUp, AlertTriangle, ArrowRight, Zap } from 'lucide-react';
import { getAllEgtsReceipts } from '@/services/egtsService';
import { onRebalance, onSilenceMode } from '@/services/hex6Engine';

export default function Dashboard() {
  const [assets, setAssets] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [triggering, setTriggering] = useState(null);

  useEffect(() => {
    base44.entities.Asset.list('-updated_date', 20).then((data) => {
      setAssets(data);
      setLoadingAssets(false);
    });
    getAllEgtsReceipts().then(setReceipts).catch(console.error);
  }, []);

  async function triggerRebalance() {
    setTriggering('rebalance');
    const assetIds = assets.map((a) => a.ticker).filter(Boolean);
    if (assetIds.length === 0) { alert('Add assets first via the Portfolio page.'); setTriggering(null); return; }
    await onRebalance({ assets: assetIds, triggeredBy: 'DASHBOARD_MANUAL' });
    const fresh = await getAllEgtsReceipts();
    setReceipts(fresh);
    setTriggering(null);
  }

  async function triggerSilence() {
    setTriggering('silence');
    const assetIds = assets.map((a) => a.ticker).filter(Boolean);
    if (assetIds.length === 0) { alert('Add assets first via the Portfolio page.'); setTriggering(null); return; }
    await onSilenceMode({ assets: assetIds, reason: 'MANUAL_SILENCE', triggeredBy: 'DASHBOARD_MANUAL' });
    const fresh = await getAllEgtsReceipts();
    setReceipts(fresh);
    setTriggering(null);
  }

  const stats = [
    { label: 'Assets Governed', value: assets.length, icon: Activity },
    { label: 'Total Receipts', value: receipts.length, icon: Shield },
    { label: 'Rebalance Events', value: receipts.filter((r) => r.event_type === 'REBALANCE').length, icon: TrendingUp },
    { label: 'Silence Events', value: receipts.filter((r) => r.event_type === 'SILENCE').length, icon: AlertTriangle },
  ];

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 space-y-12">
      {/* Hero */}
      <div className="text-center space-y-3">
        <h1 className="text-5xl font-bold tracking-tight text-white">Governance Dashboard</h1>
        <p className="text-white/40 text-sm">HEX6 BLE Engine · EGTS Audit System · Real-time portfolio governance</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-[#111111] border border-white/10 rounded-xl p-6 flex flex-col items-center gap-3">
            <Icon className="w-5 h-5 text-[#C9A84C]" />
            <p className="text-4xl font-bold text-[#C9A84C]">{value}</p>
            <p className="text-xs text-white/40 text-center">{label}</p>
          </div>
        ))}
      </div>

      {/* Engine Controls */}
      <div className="bg-[#111111] border border-white/10 rounded-xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#C9A84C]" />
            <h2 className="text-base font-bold text-white">HEX6 Engine Controls</h2>
          </div>
          <span className="text-xs text-white/20 font-mono text-right">HEX6-BLE-v5.0<br />SCEFM</span>
        </div>
        <p className="text-sm text-white/40 leading-relaxed">
          Trigger the HEX6 BLE v5.0 SCEFM engine. Each action runs on real market data and mints cryptographic EGTS receipts per asset.
          Use <span className="text-white/60">Backtest</span> to run historical simulations or <span className="text-white/60">Managers</span> to distribute allocations across AUM.
        </p>
        <div className="flex gap-3">
          <button
            onClick={triggerRebalance}
            disabled={!!triggering}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-[#C9A84C]/50 text-[#C9A84C] text-sm font-medium hover:bg-[#C9A84C]/10 transition-colors disabled:opacity-40"
          >
            <TrendingUp className="w-4 h-4" />
            {triggering === 'rebalance' ? 'Running…' : 'Trigger Rebalance'}
          </button>
          <button
            onClick={triggerSilence}
            disabled={!!triggering}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-[#C9A84C] text-black text-sm font-bold hover:bg-[#b8973d] transition-colors disabled:opacity-40"
          >
            <AlertTriangle className="w-4 h-4" />
            {triggering === 'silence' ? 'Running…' : 'Activate Silence Mode'}
          </button>
        </div>
      </div>

      {/* Recent Receipts */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Recent Governance Receipts</h2>
          <Link to="/governance" className="flex items-center gap-1 text-sm text-white/40 hover:text-white transition-colors">
            View all <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        {receipts.length === 0 ? (
          <div className="bg-[#111111] border border-white/10 rounded-xl p-8 text-center">
            <p className="text-sm text-white/30">No receipts yet. Trigger a rebalance above.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {receipts.slice(0, 5).map((r) => (
              <div key={r.id} className="bg-[#111111] border border-white/10 rounded-xl px-5 py-4 flex items-center gap-4">
                <span className="text-xs font-mono font-bold text-white/60 w-28">{r.event_type}</span>
                <span className="text-sm text-white flex-1 font-medium">{r.asset_id}</span>
                <span className="text-xs font-mono text-white/30">{r.crypto_hash?.slice(0, 10)}...</span>
                <span className="w-2 h-2 rounded-full bg-[#C9A84C]" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Governed Assets */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Governed Assets</h2>
          <Link to="/portfolio" className="flex items-center gap-1 text-sm text-white/40 hover:text-white transition-colors">
            Manage <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        {loadingAssets ? (
          <div className="flex justify-center py-8">
            <div className="w-5 h-5 border-2 border-white/10 border-t-[#C9A84C] rounded-full animate-spin" />
          </div>
        ) : assets.length === 0 ? (
          <div className="bg-[#111111] border border-white/10 rounded-xl p-10 text-center space-y-2">
            <p className="text-sm text-white/30">No assets in portfolio.</p>
            <Link to="/portfolio" className="text-sm text-[#C9A84C] hover:underline">Add your first asset →</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {assets.map((asset) => (
              <Link
                key={asset.id}
                to={`/portfolio/${asset.id}`}
                className="bg-[#111111] border border-white/10 rounded-xl p-5 hover:border-[#C9A84C]/40 transition-all group space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-white bg-white/8 px-2 py-0.5 rounded">{asset.ticker}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${asset.market_state === 'BULL' ? 'text-[#C9A84C]' : asset.market_state === 'BEAR' ? 'text-red-400' : 'text-white/30'}`}>
                    {asset.market_state || 'UNKNOWN'}
                  </span>
                </div>
                <p className="text-sm font-medium text-white">{asset.name}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/30">{asset.asset_class}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-white/20 group-hover:text-[#C9A84C] transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}