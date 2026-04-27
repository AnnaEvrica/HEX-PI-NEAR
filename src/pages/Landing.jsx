import { Link } from 'react-router-dom';
import { Shield, Zap, BarChart2, TrendingUp, Activity, Lock, ArrowRight, CheckCircle2 } from 'lucide-react';

const FEATURES = [
  {
    icon: Zap,
    title: 'HEX6 BLE Engine',
    desc: 'State-Conditioned Exposure Field Model that reads market mood — BULL, BEAR, LATERAL, VOLATILE — and computes the mathematically optimal position size for every asset.',
    gold: true,
  },
  {
    icon: Activity,
    title: 'Autonomous Day Trading',
    desc: 'Scans dozens of crypto and token markets in real time, ranks by risk-adjusted momentum, and executes the highest-margin trades automatically via Alpaca.',
  },
  {
    icon: Shield,
    title: 'EGTS Governance',
    desc: 'Every single decision is cryptographically sealed with a SHA-256 fingerprint — an immutable, tamper-proof audit receipt that proves what happened and when.',
  },
  {
    icon: BarChart2,
    title: 'Backtest Engine',
    desc: 'Run historical simulations on any portfolio with real Yahoo Finance data. Get Sharpe ratio, CAGR, max drawdown, and full equity curves before committing capital.',
  },
  {
    icon: TrendingUp,
    title: 'Self-Learning Memory',
    desc: 'The engine records every trade outcome and backtest result. Over time it recognises patterns — what worked, what didn\'t — and sharpens its own edge.',
  },
  {
    icon: Lock,
    title: 'Institutional Grade',
    desc: 'Built for fund managers and professional traders. Handles AUM allocation, multi-manager portals, AI-powered investment theses, and full legal compliance documentation.',
  },
];

const STATS = [
  { label: 'Cryptos Scanned', value: '50+' },
  { label: 'Engine Version', value: 'v5.0' },
  { label: 'Audit Standard', value: 'EGTS' },
  { label: 'Trade Type', value: 'Paper / Live' },
];

