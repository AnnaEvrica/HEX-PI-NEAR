import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Key, CheckCircle2, AlertTriangle, RefreshCw, ExternalLink, Eye, EyeOff } from 'lucide-react';

export default function Settings() {
  const [alpacaKey, setAlpacaKey] = useState('');
  const [alpacaSecret, setAlpacaSecret] = useState('');
  const [baseUrl, setBaseUrl] = useState('https://paper-api.alpaca.markets');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [showSecret, setShowSecret] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await base44.functions.invoke('alpacaTrading', { action: 'getAccount' });
      if (res.data?.error) throw new Error(res.data.error);
      const acct = res.data?.account;
      setTestResult({
        success: true,
        message: `Connected! Portfolio value: $${parseFloat(acct?.portfolio_value || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        account: acct,
      });
    } catch (err) {
      setTestResult({ success: false, message: err.message });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 space-y-10">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold text-white">Settings</h1>
        <p className="text-white/40 text-sm">Connect your trading account and manage your preferences.</p>
      </div>

      {/* Who you are */}
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

      {/* Alpaca API Connection */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-[#C9A84C]" />
          <h2 className="text-lg font-bold text-white">Alpaca Trading Connection</h2>
        </div>
        <p className="text-sm text-white/40 leading-relaxed">
          Your Alpaca API keys are stored securely in the app's backend secrets — they never touch the browser. 
          To update them, go to your app's Settings → Secrets in the Base44 dashboard.
        </p>

        <div className="bg-[#111111] border border-white/10 rounded-xl p-5 space-y-5">
          {/* Current status */}
          <div>
            <p className="text-xs text-white/30 uppercase tracking-widest mb-3">Current Connection Status</p>
            <button onClick={testConnection} disabled={testing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#C9A84C]/40 text-[#C9A84C] text-sm font-medium hover:bg-[#C9A84C]/10 transition-colors disabled:opacity-40">
              <RefreshCw className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} />
              {testing ? 'Testing connection…' : 'Test Alpaca Connection'}
            </button>
            {testResult && (
              <div className={`mt-3 flex items-start gap-2 p-3 rounded-lg border text-sm ${
                testResult.success
                  ? 'border-green-800/40 bg-green-950/20 text-green-400'
                  : 'border-red-800/40 bg-red-950/20 text-red-400'
              }`}>
                {testResult.success
                  ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
                <div>
                  <p>{testResult.message}</p>
                  {testResult.success && testResult.account && (
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-green-300/60">
                      <span>Buying power: ${parseFloat(testResult.account.buying_power || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      <span>Status: {testResult.account.status}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="border-t border-white/10 pt-4 space-y-3">
            <p className="text-xs text-white/30 uppercase tracking-widest">How to update your API keys</p>
            <div className="space-y-2">
              {[
                'Go to alpaca.markets and log into your account',
                'Click on "API Keys" in your Alpaca dashboard',
                'Generate or copy your API Key ID and Secret Key',
                'In Base44, open your app Settings → Secrets',
                'Set ALPACA_API_KEY, ALPACA_SECRET_KEY, and ALPACA_BASE_URL',
              ].map((step, i) => (
                <div key={i} className="flex gap-3">
                  <span className="text-xs text-[#C9A84C] font-mono w-5 shrink-0 mt-0.5">{i + 1}.</span>
                  <p className="text-sm text-white/50">{step}</p>
                </div>
              ))}
            </div>
            <a href="https://alpaca.markets" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-[#C9A84C] hover:underline mt-1">
              Open Alpaca Markets <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Environment */}
          <div className="border-t border-white/10 pt-4 space-y-3">
            <p className="text-xs text-white/30 uppercase tracking-widest">Trading Environment</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Paper Trading', url: 'https://paper-api.alpaca.markets', desc: 'Simulated, no real money' },
                { label: 'Live Trading', url: 'https://api.alpaca.markets', desc: 'Real money, real trades' },
              ].map(env => (
                <div key={env.label} className={`p-3 rounded-lg border ${
                  baseUrl === env.url ? 'border-[#C9A84C]/40 bg-[#C9A84C]/5' : 'border-white/10'
                }`}>
                  <p className={`text-sm font-medium ${baseUrl === env.url ? 'text-[#C9A84C]' : 'text-white/50'}`}>{env.label}</p>
                  <p className="text-xs text-white/30 mt-0.5">{env.desc}</p>
                  <p className="text-xs font-mono text-white/20 mt-1 break-all">{env.url}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-white/30">Set ALPACA_BASE_URL in secrets to switch environments.</p>
          </div>
        </div>
      </div>

      {/* Risk Disclaimer */}
      <div className="bg-[#111111] border border-amber-800/30 rounded-xl p-5 space-y-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <p className="text-amber-300 font-medium text-sm">Risk Disclaimer</p>
        </div>
        <p className="text-sm text-white/40 leading-relaxed">
          All trading features use Alpaca Markets. Paper trading uses real prices but simulated money — safe to experiment with. 
          Live trading involves real capital and real risk. HEX6 analysis is algorithmic, not financial advice. 
          You are responsible for all trading decisions.
        </p>
      </div>
    </div>
  );
}