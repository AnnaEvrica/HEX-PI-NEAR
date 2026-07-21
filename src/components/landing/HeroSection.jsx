import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import SignaturePatternBackground from '@/components/landing/SignaturePatternBackground';

const POOL = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ∑∫π∞≈±∇√∂λμ';

// Probability — 3D stream of numbers + letters generating out of depth
function ProbabilityMotif() {
  const [chars, setChars] = useState(() =>
    Array.from({ length: 16 }, () => POOL[Math.floor(Math.random() * POOL.length)])
  );
  useEffect(() => {
    const id = setInterval(() => {
      setChars((prev) =>
        prev.map((c) => (Math.random() < 0.55 ? POOL[Math.floor(Math.random() * POOL.length)] : c))
      );
    }, 230);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ perspective: '720px' }}>
      {chars.map((c, i) => {
        const left = ((i * 6.1) % 90) + 4;
        const top = ((i * 23) % 80) + 8;
        const size = 9 + (i % 5) * 6;
        return (
          <motion.span
            key={i}
            className="absolute font-mono font-bold text-accent"
            style={{ left: `${left}%`, top: `${top}%`, fontSize: `${size}px` }}
            initial={{ opacity: 0, z: -280, scale: 0.4, rotateX: 35 }}
            animate={{ opacity: [0, 0.3, 0.05], z: [-280, 70], scale: [0.4, 1.1], rotateX: [35, 0] }}
            transition={{ duration: 2.6 + (i % 4) * 0.6, repeat: Infinity, delay: (i * 0.12) % 3, ease: 'easeOut' }}
          >
            {c}
          </motion.span>
        );
      })}
    </div>
  );
}

// Resonance — wave-like patterns flowing behind the word
function ResonanceMotif() {
  const waves = [
    { d: 'M0 40 Q 50 8 100 40 T 200 40 T 300 40 T 400 40', dur: 4, op: 0.4, w: 2 },
    { d: 'M0 40 Q 50 70 100 40 T 200 40 T 300 40 T 400 40', dur: 6, op: 0.22, w: 1.5 },
    { d: 'M0 40 Q 50 24 100 40 T 200 40 T 300 40 T 400 40', dur: 5, op: 0.16, w: 1 },
  ];
  return (
    <svg viewBox="0 0 400 80" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
      {waves.map((wv, i) => (
        <motion.path
          key={i}
          d={wv.d}
          fill="none"
          className="text-accent"
          stroke="currentColor"
          strokeWidth={wv.w}
          strokeDasharray="6 8"
          opacity={wv.op}
          animate={{ strokeDashoffset: [0, -28] }}
          transition={{ duration: wv.dur, repeat: Infinity, ease: 'linear' }}
        />
      ))}
    </svg>
  );
}

function HeroWord({ word, motif, delay }) {
  return (
    <div className="relative flex items-center justify-center py-2 sm:py-3">
      <div className="absolute inset-0">{motif}</div>
      <motion.h2
        className="relative text-5xl sm:text-7xl md:text-8xl font-bold tracking-tight text-foreground"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay }}
      >
        {word}
      </motion.h2>
    </div>
  );
}

function Operator({ op, delay }) {
  return (
    <motion.div
      className="flex items-center justify-center py-0.5"
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay }}
    >
      <span className="text-3xl sm:text-5xl font-bold text-accent/80">{op}</span>
    </motion.div>
  );
}

export default function HeroSection() {
  return (
    <section className="relative w-full overflow-hidden pt-10 sm:pt-14 md:pt-20 pb-10 sm:pb-16">
      {/* Full-bleed signature-pattern background */}
      <SignaturePatternBackground />

      <motion.div
        className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-sm bg-accent/10 border border-accent/30 w-fit">
            <span className="text-sm font-bold text-accent">HEX6 BLE</span>
            <span className="text-sm font-medium text-accent">Probabilistic Intelligence</span>
          </div>
        </div>

        <div className="mt-6">
          <HeroWord word="Probability" motif={<ProbabilityMotif />} delay={0.1} />
          <Operator op="+" delay={0.2} />
          <HeroWord word="Resonance" motif={<ResonanceMotif />} delay={0.3} />
          <Operator op="=" delay={0.4} />
        </div>

        {/* AI → PI, sized to match the equation, with tagline */}
        <motion.div
          className="flex flex-col items-center gap-3 mt-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.55 }}
        >
          <div className="flex items-center justify-center gap-4 sm:gap-6">
            <span className="text-5xl sm:text-7xl md:text-8xl font-bold text-secondary line-through decoration-2 decoration-accent">AI</span>
            <ArrowRight className="w-7 h-7 sm:w-10 sm:h-10 text-accent" />
            <span className="text-5xl sm:text-7xl md:text-8xl font-bold text-accent">PI</span>
          </div>
          <span className="text-base sm:text-xl font-semibold text-foreground tracking-tight">intelligence like never before</span>
        </motion.div>

        <div className="flex flex-col items-center gap-4 pt-8">
          <button
            onClick={() => base44.auth.loginWithProvider('google', '/app')}
            className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-4 rounded-sm bg-accent text-accent-foreground font-medium hover:bg-accent/90 transition-colors text-sm sm:text-base md:text-lg"
          >
            Enter Oracle <ArrowRight className="w-4 h-4" />
          </button>
          <span className="font-bold text-accent text-xs sm:text-sm tracking-tight">[HEX6-BLE PI-US · PROBABILISTIC INTELLIGENCE MODEL V5.5]</span>
        </div>
      </motion.div>
    </section>
  );
}