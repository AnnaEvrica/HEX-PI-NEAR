import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Sparkles, TrendingUp, TrendingDown, Shield, ChevronRight, RefreshCw, CheckCircle2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const STEPS = ['predict', 'trade', 'receipt'];

export default function AssetAI({ asset, onRebalance, triggering }) {
  const [step, setStep] = useState('predict');
  const [prediction, setPrediction] = useState(null);
  const [loadingPrediction, setLoadingPrediction] = useState(false);
  const [tradeDecision, setTradeDecision] = useState(null); // 'buy' | 'sell' | 'hold'
  const [tradeQty, setTradeQty] = useState('1');
  const [submitting, setSubmitting] = useState(false);
  const [tradeResult, setTradeResult] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);

  async function generatePrediction() {
    setLoadingPrediction(true);
    setPrediction(null);
    try {
      const prompt = `
You are a friendly financial guide explaining things in plain English to someone who may not know much about investing.

Analyze this asset and give a prediction:
- Ticker: ${asset.ticker}
- Full Name: ${asset.name}
- Asset Class: ${asset.asset_class}
- Current Market State: ${asset.market_state || 'UNKNOWN'} (BULL means prices are going up, BEAR means going down, LATERAL means sideways, VOLATILE means unpredictable, SILENCE means paused)
- Current Portfolio Weight: ${asset.current_weight != null ? (asset.current_weight * 100).toFixed(2) + '%' : 'Not set'}
- Target Weight from our engine: ${asset.target_weight != null ? (asset.target_weight * 100).toFixed(2) + '%' : 'Not set'}
- Description: ${asset.description || 'No description'}

The HEX6 engine is a smart computer program that watches market patterns and decides how much of each asset to hold.

Please respond in this exact JSON format:
{
  "direction": "buy" | "sell" | "hold",
  "confidence": "high" | "medium" | "low",
  "simple_verdict": "One plain English sentence saying what to do and why (e.g. 'This looks like a good time to buy a small amount because the market is trending up.')",
  "reasoning": "3-4 sentences in plain English explaining WHY. No jargon. Use everyday language. Mention what the market state means and what the engine is suggesting.",
  "risk_note": "One plain English sentence about the main risk to be aware of.",
  "what_happens_next": "One sentence explaining what the user should watch for."
}
`.trim();

      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            direction: { type: 'string' },
            confidence: { type: 'string' },
            simple_verdict: { type: 'string' },
            reasoning: { type: 'string' },
            risk_note: { type: 'string' },
            what_happens_next: { type: 'string' },
          },
        },
      });
      setPrediction(res);
      setTradeDecision(res.direction === 'hold' ? null : res.direction);
    } catch (err) {
      setPrediction({ error: err.message });
    } finally {
      setLoadingPrediction(false);
    }
  }

  async function executeTrade() {
    if (!tradeDecision || !tradeQty) return;
    setSubmitting(true);
    setTradeResult(null);
    try {
      const res = await base44.functions.invoke('alpacaTrading', {
        action: 'placeOrder',
        symbol: asset.ticker,
        qty: parseFloat(tradeQty),
        side: tradeDecision,
        type: 'market',
      });
      if (res.data?.error) throw new Error(res.data.error);
      setTradeResult({ success: true, order: res.data?.order });
      setStep('receipt');
      // Also trigger EGTS rebalance receipt
      setLoadingReceipt(true);
      await onRebalance();
      // Fetch latest receipt
      const egtsRes = await base44.functions.invoke('egtsProxy', { action: 'fetchByAsset', assetId: asset.ticker });
      const receipts = egtsRes.data?.data || [];
      setReceipt(receipts[0] || null);
      setLoadingReceipt(false);
    } catch (err) {
      setTradeResult({ success: false, error: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setStep('predict');
    setPrediction(null);
    setTradeDecision(null);
    setTradeQty('1');
    setTradeResult(null);
    setReceipt(null);
  }

  const directionColor = {
    buy: 'text-[#C9A84C]',
    sell: 'text-red-400',
    hold: 'text-white/50',
  };
  const directionBg = {
    buy: 'border-[#C9A84C]/30 bg-[#C9A84C]/5',
    sell: 'border-red-800/40 bg-red-950/20',
    hold: 'border-white/10 bg-white/3',
  };

  return (
    <div className="space-y-6">
      {/* Step indicators */}
      <div className="flex items-center gap-2">
        {[
          { id: 'predict', label: '1. Predict' },
          { id: 'trade', label: '2. Trade' },
          { id: 'receipt', label: '3. Receipt' },
        ].map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <span className={`text-xs font-medium px-3 py-1 rounded-full border transition-colors ${
              step === s.id
                ? 'border-[#C9A84C] text-[#C9A84C] bg-[#C9A84C]/10'
                : STEPS.indexOf(step) > i
                ? 'border-white/20 text-white/50 bg-white/5'
                : 'border-white/10 text-white/20'
            }`}>{s.label}</span>
            {i < 2 && <ChevronRight className="w-3 h-3 text-white/15" />}
          </div>
        ))}
      </div>

      {/* ── STEP 1: PREDICT ── */}
      {step === 'predict' && (
        <div className="space-y-5">
          {!prediction && !loadingPrediction && (
            <div className="bg-[#111111] border border-white/10 rounded-xl p-8 text-center space-y-4">
              <Sparkles className="w-8 h-8 text-[#C9A84C] mx-auto" />
              <div className="space-y-1">
                <p className="text-white font-medium">Get an AI prediction for {asset.ticker}</p>
                <p className="text-white/40 text-sm">We'll look at the market state and tell you what we think in plain English — no jargon.</p>
              </div>
              <button
                onClick={generatePrediction}
                className="px-6 py-3 rounded-lg bg-[#C9A84C] text-black text-sm font-bold hover:bg-[#b8973d] transition-colors"
              >
                Analyse {asset.ticker} Now
              </button>
            </div>
          )}

          {loadingPrediction && (
            <div className="bg-[#111111] border border-white/10 rounded-xl p-8 text-center space-y-3">
              <div className="w-6 h-6 border-2 border-white/10 border-t-[#C9A84C] rounded-full animate-spin mx-auto" />
              <p className="text-white/40 text-sm">Analysing {asset.ticker}…</p>
            </div>
          )}

          {prediction && !prediction.error && (
            <div className="space-y-4">
              {/* Main verdict */}
              <div className={`rounded-xl border p-6 space-y-4 ${directionBg[prediction.direction] || 'border-white/10'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {prediction.direction === 'buy' ? <TrendingUp className="w-5 h-5 text-[#C9A84C]" /> :
                     prediction.direction === 'sell' ? <TrendingDown className="w-5 h-5 text-red-400" /> :
                     <Shield className="w-5 h-5 text-white/40" />}
                    <span className={`text-2xl font-bold uppercase ${directionColor[prediction.direction] || 'text-white'}`}>
                      {prediction.direction}
                    </span>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full border ${
                    prediction.confidence === 'high' ? 'border-[#C9A84C]/40 text-[#C9A84C]' :
                    prediction.confidence === 'medium' ? 'border-white/20 text-white/50' :
                    'border-white/10 text-white/30'
                  }`}>{prediction.confidence} confidence</span>
                </div>
                <p className="text-white font-medium leading-relaxed">{prediction.simple_verdict}</p>
              </div>

              {/* Reasoning */}
              <div className="bg-[#111111] border border-white/10 rounded-xl p-5 space-y-3">
                <p className="text-xs text-white/30 uppercase tracking-widest">Why we think this</p>
                <p className="text-white/70 text-sm leading-relaxed">{prediction.reasoning}</p>
              </div>

              {/* Risk + Next */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-[#111111] border border-white/10 rounded-xl p-4 space-y-1.5">
                  <p className="text-xs text-white/30 uppercase tracking-widest">⚠️ Main Risk</p>
                  <p className="text-white/60 text-sm">{prediction.risk_note}</p>
                </div>
                <div className="bg-[#111111] border border-white/10 rounded-xl p-4 space-y-1.5">
                  <p className="text-xs text-white/30 uppercase tracking-widest">👀 Watch For</p>
                  <p className="text-white/60 text-sm">{prediction.what_happens_next}</p>
                </div>
              </div>

              {/* CTA */}
              <div className="flex gap-3">
                {prediction.direction !== 'hold' && (
                  <button
                    onClick={() => setStep('trade')}
                    className="flex items-center gap-2 px-5 py-3 rounded-lg bg-[#C9A84C] text-black text-sm font-bold hover:bg-[#b8973d] transition-colors"
                  >
                    {prediction.direction === 'buy' ? 'Buy' : 'Sell'} {asset.ticker}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={generatePrediction}
                  className="flex items-center gap-2 px-4 py-3 rounded-lg border border-white/10 text-white/40 text-sm hover:text-white transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Re-analyse
                </button>
              </div>
            </div>
          )}

          {prediction?.error && (
            <div className="p-4 rounded-xl border border-red-900/40 text-sm text-red-400">
              Something went wrong: {prediction.error}
            </div>
          )}
        </div>
      )}

      {/* ── STEP 2: TRADE ── */}
      {step === 'trade' && (
        <div className="space-y-5">
          <div className="bg-[#111111] border border-white/10 rounded-xl p-6 space-y-5">
            <div className="space-y-1">
              <p className="text-white font-medium">Place a trade for {asset.ticker}</p>
              <p className="text-white/40 text-sm">This will place a real market order via Alpaca and create a permanent audit record.</p>
            </div>

            {/* Direction toggle */}
            <div>
              <p className="text-xs text-white/30 uppercase tracking-widest mb-2">Direction</p>
              <div className="flex gap-2">
                {['buy', 'sell'].map((side) => (
                  <button
                    key={side}
                    onClick={() => setTradeDecision(side)}
                    className={`flex-1 py-3 rounded-lg border text-sm font-bold capitalize transition-colors ${
                      tradeDecision === side
                        ? side === 'buy'
                          ? 'border-[#C9A84C] bg-[#C9A84C]/10 text-[#C9A84C]'
                          : 'border-red-700/60 bg-red-950/30 text-red-400'
                        : 'border-white/10 text-white/30 hover:text-white/60'
                    }`}
                  >
                    {side === 'buy' ? '↑ Buy' : '↓ Sell'}
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity */}
            <div>
              <label className="text-xs text-white/30 uppercase tracking-widest block mb-2">How many shares / units?</label>
              <input
                type="number"
                min="0.001"
                step="any"
                value={tradeQty}
                onChange={(e) => setTradeQty(e.target.value)}
                className="w-full bg-black border border-white/10 rounded-lg px-4 py-3 text-white font-mono text-lg focus:outline-none focus:border-[#C9A84C]/50"
              />
              <p className="text-xs text-white/20 mt-1.5">Market order — executes immediately at current price</p>
            </div>

            {/* Summary */}
            {tradeDecision && (
              <div className={`rounded-lg border p-4 text-sm ${
                tradeDecision === 'buy' ? 'border-[#C9A84C]/20 text-[#C9A84C]' : 'border-red-800/30 text-red-400'
              }`}>
                You are about to <strong>{tradeDecision}</strong> <strong>{tradeQty} {asset.ticker}</strong> at market price.
              </div>
            )}

            {/* Error */}
            {tradeResult?.error && (
              <p className="text-sm text-red-400">{tradeResult.error}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={executeTrade}
                disabled={!tradeDecision || !tradeQty || submitting}
                className={`flex-1 py-3 rounded-lg text-sm font-bold transition-colors disabled:opacity-40 ${
                  tradeDecision === 'sell'
                    ? 'bg-red-900/60 border border-red-800/50 text-red-300 hover:bg-red-900/80'
                    : 'bg-[#C9A84C] text-black hover:bg-[#b8973d]'
                }`}
              >
                {submitting ? 'Placing order…' : `Confirm ${tradeDecision || 'Trade'}`}
              </button>
              <button
                onClick={() => setStep('predict')}
                className="px-4 py-3 rounded-lg border border-white/10 text-white/30 text-sm hover:text-white transition-colors"
              >
                Back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 3: RECEIPT ── */}
      {step === 'receipt' && (
        <div className="space-y-5">
          {/* Trade confirmation */}
          {tradeResult?.success && (
            <div className="bg-[#111111] border border-[#C9A84C]/20 rounded-xl p-6 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[#C9A84C]" />
                <p className="text-white font-medium">Trade placed successfully!</p>
              </div>
              <p className="text-white/50 text-sm">Your order to <strong className="text-white">{tradeDecision} {tradeQty} {asset.ticker}</strong> has been sent to the market and will fill at the current price.</p>
              {tradeResult.order && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {[
                    ['Order ID', tradeResult.order.id?.slice(0, 8) + '…'],
                    ['Status', tradeResult.order.status],
                    ['Type', tradeResult.order.type],
                    ['Submitted', tradeResult.order.submitted_at ? new Date(tradeResult.order.submitted_at).toLocaleTimeString() : '—'],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-black/40 rounded-lg p-3">
                      <p className="text-xs text-white/30 mb-0.5">{label}</p>
                      <p className="text-xs font-mono text-white/70">{value}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* EGTS Receipt */}
          <div className="bg-[#111111] border border-white/10 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#C9A84C]" />
              <p className="text-white font-medium">Your Governance Receipt (EGTS)</p>
            </div>
            <p className="text-white/40 text-sm">Every trade and engine action is permanently recorded. Think of this like a tamper-proof receipt that can never be deleted or changed — like a blockchain record for your portfolio decisions.</p>

            {loadingReceipt && (
              <div className="flex items-center gap-2 text-sm text-white/30">
                <div className="w-4 h-4 border-2 border-white/10 border-t-[#C9A84C] rounded-full animate-spin" />
                Minting your governance receipt…
              </div>
            )}

            {receipt && !loadingReceipt && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    ['Asset', receipt.asset_id],
                    ['Event Type', receipt.event_type],
                    ['Date & Time', receipt.created_date ? new Date(receipt.created_date).toLocaleString() : '—'],
                    ['Verified', 'Yes ✓'],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-black/40 rounded-lg p-3">
                      <p className="text-xs text-white/30 mb-0.5">{label}</p>
                      <p className="text-sm text-white font-medium">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="bg-black/40 rounded-lg p-3">
                  <p className="text-xs text-white/30 mb-1">Cryptographic Fingerprint</p>
                  <p className="text-xs font-mono text-[#C9A84C] break-all">{receipt.crypto_hash}</p>
                  <p className="text-xs text-white/20 mt-1">This unique code proves this receipt has never been altered.</p>
                </div>
              </div>
            )}

            {!loadingReceipt && !receipt && (
              <p className="text-sm text-white/30">Receipt is being processed — check the Contracts tab in a moment.</p>
            )}
          </div>

          <button
            onClick={reset}
            className="w-full py-3 rounded-lg border border-white/10 text-white/40 text-sm hover:text-white transition-colors"
          >
            Start Over
          </button>
        </div>
      )}
    </div>
  );
}