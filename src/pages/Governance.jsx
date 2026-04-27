import { Shield } from 'lucide-react';
import EGTSAuditTrail from '@/components/egts/EGTSAuditTrail';
import EGTSBadge from '@/components/egts/EGTSBadge';

export default function Governance() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Governance Audit Trail</h1>
          <p className="text-sm text-slate-400 mt-1">
            Immutable, cryptographically verifiable record of all portfolio governance decisions.
          </p>
        </div>
        <EGTSBadge status="verified" size="lg" />
      </div>

      <div className="p-5 rounded-2xl bg-white/3 border border-white/8">
        <EGTSAuditTrail />
      </div>
    </div>
  );
}