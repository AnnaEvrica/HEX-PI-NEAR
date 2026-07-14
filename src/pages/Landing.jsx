import { ArrowRight, Lock, TrendingUp, BarChart3, Brain, Zap, X } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import FoundersSection from '@/components/landing/FoundersSection';

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

export default function Landing() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState(DEFAULT_METRICS);
  const [loading, setLoading] = useState(false);
  const [openPolicy, setOpenPolicy] = useState(null);
  const [isAuth, setIsAuth] = useState(false);
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
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav
        className="sticky top-0 z-50 bg-background border-b border-border"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-3 sm:py-4 flex items-center justify-between">
          <div className="text-lg sm:text-xl font-bold tracking-tight">HEX6 BLE</div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => base44.auth.loginWithProvider('google', '/app')}
              className="px-3 sm:px-5 py-1.5 sm:py-2 rounded-sm border border-border text-xs sm:text-sm font-medium hover:bg-muted transition-colors"
              style={{ minWidth: 'auto', minHeight: 'auto' }}
            >
              Log In
            </button>
            <button
              onClick={() => base44.auth.loginWithProvider('google', '/app')}
              className="px-3 sm:px-5 py-1.5 sm:py-2 rounded-sm bg-primary text-primary-foreground text-xs sm:text-sm font-medium hover:bg-primary/90 transition-colors"
              style={{ minWidth: 'auto', minHeight: 'auto' }}
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <motion.section 
        className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-24 md:py-32 space-y-6 sm:space-y-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <div className="space-y-4 sm:space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-sm bg-accent/10 border border-accent/30 w-fit">
            <span className="text-sm font-bold text-accent">HEX6 BLE</span>
            <span className="text-sm font-medium text-accent">Probabilistic Intelligence</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight tracking-tight max-w-3xl">
            <span className="text-accent">Probability.</span>{' '}
            <span className="text-foreground">Not prediction.</span>
          </h1>

          <p className="text-base sm:text-lg text-secondary max-w-2xl leading-relaxed">
            HEX6 BLE (Binaural Linguistic Engine) — an autonomous intelligence architecture that treats uncertainty as a coherent language, abandoning binary assumptions for continuous mathematics. Developed by Evrica Technologies Inc.
          </p>
        </div>

        <button
          onClick={() => base44.auth.loginWithProvider('google', '/app')}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-sm bg-accent text-accent-foreground font-medium hover:bg-accent/90 transition-colors text-sm sm:text-base"
        >
          Enter Oracle <ArrowRight className="w-4 h-4" />
        </button>

        <div className="mt-8 flex justify-center">
          <svg className="w-24 h-8" viewBox="0 0 100 20" preserveAspectRatio="none">
            <line x1="0" y1="10" x2="100" y2="10" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4,6" className="text-accent opacity-60" style={{animation: 'dashMove 20s linear infinite'}} />
          </svg>
          <style>{`
            @keyframes dashMove {
              0% { stroke-dashoffset: 0; }
              100% { stroke-dashoffset: 10; }
            }
          `}</style>
        </div>
      </motion.section>

      {/* Forefathers of Probability — Graphic Elements */}
      <FoundersSection />

      {/* How It Works */}
      <section 
        id="how-it-works" 
        ref={(el) => (sectionRefs.current['how-it-works'] = el)}
        className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 md:py-32 space-y-12 sm:space-y-16 md:space-y-20"
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
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" />
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
        className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-24 md:py-32 space-y-8 sm:space-y-12"
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
        className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24 md:py-32 space-y-8 sm:space-y-12"
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
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-24 md:py-32 space-y-6 sm:space-y-8">
        <div className="space-y-4 sm:space-y-6">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold">Ready to observe how outcomes reorganize?</h2>
          <p className="text-base sm:text-lg md:text-xl text-secondary">No credit card required. No prediction. Only probability.</p>
        </div>
        <button
          onClick={() => base44.auth.loginWithProvider('google', '/app')}
          className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-4 rounded-sm bg-accent text-accent-foreground font-medium hover:bg-accent/90 transition-colors text-sm sm:text-base md:text-lg"
        >
          Enter Oracle <ArrowRight className="w-4 h-4" />
        </button>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 sm:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between text-xs text-secondary gap-4 sm:gap-6">
          <p>HEX6 BLE © 2026 · Developed by Evrica Technologies Inc.</p>
          <div className="flex gap-6 sm:gap-8 flex-wrap justify-center">
            <button onClick={() => setOpenPolicy('terms')} className="hover:text-foreground transition-colors">
              Terms of Service
            </button>
            <button onClick={() => setOpenPolicy('privacy')} className="hover:text-foreground transition-colors">
              Privacy Policy
            </button>
            <button onClick={() => setOpenPolicy('disclosure')} className="hover:text-foreground transition-colors">
              Risk Disclosure
            </button>
          </div>
        </div>
      </footer>

      {/* Policy Modals */}
      {openPolicy === 'terms' && (
        <PolicyModal title="Terms of Service" onClose={() => setOpenPolicy(null)}>
          <div className="space-y-6 text-sm text-secondary">
            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">1. Acceptance of Terms</h3>
              <p>By accessing and using HEX6 BLE ("Service"), operated by Evrica Technologies Inc., you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any part of these terms, you may not use our Service.</p>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">2. Service Definition</h3>
              <p>HEX6 BLE is a probabilistic intelligence platform that analyzes market conditions, models outcome distributions, and generates probabilistic exposure recommendations. The Service is provided for informational and research purposes only and does NOT constitute investment advice, financial advisory services, or portfolio management.</p>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">3. No Financial Advice</h3>
              <p>You acknowledge and agree that:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>HEX6 BLE is not a licensed investment advisor, broker-dealer, or financial institution</li>
                <li>All outputs are probabilistic models, not forecasts or recommendations</li>
                <li>You are solely responsible for all investment decisions and financial outcomes</li>
                <li>You should not rely on HEX6 BLE as a substitute for professional financial advice</li>
                <li>You should consult with a licensed financial advisor before making investment decisions</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">4. Risk Acknowledgment</h3>
              <p>All investments carry substantial risk, including potential loss of principal. Past performance does not guarantee future results. Market conditions change rapidly, and HEX6 BLE outputs may become outdated. You assume full responsibility for all financial losses.</p>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">5. User Responsibilities</h3>
              <p>You agree to:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Use the Service only for lawful purposes</li>
                <li>Not circumvent security measures or access restrictions</li>
                <li>Not engage in reverse engineering, hacking, or data mining</li>
                <li>Maintain confidentiality of your account credentials</li>
                <li>Comply with all applicable federal, state, and international laws</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">6. Limitation of Liability</h3>
              <p>To the fullest extent permitted by law, Evrica Technologies Inc. shall not be liable for any indirect, incidental, special, or consequential damages, including loss of profits, data, or business opportunity, arising from your use of the Service, even if advised of the possibility of such damages.</p>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">7. Disclaimer of Warranties</h3>
              <p>The Service is provided "AS IS" without warranties of any kind, express or implied. Evrica Technologies Inc. makes no warranty that the Service will be error-free, uninterrupted, or meet your specific needs.</p>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">8. Account Termination</h3>
              <p>Evrica Technologies Inc. reserves the right to terminate or suspend your account at any time, with or without cause, and without notice. Termination may result in deletion of all associated data and content.</p>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">9. Governing Law</h3>
              <p>These Terms shall be governed by and construed in accordance with the laws of California, USA, without regard to its conflict of law provisions. Any legal action or proceeding shall be exclusively brought in the state or federal courts located in California.</p>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">10. Contact</h3>
              <p>For questions or concerns regarding these Terms, please contact: legal@evrica.tech</p>
            </section>

            <p className="text-xs text-secondary/60 pt-4 border-t border-border">Last updated: April 2026. These terms may be updated at any time. Continued use constitutes acceptance.</p>
          </div>
        </PolicyModal>
      )}

      {openPolicy === 'privacy' && (
        <PolicyModal title="Privacy Policy" onClose={() => setOpenPolicy(null)}>
          <div className="space-y-6 text-sm text-secondary">
            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">1. Information We Collect</h3>
              <p>We collect information you provide directly, including:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Account information (email, name, authentication credentials)</li>
                <li>Market queries and conversation history</li>
                <li>Portfolio data and trading preferences</li>
                <li>Device and usage analytics</li>
                <li>IP addresses and device identifiers</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">2. How We Use Your Information</h3>
              <p>Your information is used to:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Provide, maintain, and improve the Service</li>
                <li>Process transactions and send related information</li>
                <li>Respond to your inquiries and provide customer support</li>
                <li>Send promotional communications (with opt-out capability)</li>
                <li>Improve algorithm accuracy and system performance</li>
                <li>Comply with legal obligations and enforce our Terms</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">3. Data Security</h3>
              <p>We implement industry-standard security measures including encryption, secure authentication, and restricted access protocols. However, no method of transmission over the internet is entirely secure. We cannot guarantee absolute security of your information.</p>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">4. Conversation Encryption</h3>
              <p>User conversations are encrypted and stored securely. Market analysis data derived from your queries may be anonymized and used to improve system models. You can disable this by adjusting privacy settings in your account.</p>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">5. Data Sharing</h3>
              <p>We do NOT sell your personal information to third parties. We may share data only:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>With service providers (cloud hosting, analytics) under strict data processing agreements</li>
                <li>As required by law or legal process</li>
                <li>To protect against fraud, security threats, or legal liability</li>
                <li>In connection with a merger, acquisition, or asset sale (with notice)</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">6. California Privacy Rights (CCPA)</h3>
              <p>California residents have the right to:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Know what personal information is collected and how it's used</li>
                <li>Delete personal information (with exceptions for legal compliance)</li>
                <li>Opt-out of data sales (we don't sell data, but you may still opt out)</li>
                <li>Non-discrimination for exercising privacy rights</li>
              </ul>
              <p className="pt-2">To exercise these rights, email: privacy@evrica.tech</p>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">7. GDPR Compliance (EU/EEA Users)</h3>
              <p>For users in the EU/EEA, we comply with GDPR. You have rights including access, rectification, erasure, and data portability. Our legal basis for processing is consent and legitimate interest. Contact privacy@evrica.tech for GDPR-related requests.</p>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">8. Cookies and Tracking</h3>
              <p>We use cookies and similar technologies for authentication and session management. Most browsers allow you to reject or delete cookies. However, some features may not function properly without cookies.</p>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">9. Data Retention</h3>
              <p>We retain personal information as long as necessary to provide services or comply with legal obligations. You may request deletion of your data by contacting privacy@evrica.tech</p>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">10. Third-Party Links</h3>
              <p>Our Service may contain links to third-party websites. We are not responsible for their privacy practices. Review their privacy policies before providing information.</p>
            </section>

            <p className="text-xs text-secondary/60 pt-4 border-t border-border">Last updated: April 2026. Privacy policy changes will be announced with notice.</p>
          </div>
        </PolicyModal>
      )}



      {openPolicy === 'disclosure' && (
        <PolicyModal title="Risk Disclosure & Compliance" onClose={() => setOpenPolicy(null)}>
          <div className="space-y-6 text-sm text-secondary">
            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">1. Important Risk Disclosures</h3>
              <p>Trading and investing involve substantial risk of loss of capital. Past performance is not indicative of future results. Market conditions change rapidly and unpredictably.</p>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">2. Model Limitations</h3>
              <p>HEX6 BLE outputs are probabilistic models based on historical data and mathematical assumptions. Limitations include:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Historical data may not repeat or predict future outcomes</li>
                <li>Unprecedented market conditions may cause model failures</li>
                <li>Black swan events and discontinuities cannot be reliably predicted</li>
                <li>Model assumptions may be invalid in extreme market regimes</li>
                <li>System state classifications are probabilistic, not certain</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">3. Regulatory Compliance</h3>
              <p>Evrica Technologies Inc. is NOT a registered investment advisor, broker-dealer, or financial institution. The Service is not subject to SEC or FINRA oversight. Users should verify their own regulatory obligations, including but not limited to:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Suitability of investments under their circumstances</li>
                <li>Tax reporting and compliance obligations</li>
                <li>Restrictions on trading in their jurisdiction</li>
                <li>Custody and settlement procedures</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">4. Restricted Users</h3>
              <p>The Service is not available to users who are:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Subject to sanctions or restrictions under OFAC/SDN lists</li>
                <li>Located in prohibited jurisdictions</li>
                <li>Related to prohibited industries or entities</li>
                <li>Minors (under 18 years of age)</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">5. Performance Claims</h3>
              <p>Any historical performance data presented is for illustration only and does not constitute a guarantee or warranty of future performance. Actual results may differ materially due to market conditions, execution costs, slippage, and other factors.</p>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">6. Leverage and Margin Risks</h3>
              <p>Trading with leverage or margin amplifies both gains and losses. You may lose more than your initial investment. Margin calls can force liquidation of positions at unfavorable prices.</p>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">7. Technology Risks</h3>
              <p>The Service may experience downtime, connectivity issues, or system failures. We are not liable for losses resulting from technical failures, hacking, or unavailability of the Service.</p>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">8. Execution and Counterparty Risk</h3>
              <p>If you use the Service with a broker or exchange, you assume all risks of counterparty failure, settlement failures, and execution slippage. Review your broker's disclosures separately.</p>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">9. Conflicts of Interest</h3>
              <p>Evrica Technologies Inc. may have financial interests that differ from yours. We disclose that our revenue may be derived from subscription fees, and we have no incentive to hide underperformance from users.</p>
            </section>

            <section className="space-y-3">
              <h3 className="font-bold text-foreground text-lg">10. Professional Advice</h3>
              <p>Before using this Service for significant investments, you should consult with a qualified financial advisor, tax professional, and legal counsel to ensure compliance with your circumstances and local laws.</p>
            </section>

            <p className="text-xs text-secondary/60 pt-4 border-t border-border">Last updated: April 2026. All disclosures subject to change without notice.</p>
          </div>
        </PolicyModal>
      )}
    </div>
  );
}

function PolicyModal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-lg max-w-2xl w-full max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-6">{children}</div>
        <div className="border-t border-border px-6 py-4 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}