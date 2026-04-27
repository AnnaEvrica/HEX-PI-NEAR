import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Key, CheckCircle2, AlertTriangle, RefreshCw, ExternalLink, Eye, EyeOff, Save, Zap } from 'lucide-react';

export default function Settings() {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [user, setUser] = useState(null);

  // Key input fields (user provides for reference — actual keys live in backend secrets)
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    // Auto-test on load
    testConnection();
  }, []);

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await base44.functions.invoke('alpacaTrading', { action: 'getAccount' });
      if (res.data?.error) throw new Error(res.data.error);
      const acct = res.data?.account;
      if (!acct) throw new Error('No account data returned');
      setTestResult({
        success: true,
        account: acct,
        portfolioValue: parseFloat(acct.portfolio_value || 0),
        buyingPower: parseFloat(acct.buying_power || 0),
        cash: parseFloat(acct.cash || 0),
        status: acct.status,
        env: acct.status === 'ACTIVE' ? 'Paper' : 'Live',
      });
    } catch (err) {
      setTestResult({ success: false, message: err.message });
    } finally {
      setTesting(false);
    }
  }

  const fmt = (v) => parseFloat(v || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 space-y-10">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold text-white">Settings</h1>
        <p className="text-white/40 text-sm">Manage your Alpaca trading connection and platform preferences.</p>
      </div>

      {user && (
        <div className="flex items-center gap-3 p-4 bg-[#111111] border border-white/10 rounded-xl">
          <div className="w-10 h-10 rounded-full bg-[#C9A84C]/20 flex items-center justify-center">
            <span className="text-[#C9A84C] font-bold text-sm">{user.full_name?.[0] || user.email?.[0] || '?'}</span>
          </div>
          <div>
            <p className="text-white font-medium">{user.full_name || 'You'}</p>
            <p className="text-white/40 text-sm">{user.email}</p>
          </div>
        </div>
      )}

      {/* Connection Status */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-[#C9A84C]" />
            <h2 className="text-lg font-bold text-white">Alpaca Connection</h2>
          </div>
          <button onClick={testConnection} disabled={testing}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 text-white/50 text-xs hover:text-white transition-colors disabled:opacity-40">
            <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
            {testing ? 'Testing…' : 'Re-test'}
          </button>
        </div>

        {testing && !testResult && (
          <div className="p-5 bg-[#111111] border border-white/10 rounded-xl flex items-center gap-3 text-white/40 text-sm">
            <div className="w-4 h-4 border-2 border-white/10 border-t-[#C9A84C] rounded-full animate-spin" />
            Testing Alpaca connection…
          </div>
        )}

        {testResult?.success && (
          <div className="bg-[#111111] border border-[#C9A84C]/30 rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10">
              <CheckCircle2 className="w-5 h-5 text-[#C9A84C]" />
              <div className="flex-1">
                <p className="text-white font-medium">Connected to Alpaca</p>
                <p className="text-xs text-white/30">{testResult.status?.toUpperCase()} account</p>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
                testResult.env === 'Paper'
                  ? 'border-amber-700/40 text-amber-400 bg-amber-950/30'
                  : 'border-red-700/40 text-red-400 bg-red-950/30'
              }`}>
                {testResult.env === 'Paper' ? '📋 Paper Trading' : '⚡ Live Trading'}
              </span>
            </div>
            <div className="grid grid-cols-3 divide-x divide-white/10">
              {[
                { label: 'Portfolio Value', value: fmt(testResult.portfolioValue), gold: true },
                { label: 'Buying Power', value: fmt(testResult.buyingPower) },
                { label: 'Cash', value: fmt(testResult.cash) },
              ].map(({ label, value, gold }) => (
                <div key={label} className="px-4 py-4">
                  <p className="text-xs text-white/30 uppercase tracking-widest mb-1">{label}</p>
                  <p className={`text-base font-bold font-mono ${gold ? 'text-[#C9A84C]' : 'text-white'}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {testResult && !testResult.success && (
          <div className="p-5 bg-[#111111] border border-red-800/40 rounded-xl space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-red-400 font-medium text-sm">Not connected</p>
                <p className="text-white/40 text-sm mt-1">{testResult.message}</p>
              </div>
            </div>

            <div className="border-t border-white/10 pt-4 space-y-3">
              <p className="text-white font-medium text-sm">To fix this, set your Alpaca secrets in Base44:</p>
              <div className="space-y-2">
                {[
                  { key: 'ALPACA_API_KEY', desc: 'Your Alpaca API Key ID', example: 'PKXXXXXXXXXXXXXXXX' },
                  { key: 'ALPACA_SECRET_KEY', desc: 'Your Alpaca Secret Key', example: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
                  { key: 'ALPACA_BASE_URL', desc: 'Trading environment', example: 'https://paper-api.alpaca.markets' },
                ].map(({ key, desc, example }) => (
                  <div key={key} className="flex items-start gap-3 p-3 bg-black/40 rounded-lg border border-white/10">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-[#C9A84C]">{key}</p>
                      <p className="text-xs text-white/40 mt-0.5">{desc}</p>
                      <p className="text-xs font-mono text-white/20 mt-0.5 truncate">{example}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={() => setShowInstructions(!showInstructions)}
              className="text-xs text-[#C9A84C] hover:underline">
              {showInstructions ? 'Hide' : 'Show'} step-by-step instructions
            </button>

            {showInstructions && (
              <ol className="space-y-2 mt-2">
                {[
                  'Go to alpaca.markets → log in → click "API Keys"',
                  'Generate a new API Key (choose Paper or Live)',
                  'Copy the Key ID and Secret Key immediately (secret shown once)',
                  'In Base44 dashboard: open your app → Settings → Secrets',
                  'Add ALPACA_API_KEY, ALPACA_SECRET_KEY, and ALPACA_BASE_URL',
                  'For paper trading use: https://paper-api.alpaca.markets',
                  'For live trading use: https://api.alpaca.markets',
                  'Click "Re-test" above to confirm connection',
                ].map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm text-white/50">
                    <span className="text-[#C9A84C] font-mono shrink-0">{i + 1}.</span>
                    {step}
                  </li>
                ))}
              </ol>
            )}

            <a href="https://alpaca.markets" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-[#C9A84C] hover:underline">
              Open Alpaca Markets <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>

      {/* Environments explained */}
      <div className="bg-[#111111] border border-white/10 rounded-xl p-5 space-y-4">
        <p className="text-xs text-white/30 uppercase tracking-widest">Trading Environments</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            {
              label: '📋 Paper Trading',
              url: 'https://paper-api.alpaca.markets',
              desc: 'Simulated trading with real market prices — no real money at risk. Recommended for testing HEX6.',
              safe: true,
            },
            {
              label: '⚡ Live Trading',
              url: 'https://api.alpaca.markets',
              desc: 'Real money, real trades. Only switch when you are confident in your HEX6 strategy.',
              safe: false,
            },
          ].map(env => (
            <div key={env.label} className={`p-4 rounded-lg border ${env.safe ? 'border-amber-800/30 bg-amber-950/10' : 'border-red-900/30 bg-red-950/10'}`}>
              <p className="text-sm font-bold text-white">{env.label}</p>
              <p className="text-xs text-white/40 mt-1 leading-relaxed">{env.desc}</p>
              <p className="text-xs font-mono text-white/20 mt-2 break-all">{env.url}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-white/20">Set ALPACA_BASE_URL secret to switch environments. Requires re-deploy.</p>
      </div>

      {/* Risk Disclaimer */}
      <div className="bg-[#111111] border border-amber-800/30 rounded-xl p-5 space-y-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <p className="text-amber-300 font-medium text-sm">Risk Disclaimer</p>
        </div>
        <p className="text-sm text-white/40 leading-relaxed">
          HEX6 analysis is algorithmic and not financial advice. Paper trading is safe to experiment with — it uses real prices but no real money. Live trading involves real capital and real risk. You are solely responsible for all trading decisions.
        </p>
      </div>
    </div>
  );
}