import { Scale, FileText, Shield, AlertTriangle, ExternalLink } from 'lucide-react';
import EGTSBadge from './EGTSBadge';
import EGTSVerify from './EGTSVerify';

const LEGAL_DISCLOSURES = [
  {
    id: 'immutability',
    title: 'Immutability Guarantee',
    icon: Shield,
    content:
      'All EGTS governance receipts are written once and cannot be modified or deleted. Row-Level Security policies on the Supabase egts_receipts table enforce INSERT-only access. No UPDATE or DELETE operations are permitted.',
  },
  {
    id: 'cryptographic',
    title: 'Cryptographic Integrity',
    icon: FileText,
    content:
      'Each receipt is fingerprinted with a SHA-256 hash computed from the full payload at time of minting. Integrity can be verified at any time by recomputing the hash and comparing against the stored value.',
  },
  {
    id: 'governance',
    title: 'Governance Scope',
    icon: Scale,
    content:
      'The EGTS system records every portfolio governance decision — rebalances, silence events, and manual allocations — as a verifiable, timestamped receipt. These records constitute the authoritative audit trail for regulatory and compliance purposes.',
  },
  {
    id: 'disclaimer',
    title: 'Risk Disclaimer',
    icon: AlertTriangle,
    content:
      'This system does not constitute financial advice. Portfolio allocations produced by the HEX6 BLE engine are algorithmic in nature. Past performance does not guarantee future results. All investment decisions remain the responsibility of the portfolio manager.',
    isWarning: true,
  },
];

export default function EGTSLegalPanel({ assetId = null }) {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start gap-4 p-5 rounded-xl bg-gradient-to-r from-emerald-950/40 to-transparent border border-emerald-800/30">
        <Scale className="w-8 h-8 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-semibold text-white">Legal & Governance Framework</h3>
            <EGTSBadge status="verified" size="sm" />
          </div>
          <p className="text-sm text-slate-400">
            EGTS (Ethereum Governance & Transparency System) provides cryptographically verifiable,
            immutable audit trails for every portfolio governance decision.
            {assetId && ` Currently viewing: ${assetId}`}
          </p>
        </div>
      </div>

      {/* Disclosures */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-widest">
          Legal Disclosures
        </h4>
        {LEGAL_DISCLOSURES.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              className={`p-4 rounded-xl border ${
                item.isWarning
                  ? 'bg-amber-950/20 border-amber-700/30'
                  : 'bg-white/3 border-white/8'
              }`}
            >
              <div className="flex items-start gap-3">
                <Icon
                  className={`w-4 h-4 shrink-0 mt-0.5 ${
                    item.isWarning ? 'text-amber-400' : 'text-emerald-400'
                  }`}
                />
                <div>
                  <p className={`text-sm font-semibold mb-1 ${item.isWarning ? 'text-amber-300' : 'text-white'}`}>
                    {item.title}
                  </p>
                  <p className="text-sm text-slate-400 leading-relaxed">{item.content}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Schema Reference */}
      <div className="p-4 rounded-xl bg-black/30 border border-white/8">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-slate-300">Schema Reference</p>
          <span className="text-xs font-mono text-slate-600">002_egts_augment.sql</span>
        </div>
        <div className="space-y-1.5 text-xs font-mono">
          {[
            ['Table', 'egts_receipts'],
            ['Primary Key', 'UUID (gen_random_uuid)'],
            ['Hash Algorithm', 'SHA-256 (Web Crypto API)'],
            ['Schema Version', '1.0.0'],
            ['RLS Policy', 'INSERT + SELECT only'],
            ['Mutability', 'IMMUTABLE — no UPDATE/DELETE'],
          ].map(([key, val]) => (
            <div key={key} className="flex justify-between">
              <span className="text-slate-600">{key}</span>
              <span className="text-slate-300">{val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Verify Tool */}
      <div className="p-4 rounded-xl bg-white/3 border border-white/8">
        <EGTSVerify />
      </div>
    </div>
  );
}