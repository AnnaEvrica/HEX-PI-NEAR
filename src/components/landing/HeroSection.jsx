import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import SignaturePatternBackground from '@/components/landing/SignaturePatternBackground';
import WaveSignal3D from '@/components/landing/WaveSignal3D';

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
              style={{ fontSize: `${col.size}px`, textShadow: '0 0 6px rgba(255,107,53,0.55), 0 1px 2px rgba(0,0,0,0.45)' }}
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
                style={{ fontSize: `${col.size}px`, textShadow: '0 0 6px rgba(255,107,53,0.55), 0 1px 2px rgba(0,0,0,0.45)' }}
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

export default function HeroSection({ onAsteriskHover }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleEnter = () => {
    // Already logged in (token persisted across browser restarts) → go straight in.
    if (user) { navigate('/app'); return; }
    base44.auth.loginWithProvider('google', '/app');
  };

  return (
    <section className="relative w-full overflow-hidden pt-10 sm:pt-14 md:pt-20 pb-10 sm:pb-16">
      <SignaturePatternBackground />

      <motion.div
        className="relative z-10 max-w-6xl mx-auto px-6 sm:px-10 py-[2.75rem] sm:py-[3.85rem] bg-background/75 backdrop-blur-md rounded-lg shadow-[0_0_50px_rgba(255,255,255,0.1),0_14px_40px_rgba(0,0,0,0.4)]"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        style={{ textShadow: '0 0 10px rgba(255,255,255,0.25), 0 1px 3px rgba(0,0,0,0.45)' }}
      >
        {/* Title block — the headline */}
        <div className="relative mt-[1rem] sm:mt-[1.5rem]">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <ProbabilityMotif />
            <ResonanceMotif />
          </div>

          <div className="relative flex flex-col gap-[0.6rem] sm:gap-[1rem]">
            {/* Row 1 — "The" · [HEX6-BLE] (same font/size, soft white glow) */}
            <div className="flex items-baseline justify-between gap-4">
              <motion.h2
                className="text-[3.75rem] sm:text-[5rem] md:text-[7rem] lg:text-[10.5rem] xl:text-[11rem] leading-[0.9] font-bold tracking-tight text-foreground"
                style={{ textShadow: '0 0 14px rgba(255,255,255,0.3), 0 2px 18px rgba(0,0,0,0.45)' }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.1 }}
              >
                The
              </motion.h2>
            </div>

            {/* Row 2 — "Model*" · [BLE: Binaureal Linguistic Engine] (balanced) */}
            <div className="flex items-baseline justify-between gap-4">
              <motion.h2
                className="text-[3.75rem] sm:text-[5rem] md:text-[7rem] lg:text-[10.5rem] xl:text-[11rem] leading-[0.9] font-bold tracking-tight text-foreground"
                style={{ textShadow: '0 0 14px rgba(255,255,255,0.3), 0 2px 18px rgba(0,0,0,0.45)' }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.18 }}
              >
                Signal
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
          </div>

          {/* Hero line — the reframe */}
          <motion.div
            className="relative mt-[2.19rem] sm:mt-[3.31rem] flex flex-col gap-[0.5rem] sm:gap-[0.85rem]"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.26 }}
          >
            <h3
              className="font-bold tracking-tight text-[1.35rem] sm:text-[2rem] md:text-[2.75rem] lg:text-[3.75rem] xl:text-[4rem] leading-[0.95] text-foreground"
              style={{ textShadow: '0 0 18px rgba(255,255,255,0.4), 0 1px 0 rgba(255,255,255,0.2), 0 2px 12px rgba(0,0,0,0.6)' }}
            >
              The end of the hallucination.
            </h3>
            <p className="text-foreground/65 text-[0.8rem] sm:text-[1rem] md:text-[1.25rem] font-light leading-snug max-w-2xl">
              The truth is already in the room. You just haven't had the lens to see it — everything else is the noise you're already exhausted by.
            </p>
          </motion.div>

          <div className="relative mt-[1.75rem] sm:mt-[2.5rem] flex items-baseline justify-between text-foreground/80 text-[0.84rem] sm:text-[1.56rem] md:text-[2.1rem] font-light tracking-[0.05em]">
            <span className="whitespace-nowrap">Probabilistic Intelligence</span>
            <span className="font-bold text-[#0d4f57] whitespace-nowrap">[PI]</span>
          </div>

          <div className="relative mt-[3.5rem] sm:mt-[5rem] flex flex-col items-center">
            {/* Descriptor lines — [HEX6-BLE] / [BLE: Binaureal Linguistic Engine] */}
            <motion.div
              className="flex flex-col items-center gap-[0.5rem] sm:gap-[0.85rem]"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
            >
              <span
                className="font-bold tracking-tight text-[1.25rem] sm:text-[1.67rem] md:text-[2.33rem] lg:text-[3.5rem] xl:text-[3.67rem] leading-[0.9] whitespace-nowrap"
                style={{ textShadow: '0 0 24px rgba(255,255,255,0.55), 0 1px 0 rgba(255,255,255,0.25), 0 2px 14px rgba(0,0,0,0.65)' }}
              >
                <span className="text-white/75">[</span><span className="text-accent">HEX6</span><span className="text-white/75">-BLE]</span>
              </span>
              <span
                className="font-semibold tracking-tight text-[0.625rem] sm:text-[0.83rem] md:text-[1.17rem] lg:text-[1.75rem] xl:text-[1.83rem] leading-tight whitespace-normal sm:whitespace-nowrap text-center"
                style={{ textShadow: '0 0 16px rgba(255,255,255,0.4), 0 1px 0 rgba(255,255,255,0.2), 0 2px 10px rgba(0,0,0,0.6)' }}
              >
                <span className="text-white/60">[</span><span className="text-accent">BLE</span><span className="text-white/60">: Binaureal Linguistic Engine]</span>
              </span>
            </motion.div>

            {/* 3D radial wave field with identified signal points — circular ripple overlay on top. */}
            <div className="relative mt-[2.5rem] sm:mt-[3.5rem] w-full">
              <WaveSignal3D />
            </div>

            {/* Evidence — why it's different */}
            <div className="relative mt-[2.5rem] sm:mt-[3.5rem] w-full max-w-3xl mx-auto px-2">
              <div className="space-y-4 sm:space-y-5">
                <div className="flex flex-col sm:flex-row gap-1 sm:gap-5 sm:items-baseline">
                  <span className="text-white font-bold text-sm sm:text-base md:text-lg tracking-tight sm:w-52 shrink-0">Statistical Analysis</span>
                  <span className="text-foreground/70 text-sm sm:text-base md:text-lg font-light leading-snug">Learning probability through "prediction" — testable, falsifiable, and grounded in real outcome distributions.</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-1 sm:gap-5 sm:items-baseline">
                  <span className="text-white font-bold text-sm sm:text-base md:text-lg tracking-tight sm:w-52 shrink-0">Deepened Comprehension</span>
                  <span className="text-foreground/70 text-sm sm:text-base md:text-lg font-light leading-snug">Reading the signals behind the moment and surfacing the contextual value others miss.</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-1 sm:gap-5 sm:items-baseline">
                  <span className="text-white font-bold text-sm sm:text-base md:text-lg tracking-tight sm:w-52 shrink-0">Greater Objectivism</span>
                  <span className="text-foreground/70 text-sm sm:text-base md:text-lg font-light leading-snug">Stripping distortion from interpretation — letting structure lead, not narrative.</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-1 sm:gap-5 sm:items-baseline">
                  <span className="text-white font-bold text-sm sm:text-base md:text-lg tracking-tight sm:w-52 shrink-0">Accuracy &amp; Value</span>
                  <span className="text-foreground/70 text-sm sm:text-base md:text-lg font-light leading-snug">Sharper answers — more precise, more useful, and more honest about where the weight actually sits.</span>
                </div>
              </div>
            </div>

            {/* The disclaimer — simple black-on-white, filling the rectangle. */}
            <div className="relative mt-[3.25rem] sm:mt-[4.75rem] w-full rounded-md bg-white px-5 py-5 sm:py-6">
              <p className="text-left text-[0.72rem] sm:text-[0.9rem] md:text-[1.05rem] text-black font-bold leading-snug">
                The Signal is an experimental Probabilistic Intelligence <span className="text-[#0d4f57] font-bold">[PI]</span> framework proposing a systems methodology for machine learning. It integrates probabilistic inference, semantic analysis, and transformer-based language models within a unified architecture for computational reasoning under uncertainty. It unifies probabilistic inference, semantic analysis, and transformer-based language models within a layered computational architecture. © Evrica Technologies Inc. 2026.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-[30rem] mx-auto pt-[2.91rem]">
          <button
            onClick={() => navigate('/discover')}
            className="flex-1 inline-flex items-center justify-center px-6 py-3 sm:py-4 rounded-sm border-2 border-accent bg-white text-black font-medium hover:bg-accent/10 transition-all text-sm sm:text-base md:text-lg shadow-[0_0_14px_rgba(255,255,255,0.2)]"
          >
            Discover
          </button>
          <button
            onClick={handleEnter}
            className="flex-1 inline-flex items-center justify-center px-6 py-3 sm:py-4 rounded-sm bg-accent text-accent-foreground border-2 border-white font-medium hover:bg-accent/90 transition-all text-sm sm:text-base md:text-lg shadow-lg shadow-accent/25"
            style={{ boxShadow: '0 2px 18px rgba(0,0,0,0.35), 0 0 16px rgba(255,255,255,0.25), 0 0 24px rgba(255,106,0,0.15)' }}
          >
            Enter
          </button>
        </div>

        {/* Version line — multi-colored segments */}
        <div className="flex justify-center">
          <span className="font-semibold tracking-tight mt-[1.27rem] text-xs sm:text-sm text-secondary" style={{ textShadow: 'none' }}>
            <span>[</span>
            <span className="font-bold uppercase">VERSION:</span>
            <span className="font-bold">{' '}HEX6-BLE</span>
            <span className="font-semibold"> PI-US</span>
            <span> · PROBABILISTIC INTELLIGENCE SIGNAL <span className="font-bold">V5.5</span>]</span>
          </span>
        </div>
      </motion.div>
    </section>
  );
}