const HOW = [
  { n: '01', title: 'Connect Alpaca', desc: 'Link your paper or live Alpaca account. Your keys stay encrypted server-side — never exposed to the browser.' },
  { n: '02', title: 'HEX6 Scans Markets', desc: 'The engine analyses 50+ crypto pairs, ranks them by momentum and risk-adjusted return, and selects the highest-margin opportunities.' },
  { n: '03', title: 'Trades Execute Automatically', desc: 'Optimal position sizes are calculated using a Kelly-inspired formula, then placed as market orders on Alpaca — paper or live.' },
  { n: '04', title: 'Every Decision is Sealed', desc: 'EGTS mints a cryptographic receipt for every trade. Immutable. Verifiable by anyone. No black box.' },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-black text-white">

      {/* Nav */}
      <nav className="border-b border-white/10 px-6 md:px-12 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-[#C9A84C] animate-pulse" />
          <span className="font-bold text-white tracking-tight">HEX6 BLE</span>
          <span className="text-white/20 text-xs hidden sm:block">by Evrica Technologies Inc.</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden sm:flex items-center gap-1.5 text-xs text-[#C9A84C] border border-[#C9A84C]/30 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-[#C9A84C]" />
            EGTS Verified
          </span>
          <Link to="/dashboard"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#C9A84C] text-black text-sm font-bold hover:bg-[#b8973d] transition-colors">
            Open Platform <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 md:px-12 py-24 md:py-36 max-w-5xl mx-auto space-y-8">
        <div className="inline-flex items-center gap-2 text-xs text-[#C9A84C] border border-[#C9A84C]/30 px-3 py-1.5 rounded-full">
          <Zap className="w-3 h-3" /> HEX6 BLE v5.0 · Hexadecimal Binary Logic Engine
        </div>
        <h1 className="text-5xl md:text-7xl font-black leading-none tracking-tight">
          Institutional<br />
          <span className="text-[#C9A84C]">Portfolio Intelligence.</span><br />
          Automated.
        </h1>
        <p className="text-white/50 text-lg md:text-xl max-w-2xl leading-relaxed">
          HEX6 BLE is an autonomous trading and governance engine that reads market conditions in real time, executes the highest-margin crypto trades, and seals every decision with a cryptographic audit receipt — so you always know exactly what happened and why.
        </p>
        <div className="flex flex-wrap gap-4 pt-2">
          <Link to="/dashboard"
            className="flex items-center gap-2 px-7 py-4 rounded-xl bg-[#C9A84C] text-black font-bold text-sm hover:bg-[#b8973d] transition-colors">
            <Zap className="w-4 h-4" /> Open the Platform
          </Link>
          <Link to="/dashboard"
            className="flex items-center gap-2 px-7 py-4 rounded-xl border border-white/20 text-white text-sm hover:border-white/40 transition-colors">
            View Audit Trail <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-white/10 px-6 md:px-12 py-8">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map(({ label, value }) => (
            <div key={label} className="space-y-1">
              <p className="text-3xl font-black font-mono text-[#C9A84C]">{value}</p>
              <p className="text-xs text-white/30 uppercase tracking-widest">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 md:px-12 py-24 max-w-5xl mx-auto space-y-12">
        <div className="space-y-2">
          <p className="text-xs text-white/30 uppercase tracking-widest">How It Works</p>
          <h2 className="text-3xl md:text-4xl font-black">From zero to autonomous trading<br />in four steps.</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {HOW.map(({ n, title, desc }) => (
            <div key={n} className="bg-[#0d0d0d] border border-white/10 rounded-2xl p-6 space-y-3 hover:border-white/20 transition-colors">
              <span className="text-5xl font-black font-mono text-white/8 select-none">{n}</span>
              <div className="-mt-2 space-y-2">
                <p className="text-white font-bold text-lg">{title}</p>
                <p className="text-white/50 text-sm leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features grid */}
      <section className="px-6 md:px-12 py-16 max-w-5xl mx-auto space-y-10">
        <div className="space-y-2">
          <p className="text-xs text-white/30 uppercase tracking-widest">Platform Capabilities</p>
          <h2 className="text-3xl md:text-4xl font-black">Everything you need.<br />Nothing you don't.</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(({ icon: Icon, title, desc, gold }) => (
            <div key={title} className={`rounded-2xl border p-6 space-y-3 ${gold ? 'border-[#C9A84C]/30 bg-[#C9A84C]/5' : 'border-white/10 bg-[#0d0d0d]'}`}>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${gold ? 'bg-[#C9A84C]/20' : 'bg-white/5'}`}>
                <Icon className={`w-4 h-4 ${gold ? 'text-[#C9A84C]' : 'text-white/40'}`} />
              </div>
              <p className={`font-bold ${gold ? 'text-[#C9A84C]' : 'text-white'}`}>{title}</p>
              <p className="text-white/50 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HEX6 vs EGTS explainer */}
      <section className="px-6 md:px-12 py-16 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#0d0d0d] border border-[#C9A84C]/20 rounded-2xl p-8 space-y-4">
            <Zap className="w-6 h-6 text-[#C9A84C]" />
            <h3 className="text-2xl font-black text-[#C9A84C]">HEX6 BLE</h3>
            <p className="text-xs text-white/30 uppercase tracking-widest">The Decision Maker</p>
            <ul className="space-y-2">
              {[
                'Reads market state: BULL / BEAR / LATERAL / VOLATILE',
                'Scans 50+ crypto markets for best opportunities',
                'Calculates risk-adjusted position sizes (Kelly-inspired)',
                'Executes trades automatically on Alpaca',
                'Self-learns from every outcome via HEX6 Memory',
              ].map(item => (
                <li key={item} className="flex gap-2 text-sm text-white/60">
                  <CheckCircle2 className="w-4 h-4 text-[#C9A84C] shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-[#0d0d0d] border border-white/10 rounded-2xl p-8 space-y-4">
            <Shield className="w-6 h-6 text-white/40" />
            <h3 className="text-2xl font-black text-white">EGTS</h3>
            <p className="text-xs text-white/30 uppercase tracking-widest">The Record Keeper</p>
            <ul className="space-y-2">
              {[
                'Seals every trade with a SHA-256 cryptographic hash',
                'Immutable — no UPDATE or DELETE ever',
                'Independently verifiable by anyone with the hash',
                'Full legal contract downloadable per receipt',
                'Row-Level Security enforced at database level',
              ].map(item => (
                <li key={item} className="flex gap-2 text-sm text-white/60">
                  <CheckCircle2 className="w-4 h-4 text-white/30 shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-4 p-5 bg-white/3 border border-white/8 rounded-2xl text-sm text-white/50 text-center leading-relaxed">
          <strong className="text-white">Together:</strong> HEX6 BLE is the intelligence. EGTS is the accountability layer. One decides. The other makes sure you can prove it — forever.
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 md:px-12 py-24 max-w-5xl mx-auto text-center space-y-6">
        <h2 className="text-4xl md:text-5xl font-black">Ready to trade smarter?</h2>
        <p className="text-white/40 text-lg max-w-lg mx-auto">Connect your Alpaca account and let HEX6 start scanning crypto markets for you in minutes.</p>
        <Link to="/dashboard"
          className="inline-flex items-center gap-3 px-8 py-4 rounded-xl bg-[#C9A84C] text-black font-bold text-base hover:bg-[#b8973d] transition-colors">
          <Zap className="w-5 h-5" /> Launch HEX6 Platform
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 px-6 text-center">
        <p className="text-xs text-white/20 font-mono">HEX6 BLE v5.0 · EGTS v1.0 · © Evrica Technologies Inc. · Not financial advice.</p>
      </footer>
    </div>
  );
}