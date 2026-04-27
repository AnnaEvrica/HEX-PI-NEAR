import { useState } from 'react';
import EGTSAuditTrail from '@/components/egts/EGTSAuditTrail';
import EGTSBadge from '@/components/egts/EGTSBadge';
import EGTSContractViewer from '@/components/egts/EGTSContractViewer';

export default function Governance() {
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-4xl font-bold text-white">Audit Trail</h1>
          <p className="text-sm text-white/40">Every governance decision, cryptographically sealed and permanently recorded.</p>
        </div>
        <EGTSBadge status="verified" size="lg" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: receipt list */}
        <div className="bg-[#111111] border border-white/10 rounded-xl p-6">
          <EGTSAuditTrail
            onSelectReceipt={setSelectedReceipt}
            selectedId={selectedReceipt?.id}
          />
        </div>

        {/* Right: contract viewer */}
        <div className="bg-[#111111] border border-white/10 rounded-xl p-6">
          {selectedReceipt ? (
            <EGTSContractViewer receipt={selectedReceipt} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full min-h-64 text-center space-y-3 py-16">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                <span className="text-2xl">📄</span>
              </div>
              <p className="text-white/30 text-sm">Select a receipt to view its full legal contract.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}