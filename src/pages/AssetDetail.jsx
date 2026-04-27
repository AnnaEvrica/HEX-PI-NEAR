import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, Activity, TrendingUp, AlertTriangle, Zap } from 'lucide-react';
import EGTSBadge from '@/components/egts/EGTSBadge';
import EGTSAuditTrail from '@/components/egts/EGTSAuditTrail';
import EGTSLegalPanel from '@/components/egts/EGTSLegalPanel';
import { onRebalance, onSilenceMode } from '@/services/hex6Engine';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'contracts', label: 'Contracts' },
  { id: 'legal', label: 'Legal' },
];

export default function AssetDetail() {
  const { id } = useParams();
  const [asset, setAsset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [triggering, setTriggering] = useState(null);

  useEffect(() => {
    base44.entities.Asset.list().then((all) => {
      const found = all.find((a) => a.id === id);
      setAsset(found || null);
      setLoading(false);
    });
  }, [id]);

  async function triggerRebalance() {
    if (!asset) return;
    setTriggering('rebalance');
    await onRebalance({
      assets: [asset.ticker],
      marketData: { volatility: 0.18, trend: 0.06 },
      triggeredBy: 'ASSET_DETAIL_MANUAL',
    });
    setTriggering(null);
    // Switch to contracts tab to see the new receipt
    setActiveTab('contracts');
  }

  async function triggerSilence() {
    if (!asset) return;
    setTriggering('silence');
    await onSilenceMode({
      assets: [asset.ticker],
      reason: 'MANUAL_SILENCE',
      triggeredBy: 'ASSET_DETAIL_MANUAL',
    });
    setTriggering(null);
    setActiveTab('contracts');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-6 h-6 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="p-6 text-center">
        <p className="text-slate-500">Asset not found.</p>
        <Link to="/portfolio" className="text-blue-400 text-sm mt-2 inline-block hover:underline">← Back to Portfolio</Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link to="/portfolio" className="p-2 rounded-lg bg-white/5 text-slate-500 hover:text-slate-200 transition-colors mt-1">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <span className="text-lg font-mono font-bold text-white bg-white/10 px-3 py-1 rounded-lg">
              {asset.ticker}
            </span>
            <span className={cn(
              'text-xs px-2.5 py-1 rounded-full font-medium',
              asset.market_state === 'BULL' ? 'bg-emerald-950/60 text-emerald-400' :
              asset.market_state === 'BEAR' ? 'bg-red-950/60 text-red-400' :
              asset.market_state === 'SILENCE' ? 'bg-amber-950/60 text-amber-400' :
              'bg-slate-800 text-slate-400'
            )}>
              {asset.market_state || 'UNKNOWN'}
            </span>
            <EGTSBadge status="verified" size="sm" />
          </div>
          <h1 className="text-2xl font-bold text-white">{asset.name}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{asset.asset_class}</p>
        </div>
      </div>

      {/* Engine Controls */}
      <div className="flex flex-wrap gap-2 p-4 rounded-xl bg-white/3 border border-white/8">
        <div className="flex items-center gap-1.5 mr-2">
          <Zap className="w-3.5 h-3.5 text-yellow-400" />
          <span className="text-xs text-slate-500 font-mono">HEX6 Engine</span>
        </div>
        <button
          onClick={triggerRebalance}
          disabled={!!triggering}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-900/40 border border-blue-700/30 text-blue-300 text-xs font-medium hover:bg-blue-900/70 transition-colors disabled:opacity-40"
        >
          <TrendingUp className="w-3.5 h-3.5" />
          {triggering === 'rebalance' ? 'Minting…' : 'Rebalance'}
        </button>
        <button
          onClick={triggerSilence}
          disabled={!!triggering}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-900/30 border border-amber-700/30 text-amber-300 text-xs font-medium hover:bg-amber-900/60 transition-colors disabled:opacity-40"
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          {triggering === 'silence' ? 'Minting…' : 'Silence Mode'}
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-white/8">
        <div className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'border-emerald-500 text-white'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="min-h-64">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              ['Ticker', asset.ticker],
              ['Full Name', asset.name],
              ['Asset Class', asset.asset_class],
              ['Market State', asset.market_state || '—'],
              ['Current Weight', asset.current_weight != null ? `${(asset.current_weight * 100).toFixed(2)}%` : '—'],
              ['Target Weight', asset.target_weight != null ? `${(asset.target_weight * 100).toFixed(2)}%` : '—'],
              ['Status', asset.is_active ? 'Active' : 'Inactive'],
              ['Last Rebalance', asset.last_rebalance ? new Date(asset.last_rebalance).toLocaleString() : '—'],
            ].map(([label, value]) => (
              <div key={label} className="p-4 rounded-xl bg-white/3 border border-white/8">
                <p className="text-xs text-slate-500 mb-1">{label}</p>
                <p className="text-sm font-medium text-white">{value}</p>
              </div>
            ))}
            {asset.description && (
              <div className="sm:col-span-2 p-4 rounded-xl bg-white/3 border border-white/8">
                <p className="text-xs text-slate-500 mb-1">Description</p>
                <p className="text-sm text-slate-300">{asset.description}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'contracts' && (
          <EGTSAuditTrail assetId={asset.ticker} />
        )}

        {activeTab === 'legal' && (
          <EGTSLegalPanel assetId={asset.ticker} />
        )}
      </div>
    </div>
  );
}