import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { TrendingUp, TrendingDown, RefreshCw, AlertTriangle, Activity, Zap, Settings, CheckCircle2, ScanSearch, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { jsPDF } from 'jspdf';

export default function Trading() {
  const [assets, setAssets] = useState([]);
  const [account, setAccount] = useState(null);
  const [positions, setPositions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [orderForm, setOrderForm] = useState({ symbol: '', qty: '', side: 'buy', type: 'market' });
  const [submitting, setSubmitting] = useState(false);
  const [orderMsg, setOrderMsg] = useState(null);

  const [autoEnabled, setAutoEnabled] = useState(false);
  const [autoCategory, setAutoCategory] = useState('all');
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoResult, setAutoResult] = useState(null);

  // Crypto scanner state
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanMode, setScanMode] = useState('scan'); // 'scan' | 'trade'
  const [topN, setTopN] = useState(3);

  useEffect(() => {
    base44.entities.Asset.list().then(setAssets);
    loadAccount();
  }, []);

  async function loadAccount() {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('alpacaTrading', { action: 'getAccount' });
      if (res.data?.error) throw new Error(res.data.error);
      setAccount(res.data?.account || null);
      const [posRes, ordRes] = await Promise.all([
        base44.functions.invoke('alpacaTrading', { action: 'getPositions' }),
        base44.functions.invoke('alpacaTrading', { action: 'getOrders' }),
      ]);
      setPositions(posRes.data?.positions || []);
      setOrders(ordRes.data?.orders || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function submitOrder(e) {
    e.preventDefault();
    setSubmitting(true);
    setOrderMsg(null);
    try {
      const res = await base44.functions.invoke('alpacaTrading', {
        action: 'placeOrder',
        symbol: orderForm.symbol.toUpperCase(),
        qty: parseFloat(orderForm.qty),
        side: orderForm.side,
        type: orderForm.type,
      });
      if (res.data?.error) throw new Error(res.data.error);
      setOrderMsg({ type: 'success', text: `Done! ${orderForm.side.toUpperCase()} ${orderForm.qty} ${orderForm.symbol.toUpperCase()} order placed.` });
      setOrderForm({ symbol: '', qty: '', side: 'buy', type: 'market' });
      await loadAccount();
    } catch (err) {
      setOrderMsg({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  async function runCryptoScan(execute = false) {
    setScanning(true);
    setScanResult(null);
    try {
      const res = await base44.functions.invoke('cryptoScanner', {
        topN,
        riskAversion: 2.0,
        scanOnly: !execute,
        maxPositionPct: 0.15,
      });
      if (res.data?.error) throw new Error(res.data.error);
      setScanResult({ ...res.data, executed: execute });
      if (execute) await loadAccount();
    } catch (err) {
      setScanResult({ error: err.message });
    } finally {
      setScanning(false);
    }
  }

  async function runAutoTrade() {
    setAutoRunning(true);
    setAutoResult(null);
    try {
      const res = await base44.functions.invoke('cryptoScanner', {
        topN: 3,
        riskAversion: 2.0,
        scanOnly: false,
        maxPositionPct: 0.15,
        category: autoCategory,
      });
      if (res.data?.error) throw new Error(res.data.error);
      setAutoResult(res.data);
      await loadAccount();
    } catch (err) {
      setAutoResult({ error: err.message });
    } finally {
      setAutoRunning(false);
    }
  }

  const fmt = (v) => parseFloat(v || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  const pct = (v) => `${parseFloat(v || 0).toFixed(2)}%`;

  function generateTradeReport(result) {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPos = 10;

    // Header
    doc.setFontSize(18);
    doc.setTextColor(201, 168, 76); // Gold
    doc.text('HEX6 Auto-Pilot Trade Report', pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    // Metadata
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, yPos, { align: 'center' });
    doc.text(`Pool: ${autoCategory.toUpperCase()} · Assets Scanned: ${result.scanned}`, pageWidth / 2, yPos + 5, { align: 'center' });
    yPos += 12;

    // Summary
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text('Scan Summary', 10, yPos);
    yPos += 6;

    doc.setFontSize(9);
    doc.setTextColor(200, 200, 200);
    const trades = result.trades?.filter(t => !t.skipped) || [];
    doc.text(`• Scanned ${result.scanned} crypto assets in the ${autoCategory} category`, 15, yPos);
    doc.text(`• Selected ${result.topPicks.length} top performers by momentum score`, 15, yPos + 5);
    doc.text(`• Executed ${trades.length} trades based on statistical edge and Bayesian thresholds`, 15, yPos + 10);
    yPos += 18;

    // Top Picks
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text('Top Momentum Picks', 10, yPos);
    yPos += 6;

    doc.setFontSize(8);
    doc.setTextColor(180, 180, 180);
    result.topPicks.forEach((pick, idx) => {
      const line = `${idx + 1}. ${pick.ticker} — State: ${pick.marketState}, Momentum: ${pick.momentumScore?.toFixed(3)}, Sharpe: ${pick.sharpe?.toFixed(2)}, Target: ${(pick.targetWeight * 100).toFixed(1)}%`;
      doc.text(line, 15, yPos);
      yPos += 4;
    });
    yPos += 4;

    // Trades Executed
    if (trades.length > 0) {
      doc.setFontSize(11);
      doc.setTextColor(255, 255, 255);
      doc.text('Trades Executed', 10, yPos);
      yPos += 6;

      doc.setFontSize(8);
      doc.setTextColor(180, 180, 180);
      trades.forEach((trade, idx) => {
        const action = trade.side.toUpperCase();
        const line = `${idx + 1}. ${action} ${trade.qty} ${trade.ticker} @ $${trade.price?.toFixed(2)} · Sharpe: ${trade.sharpe?.toFixed(2)}`;
        doc.text(line, 15, yPos);
        yPos += 4;
        if (yPos > pageHeight - 15) {
          doc.addPage();
          yPos = 10;
        }
      });
    }

    // Footer
    yPos = pageHeight - 10;
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text('HEX6 BLE v5.0 · State-Conditioned Exposure Field Model · EGTS Verified', pageWidth / 2, yPos, { align: 'center' });

    doc.save(`HEX6_TradeReport_${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-12 space-y-10">
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <h1 className="text-4xl font-bold text-white">Trade</h1>
          <p className="text-sm text-white/40">Manual trades or let HEX6 find and execute the best opportunities for you.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/settings" className="p-2.5 rounded-lg border border-white/10 text-white/40 hover:text-white transition-colors" title="API Settings">
            <Settings className="w-4 h-4" />
          </Link>
          <button onClick={loadAccount} disabled={loading}
            className="p-2.5 rounded-lg border border-white/10 text-white/40 hover:text-white transition-colors disabled:opacity-40">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-5 bg-[#111111] border border-amber-800/40 rounded-xl space-y-3">
          <div className="flex items-center gap-2 text-amber-400 text-sm font-medium">
            <AlertTriangle className="w-4 h-4" />
            Alpaca not connected
          </div>
          <p className="text-white/40 text-sm">You need to connect your Alpaca API keys to trade.</p>
          <Link to="/settings" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#C9A84C] text-black text-sm font-bold hover:bg-[#b8973d] transition-colors">
            <Settings className="w-4 h-4" /> Connect Alpaca
          </Link>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-white/10 border-t-[#C9A84C] rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {account && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Portfolio Value', value: fmt(account.portfolio_value), highlight: true },
                { label: 'Buying Power', value: fmt(account.buying_power) },
                { label: 'Cash', value: fmt(account.cash) },
                { label: 'Status', value: account.status?.toUpperCase() },
              ].map(({ label, value, highlight }) => (
                <div key={label} className={`rounded-xl border p-4 ${highlight ? 'border-[#C9A84C]/30 bg-[#C9A84C]/5' : 'border-white/10 bg-[#111111]'}`}>
                  <p className="text-xs text-white/30 uppercase tracking-widest mb-1">{label}</p>
                  <p className={`text-lg font-bold font-mono ${highlight ? 'text-[#C9A84C]' : 'text-white'}`}>{value}</p>
                </div>
              ))}
            </div>
          )}

          {/* CRYPTO SCANNER */}
          <div className="bg-[#111111] border border-[#C9A84C]/40 rounded-xl p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#C9A84C] flex items-center justify-center">
                <ScanSearch className="w-4 h-4 text-black" />
              </div>
              <div className="flex-1">
                <p className="text-white font-bold">HEX6 Crypto Scanner</p>
                <p className="text-white/40 text-xs">Scans 40+ crypto pairs, ranks by momentum score, picks the highest-margin opportunities.</p>
              </div>
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              <div>
                <label className="text-xs text-white/30 uppercase tracking-widest block mb-1.5">Top Picks</label>
                <select value={topN} onChange={e => setTopN(Number(e.target.value))}
                  className="bg-black border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#C9A84C]/50">
                  {[3, 5, 7, 10].map(n => <option key={n} value={n} className="bg-black">{n} assets</option>)}
                </select>
              </div>
              <div className="flex gap-2 pt-5">
                <button onClick={() => runCryptoScan(false)} disabled={scanning}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-white/20 text-white/70 text-sm hover:border-[#C9A84C]/50 hover:text-[#C9A84C] transition-colors disabled:opacity-40">
                  {scanning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ScanSearch className="w-3.5 h-3.5" />}
                  Scan Only
                </button>
                <button onClick={() => runCryptoScan(true)} disabled={scanning}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#C9A84C] text-black text-sm font-bold hover:bg-[#b8973d] transition-colors disabled:opacity-40">
                  {scanning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                  {scanning ? 'Scanning…' : 'Scan & Trade'}
                </button>
              </div>
            </div>

            {scanResult && (
              <div className="space-y-3">
                {scanResult.error && <p className="text-sm text-red-400">{scanResult.error}</p>}
                {scanResult.topPicks && (
                  <>
                    <div className="flex items-center justify-between text-xs text-white/30">
                      <span>Scanned {scanResult.scanned} assets · Top {scanResult.topPicks.length} by momentum</span>
                      {scanResult.executed && <span className="text-[#C9A84C]">✓ Trades executed</span>}
                    </div>
                    <div className="space-y-2">
                      {scanResult.topPicks.map((p, i) => (
                        <div key={p.ticker} className="flex items-center gap-3 px-4 py-3 bg-black/40 border border-white/10 rounded-lg">
                          <span className="text-xs font-mono text-white/30 w-5">#{i + 1}</span>
                          <span className="text-sm font-mono font-bold text-white w-24">{p.ticker}</span>
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                            p.marketState === 'BULL' ? 'text-[#C9A84C]' :
                            p.marketState === 'VOLATILE' ? 'text-amber-400' : 'text-white/40'
                          }`}>{p.marketState}</span>
                          <span className="text-xs text-white/40 flex-1">Momentum: <span className="text-white font-mono">{p.momentumScore?.toFixed(2)}</span></span>
                          <span className="text-xs font-mono text-white/40">Sharpe {p.sharpe?.toFixed(2)}</span>
                          <span className="text-xs font-mono text-[#C9A84C]">{(p.targetWeight * 100).toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                    {scanResult.trades?.length > 0 && (
                      <div className="space-y-1 pt-1">
                        <p className="text-xs text-white/30 uppercase tracking-widest">Executed Trades</p>
                        {scanResult.trades.filter(t => !t.skipped).map(t => (
                          <div key={t.ticker} className="flex items-center gap-2 text-xs text-white/60 px-3 py-2 bg-[#C9A84C]/5 border border-[#C9A84C]/20 rounded-lg">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#C9A84C]" />
                            <span className={`font-bold ${t.side === 'buy' ? 'text-[#C9A84C]' : 'text-red-400'}`}>{t.side?.toUpperCase()}</span>
                            <span>{t.qty} <span className="font-mono">{t.ticker}</span> @ ${t.price?.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* AUTO-TRADE */}
          <div className={`rounded-xl border p-6 space-y-5 transition-all ${autoEnabled ? 'bg-[#0d0d0d] border-[#C9A84C]/60' : 'bg-[#111111] border-white/10'}`}>
            {/* Header + toggle */}
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${autoEnabled ? 'bg-[#C9A84C]' : 'bg-white/10'}`}>
                <Zap className={`w-4 h-4 ${autoEnabled ? 'text-black' : 'text-white/40'}`} />
              </div>
              <div className="flex-1">
                <p className="text-white font-bold">HEX6 Auto-Pilot</p>
                <p className="text-white/40 text-xs">HEX6 scans the full crypto universe, picks the highest-profit opportunities across any category, and executes — no ticker needed.</p>
              </div>
              {/* Toggle switch */}
              <button onClick={() => { setAutoEnabled(v => !v); setAutoResult(null); }}
                className={`relative w-12 h-6 rounded-full transition-colors ${autoEnabled ? 'bg-[#C9A84C]' : 'bg-white/10'}`}>
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${autoEnabled ? 'left-7' : 'left-1'}`} />
              </button>
            </div>

            {autoEnabled && (
              <>
                {/* Category pool selector */}
                <div>
                  <p className="text-xs text-white/30 uppercase tracking-widest mb-2">Scan Pool</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: 'all', label: '🌐 All Crypto' },
                      { id: 'defi', label: '🏦 DeFi' },
                      { id: 'layer1', label: '⛓ Layer 1' },
                      { id: 'layer2', label: '⚡ Layer 2' },
                      { id: 'dao', label: '🗳 DAO & Gov' },
                      { id: 'staking', label: '🔒 Staking' },
                      { id: 'altcoins', label: '🚀 Altcoins' },
                      { id: 'meme', label: '🐸 Meme' },
                    ].map(cat => (
                      <button key={cat.id} onClick={() => setAutoCategory(cat.id)}
                        className={`text-xs px-3 py-2 rounded-lg border transition-colors font-medium ${
                          autoCategory === cat.id
                            ? 'border-[#C9A84C] text-[#C9A84C] bg-[#C9A84C]/10'
                            : 'border-white/10 text-white/40 hover:text-white/70 hover:border-white/20'
                        }`}>
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button onClick={runAutoTrade} disabled={autoRunning}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-[#C9A84C] text-black text-sm font-bold hover:bg-[#b8973d] transition-colors disabled:opacity-40">
                  {autoRunning
                    ? <><RefreshCw className="w-4 h-4 animate-spin" /> Scanning &amp; executing best opportunities…</>
                    : <><Zap className="w-4 h-4" /> Run Auto-Pilot Now</>}
                </button>

                {autoResult && (
                  <div className="space-y-4">
                    {autoResult.error && <p className="text-sm text-red-400">{autoResult.error}</p>}
                    {autoResult.topPicks && (
                      <>
                        {/* Summary */}
                        <div className="text-xs text-white/50 p-3 bg-black/40 rounded-lg border border-white/10">
                          <p className="font-mono">
                            Scanned <span className="text-white font-bold">{autoResult.scanned}</span> crypto assets across {autoCategory} pool · 
                            Selected <span className="text-[#C9A84C]">{autoResult.topPicks.length}</span> highest-momentum picks · 
                            Executed <span className="text-[#C9A84C]">{autoResult.trades?.filter(t => !t.skipped).length || 0}</span> trades
                          </p>
                        </div>

                        {/* Full Scan Results (Expandable) */}
                        <details className="group">
                          <summary className="cursor-pointer text-xs text-white/40 hover:text-[#C9A84C] font-medium uppercase tracking-widest p-2">
                            → View all {autoResult.scanned} scanned assets
                          </summary>
                          <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                            {autoResult.allScanned?.map((asset, idx) => (
                              <div key={asset.ticker} className="text-xs px-3 py-1.5 bg-black/60 rounded border border-white/5 flex items-center justify-between">
                                <span className="font-mono text-white/40">{idx + 1}. {asset.ticker}</span>
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                                    asset.marketState === 'BULL' ? 'text-[#C9A84C]' :
                                    asset.marketState === 'BEAR' ? 'text-red-400' : 'text-white/30'
                                  }`}>{asset.marketState}</span>
                                  <span className="text-white/20 font-mono">{asset.momentumScore?.toFixed(2)}</span>
                                </div>
                              </div>
                            )) || (
                              <p className="text-white/20 text-xs p-2">Full scan data not available</p>
                            )}
                          </div>
                        </details>

                        {/* Top Picks */}
                        <div>
                          <p className="text-xs text-white/30 uppercase tracking-widest mb-2">Top Picks (Highest Momentum)</p>
                          <div className="space-y-2">
                            {autoResult.topPicks.map((p, i) => (
                              <div key={p.ticker} className="flex items-center gap-3 px-4 py-3 bg-black/40 border border-white/10 rounded-lg">
                                <span className="text-xs font-mono text-[#C9A84C] w-5">#{i + 1}</span>
                                <span className="text-sm font-mono font-bold text-white w-24">{p.ticker}</span>
                                <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                                  p.marketState === 'BULL' ? 'text-[#C9A84C]' :
                                  p.marketState === 'VOLATILE' ? 'text-amber-400' : 'text-white/40'
                                }`}>{p.marketState}</span>
                                <span className="text-xs text-white/40 flex-1">
                                  Momentum: <span className="text-white font-mono">{p.momentumScore?.toFixed(2)}</span> · 
                                  Sharpe: <span className="text-white/60 font-mono">{p.sharpe?.toFixed(2)}</span>
                                </span>
                                <span className="text-xs font-mono text-[#C9A84C]">{(p.targetWeight * 100).toFixed(1)}%</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Trade Report */}
                        {autoResult.trades?.filter(t => !t.skipped).length > 0 && (
                          <div className="bg-[#C9A84C]/5 border border-[#C9A84C]/20 rounded-lg p-4 space-y-3">
                            <div className="flex items-center gap-2 text-[#C9A84C]">
                              <CheckCircle2 className="w-4 h-4" />
                              <p className="text-sm font-bold">Trades Executed</p>
                            </div>
                            <div className="space-y-2">
                              {autoResult.trades.filter(t => !t.skipped).map(t => (
                                <div key={t.ticker} className="text-xs space-y-1 p-3 bg-black/40 rounded border border-[#C9A84C]/10">
                                  <p className="text-white/70">
                                    <span className={`font-bold ${t.side === 'buy' ? 'text-[#C9A84C]' : 'text-red-400'}`}>
                                      {t.side?.toUpperCase()}
                                    </span>
                                    {' '}{t.qty} {t.ticker} @ ${t.price?.toFixed(2)}
                                  </p>
                                  <p className="text-white/40">
                                    State: {t.marketState} · Confidence: {t.momentumScore?.toFixed(3)} · Sharpe: {t.sharpe?.toFixed(2)}
                                  </p>
                                </div>
                              ))}
                            </div>
                            <button onClick={() => generateTradeReport(autoResult)}
                              className="w-full flex items-center justify-center gap-2 text-xs px-3 py-2 rounded-lg border border-[#C9A84C]/40 text-[#C9A84C] hover:bg-[#C9A84C]/10 transition-colors">
                              📄 Generate PDF Report
                            </button>
                          </div>
                        )}

                        {autoResult.trades?.filter(t => t.skipped).length > 0 && (
                          <div className="text-xs text-white/40 space-y-1">
                            <p className="font-mono">Skipped {autoResult.trades.filter(t => t.skipped).length} ({autoResult.trades.filter(t => t.skipped).map(t => t.reason).join(', ')})</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Manual trade */}
          <div className="bg-[#111111] border border-white/10 rounded-xl p-6 space-y-5">
            <h2 className="text-sm font-bold text-white/40 uppercase tracking-widest">Manual Trade</h2>
            <form onSubmit={submitOrder} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <label className="text-xs text-white/30 uppercase tracking-widest block mb-1.5">Symbol</label>
                <input required value={orderForm.symbol}
                  onChange={e => setOrderForm({ ...orderForm, symbol: e.target.value.toUpperCase() })}
                  placeholder="AAPL" list="asset-list"
                  className="w-full bg-black border border-white/10 rounded-lg px-3 py-2.5 text-sm font-mono text-white placeholder-white/20 focus:outline-none focus:border-[#C9A84C]/50" />
                <datalist id="asset-list">
                  {assets.map(a => <option key={a.ticker} value={a.ticker} />)}
                </datalist>
              </div>
              <div>
                <label className="text-xs text-white/30 uppercase tracking-widest block mb-1.5">Qty</label>
                <input required type="number" min="0.001" step="any" value={orderForm.qty}
                  onChange={e => setOrderForm({ ...orderForm, qty: e.target.value })}
                  placeholder="1"
                  className="w-full bg-black border border-white/10 rounded-lg px-3 py-2.5 text-sm font-mono text-white placeholder-white/20 focus:outline-none focus:border-[#C9A84C]/50" />
              </div>
              <div>
                <label className="text-xs text-white/30 uppercase tracking-widest block mb-1.5">Side</label>
                <select value={orderForm.side} onChange={e => setOrderForm({ ...orderForm, side: e.target.value })}
                  className="w-full bg-black border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#C9A84C]/50">
                  <option value="buy" className="bg-black">Buy</option>
                  <option value="sell" className="bg-black">Sell</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-white/30 uppercase tracking-widest block mb-1.5">Type</label>
                <select value={orderForm.type} onChange={e => setOrderForm({ ...orderForm, type: e.target.value })}
                  className="w-full bg-black border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#C9A84C]/50">
                  <option value="market" className="bg-black">Market</option>
                  <option value="limit" className="bg-black">Limit</option>
                </select>
              </div>
              <div className="col-span-2 sm:col-span-4">
                <button type="submit" disabled={submitting}
                  className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-colors disabled:opacity-40 ${
                    orderForm.side === 'sell'
                      ? 'bg-red-900/60 border border-red-800/50 text-red-300 hover:bg-red-900/80'
                      : 'bg-[#C9A84C] text-black hover:bg-[#b8973d]'
                  }`}>
                  {submitting ? 'Placing order…' : `${orderForm.side === 'sell' ? '↓ Sell' : '↑ Buy'} ${orderForm.symbol || '—'}`}
                </button>
              </div>
            </form>
            {orderMsg && (
              <p className={`text-sm ${orderMsg.type === 'success' ? 'text-[#C9A84C]' : 'text-red-400'}`}>{orderMsg.text}</p>
            )}
          </div>

          {/* Positions */}
          <div className="space-y-3">
            <h2 className="text-xl font-bold text-white">Open Positions</h2>
            {positions.length === 0 ? (
              <div className="py-10 text-center">
                <Activity className="w-6 h-6 text-white/10 mx-auto mb-2" />
                <p className="text-white/30 text-sm">No open positions yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {positions.map(pos => {
                  const pl = parseFloat(pos.unrealized_pl || 0);
                  return (
                    <div key={pos.symbol} className="flex items-center gap-4 px-5 py-4 bg-[#111111] border border-white/10 rounded-xl">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono font-bold text-white">{pos.symbol}</span>
                          <span className="text-xs text-white/30">{pos.qty} units</span>
                        </div>
                        <p className="text-xs text-white/30 mt-0.5">Avg entry {fmt(pos.avg_entry_price)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-mono font-bold text-white">{fmt(pos.market_value)}</p>
                        <p className={`text-xs font-mono flex items-center gap-0.5 justify-end ${pl >= 0 ? 'text-[#C9A84C]' : 'text-red-400'}`}>
                          {pl >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {fmt(pos.unrealized_pl)} ({pct(pos.unrealized_plpc * 100)})
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent Orders */}
          <div className="space-y-3">
            <h2 className="text-xl font-bold text-white">Recent Orders</h2>
            {orders.length === 0 ? (
              <p className="text-white/30 text-sm py-4">No recent orders.</p>
            ) : (
              <div className="space-y-2">
                {orders.slice(0, 10).map(order => (
                  <div key={order.id} className="flex items-center gap-4 px-5 py-3 bg-[#111111] border border-white/10 rounded-xl">
                    <span className={`text-xs font-mono font-bold w-10 ${order.side === 'buy' ? 'text-[#C9A84C]' : 'text-red-400'}`}>
                      {order.side?.toUpperCase()}
                    </span>
                    <span className="text-sm font-mono text-white">{order.symbol}</span>
                    <span className="text-xs text-white/30">{order.qty} @ {order.type}</span>
                    <span className="flex-1" />
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      order.status === 'filled' ? 'text-[#C9A84C]' :
                      order.status === 'canceled' ? 'text-white/20' : 'text-white/50'
                    }`}>{order.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}