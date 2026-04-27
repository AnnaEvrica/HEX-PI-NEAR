import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Users, Plus, Trash2, DollarSign, TrendingUp, BarChart2, ChevronDown, ChevronUp } from 'lucide-react';

const RISK_PROFILES = ['conservative', 'moderate', 'aggressive'];

const RISK_COLORS = {
  conservative: 'border-white/20 text-white/50',
  moderate: 'border-[#C9A84C]/40 text-[#C9A84C]',
  aggressive: 'border-red-800/50 text-red-400',
};

function fmt(n) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toLocaleString()}`;
}

function ManagerCard({ manager, assets, receipts, onDelete }) {
  const [expanded, setExpanded] = useState(false);

  // Get latest allocations for this manager's assigned assets
  const assignedTickers = manager.assigned_assets || [];
  const latestAllocations = {};
  for (const ticker of assignedTickers) {
    const assetReceipts = receipts
      .filter((r) => r.asset_id === ticker && r.event_type === 'ALLOCATION')
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    if (assetReceipts[0]) {
      latestAllocations[ticker] = assetReceipts[0].allocation_data;
    }
  }

  // Risk-profile based AUM multiplier
  const riskMultiplier = manager.risk_profile === 'aggressive' ? 1.0
    : manager.risk_profile === 'conservative' ? 0.5 : 0.75;

  const totalAllocationPct = Object.values(latestAllocations).reduce(
    (s, a) => s + (a?.targetWeight || 0), 0
  ) * riskMultiplier;

  const deployedAum = manager.aum * Math.min(totalAllocationPct, 1);
  const cashAum = manager.aum - deployedAum;

  return (
    <div className="bg-[#111111] border border-white/10 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-5 flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg bg-[#C9A84C] flex items-center justify-center shrink-0 text-black font-bold text-sm">
          {manager.name?.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-white">{manager.name}</h3>
            <span className={`text-xs px-2 py-0.5 rounded border ${RISK_COLORS[manager.risk_profile]}`}>
              {manager.risk_profile}
            </span>
          </div>
          <p className="text-sm text-white/40">{manager.firm}</p>
          {manager.email && <p className="text-xs text-white/20 mt-0.5">{manager.email}</p>}
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold font-mono text-[#C9A84C]">{fmt(manager.aum)}</p>
          <p className="text-xs text-white/30">AUM</p>
        </div>
      </div>

      {/* AUM Distribution Bar */}
      <div className="px-5 pb-4">
        <div className="flex items-center justify-between text-xs text-white/30 mb-1.5">
          <span>Capital Deployment</span>
          <span className="text-white/60">{(Math.min(totalAllocationPct, 1) * 100).toFixed(1)}% deployed</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full bg-[#C9A84C] transition-all"
            style={{ width: `${Math.min(totalAllocationPct * 100, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs mt-1.5">
          <span className="text-[#C9A84C]">{fmt(deployedAum)} deployed</span>
          <span className="text-white/20">{fmt(cashAum)} cash</span>
        </div>
      </div>

      {/* Asset allocations */}
      {assignedTickers.length > 0 && (
        <div className="border-t border-white/10 px-5 py-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-xs text-white/40 hover:text-white/70 transition-colors w-full"
          >
            <BarChart2 className="w-3.5 h-3.5" />
            {assignedTickers.length} asset{assignedTickers.length !== 1 ? 's' : ''} assigned
            {expanded ? <ChevronUp className="w-3.5 h-3.5 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 ml-auto" />}
          </button>

          {expanded && (
            <div className="mt-3 space-y-2">
              {assignedTickers.map((ticker) => {
                const alloc = latestAllocations[ticker];
                const weight = (alloc?.targetWeight || 0) * riskMultiplier;
                const dollars = manager.aum * weight;
                return (
                  <div key={ticker} className="flex items-center gap-3">
                    <span className="text-xs font-mono font-bold text-white/60 w-16">{ticker}</span>
                    <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full rounded-full bg-[#C9A84C]" style={{ width: `${Math.min(weight * 100, 100)}%` }} />
                    </div>
                    <span className="text-xs font-mono text-white/40 w-14 text-right">{(weight * 100).toFixed(1)}%</span>
                    <span className="text-xs font-mono text-[#C9A84C] w-20 text-right">{fmt(dollars)}</span>
                  </div>
                );
              })}
              <div className="flex items-center gap-3 mt-2 pt-2 border-t border-white/5">
                <span className="text-xs font-mono font-bold text-white/20 w-16">CASH</span>
                <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full bg-white/20" style={{ width: `${Math.min((1 - Math.min(totalAllocationPct, 1)) * 100, 100)}%` }} />
                </div>
                <span className="text-xs font-mono text-white/20 w-14 text-right">{((1 - Math.min(totalAllocationPct, 1)) * 100).toFixed(1)}%</span>
                <span className="text-xs font-mono text-white/20 w-20 text-right">{fmt(cashAum)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-white/10 px-5 py-3 flex items-center justify-between">
        <span className="text-xs text-[#C9A84C]/60 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#C9A84C]" />EGTS Verified</span>
        <button onClick={() => onDelete(manager.id)}
          className="p-1.5 rounded text-white/20 hover:text-red-400 transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function Managers() {
  const [managers, setManagers] = useState([]);
  const [assets, setAssets] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', firm: '', aum: '', email: '',
    risk_profile: 'moderate', assigned_assets: [], notes: '',
  });

  async function load() {
    setLoading(true);
    const [mgrs, assts] = await Promise.all([
      base44.entities.Manager.list('-created_date'),
      base44.entities.Asset.list(),
    ]);
    setManagers(mgrs);
    setAssets(assts);

    // Load recent receipts for allocation display
    const res = await base44.functions.invoke('egtsProxy', { action: 'fetchAll' });
    setReceipts(res.data?.data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function toggleAsset(ticker) {
    setForm((prev) => ({
      ...prev,
      assigned_assets: prev.assigned_assets.includes(ticker)
        ? prev.assigned_assets.filter((t) => t !== ticker)
        : [...prev.assigned_assets, ticker],
    }));
  }

  async function handleAdd(e) {
    e.preventDefault();
    setSaving(true);
    await base44.entities.Manager.create({
      ...form,
      aum: parseFloat(form.aum),
      is_active: true,
    });
    setForm({ name: '', firm: '', aum: '', email: '', risk_profile: 'moderate', assigned_assets: [], notes: '' });
    setShowForm(false);
    await load();
    setSaving(false);
  }

  async function handleDelete(id) {
    if (!confirm('Remove this manager?')) return;
    await base44.entities.Manager.delete(id);
    await load();
  }

  const totalAUM = managers.reduce((s, m) => s + (m.aum || 0), 0);

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 space-y-10">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-4xl font-bold text-white">Manager Portal</h1>
          <p className="text-sm text-white/40">Fund manager AUM distribution · HEX6 allocation-driven capital deployment</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#C9A84C]/50 text-[#C9A84C] text-sm font-medium hover:bg-[#C9A84C]/10 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Manager
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 bg-[#111111] border border-white/10 rounded-xl">
          <Users className="w-4 h-4 text-[#C9A84C] mb-3" />
          <p className="text-3xl font-bold text-white">{managers.length}</p>
          <p className="text-xs text-white/30 mt-1">Active Managers</p>
        </div>
        <div className="p-5 bg-[#111111] border border-white/10 rounded-xl">
          <DollarSign className="w-4 h-4 text-[#C9A84C] mb-3" />
          <p className="text-3xl font-bold font-mono text-[#C9A84C]">{fmt(totalAUM)}</p>
          <p className="text-xs text-white/30 mt-1">Total AUM</p>
        </div>
        <div className="p-5 bg-[#111111] border border-white/10 rounded-xl">
          <TrendingUp className="w-4 h-4 text-[#C9A84C] mb-3" />
          <p className="text-3xl font-bold text-white">{assets.length}</p>
          <p className="text-xs text-white/30 mt-1">Governed Assets</p>
        </div>
      </div>

      {/* Add Manager Form */}
      {showForm && (
        <form onSubmit={handleAdd} className="bg-[#111111] border border-white/10 rounded-xl p-6 space-y-5">
          <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest">New Manager</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: 'Full Name', key: 'name', placeholder: 'Jane Smith', required: true },
              { label: 'Firm / Institution', key: 'firm', placeholder: 'BlackRock, Vanguard…', required: true },
              { label: 'Email', key: 'email', placeholder: 'jane@firm.com', type: 'email' },
              { label: 'Notes', key: 'notes', placeholder: 'Optional notes' },
            ].map(({ label, key, placeholder, required, type }) => (
              <div key={key}>
                <label className="text-xs text-white/30 uppercase tracking-widest block mb-1.5">{label}</label>
                <input required={required} type={type || 'text'} value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  placeholder={placeholder}
                  className="w-full bg-black border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#C9A84C]/50" />
              </div>
            ))}
            <div>
              <label className="text-xs text-white/30 uppercase tracking-widest block mb-1.5">AUM (USD)</label>
              <input required type="number" min="1000000" value={form.aum}
                onChange={(e) => setForm({ ...form, aum: e.target.value })}
                placeholder="100000000"
                className="w-full bg-black border border-white/10 rounded-lg px-3 py-2.5 text-sm font-mono text-white placeholder-white/20 focus:outline-none focus:border-[#C9A84C]/50" />
            </div>
            <div>
              <label className="text-xs text-white/30 uppercase tracking-widest block mb-1.5">Risk Profile</label>
              <select value={form.risk_profile} onChange={(e) => setForm({ ...form, risk_profile: e.target.value })}
                className="w-full bg-black border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#C9A84C]/50">
                {RISK_PROFILES.map((r) => <option key={r} value={r} className="bg-black">{r}</option>)}
              </select>
            </div>
          </div>

          {assets.length > 0 && (
            <div>
              <label className="text-xs text-white/30 uppercase tracking-widest block mb-2">Assign Assets</label>
              <div className="flex flex-wrap gap-2">
                {assets.map((a) => (
                  <button type="button" key={a.ticker} onClick={() => toggleAsset(a.ticker)}
                    className={`text-xs font-mono px-3 py-1.5 rounded-lg border transition-colors ${
                      form.assigned_assets.includes(a.ticker)
                        ? 'border-[#C9A84C] text-[#C9A84C] bg-[#C9A84C]/10'
                        : 'border-white/10 text-white/40 hover:text-white/70'
                    }`}>
                    {a.ticker}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button type="submit" disabled={saving}
              className="px-5 py-2.5 rounded-lg bg-[#C9A84C] text-black text-sm font-bold hover:bg-[#b8973d] transition-colors disabled:opacity-40">
              {saving ? 'Adding…' : 'Add Manager'}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-5 py-2.5 rounded-lg border border-white/10 text-white/40 text-sm hover:text-white transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Manager cards */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-white/10 border-t-[#C9A84C] rounded-full animate-spin" />
        </div>
      ) : managers.length === 0 ? (
        <div className="py-20 text-center space-y-2">
          <Users className="w-8 h-8 text-white/10 mx-auto" />
          <p className="text-white/30 text-sm">No managers yet.</p>
          <p className="text-xs text-white/20">Add fund managers to distribute HEX6 allocations across AUM.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {managers.map((m) => (
            <ManagerCard key={m.id} manager={m} assets={assets} receipts={receipts} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}