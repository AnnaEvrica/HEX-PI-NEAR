import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Plus, Trash2, ArrowRight, Activity } from 'lucide-react';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import PullToRefresh from '@/components/mobile/PullToRefresh';

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

  const { containerRef, isRefreshing, pullDistance } = usePullToRefresh(load);

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
    <div ref={containerRef} className="max-w-3xl mx-auto px-6 py-12 space-y-10">
      <PullToRefresh isRefreshing={isRefreshing} pullDistance={pullDistance} />
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <h1 className="text-4xl font-bold text-white">Portfolio</h1>
          <p className="text-sm text-white/40">Manage assets under HEX6 governance</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#C9A84C]/50 text-[#C9A84C] text-sm font-medium hover:bg-[#C9A84C]/10 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Asset
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-[#111111] border border-white/10 rounded-xl p-6 space-y-5">
          <h3 className="text-sm font-bold text-white uppercase tracking-widest">New Asset</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: 'Ticker', key: 'ticker', placeholder: 'BTC', mono: true, transform: (v) => v.toUpperCase() },
              { label: 'Name', key: 'name', placeholder: 'Bitcoin' },
            ].map(({ label, key, placeholder, mono, transform }) => (
              <div key={key}>
                <label className="text-xs text-white/40 block mb-1.5 uppercase tracking-widest">{label}</label>
                <input
                  required
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: transform ? transform(e.target.value) : e.target.value })}
                  placeholder={placeholder}
                  className={`w-full bg-black border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#C9A84C]/50 ${mono ? 'font-mono' : ''}`}
                />
              </div>
            ))}
            <div>
              <label className="text-xs text-white/40 block mb-1.5 uppercase tracking-widest">Asset Class</label>
              <select value={form.asset_class} onChange={(e) => setForm({ ...form, asset_class: e.target.value })}
                className="w-full bg-black border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#C9A84C]/50">
                {ASSET_CLASSES.map((c) => <option key={c} value={c} className="bg-black">{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-white/40 block mb-1.5 uppercase tracking-widest">Market State</label>
              <select value={form.market_state} onChange={(e) => setForm({ ...form, market_state: e.target.value })}
                className="w-full bg-black border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#C9A84C]/50">
                {MARKET_STATES.map((s) => <option key={s} value={s} className="bg-black">{s}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={saving}
              className="px-5 py-2.5 rounded-lg bg-[#C9A84C] text-black text-sm font-bold hover:bg-[#b8973d] transition-colors disabled:opacity-40">
              {saving ? 'Adding…' : 'Add Asset'}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-5 py-2.5 rounded-lg border border-white/10 text-white/40 text-sm hover:text-white transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-white/10 border-t-[#C9A84C] rounded-full animate-spin" />
        </div>
      ) : assets.length === 0 ? (
        <div className="py-20 text-center space-y-2">
          <Activity className="w-8 h-8 text-white/10 mx-auto" />
          <p className="text-white/30 text-sm">No assets yet. Add your first asset above.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {assets.map((asset) => (
            <div key={asset.id} className="flex items-center gap-4 px-5 py-4 bg-[#111111] border border-white/10 rounded-xl hover:border-white/20 transition-colors group">
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-white">{asset.ticker}</span>
                  <span className="text-xs text-white/30">{asset.asset_class}</span>
                </div>
                <p className="text-sm text-white/70">{asset.name}</p>
              </div>
              <span className={`text-xs font-medium px-2 py-1 rounded ${
                asset.market_state === 'BULL' ? 'text-[#C9A84C]' :
                asset.market_state === 'BEAR' ? 'text-red-400' : 'text-white/30'
              }`}>{asset.market_state || '—'}</span>
              <Link to={`/portfolio/${asset.id}`}
                className="p-2 rounded-lg text-white/20 hover:text-[#C9A84C] transition-colors">
                <ArrowRight className="w-4 h-4" />
              </Link>
              <button onClick={() => handleDelete(asset.id)}
                className="p-2 rounded-lg text-white/20 hover:text-red-400 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}