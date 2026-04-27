import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Plus, Trash2, ArrowRight, Activity } from 'lucide-react';
import EGTSBadge from '@/components/egts/EGTSBadge';

const ASSET_CLASSES = ['equity', 'crypto', 'fixed_income', 'commodity', 'fx', 'alternative'];
const MARKET_STATES = ['BULL', 'BEAR', 'LATERAL', 'VOLATILE', 'SILENCE'];

export default function Portfolio() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ticker: '', name: '', asset_class: 'equity', market_state: 'LATERAL' });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const data = await base44.entities.Asset.list('-created_date');
    setAssets(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(e) {
    e.preventDefault();
    setSaving(true);
    await base44.entities.Asset.create({ ...form, is_active: true });
    setForm({ ticker: '', name: '', asset_class: 'equity', market_state: 'LATERAL' });
    setShowForm(false);
    await load();
    setSaving(false);
  }

  async function handleDelete(id) {
    if (!confirm('Remove this asset from governance?')) return;
    await base44.entities.Asset.delete(id);
    await load();
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Portfolio</h1>
          <p className="text-sm text-slate-400 mt-1">Manage assets under HEX6 governance</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-900/50 border border-blue-700/40 text-blue-300 text-sm font-medium hover:bg-blue-900/80 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Asset
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleAdd} className="p-5 rounded-2xl bg-white/3 border border-white/10 space-y-4">
          <h3 className="text-sm font-semibold text-white">New Asset</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Ticker</label>
              <input
                required
                value={form.ticker}
                onChange={(e) => setForm({ ...form, ticker: e.target.value.toUpperCase() })}
                placeholder="BTC"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Name</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Bitcoin"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Asset Class</label>
              <select
                value={form.asset_class}
                onChange={(e) => setForm({ ...form, asset_class: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
              >
                {ASSET_CLASSES.map((c) => <option key={c} value={c} className="bg-slate-900">{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Initial Market State</label>
              <select
                value={form.market_state}
                onChange={(e) => setForm({ ...form, market_state: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
              >
                {MARKET_STATES.map((s) => <option key={s} value={s} className="bg-slate-900">{s}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-blue-700/60 text-blue-200 text-sm font-medium hover:bg-blue-700/80 transition-colors disabled:opacity-40"
            >
              {saving ? 'Adding…' : 'Add Asset'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg bg-white/5 text-slate-400 text-sm hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Assets list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : assets.length === 0 ? (
        <div className="py-20 text-center">
          <Activity className="w-10 h-10 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500">No assets yet. Add your first asset above.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {assets.map((asset) => (
            <div key={asset.id} className="flex items-center gap-3 p-4 rounded-xl bg-white/3 border border-white/8 hover:border-white/15 transition-colors group">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-mono font-bold text-white bg-white/10 px-2 py-0.5 rounded">
                    {asset.ticker}
                  </span>
                  <span className="text-xs text-slate-500">{asset.asset_class}</span>
                  <EGTSBadge status="verified" showLabel={false} size="sm" />
                </div>
                <p className="text-sm text-slate-300">{asset.name}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  asset.market_state === 'BULL' ? 'bg-emerald-950/60 text-emerald-400' :
                  asset.market_state === 'BEAR' ? 'bg-red-950/60 text-red-400' :
                  asset.market_state === 'SILENCE' ? 'bg-amber-950/60 text-amber-400' :
                  'bg-slate-800 text-slate-400'
                }`}>
                  {asset.market_state || '—'}
                </span>
                <Link
                  to={`/portfolio/${asset.id}`}
                  className="p-2 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-blue-900/20 transition-colors"
                >
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <button
                  onClick={() => handleDelete(asset.id)}
                  className="p-2 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-900/20 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}