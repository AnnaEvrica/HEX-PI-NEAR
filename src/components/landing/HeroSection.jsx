import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// Probability — animated numbers drifting in the background
function NumbersMotif() {
  const [nums, setNums] = useState(() => Array.from({ length: 18 }, () => Math.floor(Math.random() * 1000)));
  useEffect(() => {
    const id = setInterval(() => {
      setNums((prev) => prev.map((n, i) => (i % 2 === 0 ? Math.floor(Math.random() * 1000) : n)));
    }, 700);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="absolute inset-0 overflow-hidden">
      {nums.map((n, i) => (
        <motion.span
          key={i}
          className="absolute font-mono font-bold text-accent"
          style={{
            left: `${(i * 5.5 + 3) % 94}%`,
            top: `${(i * 29) % 85}%`,
            fontSize: `${10 + (i % 4) * 5}px`,
          }}
          initial={{ opacity: 0.05 }}
          animate={{ y: [0, -14, 0], opacity: [0.05, 0.22, 0.05] }}
          transition={{ duration: 3 + (i % 5), repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }}
        >
          {n}
        </motion.span>
      ))}
    </div>
  );
}

// Resonance — flowing wave dashes
function WavesMotif() {
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

// Patterns — rotating hexagonal geometry
function GeometryMotif() {
  return (
    <svg viewBox="0 0 200 80" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid meet">
      <motion.g
        className="text-accent"
        stroke="currentColor"
        fill="none"
        strokeWidth="1"
        opacity="0.35"
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        animate={{ rotate: 360 }}
        transition={{ duration: 36, repeat: Infinity, ease: 'linear' }}
      >
        <polygon points="100,12 130,27 130,53 100,68 70,53 70,27" />
        <polygon points="100,22 122,33 122,47 100,58 78,47 78,33" opacity="0.6" />
        <line x1="100" y1="12" x2="100" y2="68" opacity="0.4" />
        <line x1="70" y1="27" x2="130" y2="53" opacity="0.4" />
        <line x1="130" y1="27" x2="70" y2="53" opacity="0.4" />
      </motion.g>
      <motion.g
        className="text-accent"
        stroke="currentColor"
        fill="none"
        strokeWidth="0.8"
        opacity="0.22"
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        animate={{ rotate: -360 }}
        transition={{ duration: 50, repeat: Infinity, ease: 'linear' }}
      >
        <circle cx="100" cy="40" r="34" strokeDasharray="4 6" />
      </motion.g>
    </svg>
  );
}

function HeroWord({ word, motif, delay }) {
  return (
    <div className="relative flex items-center justify-center py-3 sm:py-4">
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

export default function HeroSection() {
  return (
    <motion.section
      className="max-w-4xl mx-auto px-4 sm:px-6 pt-10 sm:pt-14 md:pt-20 pb-10 sm:pb-16 space-y-8 sm:space-y-10"
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

      <div className="space-y-1 sm:space-y-2">
        <HeroWord word="Probability" motif={<NumbersMotif />} delay={0.1} />
        <HeroWord word="Resonance" motif={<WavesMotif />} delay={0.25} />
        <HeroWord word="Patterns" motif={<GeometryMotif />} delay={0.4} />
      </div>

      <motion.div
        className="flex items-center justify-center gap-3 sm:gap-5"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.55 }}
      >
        <span className="text-2xl sm:text-4xl font-bold text-secondary line-through decoration-2 decoration-accent">AI</span>
        <ArrowRight className="w-5 h-5 sm:w-7 sm:h-7 text-accent" />
        <span className="text-3xl sm:text-5xl font-bold text-accent">PI</span>
      </motion.div>

      <div className="flex flex-col items-center gap-4 pt-2">
        <button
          onClick={() => base44.auth.loginWithProvider('google', '/app')}
          className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-4 rounded-sm bg-accent text-accent-foreground font-medium hover:bg-accent/90 transition-colors text-sm sm:text-base md:text-lg"
        >
          Enter Oracle <ArrowRight className="w-4 h-4" />
        </button>
        <span className="font-bold text-accent text-xs sm:text-sm tracking-tight">[PI-US · PROBABILISTIC INTELLIGENCE MODEL V5.5]</span>
      </div>
    </motion.section>
  );
}