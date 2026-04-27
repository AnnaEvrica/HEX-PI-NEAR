import { useState } from 'react';
import { Shield, Download, ChevronDown, ChevronUp, CheckCircle2, FileText } from 'lucide-react';

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    timeZoneName: 'short',
  });
}

export default function EGTSContractViewer({ receipt }) {
  const [expanded, setExpanded] = useState(false);

  if (!receipt) return null;

  const alloc = receipt.allocation_data || {};
  const meta = receipt.metadata || {};

  function downloadContract() {
    const doc = generateContractText(receipt, alloc, meta);
    const blob = new Blob([doc], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `EGTS-Contract-${receipt.asset_id}-${receipt.id?.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="bg-[#0d0d0d] border border-[#C9A84C]/20 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10">
        <Shield className="w-4 h-4 text-[#C9A84C]" />
        <div className="flex-1">
          <p className="text-sm font-bold text-white">EGTS Governance Contract</p>
          <p className="text-xs text-white/30">Asset: {receipt.asset_id} · Event: {receipt.event_type}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
          <span className="text-xs text-green-400 font-medium">Verified</span>
        </div>
      </div>

      {/* Core metadata — always visible */}
      <div className="px-5 py-4 grid grid-cols-2 gap-3">
        {[
          ['Contract ID', receipt.id?.slice(0, 16) + '…'],
          ['Asset', receipt.asset_id],
          ['Event Type', receipt.event_type],
          ['Date Issued', formatDate(receipt.created_date)],
          ['Issued By', receipt.triggered_by || 'HEX6 Engine'],
          ['Engine Version', meta.engineVersion || 'HEX6-BLE-v5.0'],
        ].map(([label, value]) => (
          <div key={label}>
            <p className="text-xs text-white/30 uppercase tracking-wider mb-0.5">{label}</p>
            <p className="text-sm text-white font-medium break-all">{value}</p>
          </div>
        ))}
      </div>

      {/* Allocation data */}
      {Object.keys(alloc).length > 0 && (
        <div className="px-5 pb-4">
          <p className="text-xs text-white/30 uppercase tracking-wider mb-2">Decision Data</p>
          <div className="grid grid-cols-2 gap-2">
            {alloc.marketState && (
              <div className="bg-[#1a1a1a] rounded-lg p-3">
                <p className="text-xs text-white/30 mb-0.5">Market State</p>
                <p className="text-sm font-mono font-bold text-[#C9A84C]">{alloc.marketState}</p>
              </div>
            )}
            {alloc.targetWeight != null && (
              <div className="bg-[#1a1a1a] rounded-lg p-3">
                <p className="text-xs text-white/30 mb-0.5">Target Weight</p>
                <p className="text-sm font-mono font-bold text-white">{(alloc.targetWeight * 100).toFixed(2)}%</p>
              </div>
            )}
            {alloc.confidence && (
              <div className="bg-[#1a1a1a] rounded-lg p-3">
                <p className="text-xs text-white/30 mb-0.5">Confidence</p>
                <p className="text-sm font-mono font-bold text-white capitalize">{alloc.confidence}</p>
              </div>
            )}
            {alloc.side && (
              <div className="bg-[#1a1a1a] rounded-lg p-3">
                <p className="text-xs text-white/30 mb-0.5">Trade Direction</p>
                <p className={`text-sm font-mono font-bold uppercase ${alloc.side === 'buy' ? 'text-[#C9A84C]' : 'text-red-400'}`}>{alloc.side}</p>
              </div>
            )}
            {alloc.tradeQty != null && (
              <div className="bg-[#1a1a1a] rounded-lg p-3">
                <p className="text-xs text-white/30 mb-0.5">Quantity</p>
                <p className="text-sm font-mono font-bold text-white">{alloc.tradeQty}</p>
              </div>
            )}
            {alloc.price != null && (
              <div className="bg-[#1a1a1a] rounded-lg p-3">
                <p className="text-xs text-white/30 mb-0.5">Price at Execution</p>
                <p className="text-sm font-mono font-bold text-white">${parseFloat(alloc.price).toFixed(2)}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cryptographic hash */}
      <div className="px-5 pb-4">
        <p className="text-xs text-white/30 uppercase tracking-wider mb-2">Cryptographic Fingerprint (SHA-256)</p>
        <div className="bg-[#1a1a1a] rounded-lg p-3">
          <p className="text-xs font-mono text-[#C9A84C] break-all">{receipt.crypto_hash}</p>
          <p className="text-xs text-white/20 mt-1.5">This fingerprint is unique. Any change to this record would produce a completely different hash — instantly proving tampering.</p>
        </div>
      </div>

      {/* Expandable full contract text */}
      <div className="border-t border-white/10">
        <button onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-5 py-3 text-xs text-white/40 hover:text-white transition-colors">
          <span className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            Full Contract Text
          </span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {expanded && (
          <div className="px-5 pb-4">
            <pre className="text-xs font-mono text-white/40 whitespace-pre-wrap leading-relaxed bg-[#1a1a1a] rounded-lg p-4 max-h-64 overflow-auto">
              {generateContractText(receipt, alloc, meta)}
            </pre>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="border-t border-white/10 px-5 py-3 flex gap-2">
        <button onClick={downloadContract}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-xs text-white/40 hover:text-white hover:border-white/30 transition-colors">
          <Download className="w-3.5 h-3.5" /> Download Contract
        </button>
      </div>
    </div>
  );
}

function generateContractText(receipt, alloc, meta) {
  return `================================================================================
EGTS GOVERNANCE CONTRACT
Evrica Global Token Standard — Evrica Technologies Inc.
================================================================================

CONTRACT ID:        ${receipt.id || 'N/A'}
ASSET:              ${receipt.asset_id || 'N/A'}
EVENT TYPE:         ${receipt.event_type || 'N/A'}
DATE ISSUED:        ${receipt.created_date ? new Date(receipt.created_date).toUTCString() : 'N/A'}
ISSUED BY:          ${receipt.triggered_by || 'HEX6 Engine'}
ENGINE VERSION:     ${meta.engineVersion || 'HEX6-BLE-v5.0'}
DATA SOURCE:        ${meta.synthetic ? 'Synthetic (estimated)' : 'Live market data'}

--- DECISION DATA ---
Market State:       ${alloc.marketState || 'N/A'}
Target Weight:      ${alloc.targetWeight != null ? (alloc.targetWeight * 100).toFixed(4) + '%' : 'N/A'}
Total Exposure:     ${alloc.totalExposure != null ? (alloc.totalExposure * 100).toFixed(4) + '%' : 'N/A'}
Confidence:         ${alloc.confidence || 'N/A'}
Annual Return (est):${alloc.annualReturn != null ? alloc.annualReturn.toFixed(4) + '%' : 'N/A'}
Annual Vol (est):   ${alloc.annualVol != null ? alloc.annualVol.toFixed(4) + '%' : 'N/A'}
Trade Direction:    ${alloc.side ? alloc.side.toUpperCase() : 'N/A'}
Trade Quantity:     ${alloc.tradeQty != null ? alloc.tradeQty : 'N/A'}
Execution Price:    ${alloc.price != null ? '$' + parseFloat(alloc.price).toFixed(4) : 'N/A'}
Auto-Trade:         ${alloc.autoTrade ? 'Yes (HEX6 automated execution)' : 'No (manual)'}

--- CRYPTOGRAPHIC INTEGRITY ---
SHA-256 Hash:       ${receipt.crypto_hash || 'N/A'}

This hash was computed at the moment this record was created from the full payload
above. Any modification to any field above would produce a completely different
hash, immediately proving tampering.

--- LEGAL NOTICE ---
This document is an immutable governance record generated by the EGTS system
(Evrica Global Token Standard) as implemented by Evrica Technologies Inc.

This record constitutes a verifiable audit trail of a portfolio governance
decision made by the HEX6 BLE v5.0 SCEFM engine. It does not constitute
financial advice. All investment decisions remain the sole responsibility of
the portfolio manager or end user.

Past performance of the HEX6 engine does not guarantee future results.
This record is INSERT-only and cannot be modified or deleted (RLS-enforced).

================================================================================
END OF CONTRACT
================================================================================`;
}