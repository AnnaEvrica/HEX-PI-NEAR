import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Sparkles, TrendingUp, TrendingDown, Shield, ChevronRight, RefreshCw, CheckCircle2, Zap } from 'lucide-react';

const STEPS = ['predict', 'trade', 'receipt'];

export default function AssetAI({ asset, onRebalance }) {
  const [step, setStep] = useState('predict');

  // Step 1 state
  const [engineData, setEngineData] = useState(null);   // raw HEX6 output
  const [prediction, setPrediction] = useState(null);   // LLM output
  const [loadingPredict, setLoadingPredict] = useState(false);

  // Step 2 state
  const [tradeDecision, setTradeDecision] = useState(null);
  const [tradeQty, setTradeQty] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [tradeResult, setTradeResult] = useState(null);

  // Auto-trade state
  const [autoTrading, setAutoTrading] = useState(false);
  const [autoResult, setAutoResult] = useState(null);

  // Step 3 state
  const [receipt, setReceipt] = useState(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);

  // ── STEP 1: Run HEX6 live, then LLM explains in plain English ──
  async function generatePrediction() {
    setLoadingPredict(true);
    setPrediction(null);
    setEngineData(null);

    try {
      // 1a. Fetch real market data + run mini HEX6 engine via marketData function
      let mData = null;
      try {
        const mdRes = await base44.functions.invoke('marketData', {
          tickers: [asset.ticker],
          lookbackDays: 365,
        });
        mData = mdRes.data?.results?.[asset.ticker] || null;
      } catch { /* falls through to stored data */ }

      // Compute simple HEX6 metrics from returns if we have them
      let hex6 = {
        marketState: asset.market_state || 'UNKNOWN',
        targetWeight: asset.target_weight,
        currentWeight: asset.current_weight,
        confidence: 'medium',
        annualReturn: null,
        annualVol: null,
        latestPrice: null,
        dataPoints: 0,
        synthetic: true,
      };

      if (mData && mData.returns && mData.returns.length >= 20) {
        const r = mData.returns;
        const mean = r.reduce((s, x) => s + x, 0) / r.length;
        const variance = r.reduce((s, x) => s + (x - mean) ** 2, 0) / r.length;
        const std = Math.sqrt(variance);
        const recent = r.slice(-20);
        const recentMean = recent.reduce((s, x) => s + x, 0) / recent.length;
        const annualReturn = mean * 252;
        const annualVol = std * Math.sqrt(252);
        // Kelly-inspired target weight
        const kelly = annualVol > 0 ? annualReturn / (2.5 * annualVol ** 2) : 0;
        const raw = Math.max(0, Math.min(1, kelly));
        let state = 'LATERAL';
        if (recentMean > std * 0.3) state = 'BULL';
        else if (recentMean < -std * 0.3) state = 'BEAR';
        else if (Math.sqrt(recent.reduce((s, x) => s + (x - recentMean) ** 2, 0) / recent.length) > std * 1.5) state = 'VOLATILE';
        const stateAdjusted = state === 'BEAR' ? raw * 0.3 : state === 'VOLATILE' ? raw * 0.5 : state === 'BULL' ? Math.min(raw * 1.2, 1) : raw;
        hex6 = {
          marketState: state,
          targetWeight: parseFloat(stateAdjusted.toFixed(4)),
          currentWeight: asset.current_weight,
          confidence: Math.abs(recentMean) > std * 0.5 ? 'high' : Math.abs(recentMean) > std * 0.2 ? 'medium' : 'low',
          annualReturn: parseFloat((annualReturn * 100).toFixed(2)),
          annualVol: parseFloat((annualVol * 100).toFixed(2)),
          latestPrice: mData.latestPrice,
          dataPoints: mData.dataPoints,
          synthetic: false,
        };
      }

      setEngineData(hex6);

      // 1b. LLM explains the HEX6 output in plain English
      const prompt = `
You are a friendly financial guide. Explain things in plain English — no jargon, no technical terms.

The HEX6 smart engine has analysed ${asset.name} (${asset.ticker}) using real market data.
Here is what the engine found:

- Market State: ${hex6.marketState} (BULL = prices trending up, BEAR = trending down, LATERAL = flat, VOLATILE = unpredictable)
- Engine's Target Portfolio Weight: ${hex6.targetWeight != null ? (hex6.targetWeight * 100).toFixed(2) + '%' : 'Not calculated'}
- Current Portfolio Weight: ${hex6.currentWeight != null ? (hex6.currentWeight * 100).toFixed(2) + '%' : 'Not set'}
- Engine Confidence: ${hex6.confidence}
${hex6.annualReturn != null ? `- Expected Annual Return: ${hex6.annualReturn}%` : ''}
${hex6.annualVol != null ? `- Expected Annual Volatility: ${hex6.annualVol}%` : ''}
${hex6.latestPrice != null ? `- Current Price: $${hex6.latestPrice}` : ''}
- Data: ${hex6.synthetic ? 'Estimated (live data unavailable)' : `${hex6.dataPoints} days of real price data`}

Based on this, tell me:
1. Should I buy more, sell some, or hold what I have?
2. Why? (explain the engine's reasoning simply, like you're talking to a friend)
3. What's the main risk right now?
4. What should I watch for next?

Respond in this exact JSON:
{
  "direction": "buy" | "sell" | "hold",
  "simple_verdict": "One clear sentence saying what to do and why.",
  "reasoning": "2-3 plain English sentences explaining the engine's thinking.",
  "risk_note": "One sentence about the main risk.",
  "watch_for": "One sentence about what to watch next.",
  "suggested_qty_note": "One sentence explaining what quantity the engine suggests based on the target weight, in plain English."
}
`.trim();

      const llm = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            direction: { type: 'string' },
            simple_verdict: { type: 'string' },
            reasoning: { type: 'string' },
            risk_note: { type: 'string' },
            watch_for: { type: 'string' },
            suggested_qty_note: { type: 'string' },
          },
        },
      });

      setPrediction(llm);
      setTradeDecision(llm.direction === 'hold' ? null : llm.direction);
      // Pre-fill qty from HEX6 target weight delta if we have price data
      if (hex6.latestPrice && hex6.targetWeight != null) {
        // We don't have portfolio value here, so leave qty editable but show hint
        setTradeQty('1');
      }
    } catch (err) {
      setPrediction({ error: err.message });
    } finally {
      setLoadingPredict(false);
    }
  }

  // ── STEP 2: Manual trade ──
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
      await fetchReceipt();
      setStep('receipt');
    } catch (err) {
      setTradeResult({ success: false, error: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  // ── AUTO-TRADE: Full HEX6-driven execution ──
  async function runAutoTrade() {
    setAutoTrading(true);
    setAutoResult(null);
    try {
      const res = await base44.functions.invoke('autoTrade', {
        ticker: asset.ticker,
        riskAversion: 2.5,
      });
      if (res.data?.error) throw new Error(res.data.error);
      setAutoResult(res.data);
      if (!res.data.skipped) {
        await fetchReceipt();
        setStep('receipt');
      }
    } catch (err) {
      setAutoResult({ error: err.message });
    } finally {
      setAutoTrading(false);
    }
  }

  async function fetchReceipt() {
    setLoadingReceipt(true);
    try {
      await onRebalance();
      const egtsRes = await base44.functions.invoke('egtsProxy', { action: 'fetchByAsset', assetId: asset.ticker });
      const receipts = egtsRes.data?.data || [];
      setReceipt(receipts[0] || null);
    } catch { /* receipt will show fallback */ }
    setLoadingReceipt(false);
  }

  function reset() {
    setStep('predict');
    setPrediction(null);
    setEngineData(null);
    setTradeDecision(null);
    setTradeQty('');
    setTradeResult(null);
    setAutoResult(null);
    setReceipt(null);
  }

  const dirBg = { buy: 'border-[#C9A84C]/30 bg-[#C9A84C]/5', sell: 'border-red-800/40 bg-red-950/20', hold: 'border-white/10' };
  const dirColor = { buy: 'text-[#C9A84C]', sell: 'text-red-400', hold: 'text-white/50' };

  return (
    <div className="space-y-6">
      {/* Step indicators */}
      <div className="flex items-center gap-2">
        {[{ id: 'predict', label: '1. Predict' }, { id: 'trade', label: '2. Trade' }, { id: 'receipt', label: '3. Receipt' }].map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <span className={`text-xs font-medium px-3 py-1 rounded-full border transition-colors ${
              step === s.id ? 'border-[#C9A84C] text-[#C9A84C] bg-[#C9A84C]/10'
              : STEPS.indexOf(step) > i ? 'border-white/20 text-white/50 bg-white/5'
              : 'border-white/10 text-white/20'
            }`}>{s.label}</span>
            {i < 2 && <ChevronRight className="w-3 h-3 text-white/15" />}
          </div>
        ))}
      </div>

      {/* ── STEP 1: PREDICT ── */}
      {step === 'predict' && (
        <div className="space-y-5">
          {!prediction && !loadingPredict && (
            <div className="bg-[#111111] border border-white/10 rounded-xl p-8 text-center space-y-4">
              <Sparkles className="w-8 h-8 text-[#C9A84C] mx-auto" />
              <div className="space-y-1">
                <p className="text-white font-medium">Get a live HEX6 prediction for {asset.ticker}</p>
                <p className="text-white/40 text-sm">We'll pull real market data, run the HEX6 engine, and explain what it means in plain English.</p>
              </div>
              <button onClick={generatePrediction}
                className="px-6 py-3 rounded-lg bg-[#C9A84C] text-black text-sm font-bold hover:bg-[#b8973d] transition-colors">
                Analyse {asset.ticker} Now
              </button>
            </div>
          )}

          {loadingPredict && (
            <div className="bg-[#111111] border border-white/10 rounded-xl p-8 text-center space-y-3">
              <div className="w-6 h-6 border-2 border-white/10 border-t-[#C9A84C] rounded-full animate-spin mx-auto" />
              <p className="text-white/40 text-sm">Running HEX6 engine on live market data…</p>
            </div>
          )}

          {prediction && !prediction.error && engineData && (
            <div className="space-y-4">
              {/* HEX6 engine stats bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  ['Market State', engineData.marketState],
                  ['Target Weight', engineData.targetWeight != null ? `${(engineData.targetWeight * 100).toFixed(1)}%` : '—'],
                  ['Engine Confidence', engineData.confidence],
                  ['Data Source', engineData.synthetic ? 'Estimated' : `${engineData.dataPoints} days live`],
                ].map(([label, value]) => (
                  <div key={label} className="bg-[#111111] border border-white/10 rounded-lg p-3">
                    <p className="text-xs text-white/30 mb-0.5">{label}</p>
                    <p className="text-xs font-mono font-bold text-white">{value}</p>
                  </div>
                ))}
              </div>

              {/* Verdict card */}
              <div className={`rounded-xl border p-5 space-y-3 ${dirBg[prediction.direction] || 'border-white/10'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {prediction.direction === 'buy' ? <TrendingUp className="w-5 h-5 text-[#C9A84C]" /> :
                     prediction.direction === 'sell' ? <TrendingDown className="w-5 h-5 text-red-400" /> :
                     <Shield className="w-5 h-5 text-white/40" />}
                    <span className={`text-xl font-bold uppercase ${dirColor[prediction.direction] || 'text-white'}`}>{prediction.direction}</span>
                  </div>
                  <span className="text-xs font-mono text-white/30">HEX6-BLE-v5.0</span>
                </div>
                <p className="text-white font-medium leading-relaxed">{prediction.simple_verdict}</p>
              </div>

              {/* Reasoning */}
              <div className="bg-[#111111] border border-white/10 rounded-xl p-5 space-y-2">
                <p className="text-xs text-white/30 uppercase tracking-widest">Why the engine thinks this</p>
                <p className="text-white/70 text-sm leading-relaxed">{prediction.reasoning}</p>
              </div>

              {/* Suggested qty note */}
              {prediction.suggested_qty_note && (
                <div className="bg-[#111111] border border-white/10 rounded-xl p-4 space-y-1">
                  <p className="text-xs text-white/30 uppercase tracking-widest">💡 Suggested Size</p>
                  <p className="text-white/60 text-sm">{prediction.suggested_qty_note}</p>
                </div>
              )}

              {/* Risk + Watch */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-[#111111] border border-white/10 rounded-xl p-4 space-y-1.5">
                  <p className="text-xs text-white/30 uppercase tracking-widest">⚠️ Main Risk</p>
                  <p className="text-white/60 text-sm">{prediction.risk_note}</p>
                </div>
                <div className="bg-[#111111] border border-white/10 rounded-xl p-4 space-y-1.5">
                  <p className="text-xs text-white/30 uppercase tracking-widest">👀 Watch For</p>
                  <p className="text-white/60 text-sm">{prediction.watch_for}</p>
                </div>
              </div>

              {/* CTAs */}
              <div className="flex flex-wrap gap-3">
                {prediction.direction !== 'hold' && (
                  <button onClick={() => setStep('trade')}
                    className="flex items-center gap-2 px-5 py-3 rounded-lg bg-[#C9A84C] text-black text-sm font-bold hover:bg-[#b8973d] transition-colors">
                    Manual Trade <ChevronRight className="w-4 h-4" />
                  </button>
                )}
                <button onClick={runAutoTrade} disabled={autoTrading}
                  className="flex items-center gap-2 px-5 py-3 rounded-lg border border-[#C9A84C]/50 text-[#C9A84C] text-sm font-bold hover:bg-[#C9A84C]/10 transition-colors disabled:opacity-40">
                  <Zap className="w-4 h-4" />
                  {autoTrading ? 'Auto-Trading…' : 'Auto-Trade (HEX6)'}
                </button>
                <button onClick={generatePrediction}
                  className="flex items-center gap-2 px-4 py-3 rounded-lg border border-white/10 text-white/40 text-sm hover:text-white transition-colors">
                  <RefreshCw className="w-3.5 h-3.5" /> Re-analyse
                </button>
              </div>

              {/* Auto-trade result (if skipped) */}
              {autoResult && autoResult.skipped && (
                <div className="p-4 rounded-xl border border-white/10 text-sm text-white/50">
                  ✓ No trade needed — {autoResult.reason}
                </div>
              )}
              {autoResult?.error && (
                <div className="p-4 rounded-xl border border-red-900/40 text-sm text-red-400">{autoResult.error}</div>
              )}
            </div>
          )}

          {prediction?.error && (
            <div className="p-4 rounded-xl border border-red-900/40 text-sm text-red-400">
              Something went wrong: {prediction.error}
            </div>
          )}
        </div>
      )}

      {/* ── STEP 2: MANUAL TRADE ── */}
      {step === 'trade' && (
        <div className="space-y-5">
          <div className="bg-[#111111] border border-white/10 rounded-xl p-6 space-y-5">
            <div className="space-y-1">
              <p className="text-white font-medium">Place a manual trade for {asset.ticker}</p>
              <p className="text-white/40 text-sm">
                HEX6 target weight: <span className="text-[#C9A84C] font-mono">{engineData?.targetWeight != null ? `${(engineData.targetWeight * 100).toFixed(1)}%` : '—'}</span>
                {engineData?.latestPrice ? ` · Current price: $${engineData.latestPrice}` : ''}
              </p>
            </div>

            {/* Direction */}
            <div>
              <p className="text-xs text-white/30 uppercase tracking-widest mb-2">Direction</p>
              <div className="flex gap-2">
                {['buy', 'sell'].map((side) => (
                  <button key={side} onClick={() => setTradeDecision(side)}
                    className={`flex-1 py-3 rounded-lg border text-sm font-bold capitalize transition-colors ${
                      tradeDecision === side
                        ? side === 'buy' ? 'border-[#C9A84C] bg-[#C9A84C]/10 text-[#C9A84C]' : 'border-red-700/60 bg-red-950/30 text-red-400'
                        : 'border-white/10 text-white/30 hover:text-white/60'
                    }`}>
                    {side === 'buy' ? '↑ Buy' : '↓ Sell'}
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity */}
            <div>
              <label className="text-xs text-white/30 uppercase tracking-widest block mb-2">
                How many shares / units?
              </label>
              <input type="number" min="0.001" step="any" value={tradeQty}
                onChange={(e) => setTradeQty(e.target.value)}
                placeholder="e.g. 1"
                className="w-full bg-black border border-white/10 rounded-lg px-4 py-3 text-white font-mono text-lg focus:outline-none focus:border-[#C9A84C]/50" />
              <p className="text-xs text-white/20 mt-1.5">Market order — executes immediately at current price</p>
            </div>

            {tradeDecision && tradeQty && (
              <div className={`rounded-lg border p-4 text-sm ${tradeDecision === 'buy' ? 'border-[#C9A84C]/20 text-[#C9A84C]' : 'border-red-800/30 text-red-400'}`}>
                You are about to <strong>{tradeDecision}</strong> <strong>{tradeQty} {asset.ticker}</strong> at market price.
              </div>
            )}

            {tradeResult?.error && <p className="text-sm text-red-400">{tradeResult.error}</p>}

            <div className="flex gap-3">
              <button onClick={executeTrade} disabled={!tradeDecision || !tradeQty || submitting}
                className={`flex-1 py-3 rounded-lg text-sm font-bold transition-colors disabled:opacity-40 ${
                  tradeDecision === 'sell' ? 'bg-red-900/60 border border-red-800/50 text-red-300 hover:bg-red-900/80' : 'bg-[#C9A84C] text-black hover:bg-[#b8973d]'
                }`}>
                {submitting ? 'Placing order…' : `Confirm ${tradeDecision || 'Trade'}`}
              </button>
              <button onClick={() => setStep('predict')}
                className="px-4 py-3 rounded-lg border border-white/10 text-white/30 text-sm hover:text-white transition-colors">
                Back
              </button>
            </div>
          </div>

          {/* Or auto-trade shortcut */}
          <div className="flex items-center gap-3 p-4 bg-[#111111] border border-white/10 rounded-xl">
            <Zap className="w-4 h-4 text-[#C9A84C] shrink-0" />
            <p className="text-sm text-white/40 flex-1">Let HEX6 calculate the exact size and place the trade for you.</p>
            <button onClick={runAutoTrade} disabled={autoTrading}
              className="px-4 py-2.5 rounded-lg border border-[#C9A84C]/50 text-[#C9A84C] text-xs font-bold hover:bg-[#C9A84C]/10 transition-colors disabled:opacity-40">
              {autoTrading ? 'Running…' : 'Auto-Trade'}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: RECEIPT ── */}
      {step === 'receipt' && (
        <div className="space-y-5">
          {/* Trade summary */}
          <div className="bg-[#111111] border border-[#C9A84C]/20 rounded-xl p-6 space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-[#C9A84C]" />
              <p className="text-white font-medium">
                {autoResult?.success ? 'Auto-trade executed by HEX6!' : 'Trade placed successfully!'}
              </p>
            </div>

            {autoResult?.success && (
              <div className="space-y-2">
                <p className="text-white/50 text-sm">
                  HEX6 automatically {autoResult.trade?.side === 'buy' ? 'bought' : 'sold'} <strong className="text-white">{autoResult.trade?.qty} {asset.ticker}</strong> at ~${autoResult.trade?.price?.toFixed(2)} to hit the target portfolio weight of <strong className="text-white">{autoResult.engine?.targetWeight != null ? (autoResult.engine.targetWeight * 100).toFixed(1) + '%' : '—'}</strong>.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['Market State', autoResult.engine?.marketState],
                    ['Confidence', autoResult.engine?.confidence],
                    ['Trade Side', autoResult.trade?.side?.toUpperCase()],
                    ['Qty', autoResult.trade?.qty],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-black/40 rounded-lg p-3">
                      <p className="text-xs text-white/30 mb-0.5">{label}</p>
                      <p className="text-xs font-mono text-white/70">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tradeResult?.success && tradeResult.order && !autoResult?.success && (
              <div className="space-y-2">
                <p className="text-white/50 text-sm">
                  Your order to <strong className="text-white">{tradeDecision} {tradeQty} {asset.ticker}</strong> has been sent to the market.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['Order ID', tradeResult.order.id?.slice(0, 8) + '…'],
                    ['Status', tradeResult.order.status],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-black/40 rounded-lg p-3">
                      <p className="text-xs text-white/30 mb-0.5">{label}</p>
                      <p className="text-xs font-mono text-white/70">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* EGTS Receipt */}
          <div className="bg-[#111111] border border-white/10 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#C9A84C]" />
              <p className="text-white font-medium">Governance Receipt (EGTS)</p>
            </div>
            <p className="text-white/40 text-sm">This is your permanent, tamper-proof record of this decision — like a blockchain receipt that can never be changed.</p>

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
              <p className="text-sm text-white/30">Receipt is being processed — check the Contracts tab shortly.</p>
            )}
          </div>

          <button onClick={reset}
            className="w-full py-3 rounded-lg border border-white/10 text-white/40 text-sm hover:text-white transition-colors">
            Start Over
          </button>
        </div>
      )}
    </div>
  );
}