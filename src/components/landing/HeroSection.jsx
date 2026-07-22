import { motion } from 'framer-motion';
import { useMemo } from 'react';
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

function HeroWord({ word, motif, delay, onAsteriskHover }) {
  return (
    <div className="relative flex items-center justify-start py-2 sm:py-3">
      <div className="absolute inset-0">{motif}</div>
      <motion.h2
        className="relative text-[3.25rem] sm:text-[6rem] md:text-[9rem] lg:text-[12rem] leading-[0.85] font-bold tracking-tight text-foreground"
        style={{ textShadow: '0 2px 18px rgba(0,0,0,0.45)' }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay }}
      >
        {word}
        <span
          onMouseEnter={() => onAsteriskHover?.(true)}
          onMouseLeave={() => onAsteriskHover?.(false)}
          className="ml-1 text-accent align-super cursor-pointer transition-transform duration-200 hover:scale-125"
          style={{ fontSize: '0.38em' }}
        >
          *
        </span>
      </motion.h2>
    </div>
  );
}

const WHITE_SHADOW = '0 1px 2px rgba(0,0,0,0.9), 0 2px 14px rgba(0,0,0,0.7)';

export default function HeroSection({ onAsteriskHover }) {
  const navigate = useNavigate();

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
            className="text-sm text-[#0a1929] hover:text-[#1c3a5e] transition-colors"
          >
            Developed by Evrica Technologies Inc.
          </a>
        </div>

        <div className="flex justify-center mt-5 sm:mt-7">
          <span className="text-xs sm:text-sm uppercase tracking-[0.25em] text-secondary whitespace-nowrap">
            Welcome to
          </span>
        </div>

        {/* Title row: The Model* (left) · HEX6-BLE (right) */}
        <div className="mt-3 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col items-start">
            <HeroWord
              word="The Model"
              motif={<><ProbabilityMotif /><ResonanceMotif /></>}
              delay={0.1}
              onAsteriskHover={onAsteriskHover}
            />
            <div className="mt-2 text-secondary text-[0.7rem] sm:text-[1.3rem] md:text-[1.75rem] font-medium tracking-[0.05em] whitespace-nowrap">
              Probabilistic Intelligence <span className="font-bold text-secondary">[PI]</span>
            </div>
          </div>

          <div className="self-end sm:self-center rounded-md bg-black/75 px-4 py-2 sm:px-5 sm:py-3 backdrop-blur-sm">
            <div className="text-white font-bold tracking-tight text-2xl sm:text-3xl md:text-4xl leading-tight">
              [HEX6-BLE]
            </div>
            <div className="text-white/90 text-[0.6rem] sm:text-xs md:text-sm tracking-tight mt-1 text-center whitespace-nowrap">
              [BLE: Binaureal Linguistic Engine]
            </div>
          </div>
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

        {/* Version line — multi-colored segments */}
        <div className="flex justify-center">
          <span className="font-semibold tracking-tight mt-4 text-xs sm:text-sm">
            <span className="text-secondary">[</span>
            <span className="font-bold text-accent">Version:</span>
            <span className="text-white font-bold" style={{ textShadow: WHITE_SHADOW }}>
              {' '}HEX6-BLE
            </span>
            <span className="text-accent font-semibold"> PI-US</span>
            <span className="text-secondary"> · PROBABILISTIC INTELLIGENCE MODEL V5.5]</span>
          </span>
        </div>
      </motion.div>
    </section>
  );
}