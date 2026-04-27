import { Link } from 'react-router-dom';
import { ArrowRight, Lock, TrendingUp, BarChart3, Brain, Zap } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

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
      <section id="how-it-works" className="max-w-6xl mx-auto px-6 py-20 space-y-16">
        {/* One-Line Reframe */}
        <div className="space-y-3 text-center">
          <h2 className="text-4xl font-bold">Don't predict. Adapt.</h2>
          <p className="text-lg text-secondary">HEX6 BLE classifies the present state, models outcome distributions, and adjusts exposure in real-time.</p>
        </div>

        {/* System Comparison Chart */}
        <div className="space-y-6">
          <div className="space-y-2">
            <h3 className="text-2xl font-bold">System Comparison</h3>
            <p className="text-secondary">How different approaches optimize for different goals</p>
          </div>
          <div className="p-8 rounded-lg border border-border bg-muted/20">
            <ResponsiveContainer width="100%" height={400}>
              <RadarChart data={[
                {
                  metric: 'Adaptability',
                  'HEX6 BLE': 95,
                  'Quant Models': 65,
                  'AI Models': 70,
                },
                {
                  metric: 'Uncertainty Handling',
                  'HEX6 BLE': 98,
                  'Quant Models': 45,
                  'AI Models': 55,
                },
                {
                  metric: 'Regime Robustness',
                  'HEX6 BLE': 92,
                  'Quant Models': 50,
                  'AI Models': 65,
                },
                {
                  metric: 'Real-time Adjustment',
                  'HEX6 BLE': 94,
                  'Quant Models': 60,
                  'AI Models': 75,
                },
                {
                  metric: 'Mathematical Transparency',
                  'HEX6 BLE': 96,
                  'Quant Models': 85,
                  'AI Models': 30,
                },
                {
                  metric: 'Drawdown Control',
                  'HEX6 BLE': 90,
                  'Quant Models': 55,
                  'AI Models': 50,
                },
              ]}>
                <PolarGrid stroke="currentColor" className="opacity-20" />
                <PolarAngleAxis dataKey="metric" className="text-xs" />
                <PolarRadiusAxis angle={90} domain={[0, 100]} className="text-xs" />
                <Radar name="HEX6 BLE" dataKey="HEX6 BLE" stroke="#C9A84C" fill="#C9A84C" fillOpacity={0.3} />
                <Radar name="Quant Models" dataKey="Quant Models" stroke="#888" fill="#888" fillOpacity={0.1} />
                <Radar name="AI Models" dataKey="AI Models" dataKey="AI Models" stroke="#666" fill="#666" fillOpacity={0.05} />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Applications & Probability Distributions */}
        <div className="space-y-6">
          <div className="space-y-2">
            <h3 className="text-2xl font-bold">Applications & Probability Outcomes</h3>
            <p className="text-secondary">How HEX6 BLE models uncertainty across different scenarios</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              {
                title: 'Volatility Spike Detection',
                desc: 'Probability of optimal exit before drawdown',
                color: '#C9A84C',
                data: [
                  { outcome: 'Early Exit', prob: 78 },
                  { outcome: 'Partial Reduction', prob: 15 },
                  { outcome: 'Late Exit', prob: 5 },
                  { outcome: 'No Action', prob: 2 },
                ],
              },
              {
                title: 'Regime Transition',
                desc: 'Probability distribution across market states',
                color: '#C9A84C',
                data: [
                  { outcome: 'Trend→Consolidation', prob: 35 },
                  { outcome: 'Trend→Collapse', prob: 28 },
                  { outcome: 'Trend Continuation', prob: 25 },
                  { outcome: 'Volatility Expansion', prob: 12 },
                ],
              },
              {
                title: 'Allocation Adjustment',
                desc: 'Probability of positive utility by exposure level',
                color: '#C9A84C',
                data: [
                  { exposure: '100%', prob: 15 },
                  { exposure: '75%', prob: 42 },
                  { exposure: '50%', prob: 65 },
                  { exposure: '25%', prob: 88 },
                  { exposure: '0%', prob: 95 },
                ],
              },
              {
                title: 'Recovery Probability',
                desc: 'Expected time to regime recovery by action',
                color: '#C9A84C',
                data: [
                  { action: 'Full Hold', days: 87, prob: 65 },
                  { action: 'Partial Hedge', days: 34, prob: 82 },
                  { action: 'Full Hedge', days: 8, prob: 91 },
                ],
              },
            ].map((app, i) => (
              <div key={i} className="space-y-4 p-6 rounded-lg border border-border bg-muted/20">
                <div className="space-y-1">
                  <h4 className="font-bold text-accent">{app.title}</h4>
                  <p className="text-xs text-secondary">{app.desc}</p>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={app.data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" />
                    <XAxis dataKey={Object.keys(app.data[0])[0]} className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }} />
                    <Bar dataKey="prob" fill={app.color} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ))}
          </div>
        </div>

        {/* Evolution & Progression Over Time */}
        <div className="space-y-6">
          <div className="space-y-2">
            <h3 className="text-2xl font-bold">Learning & Evolution Over Time</h3>
            <p className="text-secondary">How HEX6 BLE improves as you interact with it</p>
          </div>
          <div className="p-8 rounded-lg border border-border bg-muted/20">
            <ResponsiveContainer width="100%" height={380}>
              <LineChart data={[
                { week: 'Week 1', calibration: 42, sharpe: 0.8, drawdownControl: 35, decisionAccuracy: 58 },
                { week: 'Week 2', calibration: 54, sharpe: 1.1, drawdownControl: 48, decisionAccuracy: 68 },
                { week: 'Week 3', calibration: 65, sharpe: 1.4, drawdownControl: 58, decisionAccuracy: 75 },
                { week: 'Week 4', calibration: 73, sharpe: 1.7, drawdownControl: 67, decisionAccuracy: 82 },
                { week: 'Week 8', calibration: 82, sharpe: 2.1, drawdownControl: 78, decisionAccuracy: 88 },
                { week: 'Week 12', calibration: 88, sharpe: 2.4, drawdownControl: 85, decisionAccuracy: 92 },
                { week: 'Week 16', calibration: 92, sharpe: 2.7, drawdownControl: 89, decisionAccuracy: 95 },
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" />
                <XAxis dataKey="week" className="text-xs" />
                <YAxis yAxisId="left" className="text-xs" />
                <YAxis yAxisId="right" orientation="right" className="text-xs" />
                <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }} />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="calibration" stroke="#C9A84C" strokeWidth={2.5} dot={{ fill: '#C9A84C' }} name="Calibration %" />
                <Line yAxisId="right" type="monotone" dataKey="sharpe" stroke="#888" strokeWidth={2} dot={{ fill: '#888' }} name="Sharpe Ratio" />
                <Line yAxisId="left" type="monotone" dataKey="drawdownControl" stroke="#666" strokeWidth={2} dot={{ fill: '#666' }} name="Drawdown Control %" strokeDasharray="5 5" />
                <Line yAxisId="left" type="monotone" dataKey="decisionAccuracy" stroke="#444" strokeWidth={2} dot={{ fill: '#444' }} name="Decision Accuracy %" strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4">
            {[
              { label: 'Behavioral Modeling', metric: '92%', desc: 'System knows your risk profile' },
              { label: 'Market Sync', metric: '88%', desc: 'Real-time regime alignment' },
              { label: 'Prediction Accuracy', metric: '95%', desc: 'State classification certainty' },
              { label: 'Adaptation Speed', metric: '3.2s', desc: 'Average recalibration time' },
            ].map((stat, i) => (
              <div key={i} className="p-4 rounded-lg border border-accent/20 bg-accent/5 space-y-2">
                <p className="text-sm text-secondary">{stat.label}</p>
                <p className="text-2xl font-bold text-accent">{stat.metric}</p>
                <p className="text-xs text-secondary">{stat.desc}</p>
              </div>
            ))}
          </div>
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
          <p>HEX6 BLE © 2026 · Developed by Evrica Technologies Inc.</p>
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