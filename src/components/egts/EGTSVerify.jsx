import { useState } from 'react';
import { Shield, ShieldCheck, ShieldAlert, Search } from 'lucide-react';
import { verifyEgtsReceipt, getAllEgtsReceipts } from '@/services/egtsService';
import { cn } from '@/lib/utils';

export default function EGTSVerify() {
  const [hashInput, setHashInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function handleVerify(e) {
    e.preventDefault();
    if (!hashInput.trim()) return;

    setVerifying(true);
    setResult(null);
    setError(null);

    try {
      const receipts = await getAllEgtsReceipts();
      const found = receipts.find((r) => r.crypto_hash === hashInput.trim());

      if (!found) {
        setError('No receipt found with that hash. The record may not exist or has been tampered with.');
      } else {
        const verification = await verifyEgtsReceipt(found);
        setResult({ receipt: found, verification });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-white mb-1">Cryptographic Verification</h3>
        <p className="text-sm text-slate-400">
          Paste a SHA-256 hash to verify the integrity of any EGTS governance receipt.
        </p>
      </div>

      <form onSubmit={handleVerify} className="flex gap-2">
        <input
          type="text"
          value={hashInput}
          onChange={(e) => setHashInput(e.target.value)}
          placeholder="SHA-256 hash (64 hex characters)"
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
        />
        <button
          type="submit"
          disabled={verifying || !hashInput.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-800/50 border border-emerald-600/40 text-emerald-300 text-sm font-medium hover:bg-emerald-800/80 transition-colors disabled:opacity-40"
        >
          <Search className="w-4 h-4" />
          {verifying ? 'Verifying…' : 'Verify'}
        </button>
      </form>

      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-950/30 border border-red-700/40">
          <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-300">Verification Failed</p>
            <p className="text-xs text-red-400/80 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {result && (
        <div className={cn(
          'p-4 rounded-xl border',
          result.verification.isValid
            ? 'bg-emerald-950/30 border-emerald-700/40'
            : 'bg-red-950/30 border-red-700/40'
        )}>
          <div className="flex items-center gap-3 mb-4">
            {result.verification.isValid
              ? <ShieldCheck className="w-6 h-6 text-emerald-400" />
              : <ShieldAlert className="w-6 h-6 text-red-400" />}
            <div>
              <p className={cn('font-semibold', result.verification.isValid ? 'text-emerald-300' : 'text-red-300')}>
                {result.verification.isValid ? 'Receipt Integrity Confirmed' : 'INTEGRITY VIOLATION DETECTED'}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Asset: {result.receipt.asset_id} · Event: {result.receipt.event_type}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Stored Hash</span>
              <span className="font-mono text-slate-300">{result.verification.storedHash?.slice(0, 16)}…</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Recomputed Hash</span>
              <span className="font-mono text-slate-300">{result.verification.recomputedHash?.slice(0, 16)}…</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Match</span>
              <span className={result.verification.isValid ? 'text-emerald-400' : 'text-red-400'}>
                {result.verification.isValid ? '✓ PASS' : '✗ FAIL'}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Timestamp</span>
              <span className="font-mono text-slate-300">{new Date(result.receipt.timestamp).toISOString()}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}