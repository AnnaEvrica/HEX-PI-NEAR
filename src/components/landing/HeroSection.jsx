import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import SignaturePatternBackground from '@/components/landing/SignaturePatternBackground';

const POOL = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ∑∫π∞≈±∇√∂λμ';

// Probability — orange matrix stream of digits, letters & words flowing BOTH
// directions (some columns fall top→bottom, some rise bottom→top).
function ProbabilityMotif() {
  const WORDS = ['HEX6', 'PI', 'PROB', 'RESONANCE', 'MODEL', 'BLE', 'CORE', 'STATE'];
  const columns = useMemo(() => {
    const COLS = 18;
    return Array.from({ length: COLS }, (_, c) => {
      const isWord = c % 4 === 0;
      return {
        left: (c / (COLS - 1)) * 94 + 3,
        delay: (c * 0.43) % 5,
        dur: 2.2 + (c % 6) * 0.45,
        size: 9 + (c % 4) * 3,
        up: c % 2 === 0,
        isWord,
        word: isWord ? WORDS[c % WORDS.length] : '',
        chars: Array.from({ length: 5 }, () => POOL[Math.floor(Math.random() * POOL.length)]),
      };
    });
  }, []);
  return (
    <div className="absolute inset-0 overflow-hidden">
      {columns.map((col, ci) => (
        <div key={ci} className="absolute top-0 flex flex-col items-center leading-none" style={{ left: `${col.left}%` }}>
          {col.isWord ? (
            <motion.span
              className="font-mono font-bold text-accent whitespace-nowrap"
              style={{ fontSize: `${col.size}px` }}
              initial={{ y: col.up ? 150 : -30, opacity: 0 }}
              animate={{ y: col.up ? [150, -30] : [-30, 150], opacity: [0, 0.5, 0] }}
              transition={{ duration: col.dur, repeat: Infinity, delay: col.delay, ease: 'linear' }}
            >
              {col.word}
            </motion.span>
          ) : (
            col.chars.map((ch, i) => (
              <motion.span
                key={i}
                className="font-mono font-bold text-accent"
                style={{ fontSize: `${col.size}px` }}
                initial={{ y: col.up ? 150 : -30, opacity: 0 }}
                animate={{ y: col.up ? [150, -30] : [-30, 150], opacity: [0, 0.45 - i * 0.06, 0] }}
                transition={{ duration: col.dur, repeat: Infinity, delay: col.delay + i * 0.16, ease: 'linear' }}
              >
                {ch}
              </motion.span>
            ))
          )}
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

function HeroWord({ word, motif, delay }) {
  return (
    <div className="relative flex items-center justify-center py-2 sm:py-3">
      <div className="absolute inset-0">{motif}</div>
      <motion.h2
        className="relative text-[8rem] sm:text-[12rem] md:text-[15rem] leading-[0.85] font-bold tracking-tight text-foreground"
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

export default function HeroSection() {
  const navigate = useNavigate();
  const [piHover, setPiHover] = useState(false);
  const piColor = piHover ? 'text-accent' : 'text-accent/55';

  return (
    <section className="relative w-full overflow-hidden pt-10 sm:pt-14 md:pt-20 pb-10 sm:pb-16">
      <SignaturePatternBackground />

      <motion.div
        className="relative z-10 max-w-6xl mx-auto px-6 sm:px-10 py-10 sm:py-14 bg-background/75 backdrop-blur-md rounded-lg"
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

        {/* Probabilistic Intelligence [PI] — small, tight, letter-spaced, muted orange */}
        <div className="mt-6 flex flex-col items-center text-accent/55 leading-[0.95] tracking-[0.05em] font-medium text-[0.7rem] sm:text-[1.3rem] md:text-[1.75rem]">
          <span>Probabilistic</span>
          <span>
            Intelligence{' '}
            <span
              onMouseEnter={() => setPiHover(true)}
              onMouseLeave={() => setPiHover(false)}
              className={`cursor-default transition-colors duration-300 ${piColor}`}
            >
              [PI]
            </span>
          </span>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-[30rem] mx-auto pt-8">
          <button
            onClick={() => navigate('/discover')}
            className="flex-1 inline-flex items-center justify-center px-6 py-3 sm:py-4 rounded-sm border-2 border-accent bg-white text-black font-medium hover:bg-accent/10 transition-all text-sm sm:text-base md:text-lg"
          >
            Discover
          </button>
          <button
            onClick={() => base44.auth.loginWithProvider('google', '/app')}
            className="flex-1 inline-flex items-center justify-center px-6 py-3 sm:py-4 rounded-sm bg-accent text-accent-foreground border-2 border-white font-medium hover:bg-accent/90 transition-all text-sm sm:text-base md:text-lg shadow-lg shadow-accent/25"
            style={{ boxShadow: '0 2px 18px rgba(0,0,0,0.35), 0 0 24px rgba(255,106,0,0.15)' }}
          >
            Enter
          </button>
        </div>

        <div className="flex justify-center">
          <span
            className={`font-semibold tracking-tight mt-4 text-xs sm:text-sm transition-colors duration-300 ${
              piHover ? 'text-accent' : 'text-accent/50'
            }`}
          >
            [HEX6-BLE PI-US · PROBABILISTIC INTELLIGENCE MODEL V5.5]
          </span>
        </div>
      </motion.div>
    </section>
  );
}