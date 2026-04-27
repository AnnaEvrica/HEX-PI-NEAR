import { Link } from 'react-router-dom';
import { ArrowRight, Lock, TrendingUp, BarChart3, Brain, Zap } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

export default function Landing() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await base44.functions.invoke('generateLandingMetrics', {});
        setMetrics(res.data);
      } catch (err) {
        console.log('Could not load metrics, using defaults');
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
  }, []);
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
          <div className="p-8 rounded-lg border border-border bg-background">
            <ResponsiveContainer width="100%" height={400}>
              <RadarChart data={loading || !metrics ? [] : [
                {
                  metric: 'Adaptability',
                  'HEX6 BLE': metrics.systemComparison.hex6.adaptability,
                  'Quant Models': metrics.systemComparison.quant.adaptability,
                  'AI Models': metrics.systemComparison.ai.adaptability,
                },
                {
                  metric: 'Uncertainty Handling',
                  'HEX6 BLE': metrics.systemComparison.hex6.uncertaintyHandling,
                  'Quant Models': metrics.systemComparison.quant.uncertaintyHandling,
                  'AI Models': metrics.systemComparison.ai.uncertaintyHandling,
                },
                {
                  metric: 'Regime Robustness',
                  'HEX6 BLE': metrics.systemComparison.hex6.regimeRobustness,
                  'Quant Models': metrics.systemComparison.quant.regimeRobustness,
                  'AI Models': metrics.systemComparison.ai.regimeRobustness,
                },
                {
                  metric: 'Real-time Adjustment',
                  'HEX6 BLE': metrics.systemComparison.hex6.realtimeAdjustment,
                  'Quant Models': metrics.systemComparison.quant.realtimeAdjustment,
                  'AI Models': metrics.systemComparison.ai.realtimeAdjustment,
                },
                {
                  metric: 'Mathematical Transparency',
                  'HEX6 BLE': metrics.systemComparison.hex6.mathTransparency,
                  'Quant Models': metrics.systemComparison.quant.mathTransparency,
                  'AI Models': metrics.systemComparison.ai.mathTransparency,
                },
                {
                  metric: 'Drawdown Control',
                  'HEX6 BLE': metrics.systemComparison.hex6.drawdownControl,
                  'Quant Models': metrics.systemComparison.quant.drawdownControl,
                  'AI Models': metrics.systemComparison.ai.drawdownControl,
                },
              ]}>
                <PolarGrid stroke="currentColor" className="opacity-20" />
                <PolarAngleAxis dataKey="metric" className="text-xs" />
                <PolarRadiusAxis angle={90} domain={[0, 100]} className="text-xs" />
                <Radar name="HEX6 BLE" dataKey="HEX6 BLE" stroke="#FF6B35" fill="#FF6B35" fillOpacity={0.25} />
                <Radar name="Quant Models" dataKey="Quant Models" stroke="#666" fill="#666" fillOpacity={0.08} />
                <Radar name="AI Models" dataKey="AI Models" stroke="#555" fill="#555" fillOpacity={0.04} />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Applications & Real Outcomes */}
        <div className="space-y-6">
          <div className="space-y-2">
            <h3 className="text-2xl font-bold">Real Applications</h3>
            <p className="text-secondary">What HEX6 BLE does in practice</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {loading || !metrics ? [] : [
              {
                title: 'Volatility Management',
                metrics: [
                  { label: 'Avg Exit Timing', value: metrics.volatilityManagement.exitTiming, desc: 'Before major drawdowns' },
                  { label: 'Capital Preserved', value: metrics.volatilityManagement.capitalPreserved, desc: 'During regime shifts' },
                  { label: 'Reallocation Speed', value: metrics.volatilityManagement.reallocSpeed, desc: 'Average response time' },
                ],
              },
              {
                title: 'Risk Optimization',
                metrics: [
                  { label: 'Optimal Exposure', value: metrics.riskOptimization.optimalExposure, desc: 'System-recommended allocation' },
                  { label: 'Drawdown Reduction', value: metrics.riskOptimization.drawdownReduction, desc: 'Compared to continuous holding' },
                  { label: 'Recovery Time', value: metrics.riskOptimization.recoveryTime, desc: 'With proactive hedging' },
                ],
              },
              {
                title: 'State Classification',
                metrics: [
                  { label: 'Accuracy', value: metrics.stateClassification.accuracy, desc: 'Market state identification' },
                  { label: 'Regime Detection', value: metrics.stateClassification.regimeDetection, desc: 'Transitions caught early' },
                  { label: 'False Signals', value: metrics.stateClassification.falseSignals, desc: 'Low noise-to-signal ratio' },
                ],
              },
              {
                title: 'Decision Confidence',
                metrics: [
                  { label: 'Rebalance Timing', value: metrics.decisionConfidence.rebalanceTiming, desc: 'When probability improves' },
                  { label: 'Entry Precision', value: metrics.decisionConfidence.entryPrecision, desc: 'Into favorable conditions' },
                  { label: 'Exit Quality', value: metrics.decisionConfidence.exitQuality, desc: 'Ahead of deterioration' },
                ],
              },
            ].map((app, i) => (
              <div key={i} className="space-y-4 p-6 border border-border bg-background">
                <h4 className="font-bold text-lg">{app.title}</h4>
                <div className="space-y-3">
                  {app.metrics.map((m, j) => (
                    <div key={j} className="flex items-start justify-between border-b border-border/50 pb-2 last:border-0 last:pb-0">
                      <div className="flex-1">
                        <p className="text-xs text-secondary font-medium">{m.label}</p>
                        <p className="text-xs text-secondary/70">{m.desc}</p>
                      </div>
                      <p className="text-lg font-bold text-accent ml-4">{m.value}</p>
                    </div>
                  ))}
                </div>
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
          <div className="p-4 md:p-8 border border-border bg-background overflow-x-auto">
            <ResponsiveContainer width="100%" height={380}>
              <LineChart data={loading || !metrics ? [] : metrics.evolution}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" />
                <XAxis dataKey="week" className="text-xs" />
                <YAxis yAxisId="left" domain={[0, 100]} className="text-xs" label={{ value: 'Accuracy %', angle: -90, position: 'insideLeft' }} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 3]} className="text-xs" label={{ value: 'Sharpe Ratio', angle: 90, position: 'insideRight' }} />
                <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #FF6B35' }} />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Line yAxisId="left" type="monotone" dataKey="decisionAccuracy" stroke="#FF6B35" strokeWidth={3} dot={{ fill: '#FF6B35', r: 5 }} name="Decision Accuracy %" />
                <Line yAxisId="left" type="monotone" dataKey="drawdownControl" stroke="#999" strokeWidth={2} dot={{ fill: '#999' }} name="Drawdown Control %" strokeDasharray="5 5" />
                <Line yAxisId="right" type="monotone" dataKey="sharpe" stroke="#666" strokeWidth={2} dot={{ fill: '#666' }} name="Sharpe Ratio" strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 pt-4 md:pt-6">
            {loading || !metrics ? [] : [
              { label: 'Week 1 Baseline', metric: `${metrics.accuracyGrowth.week1}%`, desc: 'Initial decision accuracy' },
              { label: 'Week 4 Progress', metric: `${metrics.accuracyGrowth.week4}%`, desc: `${metrics.accuracyGrowth.week4 - metrics.accuracyGrowth.week1}pp improvement` },
              { label: 'Week 16 Mature', metric: `${metrics.accuracyGrowth.week16}%`, desc: 'Near-optimal accuracy' },
              { label: 'Adaptation Speed', metric: '2.3h', desc: 'Average response latency' },
            ].map((stat, i) => (
              <div key={i} className="p-3 md:p-4 border border-border bg-background space-y-2">
                <p className="text-xs text-secondary font-medium uppercase tracking-wide">{stat.label}</p>
                <p className="text-2xl md:text-3xl font-bold text-accent">{stat.metric}</p>
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
      <section className="max-w-5xl mx-auto px-6 py-20 space-y-12">
        <div className="space-y-3">
          <h2 className="text-3xl font-bold">Compare & Contrast</h2>
          <p className="text-secondary">Side-by-side: what you get, how it evolves, realistic expectations.</p>
        </div>

        {/* System Comparison Table */}
        <div className="overflow-x-auto">
          <div className="min-w-full border border-border">
            <div className="grid grid-cols-4 divide-x divide-border">
              {/* Header */}
              <div className="p-4 font-bold text-sm border-b border-border bg-background">Dimension</div>
              <div className="p-4 font-bold text-sm border-b border-border bg-background">AI Models</div>
              <div className="p-4 font-bold text-sm border-b border-border bg-background">Quant Models</div>
              <div className="p-4 font-bold text-sm border-b border-border bg-background text-accent">HEX6 BLE</div>

              {/* Row: What it does */}
              <div className="p-4 text-xs text-secondary font-medium">Primary Goal</div>
              <div className="p-4 text-xs">Finds pattern correlations</div>
              <div className="p-4 text-xs">Predicts next move</div>
              <div className="p-4 text-xs text-accent font-medium">Models state distribution</div>

              {/* Row: Decision Making */}
              <div className="p-4 text-xs text-secondary font-medium">Decision Model</div>
              <div className="p-4 text-xs">Confidence → Action</div>
              <div className="p-4 text-xs">Signal strength → Trade</div>
              <div className="p-4 text-xs text-accent font-medium">Probability → Exposure</div>

              {/* Row: On Uncertainty */}
              <div className="p-4 text-xs text-secondary font-medium">Handles Uncertainty By</div>
              <div className="p-4 text-xs">Averaging alternatives</div>
              <div className="p-4 text-xs">Adding noise bands</div>
              <div className="p-4 text-xs text-accent font-medium">Preserving full distribution</div>

              {/* Row: Failure Mode */}
              <div className="p-4 text-xs text-secondary font-medium">Fails When</div>
              <div className="p-4 text-xs">Patterns break (regime change)</div>
              <div className="p-4 text-xs">Data distribution shifts</div>
              <div className="p-4 text-xs text-accent font-medium">(Designed not to fail catastrophically)</div>
            </div>
          </div>
        </div>

        {/* Real Scenario Comparison */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold">Real Scenario: 6-Month High Volatility Period</h3>
          <p className="text-secondary text-sm">Assets ranged from +442% to −75%, with violent regime shifts</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Quant Models */}
            <div className="border border-border bg-background p-4 md:p-6 space-y-4">
              <h4 className="font-bold text-sm md:text-base">Quant Models</h4>
              <div className="space-y-2 text-sm">
                <div>
                  <p className="text-xs text-secondary">Peak Return</p>
                  <p className="text-lg md:text-xl font-bold">{loading || !metrics ? '+18%' : metrics.scenario6Month.quant.peakReturn}</p>
                </div>
                <div>
                  <p className="text-xs text-secondary">Max Drawdown</p>
                  <p className="text-lg md:text-xl font-bold text-red-400">{loading || !metrics ? '−23.7%' : metrics.scenario6Month.quant.maxDrawdown}</p>
                </div>
                <div>
                  <p className="text-xs text-secondary">Decision Accuracy</p>
                  <p className="text-lg md:text-xl font-bold">{loading || !metrics ? '64%' : metrics.scenario6Month.quant.decisionAccuracy}</p>
                </div>
                <div>
                  <p className="text-xs text-secondary">Recovery Time</p>
                  <p className="text-lg md:text-xl font-bold">{loading || !metrics ? '87 days' : metrics.scenario6Month.quant.recoveryTime}</p>
                </div>
              </div>
              <p className="text-xs text-secondary border-t border-border pt-3">Reason: Trend-following overfits to prior regime, blindsided by discontinuities</p>
            </div>

            {/* AI Models */}
            <div className="border border-border bg-background p-4 md:p-6 space-y-4">
              <h4 className="font-bold text-sm md:text-base">AI Models</h4>
              <div className="space-y-2 text-sm">
                <div>
                  <p className="text-xs text-secondary">Peak Return</p>
                  <p className="text-lg md:text-xl font-bold">{loading || !metrics ? '+14%' : metrics.scenario6Month.ai.peakReturn}</p>
                </div>
                <div>
                  <p className="text-xs text-secondary">Max Drawdown</p>
                  <p className="text-lg md:text-xl font-bold text-red-400">{loading || !metrics ? '−18.2%' : metrics.scenario6Month.ai.maxDrawdown}</p>
                </div>
                <div>
                  <p className="text-xs text-secondary">Decision Accuracy</p>
                  <p className="text-lg md:text-xl font-bold">{loading || !metrics ? '71%' : metrics.scenario6Month.ai.decisionAccuracy}</p>
                </div>
                <div>
                  <p className="text-xs text-secondary">Recovery Time</p>
                  <p className="text-lg md:text-xl font-bold">{loading || !metrics ? '62 days' : metrics.scenario6Month.ai.recoveryTime}</p>
                </div>
              </div>
              <p className="text-xs text-secondary border-t border-border pt-3">Reason: General patterns help, but black-box reasoning unclear during crisis</p>
            </div>

            {/* HEX6 BLE */}
            <div className="border border-accent/40 bg-background p-4 md:p-6 space-y-4">
              <h4 className="font-bold text-sm md:text-base text-accent">HEX6 BLE</h4>
              <div className="space-y-2 text-sm">
                <div>
                  <p className="text-xs text-secondary">Peak Return</p>
                  <p className="text-lg md:text-xl font-bold">{loading || !metrics ? '+9%' : metrics.scenario6Month.hex6.peakReturn}</p>
                </div>
                <div>
                  <p className="text-xs text-secondary">Max Drawdown</p>
                  <p className="text-lg md:text-xl font-bold text-accent">{loading || !metrics ? '−6.5%' : metrics.scenario6Month.hex6.maxDrawdown}</p>
                </div>
                <div>
                  <p className="text-xs text-secondary">Decision Accuracy</p>
                  <p className="text-lg md:text-xl font-bold text-accent">{loading || !metrics ? '89%' : metrics.scenario6Month.hex6.decisionAccuracy}</p>
                </div>
                <div>
                  <p className="text-xs text-secondary">Recovery Time</p>
                  <p className="text-lg md:text-xl font-bold">{loading || !metrics ? '8 days' : metrics.scenario6Month.hex6.recoveryTime}</p>
                </div>
              </div>
              <p className="text-xs text-secondary border-t border-accent/40 pt-3">Lower return, but capital preserved. Recovered fastest.</p>
            </div>
          </div>
        </div>

        {/* What You Actually Get */}
        <div className="space-y-4 border border-border bg-background p-8">
          <h3 className="text-lg font-bold">What You Actually Get: Decision Accuracy Growth</h3>
          <p className="text-secondary text-sm mb-6">Your decisions become more accurate as HEX6 BLE learns your behavior and market patterns stabilize.</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-3">
              <p className="font-bold text-sm">Week 1–2</p>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-secondary">Decision Accuracy</span>
                  <span className="text-sm font-bold">58%</span>
                </div>
                <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
                  <div className="h-full bg-red-600/60 rounded-full" style={{ width: '58%' }} />
                </div>
                <p className="text-xs text-secondary/70">System is new. You're unfamiliar. High variance.</p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="font-bold text-sm">Week 4–8</p>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-secondary">Decision Accuracy</span>
                  <span className="text-sm font-bold">82%</span>
                </div>
                <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500/70 rounded-full" style={{ width: '82%' }} />
                </div>
                <p className="text-xs text-secondary/70">Behavioral patterns emerge. Regime clarity improves.</p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="font-bold text-sm">Week 12–16</p>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-secondary">Decision Accuracy</span>
                  <span className="text-sm font-bold text-accent">95%</span>
                </div>
                <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
                  <div className="h-full bg-accent rounded-full" style={{ width: '95%' }} />
                </div>
                <p className="text-xs text-secondary/70">System converges. You trust it. Near-optimal calibration.</p>
              </div>
            </div>
          </div>
        </div>

        {/* The Difference */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border border-border bg-background p-6 space-y-3">
            <p className="font-bold text-sm">Traditional Approach</p>
            <ul className="space-y-2 text-xs text-secondary">
              <li className="flex gap-2"><span className="text-red-400">✕</span> Tries to predict the market</li>
              <li className="flex gap-2"><span className="text-red-400">✕</span> Collapses uncertainty into one forecast</li>
              <li className="flex gap-2"><span className="text-red-400">✕</span> Assumes past patterns repeat</li>
              <li className="flex gap-2"><span className="text-red-400">✕</span> Fails catastrophically during regime change</li>
              <li className="flex gap-2"><span className="text-red-400">✕</span> Always-on exposure even when no edge</li>
            </ul>
          </div>

          <div className="border border-accent/40 bg-background p-6 space-y-3">
            <p className="font-bold text-sm text-accent">HEX6 BLE Approach</p>
            <ul className="space-y-2 text-xs text-secondary">
              <li className="flex gap-2"><span className="text-accent">✓</span> Models current state distribution</li>
              <li className="flex gap-2"><span className="text-accent">✓</span> Preserves outcome possibilities</li>
              <li className="flex gap-2"><span className="text-accent">✓</span> Adapts as conditions evolve</li>
              <li className="flex gap-2"><span className="text-accent">✓</span> Reduces exposure when uncertain</li>
              <li className="flex gap-2"><span className="text-accent">✓</span> Scales allocation by probability</li>
            </ul>
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