import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { LANDING_IMAGES } from './landingImages';

const STEPS = [
  {
    num: '01',
    label: 'Prediction',
    title: 'The model says: act.',
    body: 'A conventional model produces a fast, convincing recommendation. HEX6-BLE treats it as a signal — not a command.',
  },
  {
    num: '02',
    label: 'Confidence',
    title: 'How sure is "sure"?',
    body: 'The engine makes confidence explicit, so persuasive language can no longer masquerade as certainty.',
  },
  {
    num: '03',
    label: 'Outcomes',
    title: 'One forecast becomes many futures.',
    body: 'Possible outcomes receive probabilities. A single answer becomes a decision landscape.',
  },
  {
    num: '04',
    label: 'Risk',
    title: 'A good forecast can be a bad move.',
    body: 'Probability meets downside, constraints, and consequence. Being likely is not the same as being worth it.',
  },
  {
    num: '05',
    label: 'Decision',
    title: 'Act. Wait. Walk away.',
    body: 'HEX6-BLE converts the signal into a bounded action: what to do, when to do it, and how much to risk.',
  },
  {
    num: '06',
    label: 'Feedback',
    title: 'Then reality scores it.',
    body: 'The engine compares what it expected with what happened. Every result becomes evidence for the next decision.',
  },
  {
    num: '07',
    label: 'PI',
    title: 'This is Probabilistic Intelligence.',
    body: 'Not another model competing to sound smarter. A decision layer built to know what it knows — and what it does not.',
  },
  {
    num: '08',
    label: 'Resolution',
    title: 'One decision ends. The next one starts better informed.',
    body: '',
  },
];

export default function TransitionsSection() {
  const [activeStep, setActiveStep] = useState(0);
  const stepRefs = useRef([]);

  useEffect(() => {
    const observers = [];
    STEPS.forEach((_, i) => {
      const el = stepRefs.current[i];
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveStep(i);
        },
        { threshold: 0.3, rootMargin: '-30% 0px -50% 0px' },
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  return (
    <section className="bg-landing-bg py-20 lg:py-32 border-t border-landing-sheet/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Image */}
        <motion.img
          src={LANDING_IMAGES.transitions}
          alt=""
          className="w-full max-w-2xl mx-auto mb-16 h-[25vh] lg:h-[35vh] object-cover"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        />

        {/* Header */}
        <div className="mb-16 lg:mb-24">
          <p className="text-accent font-mono text-sm mb-2">One signal. Six transitions.</p>
          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-bold text-landing-sheet leading-[1.05]">
            A decision moving through the engine.
          </h2>
        </div>

        {/* Two-column layout */}
        <div className="flex flex-col lg:grid lg:grid-cols-[1fr_340px] lg:gap-16">
          {/* Steps */}
          <div className="order-2 lg:order-1 space-y-10 lg:space-y-16">
            {STEPS.map((step, i) => (
              <div
                key={i}
                ref={(el) => {
                  stepRefs.current[i] = el;
                }}
                className={`transition-opacity duration-500 ${
                  activeStep === i ? 'opacity-100' : 'opacity-40'
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="font-mono text-sm text-accent">{step.num}</span>
                  <span className="font-mono text-sm text-landing-muted">/ {step.label}</span>
                </div>
                <h3 className="text-lg sm:text-2xl lg:text-3xl font-bold text-landing-sheet mb-3 leading-[1.1]">
                  {step.title}
                </h3>
                {step.body && (
                  <p className="text-landing-muted max-w-xl leading-relaxed text-sm sm:text-base">
                    {step.body}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Sticky decision card */}
          <div className="order-1 lg:order-2 lg:sticky lg:top-24 lg:self-start mb-10 lg:mb-0">
            <DecisionCard activeStep={activeStep} />
          </div>
        </div>
      </div>
    </section>
  );
}

function DecisionCard({ activeStep }) {
  const step = STEPS[activeStep];
  return (
    <div className="bg-landing-sheet rounded-sm p-6">
      {/* Active step label */}
      <div className="flex items-center justify-between mb-6">
        <span className="font-mono text-xs text-landing-ink/50 uppercase tracking-widest">
          {step.num} / {step.label}
        </span>
        <span className="font-mono text-xs text-accent">●</span>
      </div>

      {/* Prediction */}
      <div className="mb-5">
        <div className="flex justify-between text-xs font-mono text-landing-ink mb-1.5">
          <span>Prediction</span>
          <span className="text-accent font-bold">71%</span>
        </div>
        <div className="h-1 bg-landing-ink/10 rounded-full overflow-hidden">
          <div className="h-full bg-accent" style={{ width: '71%' }} />
        </div>
      </div>

      {/* Risk + Decision */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div>
          <p className="text-xs font-mono text-landing-ink/50 mb-1">Risk</p>
          <p className="text-landing-ink font-bold text-sm">LOW</p>
        </div>
        <div>
          <p className="text-xs font-mono text-landing-ink/50 mb-1">Decision</p>
          <p className="text-accent font-bold text-sm">ACT</p>
        </div>
      </div>

      {/* Outcomes */}
      <div className="space-y-2 mb-4">
        <p className="text-xs font-mono text-landing-ink/50 mb-2">Outcomes</p>
        {[
          { label: 'A', pct: 63 },
          { label: 'B', pct: 24 },
          { label: 'C', pct: 13 },
        ].map((o) => (
          <div key={o.label} className="flex items-center gap-3">
            <span className="text-xs font-mono text-landing-ink w-4">{o.label}</span>
            <div className="flex-1 h-1.5 bg-landing-ink/10 rounded-full overflow-hidden">
              <div className="h-full bg-landing-ink/50" style={{ width: `${o.pct}%` }} />
            </div>
            <span className="text-xs font-mono text-landing-ink w-8 text-right">{o.pct}%</span>
          </div>
        ))}
      </div>

      {/* Unresolved tag */}
      <div className="pt-4 border-t border-landing-ink/10">
        <span className="font-mono text-xs text-landing-ink/40">?unresolved</span>
      </div>
    </div>
  );
}