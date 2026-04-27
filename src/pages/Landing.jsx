import { Link } from 'react-router-dom';
import { ArrowRight, Zap, Lock } from 'lucide-react';

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="text-xl font-bold tracking-tight">HEX6 BLE</div>
          <Link
            to="/app"
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
            <span className="text-sm font-bold text-accent">HEX6 BLE</span>
            <span className="text-sm font-medium text-accent">Probabilistic Intelligence</span>
          </div>

          <h1 className="text-5xl sm:text-6xl font-bold leading-tight tracking-tight">
            Probability.{' '}
            <span className="text-accent">Not prediction.</span>
          </h1>

          <p className="text-lg text-secondary max-w-2xl leading-relaxed">
            HEX6 BLE is a probabilistic intelligence system. It identifies system states, preserves outcome distributions, and generates inference—not forecasts. No opinions. No collapse to a single answer. Only probability, continuously updated.
          </p>
        </div>

        <div className="flex flex-wrap gap-4 pt-4">
          <Link
            to="/app"
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
        <div className="space-y-6">
          <h2 className="text-3xl font-bold">How It Works</h2>
          <div className="space-y-4 text-secondary">
            <p className="leading-relaxed">Complex systems don't move linearly. They shift between states.</p>
            <p className="leading-relaxed">HEX6 BLE models those shifts. At any moment, the system estimates:</p>
            <ul className="space-y-2 ml-6">
              <li>• The current state of the system</li>
              <li>• The range of possible outcomes</li>
              <li>• The probability of each outcome</li>
            </ul>
            <p className="leading-relaxed font-semibold pt-2">Instead of asking <em>"what will happen?"</em></p>
            <p className="leading-relaxed italic text-foreground">"Given the current state, how is the distribution of outcomes changing?"</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
          {
            title: 'State',
            desc: 'Every system exists in a condition defined by structure, behavior, and change over time. HEX6 BLE identifies that condition.',
          },
          {
            title: 'Distribution',
            desc: 'Outcomes exist as a range—each with a likelihood. HEX6 BLE preserves this distribution instead of collapsing it.',
          },
          {
            title: 'Inference',
            desc: 'Outputs emerge from probability structure. Not assumption. Not narrative. Only mathematics.',
          },
          ].map((item, i) => (
            <div key={i} className="space-y-3 p-6 rounded-sm border border-border">
              <h3 className="font-bold">{item.title}</h3>
              <p className="text-sm text-secondary leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Structural Difference */}
      <section className="max-w-4xl mx-auto px-6 py-20 space-y-12">
        <div className="space-y-3">
          <h2 className="text-3xl font-bold">Structural Difference</h2>
          <p className="text-secondary">How uncertainty becomes advantage</p>
        </div>

        <div className="space-y-6">
          {[
            {
              label: 'Prediction Systems',
              feature: 'Reduce uncertainty to one answer',
              hex6: 'Maintain uncertainty as structure',
            },
            {
              label: 'Advisory Systems',
              feature: 'Provide direction',
              hex6: 'Map evolving possibility',
            },
            {
              label: 'Black-box Models',
              feature: 'Obscure reasoning',
              hex6: 'Produce traceable probabilistic states',
            },
          ].map((item, i) => (
            <div key={i} className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-6 border-b border-border last:border-0">
              <div>
                <p className="text-sm text-secondary mb-2">{item.label}</p>
                <p className="font-medium">{item.feature}</p>
              </div>
              <div>
                <p className="text-sm text-secondary mb-2">HEX6 BLE</p>
                <p className="font-medium text-accent">{item.hex6}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Empirical Behavior */}
      <section className="max-w-4xl mx-auto px-6 py-20 space-y-12">
        <div className="space-y-3">
          <h2 className="text-3xl font-bold">Empirical Behavior</h2>
          <p className="text-secondary">How structural alignment outperforms</p>
        </div>

        <div className="space-y-8">
          {[
            {
              label: 'High Volatility Regimes',
              desc: 'In a 6-month simulation with extreme asset divergence (+442% to −75%), traditional models remained continuously exposed.',
              result: 'Naive allocation: −23% drawdown | HEX6 BLE: −6.5% drawdown',
              insight: 'HEX6 BLE eliminated statistically negative exposure states.',
            },
            {
              label: 'Trend + Chop Transitions',
              desc: 'In mixed regimes (trend → sideways → volatility spikes), traditional quants overfitted to prior trends.',
              result: 'Lower trade frequency, higher risk-adjusted returns, reduced volatility clustering',
              insight: 'HEX6 BLE reduced exposure during low-confidence states, re-engaged only at probability stabilization.',
            },
            {
              label: 'Macro / Event-Driven Systems',
              desc: 'Under discontinuities (rate shocks, macro releases), prediction systems collapse to outdated assumptions.',
              result: 'Avoidance of false certainty, faster adaptation to new regimes',
              insight: 'HEX6 BLE reclassifies system state and expands uncertainty distribution.',
            },
          ].map((item, i) => (
            <div key={i} className="space-y-3 p-6 rounded-sm border border-border bg-muted/30">
              <h3 className="font-bold text-accent">{item.label}</h3>
              <p className="text-sm text-secondary">{item.desc}</p>
              <div className="py-3 px-3 bg-black/20 rounded text-sm text-foreground font-mono">
                {item.result}
              </div>
              <p className="text-sm text-secondary"><strong>Insight:</strong> {item.insight}</p>
            </div>
          ))}
        </div>

        <div className="p-6 rounded-sm border border-accent/30 bg-accent/5 space-y-3">
          <p className="font-medium">Why This Outperforms</p>
          <p className="text-sm text-secondary leading-relaxed">
            Most models fail because they are forced to act—even when no edge exists. HEX6 introduces a structural condition: <em>if expected utility is negative, exposure approaches zero.</em> No override. No bias. No narrative.
          </p>
        </div>
      </section>

      {/* Verification */}
      <section className="max-w-4xl mx-auto px-6 py-20 space-y-12">
        <div className="space-y-6 p-8 rounded-sm border border-accent/20 bg-accent/5">
          <div className="flex items-start gap-3">
            <Lock className="w-5 h-5 text-accent shrink-0 mt-1" />
            <div className="space-y-3">
              <h3 className="font-bold text-lg">Verification by Structure</h3>
              <p className="text-secondary leading-relaxed">
                Every output is recorded—not as a claim, but as a state. EGTS creates an immutable record of system conditions, probability structures, and resulting inference states. This is not for visibility. It is for verification.
              </p>
              <p className="text-secondary leading-relaxed text-sm pt-2">
                HEX6 BLE introduces no execution layer. No mandates. No embedded action. A pure computational layer between data and decision.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Compare & Contrast */}
      <section className="max-w-4xl mx-auto px-6 py-20 space-y-12">
        <div className="space-y-3">
          <h2 className="text-3xl font-bold">Compare & Contrast</h2>
          <p className="text-secondary">Not about being right. About not being wrong when it matters.</p>
        </div>

        <div className="space-y-8">
          <div className="space-y-4">
            <h3 className="text-xl font-bold">What Each System Optimizes For</h3>
            <div className="space-y-3">
              {[
                {
                  label: 'AI Models',
                  sub: 'e.g., ChatGPT, Perplexity',
                  goal: 'Correct answers',
                },
                {
                  label: 'Quant Models',
                  sub: 'e.g., RSI, momentum, ML predictors',
                  goal: 'Prediction accuracy',
                },
                {
                  label: 'HEX6 BLE',
                  sub: 'Probabilistic intelligence',
                  goal: 'Probability-weighted exposure under uncertainty',
                  accent: true,
                },
              ].map((item, i) => (
                <div key={i} className={`flex items-start gap-4 p-4 rounded-sm border ${item.accent ? 'border-accent/30 bg-accent/5' : 'border-border'}`}>
                  <div className="flex-1">
                    <p className="font-bold">{item.label}</p>
                    <p className="text-xs text-secondary mb-2">{item.sub}</p>
                    <p className={`text-sm ${item.accent ? 'text-accent font-semibold' : 'text-foreground'}`}>→ {item.goal}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4 p-6 rounded-sm border border-border bg-muted/30">
            <h3 className="text-lg font-bold">Real Condition: High Dispersion Market</h3>
            <p className="text-sm text-secondary">6-month out-of-sample simulation</p>
            <ul className="space-y-2 text-sm text-secondary">
              <li>• Assets ranged from <strong>+442% to −75%</strong></li>
              <li>• Regimes shifted violently (trend → chop → collapse)</li>
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="font-bold">Traditional Quant Behavior</h3>
            <div className="space-y-3 text-sm">
              <p className="text-secondary">Maintains continuous exposure. Follows trend signals or learned patterns. Overfits to prior regime.</p>
              <div className="p-4 bg-red-950/20 border border-red-800/40 rounded text-sm space-y-2">
                <p className="font-semibold text-red-300">Observed Outcome</p>
                <ul className="space-y-1 text-red-200/80">
                  <li>• Higher peak return</li>
                  <li>• <strong>−23.7% drawdown</strong></li>
                  <li>• Capital exposed to collapsing assets</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-bold">HEX6 BLE Behavior</h3>
            <div className="space-y-3 text-sm">
              <p className="text-secondary">Classifies market state first. Models outcome distribution. Reduces exposure when expected utility turns negative.</p>
              <div className="p-4 bg-accent/10 border border-accent/30 rounded text-sm space-y-2">
                <p className="font-semibold text-accent">Observed Outcome</p>
                <ul className="space-y-1 text-accent/90">
                  <li>• Lower absolute return</li>
                  <li>• <strong>−6.5% drawdown</strong></li>
                  <li>• Capital preserved during regime breakdown</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3 p-4 rounded-sm border border-border">
              <p className="font-bold text-sm">Quant Models Fail When</p>
              <ul className="text-xs space-y-2 text-secondary">
                <li>• Regime changes</li>
                <li>• Signal degrades</li>
                <li>• Noise is mistaken for pattern</li>
              </ul>
            </div>
            <div className="space-y-3 p-4 rounded-sm border border-accent/30 bg-accent/5">
              <p className="font-bold text-sm text-accent">HEX6 BLE Adapts Because</p>
              <ul className="text-xs space-y-2 text-secondary">
                <li>• Does not require prediction</li>
                <li>• Recalculates distribution per state</li>
                <li>• Allows <em>exposure → 0</em> when no edge exists</li>
              </ul>
            </div>
          </div>

          <div className="space-y-4 p-6 rounded-sm border border-border bg-muted/30">
            <h3 className="font-bold">Core Insight</h3>
            <p className="text-sm leading-relaxed">
              <span className="text-secondary">Traditional systems try to be </span><strong>right</strong><span className="text-secondary">.</span>
            </p>
            <p className="text-sm leading-relaxed text-accent font-semibold">
              HEX6 BLE is designed to <strong>not be wrong when it matters</strong>.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-4xl mx-auto px-6 py-20 space-y-8">
        <div className="space-y-4">
          <h2 className="text-3xl font-bold">Ready to observe how outcomes reorganize?</h2>
          <p className="text-lg text-secondary">No credit card required. No prediction. Only probability.</p>
        </div>
        <Link
          to="/app"
          className="inline-flex items-center gap-2 px-8 py-4 rounded-sm bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors text-lg"
        >
          Enter Oracle <ArrowRight className="w-4 h-4" />
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