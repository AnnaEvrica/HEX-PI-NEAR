import EGTSAuditTrail from '@/components/egts/EGTSAuditTrail';

export default function Governance() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12 space-y-8">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold text-white">Governance Audit Trail</h1>
        <p className="text-sm text-white/40">Immutable, cryptographically verifiable record of all portfolio governance decisions.</p>
      </div>

      <div className="bg-[#111111] border border-white/10 rounded-xl p-6">
        <EGTSAuditTrail />
      </div>
    </div>
  );
}