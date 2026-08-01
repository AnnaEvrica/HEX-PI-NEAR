import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';


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
              className="font-mono font-bold text-foreground/25 whitespace-nowrap"
              style={{ fontSize: `${col.size}px`, textShadow: '0 0 6px rgba(255,255,255,0.25), 0 1px 2px rgba(0,0,0,0.45)' }}
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
                className="font-mono font-bold text-foreground/25"
                style={{ fontSize: `${col.size}px`, textShadow: '0 0 6px rgba(255,255,255,0.25), 0 1px 2px rgba(0,0,0,0.45)' }}
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
          className="text-foreground/25"
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
    <section className="relative w-full overflow-hidden pt-6 sm:pt-10 md:pt-14 pb-6 sm:pb-10">
      <div className="absolute inset-0 bg-black" />

      <motion.div
        className="relative z-10 max-w-6xl mx-auto px-5 sm:px-10 py-12 sm:py-16 md:py-20 bg-background/75 backdrop-blur-md rounded-lg shadow-[0_0_50px_rgba(255,255,255,0.1),0_14px_40px_rgba(0,0,0,0.4)]"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        style={{ textShadow: '0 0 10px rgba(255,255,255,0.25), 0 1px 3px rgba(0,0,0,0.45)' }}
      >
        {/* Title block — the headline */}
        <div className="relative">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <ProbabilityMotif />
            <ResonanceMotif />
          </div>

          <div className="relative flex flex-col items-center text-center gap-[0.6rem] sm:gap-[1rem]">
            {/* Single-line wordmark scales fluidly from phone to desktop. */}
            <motion.h2
              className="w-full whitespace-nowrap text-center text-[clamp(2.65rem,14vw,10rem)] leading-[0.9] font-bold tracking-[-0.055em] text-foreground"
              style={{ textShadow: '0 0 14px rgba(255,255,255,0.3), 0 2px 18px rgba(0,0,0,0.45)' }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
            >
              [<span className="text-accent">HEX6</span>-BLE]
            </motion.h2>
          </div>

          <div className="relative mt-16 sm:mt-24 flex flex-col items-center text-center">
            <motion.div
              className="flex flex-col items-center gap-6 sm:gap-8 w-full"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
            >
              <span
                className="w-full whitespace-nowrap font-semibold tracking-[-0.035em] text-[clamp(1rem,5vw,4.5rem)] leading-none text-center"
                style={{ textShadow: '0 1px 2px rgba(255,255,255,0.35), 0 2px 8px rgba(0,0,0,0.2)' }}
              >
                <span className="text-foreground/70">[</span><span className="text-foreground">BLE</span><span className="text-foreground/70">: Binaureal Linguistic Engine]</span>
              </span>
              <p className="whitespace-nowrap text-foreground text-[clamp(0.85rem,2.6vw,1.65rem)] font-medium leading-relaxed tracking-tight">
                <span className="line-through decoration-accent decoration-2 text-foreground/55">Validation</span>{' '}<span className="font-semibold">truth</span>
              </p>
            </motion.div>

            <div className="relative mt-10 sm:mt-14 w-full rounded-md bg-white px-5 py-5 sm:py-6">
              <p className="text-center text-sm sm:text-lg md:text-xl text-black font-mono font-semibold leading-snug">
                Experimental LLM in beta testing
              </p>
            </div>

            <div className="mt-8 sm:mt-10 max-w-4xl px-2">
              <p className="text-center text-[0.68rem] sm:text-[0.8rem] md:text-[0.9rem] text-foreground/55 font-medium leading-relaxed">
                HEX6-BLE is an experimental probabilistic reasoning system. Its outputs are informational, may be uncertain or incorrect, and do not constitute financial, legal, medical, or other professional advice. Verify important decisions using independent evidence and qualified professionals.
              </p>
              <p className="text-center text-[0.62rem] sm:text-[0.72rem] md:text-[0.8rem] text-foreground/40 font-medium mt-3">
                © Evrica Technologies Inc. 2026.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-center w-full pt-16 sm:pt-20">
          <button
            onClick={handleEnter}
            className="inline-flex items-center justify-center px-10 py-3 sm:py-4 rounded-sm bg-primary text-primary-foreground border-2 border-foreground font-bold hover:bg-primary/90 transition-colors text-sm sm:text-base md:text-lg shadow-lg"
            style={{ boxShadow: '0 2px 18px rgba(0,0,0,0.35), 0 0 16px rgba(255,255,255,0.25)' }}
          >
            Arrive
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