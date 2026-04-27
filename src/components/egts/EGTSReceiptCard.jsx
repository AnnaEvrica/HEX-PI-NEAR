import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Hash, Clock, User, Activity, CheckCircle2, AlertTriangle } from 'lucide-react';
import EGTSBadge from './EGTSBadge';
import { verifyEgtsReceipt } from '@/services/egtsService';
import { cn } from '@/lib/utils';

const EVENT_COLORS = {
  REBALANCE: 'text-blue-400 bg-blue-950/40 border-blue-700/30',
  SILENCE: 'text-amber-400 bg-amber-950/40 border-amber-700/30',
  ALLOCATION: 'text-violet-400 bg-violet-950/40 border-violet-700/30',
  MANUAL: 'text-slate-400 bg-slate-800/40 border-slate-600/30',
};

export default function EGTSReceiptCard({ receipt }) {
  const [expanded, setExpanded] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifying, setVerifying] = useState(false);

  const eventColor = EVENT_COLORS[receipt.event_type] || EVENT_COLORS.MANUAL;

  async function handleVerify() {
    setVerifying(true);
    const result = await verifyEgtsReceipt(receipt);
    setVerifyResult(result);
    setVerifying(false);
  }

  const shortHash = receipt.crypto_hash
    ? `${receipt.crypto_hash.slice(0, 8)}...${receipt.crypto_hash.slice(-6)}`
    : 'N/A';

  return (
    <motion.div
      layout
      className="rounded-xl border border-white/8 bg-white/3 backdrop-blur-sm overflow-hidden hover:border-white/15 transition-colors"
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 text-left"
      >
        <span className={cn('text-xs font-mono font-semibold px-2.5 py-1 rounded-md border', eventColor)}>
          {receipt.event_type}
        </span>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{receipt.asset_id}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <Hash className="w-3 h-3 text-slate-500" />
            <span className="text-xs font-mono text-slate-500">{shortHash}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-xs text-slate-400">
              {new Date(receipt.timestamp).toLocaleDateString()}
            </p>
            <p className="text-xs text-slate-600">
              {new Date(receipt.timestamp).toLocaleTimeString()}
            </p>
          </div>
          <EGTSBadge status={receipt.is_verified ? 'verified' : 'failed'} showLabel={false} size="sm" />
          <ChevronDown
            className={cn('w-4 h-4 text-slate-500 transition-transform', expanded && 'rotate-180')}
          />
        </div>
      </button>

      {/* Expanded Detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4 border-t border-white/8 pt-4">
              {/* Meta row */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-white/3 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span className="text-xs text-slate-500">Timestamp</span>
                  </div>
                  <p className="text-xs font-mono text-slate-200">
                    {new Date(receipt.timestamp).toISOString()}
                  </p>
                </div>
                <div className="bg-white/3 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <User className="w-3 h-3 text-slate-500" />
                    <span className="text-xs text-slate-500">Triggered By</span>
                  </div>
                  <p className="text-xs font-mono text-slate-200">{receipt.triggered_by}</p>
                </div>
                <div className="bg-white/3 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Activity className="w-3 h-3 text-slate-500" />
                    <span className="text-xs text-slate-500">Market State</span>
                  </div>
                  <p className="text-xs font-mono text-slate-200">
                    {receipt.allocation_data?.marketState || '—'}
                  </p>
                </div>
              </div>

              {/* Allocation data */}
              {receipt.allocation_data && (
                <div className="bg-white/3 rounded-lg p-3">
                  <p className="text-xs text-slate-500 mb-2">Allocation Data</p>
                  <pre className="text-xs font-mono text-slate-300 overflow-auto max-h-32">
                    {JSON.stringify(receipt.allocation_data, null, 2)}
                  </pre>
                </div>
              )}

              {/* Crypto hash */}
              <div className="bg-black/30 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">Cryptographic Hash (SHA-256)</p>
                <p className="text-xs font-mono text-emerald-400 break-all">{receipt.crypto_hash}</p>
              </div>

              {/* Verify button & result */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleVerify}
                  disabled={verifying}
                  className="text-xs px-3 py-1.5 rounded-md bg-emerald-900/40 border border-emerald-700/50 text-emerald-300 hover:bg-emerald-900/70 transition-colors disabled:opacity-50"
                >
                  {verifying ? 'Verifying…' : 'Verify Integrity'}
                </button>

                {verifyResult && (
                  <div className={cn('flex items-center gap-1.5 text-xs font-medium', verifyResult.isValid ? 'text-emerald-400' : 'text-red-400')}>
                    {verifyResult.isValid ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                    {verifyResult.isValid ? 'Integrity verified — hash matches' : 'INTEGRITY FAILURE — hash mismatch'}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}