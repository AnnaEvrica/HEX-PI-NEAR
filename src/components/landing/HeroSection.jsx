import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { ArrowRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import SignaturePatternBackground from '@/components/landing/SignaturePatternBackground';

const POOL = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ∑∫π∞≈±∇√∂λμ';

// Probability — realistic falling data stream (matrix-style columns of digits)
function ProbabilityMotif() {
  const columns = useMemo(() => {
    const COLS = 18;
    return Array.from({ length: COLS }, (_, c) => ({
      left: (c / (COLS - 1)) * 94 + 3,
      delay: (c * 0.43) % 5,
      dur: 2.2 + (c % 6) * 0.45,
      size: 9 + (c % 4) * 3,
      chars: Array.from({ length: 5 }, () => POOL[Math.floor(Math.random() * POOL.length)]),
    }));
  }, []);
  return (
    <div className="absolute inset-0 overflow-hidden">
      {columns.map((col, ci) => (
        <div key={ci} className="absolute top-0 flex flex-col items-center leading-none" style={{ left: `${col.left}%` }}>
          {col.chars.map((ch, i) => (
            <motion.span
              key={i}
              className="font-mono font-bold text-accent"
              style={{ fontSize: `${col.size}px` }}
              initial={{ y: -30, opacity: 0 }}
              animate={{ y: [-30, 150], opacity: [0, 0.45 - i * 0.06, 0] }}
              transition={{ duration: col.dur, repeat: Infinity, delay: col.delay + i * 0.16, ease: 'linear' }}
            >
              {ch}
            </motion.span>
          ))}
        </div>
      ))}
    </div>
  );
}

// Resonance — soft concentric ripple waves of varying strength
function ResonanceMotif() {
  const ripples = [
    { dur: 4.0, op: 0.45, w: 2 },
    { dur: 5.5, op: 0.30, w: 1.5 },
    { dur: 7.0, op: 0.18, w: 1 },
    { dur: 3.2, op: 0.26, w: 1.5 },
    { dur: 6.0, op: 0.12, w: 0.8 },
  ];
  return (
    <svg viewBox="0 0 400 80" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid meet">
      {ripples.map((r, i) => (
        <motion.circle
          key={i}
          cx="200" cy="40" fill="none"
          className="text-accent"
          stroke="currentColor"
          strokeWidth={r.w}
          initial={{ r: 4, opacity: 0 }}
          animate={{ r: [4, 190], opacity: [r.op, 0] }}
          transition={{ duration: r.dur, repeat: Infinity, delay: i * 0.7, ease: 'easeOut' }}
        />
      ))}
    </svg>
  );
}

// PI — radiating concentric pulses behind the result symbol
function PIMotif() {
  return (
    <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid meet">
      {[0, 1, 2, 3].map((i) => (
        <motion.circle
          key={i}
          cx="100" cy="100" fill="none"
          className="text-accent"
          stroke="currentColor"
          strokeWidth="1.5"
          initial={{ r: 8, opacity: 0.4 }}
          animate={{ r: [8, 95], opacity: [0.4, 0] }}
          transition={{ duration: 3, repeat: Infinity, delay: i * 0.75, ease: 'easeOut' }}
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
        style={{ textShadow: '0 2px 18px rgba(0,0,0,0.45)' }}
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
        className="relative z-10 max-w-4xl mx-auto px-6 sm:px-10 py-10 sm:py-14 bg-background/75 backdrop-blur-md rounded-lg"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <div className="flex justify-center">
          <a
            href="https://evrica.tech"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-secondary hover:text-foreground transition-colors"
          >
            Developed by Evrica Technologies Inc.
          </a>
        </div>

        <div className="flex justify-center mt-5 sm:mt-7">
          <span className="text-xs sm:text-sm uppercase tracking-[0.25em] text-secondary whitespace-nowrap">
            Welcome to
          </span>
        </div>

        <div className="mt-3">
          <HeroWord word="The Model" motif={<><ProbabilityMotif /><ResonanceMotif /></>} delay={0.1} />
        </div>

        {/* Probabilistic Intelligence — the name of the model */}
        <motion.div
          className="flex flex-col items-center gap-3 mt-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.55 }}
        >
          <div className="relative inline-flex items-center justify-center">
            <div className="absolute inset-0 -m-8 sm:-m-10"><PIMotif /></div>
            <span className="relative text-4xl sm:text-6xl md:text-7xl font-bold text-accent tracking-tight">Probabilistic Intelligence</span>
          </div>
        </motion.div>

        <div className="flex flex-col items-center gap-4 pt-8">
          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
            <button
              onClick={() => base44.auth.loginWithProvider('google', '/app')}
              className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-4 rounded-sm bg-accent text-accent-foreground font-medium hover:bg-accent/90 transition-all text-sm sm:text-base md:text-lg shadow-lg shadow-accent/25"
              style={{ boxShadow: '0 2px 18px rgba(0,0,0,0.35), 0 0 24px rgba(255,106,0,0.15)' }}
            >
              Enter World <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => document.getElementById('invitation')?.scrollIntoView({ behavior: 'smooth' })}
              className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-4 rounded-sm border border-border text-foreground font-medium hover:bg-muted transition-all text-sm sm:text-base md:text-lg"
            >
              See it live
            </button>
          </div>
          <span className="font-bold text-accent text-xs sm:text-sm tracking-tight">[HEX6-BLE PI-US · PROBABILISTIC INTELLIGENCE MODEL V5.5]</span>
        </div>
      </motion.div>
    </section>
  );
}