import { Link } from 'react-router-dom';
import { ArrowRight, Zap, Lock } from 'lucide-react';

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="text-xl font-bold tracking-tight">HEX6</div>
          <Link
            to="/dashboard"
            className="px-5 py-2 rounded-sm bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Enter
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 py-24 space-y-8">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-sm bg-accent/10 border border-accent/30">
            <Zap className="w-4 h-4 text-accent" />
            <span className="text-sm font-medium text-accent">Oracle Intelligence</span>
          </div>

          <h1 className="text-5xl sm:text-6xl font-bold leading-tight tracking-tight">
            Portfolio allocation{' '}
            <span className="text-accent">without bias.</span>
          </h1>

          <p className="text-lg text-secondary max-w-2xl leading-relaxed">
            HEX6 BLE is a state-conditioned probabilistic engine that reads market behavior and calculates optimal asset exposure in real time. Pure mathematics. No opinions.
          </p>
        </div>

        <div className="flex flex-wrap gap-4 pt-4">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-sm bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
          >
            Start Free Trial <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href="#how-it-works"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-sm border border-border hover:border-foreground transition-colors"
          >
            How it works
          </a>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="max-w-4xl mx-auto px-6 py-20 space-y-12">
        <div className="space-y-3">
          <h2 className="text-3xl font-bold">The Engine</h2>
          <p className="text-secondary">Three core principles</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              title: 'Reads Market State',
              desc: 'Analyzes historical price patterns and volatility to classify market conditions—bull, bear, lateral, or volatile.',
            },
            {
              title: 'Calculates Exposure',
              desc: 'Determines how much capital should flow to each asset using risk-adjusted mathematics rooted in probability theory.',
            },
            {
              title: 'Self-Learns',
              desc: 'Logs every decision and its outcome, continuously refining its model for what works and what doesn\'t.',
            },
          ].map((item, i) => (
            <div key={i} className="space-y-3 p-6 rounded-sm border border-border">
              <h3 className="font-bold">{item.title}</h3>
              <p className="text-sm text-secondary leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Why HEX6 */}
      <section className="max-w-4xl mx-auto px-6 py-20 space-y-12">
        <div className="space-y-3">
          <h2 className="text-3xl font-bold">Why HEX6 is Different</h2>
          <p className="text-secondary">Not a black box. Not a recommendation engine. An oracle.</p>
        </div>

        <div className="space-y-6">
          {[
            {
              label: 'Traditional Quant Models',
              hex6: 'Probabilistic allocation',
              hex6Feature: 'Outputs are treated as statements of probability, not truth claims',
            },
            {
              label: 'Robo-Advisors',
              hex6: 'Market-aware, not sentiment-driven',
              hex6Feature: 'Reacts only to data. No trend-chasing. No behavioral biases.',
            },
            {
              label: 'AI Trading Systems',
              hex6: 'Explainable by design',
              hex6Feature: 'Every decision is logged, auditable, and verifiable through EGTS.',
            },
          ].map((item, i) => (
            <div key={i} className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-6 border-b border-border last:border-0">
              <div>
                <p className="text-sm text-secondary mb-2">{item.label}</p>
                <p className="font-medium">Tries to predict. Often fails.</p>
              </div>
              <div>
                <p className="text-sm text-secondary mb-2">HEX6 BLE</p>
                <p className="font-medium text-accent">{item.hex6}</p>
                <p className="text-sm text-secondary mt-2">{item.hex6Feature}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* EGTS Teaser */}
      <section className="max-w-4xl mx-auto px-6 py-20 space-y-12">
        <div className="space-y-6 p-8 rounded-sm border border-accent/20 bg-accent/5">
          <div className="flex items-start gap-3">
            <Lock className="w-5 h-5 text-accent shrink-0 mt-1" />
            <div className="space-y-2">
              <h3 className="font-bold text-lg">Every decision is sealed.</h3>
              <p className="text-secondary leading-relaxed">
                EGTS—the Evrica Global Token Standard—creates an immutable, cryptographically verified record of every HEX6 decision. Not for blockchain hype. For institutional transparency.
              </p>
              <p className="text-sm text-secondary/60 pt-2">
                Part of Trading Mode, launching soon.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-4xl mx-auto px-6 py-20 space-y-8">
        <div className="space-y-4">
          <h2 className="text-3xl font-bold">Ready to think differently about allocation?</h2>
          <p className="text-lg text-secondary">No credit card required. 7-day free trial.</p>
        </div>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 px-8 py-4 rounded-sm bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors text-lg"
        >
          Start Trial <ArrowRight className="w-4 h-4" />
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="max-w-4xl mx-auto px-6 flex items-center justify-between text-sm text-secondary">
          <p>HEX6 BLE Oracle © 2026</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-foreground transition-colors">
              Terms
            </a>
            <a href="#" className="hover:text-foreground transition-colors">
              Privacy
            </a>
            <a href="#" className="hover:text-foreground transition-colors">
              Disclosure
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}