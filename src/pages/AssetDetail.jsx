import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, TrendingUp, AlertTriangle, Zap, Sparkles } from 'lucide-react';
import EGTSAuditTrail from '@/components/egts/EGTSAuditTrail';
import EGTSLegalPanel from '@/components/egts/EGTSLegalPanel';
import AssetAI from '@/components/asset/AssetAI';
import { onRebalance, onSilenceMode } from '@/services/hex6Engine';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'ai', label: '✦ AI' },
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
        <div className="w-6 h-6 border-2 border-white/10 border-t-[#C9A84C] rounded-full animate-spin" />
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="p-6 text-center space-y-2">
        <p className="text-white/30">Asset not found.</p>
        <Link to="/portfolio" className="text-[#C9A84C] text-sm hover:underline">← Back to Portfolio</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-12 space-y-8">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link to="/portfolio" className="p-2 rounded-lg border border-white/10 text-white/40 hover:text-white transition-colors mt-1">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-mono font-bold text-white border border-white/20 px-2.5 py-1 rounded">
              {asset.ticker}
            </span>
            <span className={cn(
              'text-xs px-2 py-0.5 rounded font-medium',
              asset.market_state === 'BULL' ? 'text-[#C9A84C]' :
              asset.market_state === 'BEAR' ? 'text-red-400' :
              'text-white/30'
            )}>
              {asset.market_state || 'UNKNOWN'}
            </span>
          </div>
          <h1 className="text-3xl font-bold text-white">{asset.name}</h1>
          <p className="text-sm text-white/30">{asset.asset_class}</p>
        </div>
      </div>

      {/* Engine Controls */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-[#111111] border border-white/10 rounded-xl">
        <div className="flex items-center gap-1.5 flex-1">
          <Zap className="w-3.5 h-3.5 text-[#C9A84C]" />
          <span className="text-xs text-white/30 font-mono">HEX6 Engine</span>
        </div>
        <button onClick={triggerRebalance} disabled={!!triggering}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#C9A84C]/50 text-[#C9A84C] text-xs font-medium hover:bg-[#C9A84C]/10 transition-colors disabled:opacity-40">
          <TrendingUp className="w-3.5 h-3.5" />
          {triggering === 'rebalance' ? 'Minting…' : 'Rebalance'}
        </button>
        <button onClick={triggerSilence} disabled={!!triggering}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-white/10 text-white/40 text-xs font-medium hover:text-white hover:border-white/30 transition-colors disabled:opacity-40">
          <AlertTriangle className="w-3.5 h-3.5" />
          {triggering === 'silence' ? 'Minting…' : 'Silence Mode'}
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-white/10 flex gap-8">
        {TABS.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={cn(
              'pb-3 text-sm font-medium border-b-2 transition-colors',
              activeTab === tab.id ? 'border-[#C9A84C] text-white' : 'border-transparent text-white/30 hover:text-white/60'
            )}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="min-h-64">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              <div key={label} className="p-4 bg-[#111111] border border-white/10 rounded-xl">
                <p className="text-xs text-white/30 uppercase tracking-widest mb-1">{label}</p>
                <p className="text-sm font-medium text-white">{value}</p>
              </div>
            ))}
            {asset.description && (
              <div className="sm:col-span-2 p-4 bg-[#111111] border border-white/10 rounded-xl">
                <p className="text-xs text-white/30 uppercase tracking-widest mb-1">Description</p>
                <p className="text-sm text-white/60">{asset.description}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'ai' && (
          <AssetAI
            asset={asset}
            onRebalance={triggerRebalance}
          />
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