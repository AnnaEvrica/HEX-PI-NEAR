import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { useState, useEffect, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import MirrorSection from '@/components/landing/MirrorSection';
import InvitationSection from '@/components/landing/InvitationSection';
import FoundersSection from '@/components/landing/FoundersSection';
import RoleModelTagline from '@/components/branding/RoleModelTagline';

const DEFAULT_METRICS = {
  systemComparison: {
    hex6: { adaptability: 85, uncertaintyHandling: 90, regimeRobustness: 88, realtimeAdjustment: 92, mathTransparency: 95, drawdownControl: 87 },
    quant: { adaptability: 60, uncertaintyHandling: 50, regimeRobustness: 55, realtimeAdjustment: 65, mathTransparency: 85, drawdownControl: 58 },
    ai: { adaptability: 70, uncertaintyHandling: 65, regimeRobustness: 62, realtimeAdjustment: 75, mathTransparency: 30, drawdownControl: 52 },
  },
  evolution: [
    { week: 'W1', decisionAccuracy: 58, drawdownControl: 50, sharpe: 0.8 },
    { week: 'W2', decisionAccuracy: 62, drawdownControl: 53, sharpe: 0.9 },
    { week: 'W3', decisionAccuracy: 65, drawdownControl: 56, sharpe: 1.0 },
    { week: 'W4', decisionAccuracy: 68, drawdownControl: 59, sharpe: 1.1 },
    { week: 'W5', decisionAccuracy: 72, drawdownControl: 62, sharpe: 1.3 },
    { week: 'W6', decisionAccuracy: 75, drawdownControl: 65, sharpe: 1.5 },
    { week: 'W7', decisionAccuracy: 78, drawdownControl: 68, sharpe: 1.7 },
    { week: 'W8', decisionAccuracy: 80, drawdownControl: 71, sharpe: 1.8 },
    { week: 'W9', decisionAccuracy: 82, drawdownControl: 74, sharpe: 1.9 },
    { week: 'W10', decisionAccuracy: 84, drawdownControl: 77, sharpe: 2.0 },
    { week: 'W11', decisionAccuracy: 86, drawdownControl: 80, sharpe: 2.1 },
    { week: 'W12', decisionAccuracy: 88, drawdownControl: 82, sharpe: 2.2 },
    { week: 'W13', decisionAccuracy: 89, drawdownControl: 84, sharpe: 2.3 },
    { week: 'W14', decisionAccuracy: 90, drawdownControl: 86, sharpe: 2.35 },
    { week: 'W15', decisionAccuracy: 91, drawdownControl: 87, sharpe: 2.4 },
    { week: 'W16', decisionAccuracy: 92, drawdownControl: 88, sharpe: 2.4 },
  ],
  accuracyGrowth: { week1: 58, week4: 72, week16: 91 },
};

// Discover — the full landing content, kept "as is", available only after
// redirection from the hero's Discover CTA. Reads location.state.scrollTo to
// deep-link from the header search overlay.
export default function Discover() {
  const location = useLocation();
  const [metrics, setMetrics] = useState(DEFAULT_METRICS);
  const [loading, setLoading] = useState(false);
  const [visibleSections, setVisibleSections] = useState({});
  const sectionRefs = useRef({});

  useEffect(() => {
    const loadMetrics = async () => {
      try {
        const res = await base44.functions.invoke('generateLandingMetrics', {});
        setMetrics(res.data);
      } catch (err) {
        console.log('Could not load metrics, using defaults');
      } finally {
        setLoading(false);
      }
    };
    loadMetrics();
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisibleSections((prev) => ({
              ...prev,
              [entry.target.id]: true,
            }));
          }
        });
      },
      { threshold: 0.1 }
    );

    Object.values(sectionRefs.current).forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const t = location.state?.scrollTo;
    if (!t) return;
    const id = setTimeout(() => {
      if (t === 'top') window.scrollTo({ top: 0, behavior: 'smooth' });
      else document.getElementById(t)?.scrollIntoView({ behavior: 'smooth' });
    }, 350);
    return () => clearTimeout(id);
  }, [location.state]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Slim nav — back to home */}
      <nav
        className="sticky top-0 z-50 bg-background border-b border-border"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to="/" className="text-lg sm:text-xl font-bold tracking-tight"><span className="text-accent">HEX6</span><span className="text-foreground"> BLE</span></Link>
          <Link to="/" className="text-sm text-secondary hover:text-foreground transition-colors" style={{ minWidth: 'auto', minHeight: 'auto' }}>← Back to home</Link>
        </div>
      </nav>

      {/* Main tagline — incredibly pronounced */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 sm:pt-14 pb-2 text-center">
        <p className="text-[clamp(1.5rem,6vw,4rem)] leading-none">
          <RoleModelTagline />
        </p>
      </div>

      {/* Mirror — HEX6-BLE, two lenses on one mind */}
      <div id="mirror"><MirrorSection /></div>

      {/* Invitation — see it for yourself */}
      <div id="invitation"><InvitationSection /></div>

      {/* Forefathers of Probability — Graphic Elements */}
      <div id="founders"><FoundersSection /></div>

      {/* How It Works */}
      <section 
        id="how-it-works" 
        ref={(el) => (sectionRefs.current['how-it-works'] = el)}
        className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14 md:py-16 space-y-12 sm:space-y-16 md:space-y-20"
      >
        {/* Section Header */}
        <motion.div 
          className="space-y-4 sm:space-y-6 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={visibleSections['how-it-works'] ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold">The odds are now in your favor</h2>
          <p className="text-base sm:text-lg md:text-2xl font-semibold text-foreground max-w-3xl mx-auto leading-relaxed"><span className="font-bold">HEX6 BLE</span> — a new category of intelligence <br /> thriving in uncertainty, seeing patterns in chaos</p>
        </motion.div>

        {/* System Comparison Chart */}
         <motion.div 
           className="space-y-6 sm:space-y-8"
           initial={{ opacity: 0, y: 20 }}
           animate={visibleSections['how-it-works'] ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
           transition={{ duration: 0.6, delay: 0.1 }}
         >
           <div className="space-y-2 sm:space-y-3">
             <h3 className="text-2xl sm:text-3xl font-bold">System Comparison</h3>
             <p className="text-base sm:text-lg text-secondary">How different approaches optimize for different goals</p>
           </div>
           <div 
             className="p-4 sm:p-6 md:p-8 rounded-lg border border-border bg-background space-y-4 overflow-visible"
           >
             <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={!metrics ? [] : [
                {
                  metric: 'Adaptability',
                  'HEX6 BLE': metrics.systemComparison?.hex6?.adaptability || 85,
                  'Quant Models': metrics.systemComparison?.quant?.adaptability || 60,
                  'AI Models': metrics.systemComparison?.ai?.adaptability || 70,
                },
                {
                  metric: 'Uncertainty Handling',
                  'HEX6 BLE': metrics.systemComparison?.hex6?.uncertaintyHandling || 90,
                  'Quant Models': metrics.systemComparison?.quant?.uncertaintyHandling || 50,
                  'AI Models': metrics.systemComparison?.ai?.uncertaintyHandling || 65,
                },
                {
                  metric: 'Regime Robustness',
                  'HEX6 BLE': metrics.systemComparison?.hex6?.regimeRobustness || 88,
                  'Quant Models': metrics.systemComparison?.quant?.regimeRobustness || 55,
                  'AI Models': metrics.systemComparison?.ai?.regimeRobustness || 62,
                },
                {
                  metric: 'Real-time Adjustment',
                  'HEX6 BLE': metrics.systemComparison?.hex6?.realtimeAdjustment || 92,
                  'Quant Models': metrics.systemComparison?.quant?.realtimeAdjustment || 65,
                  'AI Models': metrics.systemComparison?.ai?.realtimeAdjustment || 75,
                },
                {
                  metric: 'Mathematical Transparency',
                  'HEX6 BLE': metrics.systemComparison?.hex6?.mathTransparency || 95,
                  'Quant Models': metrics.systemComparison?.quant?.mathTransparency || 85,
                  'AI Models': metrics.systemComparison?.ai?.mathTransparency || 30,
                },
                {
                  metric: 'Drawdown Control',
                  'HEX6 BLE': metrics.systemComparison?.hex6?.drawdownControl || 87,
                  'Quant Models': metrics.systemComparison?.quant?.drawdownControl || 58,
                  'AI Models': metrics.systemComparison?.ai?.drawdownControl || 52,
                },
              ]}>
                <PolarGrid stroke="currentColor" className="opacity-20" />
                <PolarAngleAxis dataKey="metric" className="text-xs" />
                <PolarRadiusAxis angle={90} domain={[0, 100]} className="text-xs" />
                <Radar name="HEX6 BLE" dataKey="HEX6 BLE" stroke="#FF6B35" fill="#FF6B35" fillOpacity={0.25} isAnimationActive={true} />
                <Radar name="Quant Models" dataKey="Quant Models" stroke="#666" fill="#666" fillOpacity={0.08} isAnimationActive={true} />
                <Radar name="AI Models" dataKey="AI Models" stroke="#555" fill="#555" fillOpacity={0.04} isAnimationActive={true} />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
              </RadarChart>
            </ResponsiveContainer>
            <p className="text-xs text-secondary/60">* Illustrative scores from internal simulations across multi-regime sequential data. Comparative benchmarks reflect typical behavior of each system class, not specific implementations.</p>
            </div>
            </motion.div>

        {/* Applications & Real Outcomes */}
        <div className="space-y-6 sm:space-y-8">
          <div className="space-y-2 sm:space-y-3">
            <h3 className="text-2xl sm:text-3xl font-bold">Universal Across Domains</h3>
            <p className="text-base sm:text-lg text-secondary">HEX6 BLE doesn't care what the data represents — it reads the structure of any sequential signal*</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {loading || !metrics ? [] : [
              {
                title: 'Stable Environments',
                metrics: [
                  { label: 'Pattern Recognition', value: 'High', desc: 'Detects regime transitions before they fully form*' },
                  { label: 'Loss Avoidance', value: 'Strong', desc: 'Pulls back when conditions destabilize*' },
                  { label: 'Response Speed', value: 'Sub-second', desc: 'Reclassifies state as data arrives*' },
                ],
              },
              {
                title: 'Volatile Environments',
                metrics: [
                  { label: 'Shock Absorption', value: 'Strong', desc: 'Holds form during chaotic regime shifts*' },
                  { label: 'Exit Precision', value: 'High', desc: 'Disengages before adverse cascades*' },
                  { label: 'Recovery Time', value: 'Fast', desc: 'Returns to confident state quickly*' },
                ],
              },
              {
                title: 'Slow-Moving Systems',
                metrics: [
                  { label: 'Trend Sensing', value: 'High', desc: 'Reads gradual environmental shifts*' },
                  { label: 'Optimal Timing', value: 'High', desc: 'Engages and disengages with conviction*' },
                  { label: 'Curve Adaptation', value: 'Smooth', desc: 'Glides across slow regime evolutions*' },
                ],
              },
              {
                title: 'Multi-Signal Analysis',
                metrics: [
                  { label: 'Distribution Modeling', value: 'Robust', desc: 'Holds the entire outcome space at once*' },
                  { label: 'Correlation Tracking', value: 'High', desc: 'Detects co-movement across signals*' },
                  { label: 'Decision Confidence', value: 'Calibrated', desc: 'Acts only when probability stabilizes*' },
                ],
              },
            ].map((app, i) => (
              <div key={i} className="space-y-4 p-4 sm:p-6 border border-border bg-background">
                <h4 className="font-bold text-base sm:text-lg">{app.title}</h4>
                <div className="space-y-3">
                  {app.metrics.map((m, j) => (
                    <div key={j} className="flex items-start justify-between border-b border-border/50 pb-2 last:border-0 last:pb-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-secondary font-medium">{m.label}</p>
                        <p className="text-xs text-secondary/70">{m.desc}</p>
                      </div>
                      <p className="text-base sm:text-lg font-bold text-accent ml-2 sm:ml-4 flex-shrink-0">{m.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-secondary/60 pt-2">* Qualitative descriptors based on internal simulations of the HEX6 BLE engine across multi-regime sequential signals. Behavior generalizes across any domain where state transitions matter — markets, sports, biometrics, traffic, sensor data, language, anything sequential.</p>
        </div>

        {/* Evolution & Progression Over Time */}
        <div className="space-y-8">
          <div className="space-y-3">
            <h3 className="text-3xl font-bold">Learning & Evolution Over Time</h3>
            <p className="text-lg text-secondary">How HEX6 BLE improves as you interact with it</p>
          </div>
          <div className="p-4 md:p-8 border border-border bg-background overflow-x-auto">
            <ResponsiveContainer width="100%" height={380}>
              <LineChart data={loading || !metrics ? [] : metrics.evolution}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity.10" />
                <XAxis dataKey="week" className="text-xs" />
                <YAxis yAxisId="left" domain={[0, 100]} className="text-xs" label={{ value: 'Accuracy %', angle: -90, position: 'insideLeft' }} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 3]} className="text-xs" label={{ value: 'Conviction Index', angle: 90, position: 'insideRight' }} />
                <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #FF6B35' }} />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Line yAxisId="left" type="monotone" dataKey="decisionAccuracy" stroke="#FF6B35" strokeWidth={3} dot={{ fill: '#FF6B35', r: 5 }} name="Decision Accuracy %" />
                <Line yAxisId="left" type="monotone" dataKey="drawdownControl" stroke="#999" strokeWidth={2} dot={{ fill: '#999' }} name="Loss Control %" strokeDasharray="5 5" />
                <Line yAxisId="right" type="monotone" dataKey="sharpe" stroke="#666" strokeWidth={2} dot={{ fill: '#666' }} name="Conviction Index" strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-xs text-secondary/60 pt-2">* Illustrative learning curve from internal simulations. Adaptation pace varies with the volatility and complexity of the signal being observed.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 pt-4 md:pt-6">
            {loading || !metrics ? [] : [
              { label: 'Week 1 Baseline', metric: `${metrics.accuracyGrowth.week1}%`, desc: 'Initial decision accuracy' },
              { label: 'Week 4 Progress', metric: `${metrics.accuracyGrowth.week4}%`, desc: `${metrics.accuracyGrowth.week4 - metrics.accuracyGrowth.week1}pp improvement` },
              { label: 'Week 16 Mature', metric: `${metrics.accuracyGrowth.week16}%`, desc: 'Near-optimal accuracy' },
              { label: 'Adaptation Speed', metric: 'Real-time', desc: 'Reclassifies as new data arrives' },
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
      <section 
        id="structural"
        ref={(el) => (sectionRefs.current['structural'] = el)}
        className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14 md:py-16 space-y-8 sm:space-y-12"
      >
        <motion.div 
          className="space-y-4"
          initial={{ opacity: 0, y: 20 }}
          animate={visibleSections['structural'] ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-4xl font-bold">Structural Difference</h2>
          <p className="text-lg text-secondary">How uncertainty becomes advantage</p>
        </motion.div>

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

      {/* Compare & Contrast */}
      <section 
        id="compare"
        ref={(el) => (sectionRefs.current['compare'] = el)}
        className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14 md:py-16 space-y-8 sm:space-y-12"
      >
        <div className="space-y-4">
          <h2 className="text-4xl font-bold">Compare & Contrast</h2>
          <p className="text-lg text-secondary">Side-by-side: what you get, how it evolves, realistic expectations.</p>
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
              <div className="p-4 text-xs">Signal strength → Decision</div>
              <div className="p-4 text-xs text-accent font-medium">Probability → Engagement</div>

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
        <div className="space-y-6">
          <div className="space-y-2">
            <h3 className="text-2xl font-bold">How It Behaves in the Wild</h3>
            <p className="text-lg text-secondary">Across stable, chaotic, and discontinuous regimes — same engine, different responses</p>
          </div>

          <div className="grid grid-cols-1 space-y-6">
           {/* Empirical Behavior subsection */}
           <div className="space-y-4">
             <h4 className="text-base font-bold">How Structural Alignment Outperforms</h4>
             <div className="space-y-6">
          {[
            {
              label: 'High-Volatility Regimes',
              desc: 'When the underlying signal swings violently between extremes, traditional models remain continuously engaged regardless of clarity.',
              result: 'Naive systems: stay exposed through chaos | HEX6 BLE: pulls back when probability collapses',
              insight: 'HEX6 BLE disengages from statistically unfavorable states rather than averaging through them.',
            },
            {
              label: 'Trend + Chop Transitions',
              desc: 'In mixed regimes (steady trend → sideways drift → sudden spike), traditional models overfit to the most recent pattern.',
              result: 'Fewer false moves, higher conviction-to-action ratio, less reactive thrashing',
              insight: 'HEX6 BLE reduces engagement during low-confidence states, re-engages only when probability stabilizes.',
            },
            {
              label: 'Discontinuities & Shocks',
              desc: 'When the system fundamentally changes (regime breaks, structural shifts, new conditions), prediction systems collapse to outdated assumptions.',
              result: 'No false certainty, faster adaptation to the new regime',
              insight: 'HEX6 BLE reclassifies system state and expands the uncertainty distribution rather than forcing an answer.',
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
            </div>
          </div>
        </div>

        {/* What You Actually Get */}
        <div className="space-y-4 border border-border bg-background p-8">
          <h3 className="text-lg font-bold">What You Actually Get: Calibration Over Time</h3>
          <p className="text-secondary text-sm mb-6">The engine becomes more confident as it observes more of your signals and the patterns clarify.</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-3">
              <p className="font-bold text-sm">Early</p>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-secondary">Calibration</span>
                  <span className="text-sm font-bold">Forming</span>
                </div>
                <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
                  <div className="h-full bg-red-600/60 rounded-full" style={{ width: '33%' }} />
                </div>
                <p className="text-xs text-secondary/70">System is new. Patterns are unfamiliar. High variance.</p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="font-bold text-sm">Mid</p>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-secondary">Calibration</span>
                  <span className="text-sm font-bold">Sharpening</span>
                </div>
                <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500/70 rounded-full" style={{ width: '66%' }} />
                </div>
                <p className="text-xs text-secondary/70">Behavioral patterns emerge. State clarity improves.</p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="font-bold text-sm">Mature</p>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-secondary">Calibration</span>
                  <span className="text-sm font-bold text-accent">Converged</span>
                </div>
                <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
                  <div className="h-full bg-accent rounded-full" style={{ width: '95%' }} />
                </div>
                <p className="text-xs text-secondary/70">System stabilizes. You trust it. High-confidence calibration.</p>
              </div>
            </div>
          </div>
        </div>

        {/* The Difference */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border border-border bg-background p-6 space-y-3">
            <p className="font-bold text-sm">Traditional Approach</p>
            <ul className="space-y-2 text-xs text-secondary">
              <li className="flex gap-2"><span className="text-red-400">✕</span> Tries to predict the next outcome</li>
              <li className="flex gap-2"><span className="text-red-400">✕</span> Collapses uncertainty into one forecast</li>
              <li className="flex gap-2"><span className="text-red-400">✕</span> Assumes past patterns repeat</li>
              <li className="flex gap-2"><span className="text-red-400">✕</span> Fails catastrophically when conditions change</li>
              <li className="flex gap-2"><span className="text-red-400">✕</span> Always-on engagement even without clarity</li>
            </ul>
          </div>

          <div className="border border-accent/40 bg-background p-6 space-y-3">
            <p className="font-bold text-sm text-accent">HEX6 BLE Approach</p>
            <ul className="space-y-2 text-xs text-secondary">
              <li className="flex gap-2"><span className="text-accent">✓</span> Models the current state distribution</li>
              <li className="flex gap-2"><span className="text-accent">✓</span> Preserves the full possibility space</li>
              <li className="flex gap-2"><span className="text-accent">✓</span> Adapts as conditions evolve</li>
              <li className="flex gap-2"><span className="text-accent">✓</span> Disengages when uncertain</li>
              <li className="flex gap-2"><span className="text-accent">✓</span> Scales engagement by probability</li>
            </ul>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="cta" className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14 md:py-16 space-y-6 sm:space-y-8">
        <div className="space-y-4 sm:space-y-6">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold">Ready to observe how outcomes reorganize?</h2>
          <p className="text-base sm:text-lg md:text-xl text-secondary">No credit card required. Reasoning through probability. Decisions through resonance.</p>
        </div>
        <button
          onClick={() => base44.auth.loginWithProvider('google', '/app')}
          className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-4 rounded-sm bg-accent text-accent-foreground font-medium hover:bg-accent/90 transition-colors text-sm sm:text-base md:text-lg"
        >
          Enter Oracle <ArrowRight className="w-4 h-4" />
        </button>
      </section>
    </div>
  );
}