import { Link } from 'react-router-dom';
import { Shield, Zap, BarChart2, ArrowRight, CheckCircle2, BookOpen, Activity, FlaskConical, Users, TrendingUp } from 'lucide-react';

function Section({ title, children }) {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-white">{title}</h2>
      {children}
    </div>
  );
}

function Card({ icon: CardIcon, title, children, gold }) {
  return (
    <div className={`rounded-xl border p-5 space-y-2 ${gold ? 'border-[#C9A84C]/30 bg-[#C9A84C]/5' : 'border-white/10 bg-[#111111]'}`}>
      {CardIcon && <CardIcon className={`w-5 h-5 ${gold ? 'text-[#C9A84C]' : 'text-white/40'}`} />}
      {title && <p className={`font-semibold ${gold ? 'text-[#C9A84C]' : 'text-white'}`}>{title}</p>}
      <div className="text-sm text-white/60 leading-relaxed space-y-2">{children}</div>
    </div>
  );
}

function Step({ n, title, desc, to, linkLabel }) {
  return (
    <div className="flex gap-4">
      <div className="w-8 h-8 rounded-full bg-[#C9A84C] text-black text-sm font-bold flex items-center justify-center shrink-0 mt-0.5">{n}</div>
      <div className="flex-1 space-y-1">
        <p className="text-white font-semibold">{title}</p>
        <p className="text-sm text-white/50 leading-relaxed">{desc}</p>
        {to && (
          <Link to={to} className="inline-flex items-center gap-1 text-xs text-[#C9A84C] hover:underline mt-1">
            Go to {linkLabel} <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      </div>
    </div>
  );
}

export default function About() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-14 space-y-16">

      {/* Hero */}
      <div className="space-y-4 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#C9A84C]/30 text-[#C9A84C] text-xs font-medium mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#C9A84C] animate-pulse" />
          Evrica Technologies Inc.
        </div>
        <h1 className="text-5xl font-bold text-white leading-tight">HEX6 BLE</h1>
        <p className="text-lg text-white/50 max-w-xl mx-auto leading-relaxed">
          An institutional-grade portfolio intelligence engine — and the audit system that makes every decision permanently verifiable.
        </p>
      </div>

      {/* What is HEX6 BLE */}
      <Section title="What is HEX6 BLE?">
        <Card icon={Zap} gold>
          <p>
            <strong className="text-[#C9A84C]">HEX6 BLE</strong> stands for <strong className="text-[#C9A84C]">Hexadecimal Binary Logic Engine</strong>. It's the brain of this platform — a sophisticated mathematical model developed by Evrica Technologies Inc. that analyses financial markets and decides, at any given moment, how much of each asset you should hold in your portfolio.
          </p>
          <p>
            Think of it like a very experienced portfolio manager who never sleeps, never panics, and always makes decisions based on data — not emotion.
          </p>
        </Card>
        <Card icon={BarChart2}>
          <p className="font-medium text-white">What does it actually do?</p>
          <p>
            Every asset in your portfolio has a price history. HEX6 BLE reads those historical price movements and asks: <em>"Given how this asset has behaved in the past, how much of my money should I put into it right now to maximise my return without taking on too much risk?"</em>
          </p>
          <p>
            It does this continuously — and every time market conditions shift, it recalculates and tells you whether to hold more, hold less, or stay put.
          </p>
        </Card>
      </Section>

      {/* The Math — plain English */}
      <Section title="The Math (in plain English)">
        <p className="text-white/50 text-sm">We won't share the proprietary details of our algorithm, but here's the honest intuition behind it:</p>
        <div className="space-y-3">
          {[
            {
              title: 'It reads the market\'s "mood"',
              body: 'HEX6 BLE looks at recent price patterns to classify the market into one of five states: BULL (prices trending up), BEAR (trending down), LATERAL (going sideways), VOLATILE (unpredictable swings), or SILENCE (engine paused for safety). Each state triggers a different strategy.',
            },
            {
              title: 'It measures risk vs reward',
              body: 'The engine calculates the expected return of an asset and how risky (volatile) that return is likely to be. Assets that offer a good return for their level of risk get a higher allocation. Risky assets with poor expected return get a lower one — or zero.',
            },
            {
              title: 'It uses a risk-adjusted sizing formula',
              body: 'At its core, HEX6 BLE uses a principle similar to the Kelly Criterion — a mathematical formula originally developed for gambling and later adopted by professional fund managers. It asks: given your risk tolerance, what\'s the mathematically optimal fraction of your portfolio to put into this asset? We\'ve extended this with our proprietary state-conditioning layer.',
            },
            {
              title: 'It adjusts for who you are',
              body: 'The engine accepts a "risk aversion" setting. If you\'re conservative, it dials down allocations even when the signal is positive. If you\'re more aggressive, it leans in. This ensures the output is personalised, not one-size-fits-all.',
            },
          ].map(({ title, body }) => (
            <div key={title} className="flex gap-3 bg-[#111111] border border-white/10 rounded-xl p-4">
              <CheckCircle2 className="w-4 h-4 text-[#C9A84C] shrink-0 mt-0.5" />
              <div>
                <p className="text-white text-sm font-semibold mb-1">{title}</p>
                <p className="text-white/50 text-sm leading-relaxed">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* What is EGTS */}
      <Section title="What is EGTS?">
        <Card icon={Shield} gold>
          <p>
            <strong className="text-[#C9A84C]">EGTS</strong> stands for <strong className="text-[#C9A84C]">Evrica Global Token Standard</strong>. It's completely separate from the HEX6 engine — it's not about making decisions. It's about <em>recording</em> them in a way that can never be tampered with.
          </p>
          <p>
            Every time the HEX6 engine makes a decision — a rebalance, a silence event, an allocation — EGTS instantly creates a permanent, cryptographically-signed receipt. Think of it like a notarised document that proves, beyond doubt, what decision was made, when, and why.
          </p>
        </Card>
        <div className="space-y-3">
          {[
            {
              title: 'What\'s a cryptographic receipt?',
              body: 'Each receipt has a unique fingerprint (called a hash) generated from the actual data inside it. If anyone tries to change even a single character of the record, the fingerprint breaks — immediately proving tampering occurred. This is the same technology that underpins blockchains.',
            },
            {
              title: 'Why does this matter?',
              body: 'For fund managers and institutional investors, being able to prove that a decision was made at a specific time — and hasn\'t been altered since — is critical for regulatory compliance, audits, and legal defensibility. EGTS provides that proof automatically.',
            },
            {
              title: 'Who can verify it?',
              body: 'Anyone. The receipts are stored in the Governance section and can be verified by pasting the cryptographic hash into the Legal page\'s verification tool. You don\'t need to trust us — the math proves it.',
            },
          ].map(({ title, body }) => (
            <div key={title} className="flex gap-3 bg-[#111111] border border-white/10 rounded-xl p-4">
              <CheckCircle2 className="w-4 h-4 text-[#C9A84C] shrink-0 mt-0.5" />
              <div>
                <p className="text-white text-sm font-semibold mb-1">{title}</p>
                <p className="text-white/50 text-sm leading-relaxed">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* How they're different */}
      <Section title="HEX6 BLE vs EGTS — What's the difference?">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-[#111111] border border-[#C9A84C]/20 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#C9A84C]" />
              <p className="text-[#C9A84C] font-bold text-sm">HEX6 BLE</p>
            </div>
            <p className="text-xs text-white/30 uppercase tracking-widest">The Decision Maker</p>
            <ul className="text-sm text-white/60 space-y-1.5">
              <li>• Analyses market data in real time</li>
              <li>• Calculates how much of each asset to hold</li>
              <li>• Detects market states (BULL, BEAR, etc.)</li>
              <li>• Executes trades via Alpaca</li>
              <li>• Risk-adjusts based on your profile</li>
            </ul>
          </div>
          <div className="bg-[#111111] border border-white/10 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-white/40" />
              <p className="text-white font-bold text-sm">EGTS</p>
            </div>
            <p className="text-xs text-white/30 uppercase tracking-widest">The Record Keeper</p>
            <ul className="text-sm text-white/60 space-y-1.5">
              <li>• Records every decision permanently</li>
              <li>• Issues cryptographic receipts</li>
              <li>• Enables independent verification</li>
              <li>• Provides legal audit trail</li>
              <li>• Cannot be altered or deleted</li>
            </ul>
          </div>
        </div>
        <div className="bg-[#111111] border border-white/10 rounded-xl p-5 text-sm text-white/50 leading-relaxed">
          <strong className="text-white">Together:</strong> HEX6 BLE makes the call, EGTS writes it in ink that can never be erased. One is the intelligence, the other is the accountability layer. You need both for institutional-grade portfolio governance.
        </div>
      </Section>

      {/* How to use this app */}
      <Section title="How to use this app — step by step">
        <p className="text-white/50 text-sm leading-relaxed">
          Here's exactly how to get value out of this platform, from start to finish.
        </p>
        <div className="space-y-6 pt-2">
          <Step n="1" title="Add your assets"
            desc="Go to the Portfolio page and add the assets you want to govern — stocks, crypto, ETFs, whatever. Just enter the ticker symbol (e.g. AAPL, BTC, SPY) and the asset class. These become the universe the HEX6 engine will analyse."
            to="/portfolio" linkLabel="Portfolio" />
          <Step n="2" title="Run the HEX6 engine"
            desc="From the Dashboard, hit 'Trigger Rebalance'. The engine will fetch live market data for all your assets, calculate optimal weights for each one, and mint EGTS receipts proving it happened. This is your first governance event."
            to="/" linkLabel="Dashboard" />
          <Step n="3" title="Explore each asset in depth"
            desc="Click any asset in your portfolio to open its detail page. There you'll find a full overview, an AI-powered analysis tab (the ✦ AI tab), your audit trail, and legal documentation — all specific to that asset."
            to="/portfolio" linkLabel="Portfolio" />
          <Step n="4" title="Use the AI tab to predict, trade, and get receipts"
            desc="Inside any asset's ✦ AI tab: first get a plain-English prediction from the live HEX6 engine. Then either place a manual trade or hit 'Auto-Trade' to let HEX6 calculate the exact size and execute it on Alpaca paper trading automatically. Finally, your EGTS receipt is shown immediately."
            to="/portfolio" linkLabel="an Asset" />
          <Step n="5" title="Backtest before you commit"
            desc="Not sure about a strategy? Go to Backtest, pick your assets and time period, and run a historical simulation. The engine will show you how your portfolio would have performed — with real market data and full performance metrics."
            to="/backtest" linkLabel="Backtest" />
          <Step n="6" title="Write an investment thesis"
            desc="The Thesis page uses the HEX6 engine output and AI to generate a structured investment case for any asset. Useful for documentation, presentations, or just understanding why the engine is recommending what it is."
            to="/thesis" linkLabel="Thesis" />
          <Step n="7" title="Manage fund managers and AUM"
            desc="If you manage money on behalf of others, use the Managers page to add fund managers, assign assets to them, and see how HEX6 allocations translate into actual dollar deployments across their AUM."
            to="/managers" linkLabel="Managers" />
          <Step n="8" title="View your full audit trail"
            desc="The Governance page shows every decision ever made by the engine — timestamped and cryptographically sealed. Use the Legal page to independently verify any receipt."
            to="/governance" linkLabel="Governance" />
        </div>
      </Section>

      {/* Live trading note */}
      <div className="bg-[#111111] border border-[#C9A84C]/20 rounded-xl p-6 space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#C9A84C]" />
          <p className="text-white font-semibold">A note on paper trading</p>
        </div>
        <p className="text-sm text-white/50 leading-relaxed">
          The Trading and Auto-Trade features are connected to <strong className="text-white">Alpaca Markets paper trading</strong> — a simulated environment that uses real market prices but fake money. Nothing here risks your real capital unless you explicitly switch to a live Alpaca account. Paper trading is the recommended way to validate HEX6 strategies before committing real funds.
        </p>
      </div>

      {/* Footer CTA */}
      <div className="text-center space-y-3 pt-4">
        <p className="text-xs text-white/20 font-mono">HEX6 BLE v5.0 · EGTS v1.0 · Evrica Technologies Inc.</p>
        <div className="flex items-center justify-center gap-3">
          <Link to="/" className="text-sm text-[#C9A84C] hover:underline">Go to Dashboard →</Link>
          <span className="text-white/20">·</span>
          <Link to="/legal" className="text-sm text-white/40 hover:text-white">Legal & Compliance</Link>
        </div>
      </div>
    </div>
  );
}