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

const WHITE_SHADOW = '0 1px 2px rgba(0,0,0,0.9), 0 2px 14px rgba(0,0,0,0.7)';

export default function HeroSection({ onAsteriskHover }) {
  const navigate = useNavigate();

  return (
    <section className="relative w-full overflow-hidden pt-10 sm:pt-14 md:pt-20 pb-10 sm:pb-16">
      <SignaturePatternBackground />

      <motion.div
        className="relative z-10 max-w-6xl mx-auto px-6 sm:px-10 py-[2.75rem] sm:py-[3.85rem] bg-background/75 backdrop-blur-md rounded-lg"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <div className="flex justify-start mt-[1.375rem] sm:mt-[1.925rem]">
          <span className="text-xs sm:text-sm uppercase tracking-[0.12em] text-secondary whitespace-nowrap">
            Welcome to
          </span>
        </div>

        {/* Title block — two balanced rows: headline word (left) · system label (right) */}
        <div className="relative mt-[2.75rem] sm:mt-[3.85rem]">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <ProbabilityMotif />
            <ResonanceMotif />
          </div>

          <div className="relative flex flex-col">
            {/* Row 1 — "The" · [HEX6-BLE] (same font/size, soft white glow) */}
            <div className="flex items-baseline justify-between gap-4">
              <motion.h2
                className="text-[3.75rem] sm:text-[5rem] md:text-[7rem] lg:text-[10.5rem] xl:text-[11rem] leading-[0.9] font-bold tracking-tight text-foreground"
                style={{ textShadow: '0 2px 18px rgba(0,0,0,0.45)' }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.1 }}
              >
                The
              </motion.h2>
              <motion.span
                className="text-white/85 font-bold tracking-tight text-[1.25rem] sm:text-[1.67rem] md:text-[2.33rem] lg:text-[3.5rem] xl:text-[3.67rem] leading-[0.9] whitespace-nowrap"
                style={{ textShadow: '0 0 24px rgba(255,255,255,0.5), 0 2px 14px rgba(0,0,0,0.65)' }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.2 }}
              >
                <span className="text-white">[</span><span className="text-[#f4f1dd]">HEX6</span><span className="text-white">-BLE]</span>
              </motion.span>
            </div>

            {/* Row 2 — "Model*" · [BLE: Binaureal Linguistic Engine] (balanced) */}
            <div className="flex items-baseline justify-between gap-4">
              <motion.h2
                className="text-[3.75rem] sm:text-[5rem] md:text-[7rem] lg:text-[10.5rem] xl:text-[11rem] leading-[0.9] font-bold tracking-tight text-foreground"
                style={{ textShadow: '0 2px 18px rgba(0,0,0,0.45)' }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.18 }}
              >
                Model
                <span
                  onMouseEnter={() => onAsteriskHover?.(true)}
                  onMouseLeave={() => onAsteriskHover?.(false)}
                  className="ml-1 text-accent align-super cursor-pointer transition-transform duration-200 hover:scale-125"
                  style={{ fontSize: '0.38em' }}
                >
                  *
                </span>
              </motion.h2>
              <motion.span
                className="text-white/70 font-semibold tracking-tight text-[0.625rem] sm:text-[0.83rem] md:text-[1.17rem] lg:text-[1.75rem] xl:text-[1.83rem] leading-tight min-w-0 text-right whitespace-normal sm:whitespace-nowrap"
                style={{ textShadow: '0 0 16px rgba(255,255,255,0.35), 0 2px 10px rgba(0,0,0,0.6)' }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.28 }}
              >
                [BLE: Binaureal Linguistic Engine]
              </motion.span>
            </div>
          </div>

          <div className="relative mt-[0.825rem] text-secondary text-[0.7rem] sm:text-[1.3rem] md:text-[1.75rem] font-medium tracking-[0.05em] whitespace-nowrap">
            Probabilistic Intelligence <span className="font-bold text-[#0d4f57]">[PI]</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-[30rem] mx-auto pt-[2.2rem]">
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
          <span className="font-semibold tracking-tight mt-[1.1rem] text-xs sm:text-sm">
            <span className="text-secondary">[</span>
            <span className="font-bold text-secondary uppercase">VERSION:</span>
            <span className="font-bold" style={{ textShadow: WHITE_SHADOW }}>{' '}<span className="text-[#f4f1dd]">HEX6</span><span className="text-white">-BLE</span></span>
            <span className="text-[#0d4f57] font-semibold"> PI-US</span>
            <span className="text-secondary"> · PROBABILISTIC INTELLIGENCE MODEL <span className="font-bold">V5.5</span>]</span>
          </span>
        </div>
      </motion.div>
    </section>
  );
}