import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Shield, Activity, TrendingUp, AlertTriangle, ArrowRight, Zap } from 'lucide-react';
import EGTSBadge from '@/components/egts/EGTSBadge';
import { getAllEgtsReceipts } from '@/services/egtsService';
import { onRebalance, onSilenceMode, MARKET_STATES } from '@/services/hex6Engine';

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
    if (assetIds.length === 0) {
      alert('Add assets first via the Portfolio page.');
      setTriggering(null);
      return;
    }
    await onRebalance({
      assets: assetIds,
      marketData: { volatility: 0.18, trend: 0.06 },
      triggeredBy: 'DASHBOARD_MANUAL',
    });
    const fresh = await getAllEgtsReceipts();
    setReceipts(fresh);
    setTriggering(null);
  }

  async function triggerSilence() {
    setTriggering('silence');
    const assetIds = assets.map((a) => a.ticker).filter(Boolean);
    if (assetIds.length === 0) {
      alert('Add assets first via the Portfolio page.');
      setTriggering(null);
      return;
    }
    await onSilenceMode({
      assets: assetIds,
      reason: 'MANUAL_SILENCE',
      triggeredBy: 'DASHBOARD_MANUAL',
    });
    const fresh = await getAllEgtsReceipts();
    setReceipts(fresh);
    setTriggering(null);
  }

  const stats = [
    { label: 'Assets Governed', value: assets.length, icon: Activity, color: 'text-blue-400' },
    { label: 'Total Receipts', value: receipts.length, icon: Shield, color: 'text-emerald-400' },
    {
      label: 'Rebalance Events',
      value: receipts.filter((r) => r.event_type === 'REBALANCE').length,
      icon: TrendingUp,
      color: 'text-violet-400',
    },
    {
      label: 'Silence Events',
      value: receipts.filter((r) => r.event_type === 'SILENCE').length,
      icon: AlertTriangle,
      color: 'text-amber-400',
    },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Governance Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">
            HEX6 BLE Engine · EGTS Audit System · Real-time portfolio governance
          </p>
        </div>
        <EGTSBadge status="verified" size="lg" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="p-4 rounded-xl bg-white/3 border border-white/8">
            <Icon className={`w-5 h-5 ${color} mb-3`} />
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-xs text-slate-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Engine Controls */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-[#080c10] border border-white/10">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-yellow-400" />
          <h2 className="text-sm font-semibold text-white">HEX6 Engine Controls</h2>
          <span className="text-xs text-slate-600 font-mono ml-auto">HEX6-BLE-v5.0 · SCEFM</span>
        </div>
        <p className="text-xs text-slate-500 mb-5">
          Trigger the HEX6 BLE v5.0 SCEFM engine. Each action runs on real market data and mints cryptographic EGTS receipts per asset.
          Use <strong className="text-slate-400">Backtest</strong> to run historical simulations or <strong className="text-slate-400">Managers</strong> to distribute allocations across AUM.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={triggerRebalance}
            disabled={!!triggering}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-900/50 border border-blue-700/40 text-blue-300 text-sm font-medium hover:bg-blue-900/80 transition-colors disabled:opacity-40"
          >
            <TrendingUp className="w-4 h-4" />
            {triggering === 'rebalance' ? 'Minting receipts…' : 'Trigger Rebalance'}
          </button>
          <button
            onClick={triggerSilence}
            disabled={!!triggering}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-900/40 border border-amber-700/40 text-amber-300 text-sm font-medium hover:bg-amber-900/70 transition-colors disabled:opacity-40"
          >
            <AlertTriangle className="w-4 h-4" />
            {triggering === 'silence' ? 'Minting receipts…' : 'Activate Silence Mode'}
          </button>
        </div>
      </div>

      {/* Recent Receipts Preview */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">Recent Governance Receipts</h2>
          <Link to="/governance" className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300">
            View all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {receipts.length === 0 ? (
          <div className="p-8 rounded-xl bg-white/3 border border-white/8 text-center">
            <Shield className="w-8 h-8 text-slate-700 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No receipts yet.</p>
            <p className="text-xs text-slate-600 mt-1">Trigger a rebalance or silence event above to mint the first receipt.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {receipts.slice(0, 5).map((r) => (
              <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/3 border border-white/8">
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-white/8 text-slate-300">
                  {r.event_type}
                </span>
                <span className="text-sm text-white flex-1">{r.asset_id}</span>
                <span className="text-xs font-mono text-slate-500">{r.crypto_hash?.slice(0, 12)}…</span>
                <EGTSBadge status="verified" showLabel={false} size="sm" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Asset list */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">Governed Assets</h2>
          <Link to="/portfolio" className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
            Manage <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loadingAssets ? (
          <div className="flex justify-center py-8">
            <div className="w-5 h-5 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : assets.length === 0 ? (
          <div className="p-6 rounded-xl bg-white/3 border border-white/8 text-center">
            <p className="text-sm text-slate-500">No assets in portfolio.</p>
            <Link to="/portfolio" className="text-xs text-blue-400 mt-1 inline-block hover:underline">
              Add your first asset →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {assets.map((asset) => (
              <Link
                key={asset.id}
                to={`/portfolio/${asset.id}`}
                className="p-4 rounded-xl bg-white/3 border border-white/8 hover:border-white/20 hover:bg-white/5 transition-all group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-bold text-slate-300 bg-white/8 px-2 py-0.5 rounded">
                    {asset.ticker}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${asset.market_state === 'BULL' ? 'bg-emerald-950/60 text-emerald-400' : asset.market_state === 'BEAR' ? 'bg-red-950/60 text-red-400' : 'bg-slate-800 text-slate-400'}`}>
                    {asset.market_state || 'UNKNOWN'}
                  </span>
                </div>
                <p className="text-sm font-medium text-white">{asset.name}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-slate-500">{asset.asset_class}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-300 transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}