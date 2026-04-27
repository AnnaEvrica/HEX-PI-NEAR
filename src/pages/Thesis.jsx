import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Sparkles, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export default function Thesis() {
  const [assets, setAssets] = useState([]);
  const [selectedTicker, setSelectedTicker] = useState('');
  const [thesis, setThesis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    base44.entities.Asset.list().then((data) => {
      setAssets(data);
      if (data.length > 0) setSelectedTicker(data[0].ticker);
    });
  }, []);

  async function generateThesis() {
    if (!selectedTicker) return;
    setLoading(true);
    setThesis(null);
    const asset = assets.find((a) => a.ticker === selectedTicker);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an institutional portfolio analyst using the HEX6 BLE v5.0 engine (State-Conditioned Exposure Field Model).

Generate a detailed investment thesis for: ${asset?.name || selectedTicker} (${selectedTicker})
Asset class: ${asset?.asset_class || 'unknown'}
Current market state: ${asset?.market_state || 'UNKNOWN'}
Current portfolio weight: ${asset?.current_weight != null ? (asset.current_weight * 100).toFixed(2) + '%' : 'not set'}
Target weight (HEX6): ${asset?.target_weight != null ? (asset.target_weight * 100).toFixed(2) + '%' : 'not set'}

Produce a structured, professional thesis covering:
1. Executive Summary
2. Macro & Market Context (use current real-world knowledge)
3. HEX6 Engine Signal Interpretation (based on the market state: ${asset?.market_state || 'UNKNOWN'})
4. Risk Factors & Tail Risks
5. Allocation Rationale
6. Recommended Action (Hold / Increase / Reduce / Silence)

Be concise but rigorous. Use markdown formatting.`,
      add_context_from_internet: true,
      response_json_schema: {
        type: 'object',
        properties: {
          executive_summary: { type: 'string' },
          macro_context: { type: 'string' },
          hex6_signal: { type: 'string' },
          risk_factors: { type: 'string' },
          allocation_rationale: { type: 'string' },
          recommended_action: { type: 'string' },
          action_label: { type: 'string', enum: ['HOLD', 'INCREASE', 'REDUCE', 'SILENCE'] },
          confidence: { type: 'number' },
        },
      },
    });
    setThesis(result);
    setLoading(false);
  }

  const ACTION_COLORS = {
    HOLD: 'text-white border-white/30',
    INCREASE: 'text-[#C9A84C] border-[#C9A84C]/50',
    REDUCE: 'text-red-400 border-red-800/50',
    SILENCE: 'text-white/30 border-white/10',
  };

  const SECTIONS = thesis
    ? [
        { key: 'executive_summary', label: 'Executive Summary' },
        { key: 'macro_context', label: 'Macro & Market Context' },
        { key: 'hex6_signal', label: 'HEX6 Signal Interpretation' },
        { key: 'risk_factors', label: 'Risk Factors & Tail Risks' },
        { key: 'allocation_rationale', label: 'Allocation Rationale' },
      ]
    : [];

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 space-y-10">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold text-white">AI Investment Thesis</h1>
        <p className="text-sm text-white/40">HEX6 BLE v5.0 · LLM-powered institutional thesis generation with live market context</p>
      </div>

      {/* Generator */}
      <div className="bg-[#111111] border border-white/10 rounded-xl p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#C9A84C]" />
          <h2 className="text-xs font-bold text-white/40 uppercase tracking-widest">Generate Thesis</h2>
        </div>

        <div className="flex gap-3">
          <select
            value={selectedTicker}
            onChange={(e) => setSelectedTicker(e.target.value)}
            className="flex-1 bg-black border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#C9A84C]/50"
          >
            {assets.map((a) => (
              <option key={a.ticker} value={a.ticker} className="bg-black">
                {a.ticker} — {a.name}
              </option>
            ))}
            {assets.length === 0 && <option value="">No assets — add via Portfolio</option>}
          </select>
          <button
            onClick={generateThesis}
            disabled={loading || !selectedTicker}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#C9A84C] text-black text-sm font-bold hover:bg-[#b8973d] transition-colors disabled:opacity-40"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? 'Generating…' : 'Generate'}
          </button>
        </div>

        {loading && (
          <div className="text-xs text-white/30 animate-pulse">
            Fetching live market data and generating institutional thesis…
          </div>
        )}
      </div>

      {/* Thesis Output */}
      {thesis && (
        <div className="space-y-4">
          {/* Recommended action */}
          <div className="flex items-center justify-between p-5 bg-[#111111] border border-white/10 rounded-xl">
            <div>
              <p className="text-xs text-white/30 uppercase tracking-widest mb-1">Recommended Action</p>
              <p className={`text-2xl font-bold font-mono border px-3 py-1 rounded inline-block ${ACTION_COLORS[thesis.action_label] || 'text-white border-white/20'}`}>
                {thesis.action_label || 'HOLD'}
              </p>
            </div>
            {thesis.confidence != null && (
              <div className="text-right">
                <p className="text-xs text-white/30 uppercase tracking-widest mb-1">Confidence</p>
                <p className="text-2xl font-bold text-[#C9A84C]">{Math.round(thesis.confidence * 100)}%</p>
              </div>
            )}
          </div>

          {/* Recommended action narrative */}
          {thesis.recommended_action && (
            <div className="p-5 bg-[#111111] border border-[#C9A84C]/20 rounded-xl">
              <p className="text-xs text-[#C9A84C]/60 uppercase tracking-widest mb-2">Analyst Commentary</p>
              <ReactMarkdown className="text-sm text-white/70 leading-relaxed prose prose-sm prose-invert max-w-none">
                {thesis.recommended_action}
              </ReactMarkdown>
            </div>
          )}

          {/* Collapsible sections */}
          {SECTIONS.map(({ key, label }) => (
            <div key={key} className="bg-[#111111] border border-white/10 rounded-xl overflow-hidden">
              <button
                onClick={() => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))}
                className="w-full flex items-center justify-between px-5 py-4 text-left"
              >
                <span className="text-sm font-medium text-white">{label}</span>
                {expanded[key] ? (
                  <ChevronUp className="w-4 h-4 text-white/30" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-white/30" />
                )}
              </button>
              {expanded[key] && (
                <div className="px-5 pb-5 border-t border-white/5">
                  <ReactMarkdown className="text-sm text-white/60 leading-relaxed prose prose-sm prose-invert max-w-none mt-4">
                    {thesis[key]}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          ))}

          {/* Regenerate */}
          <button
            onClick={generateThesis}
            className="flex items-center gap-2 text-sm text-white/30 hover:text-white/60 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Regenerate with latest data
          </button>
        </div>
      )}
    </div>
  );
}