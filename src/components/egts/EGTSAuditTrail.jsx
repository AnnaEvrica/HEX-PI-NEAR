import { useState, useEffect } from 'react';
import { RefreshCw, Filter, Download } from 'lucide-react';
import { getEgtsReceiptsForAsset, getAllEgtsReceipts } from '@/services/egtsService';
import EGTSReceiptCard from './EGTSReceiptCard';
import EGTSBadge from './EGTSBadge';
import { cn } from '@/lib/utils';

const EVENT_TYPES = ['ALL', 'REBALANCE', 'SILENCE', 'ALLOCATION', 'MANUAL'];

export default function EGTSAuditTrail({ assetId = null, onSelectReceipt = null, selectedId = null }) {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = assetId
        ? await getEgtsReceiptsForAsset(assetId)
        : await getAllEgtsReceipts();
      setReceipts(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [assetId]);

  const filtered = filter === 'ALL' ? receipts : receipts.filter((r) => r.event_type === filter);

  function exportJson() {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `egts-audit-${assetId || 'all'}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <EGTSBadge status="verified" size="sm" />
          <span className="text-sm text-slate-400">
            {filtered.length} receipt{filtered.length !== 1 ? 's' : ''}
            {assetId ? ` · ${assetId}` : ' · All Assets'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportJson}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md bg-white/5 border border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/8 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md bg-white/5 border border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/8 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 bg-white/3 rounded-lg p-1 w-fit">
        <Filter className="w-3.5 h-3.5 text-slate-600 ml-2" />
        {EVENT_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={cn(
              'text-xs px-3 py-1 rounded-md font-medium transition-colors',
              filter === type
                ? 'bg-white/10 text-white'
                : 'text-slate-500 hover:text-slate-300'
            )}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-slate-700 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-950/30 border border-red-700/40 text-sm text-red-400">
          Error loading receipts: {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
            <Filter className="w-5 h-5 text-slate-600" />
          </div>
          <p className="text-sm text-slate-500">No governance receipts yet</p>
          <p className="text-xs text-slate-600 mt-1">
            Receipts will appear here after the HEX6 engine triggers a rebalance or silence event.
          </p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((receipt) => (
            <div key={receipt.id} onClick={() => onSelectReceipt?.(receipt)}
              className={onSelectReceipt ? 'cursor-pointer' : ''}>
              <EGTSReceiptCard receipt={receipt} highlight={selectedId === receipt.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}