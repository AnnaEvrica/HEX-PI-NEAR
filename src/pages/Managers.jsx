import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Users, Plus, Trash2, DollarSign, TrendingUp, BarChart2, ChevronDown, ChevronUp } from 'lucide-react';
import EGTSBadge from '@/components/egts/EGTSBadge';

const RISK_PROFILES = ['conservative', 'moderate', 'aggressive'];

const RISK_COLORS = {
  conservative: 'bg-blue-950/60 text-blue-300 border-blue-700/40',
  moderate: 'bg-violet-950/60 text-violet-300 border-violet-700/40',
  aggressive: 'bg-red-950/60 text-red-300 border-red-700/40',
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
    <div className="rounded-2xl bg-white/3 border border-white/8 overflow-hidden">
      {/* Header */}
      <div className="p-5 flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center shrink-0 text-white font-bold text-sm">
          {manager.name?.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-white">{manager.name}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full border ${RISK_COLORS[manager.risk_profile]}`}>
              {manager.risk_profile}
            </span>
          </div>
          <p className="text-sm text-slate-400">{manager.firm}</p>
          {manager.email && <p className="text-xs text-slate-600 mt-0.5">{manager.email}</p>}
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold font-mono text-white">{fmt(manager.aum)}</p>
          <p className="text-xs text-slate-500">AUM</p>
        </div>
      </div>

      {/* AUM Distribution Bar */}
      <div className="px-5 pb-4">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
          <span>Capital Deployment</span>
          <span className="text-slate-300">{(Math.min(totalAllocationPct, 1) * 100).toFixed(1)}% deployed</span>
        </div>
        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-blue-500 transition-all"
            style={{ width: `${Math.min(totalAllocationPct * 100, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs mt-1">
          <span className="text-emerald-400">{fmt(deployedAum)} deployed</span>
          <span className="text-slate-600">{fmt(cashAum)} cash</span>
        </div>
      </div>

      {/* Asset allocations */}
      {assignedTickers.length > 0 && (
        <div className="border-t border-white/8 px-5 py-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
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
                    <span className="text-xs font-mono font-bold text-slate-300 w-16">{ticker}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500"
                        style={{ width: `${Math.min(weight * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono text-slate-400 w-14 text-right">
                      {(weight * 100).toFixed(1)}%
                    </span>
                    <span className="text-xs font-mono text-emerald-400 w-20 text-right">
                      {fmt(dollars)}
                    </span>
                  </div>
                );
              })}
              <div className="flex items-center gap-3 mt-2 pt-2 border-t border-white/5">
                <span className="text-xs font-mono font-bold text-slate-400 w-16">CASH</span>
                <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-slate-700"
                    style={{ width: `${Math.min((1 - Math.min(totalAllocationPct, 1)) * 100, 100)}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-slate-500 w-14 text-right">
                  {((1 - Math.min(totalAllocationPct, 1)) * 100).toFixed(1)}%
                </span>
                <span className="text-xs font-mono text-slate-500 w-20 text-right">{fmt(cashAum)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-white/8 px-5 py-3 flex items-center justify-between">
        <EGTSBadge status="verified" size="sm" showLabel={false} />
        <button
          onClick={() => onDelete(manager.id)}
          className="p-1.5 rounded-lg text-slate-700 hover:text-red-400 hover:bg-red-900/20 transition-colors"
        >
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
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Manager Portal</h1>
          <p className="text-sm text-slate-400 mt-1">
            Fund manager AUM distribution · HEX6 allocation-driven capital deployment
          </p>
        </div>
        <div className="flex items-center gap-3">
          <EGTSBadge status="verified" size="lg" />
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-900/50 border border-violet-700/40 text-violet-300 text-sm font-medium hover:bg-violet-900/80 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Manager
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-white/3 border border-white/8">
          <Users className="w-4 h-4 text-violet-400 mb-2" />
          <p className="text-2xl font-bold text-white">{managers.length}</p>
          <p className="text-xs text-slate-500">Active Managers</p>
        </div>
        <div className="p-4 rounded-xl bg-white/3 border border-white/8">
          <DollarSign className="w-4 h-4 text-emerald-400 mb-2" />
          <p className="text-2xl font-bold font-mono text-white">{fmt(totalAUM)}</p>
          <p className="text-xs text-slate-500">Total AUM</p>
        </div>
        <div className="p-4 rounded-xl bg-white/3 border border-white/8">
          <TrendingUp className="w-4 h-4 text-blue-400 mb-2" />
          <p className="text-2xl font-bold text-white">{assets.length}</p>
          <p className="text-xs text-slate-500">Governed Assets</p>
        </div>
      </div>

      {/* Add Manager Form */}
      {showForm && (
        <form onSubmit={handleAdd} className="p-5 rounded-2xl bg-white/3 border border-white/10 space-y-4">
          <h3 className="text-sm font-semibold text-white">New Manager</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Full Name</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Jane Smith"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500/50" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Firm / Institution</label>
              <input required value={form.firm} onChange={(e) => setForm({ ...form, firm: e.target.value })}
                placeholder="BlackRock, Vanguard…"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500/50" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">AUM (USD)</label>
              <input required type="number" min="1000000" value={form.aum}
                onChange={(e) => setForm({ ...form, aum: e.target.value })}
                placeholder="100000000"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono text-white placeholder-slate-600 focus:outline-none focus:border-violet-500/50" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="jane@firm.com"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500/50" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Risk Profile</label>
              <select value={form.risk_profile} onChange={(e) => setForm({ ...form, risk_profile: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50">
                {RISK_PROFILES.map((r) => <option key={r} value={r} className="bg-slate-900">{r}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Notes</label>
              <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Optional notes"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500/50" />
            </div>
          </div>

          {/* Assign assets */}
          {assets.length > 0 && (
            <div>
              <label className="text-xs text-slate-400 block mb-2">Assign Assets</label>
              <div className="flex flex-wrap gap-2">
                {assets.map((a) => (
                  <button type="button" key={a.ticker} onClick={() => toggleAsset(a.ticker)}
                    className={`text-xs font-mono px-3 py-1.5 rounded-lg border transition-colors ${
                      form.assigned_assets.includes(a.ticker)
                        ? 'bg-violet-900/60 border-violet-600/50 text-violet-200'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
                    }`}>
                    {a.ticker}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button type="submit" disabled={saving}
              className="px-4 py-2 rounded-lg bg-violet-700/60 text-violet-200 text-sm font-medium hover:bg-violet-700/80 transition-colors disabled:opacity-40">
              {saving ? 'Adding…' : 'Add Manager'}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg bg-white/5 text-slate-400 text-sm hover:text-slate-200 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Manager cards */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-slate-700 border-t-violet-500 rounded-full animate-spin" />
        </div>
      ) : managers.length === 0 ? (
        <div className="py-20 text-center">
          <Users className="w-10 h-10 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500">No managers yet.</p>
          <p className="text-xs text-slate-600 mt-1">Add fund managers to distribute HEX6 allocations across AUM.</p>
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