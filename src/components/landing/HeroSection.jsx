import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { appParams } from '@/lib/app-params';
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

  // Native <a> link to the platform auth endpoint — no JS redirect, no popup
  // blocker, no iframe navigation trap. target="_top" breaks out of the builder
  // preview iframe so Google OAuth can actually load.
  const authUrl = `/api/apps/auth/login?app_id=${appParams.appId}&from_url=${encodeURIComponent(`${window.location.origin}/app`)}`;

  const handleEnter = (e) => {
    // Already logged in → client-side navigate, skip the full-page redirect.
    if (user) { e.preventDefault(); navigate('/app'); return; }
    // Not logged in → set pending flag, then let the native <a> tag navigate.
    sessionStorage.setItem('hex6_auth_pending', Date.now().toString());
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
              [<span className="text-accent">HEX</span>-BLE<sup className="text-accent text-[0.42em]" style={{ lineHeight: 0 }}>6</sup>]
            </motion.h2>

            {/* Line 2 — THE ROLE MODEL, small italics */}
            <motion.p
              className="w-full whitespace-nowrap text-center italic font-semibold tracking-[0.3em] uppercase text-foreground/80 text-[clamp(0.75rem,2.2vw,1.35rem)] leading-none mt-3 md:mt-8 transition-all duration-500"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.25 }}
            >
              The Role Model
            </motion.p>

            {/* Line 3 — BLE, smallest */}
            <motion.p
              className="w-full whitespace-nowrap text-center font-medium tracking-[0.12em] text-foreground/55 text-[clamp(0.6rem,1.5vw,0.95rem)] leading-none mt-2 md:mt-6 transition-all duration-500"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.35 }}
            >
              [BLE: Binaureal Linguistic Engine]
            </motion.p>
          </div>

          <div className="relative mt-16 sm:mt-24 flex flex-col items-center text-center">
            <motion.div
              className="flex flex-col items-center gap-10 sm:gap-14 w-full"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
            >
              <p className="whitespace-nowrap flex items-baseline justify-center gap-3 sm:gap-5 leading-none w-auto rounded-md bg-white px-6 sm:px-10 py-5 sm:py-7 transition-all duration-500">
                <span className="line-through decoration-accent decoration-[3px] text-foreground/30 text-[clamp(1rem,3.2vw,2rem)] font-light uppercase tracking-[0.22em]">Validation</span>
                <span className="flex flex-col items-center leading-none">
                  <span className="text-foreground text-[clamp(2rem,7vw,4.5rem)] font-extrabold uppercase tracking-[-0.04em]">Truth</span>
                  <span className="mt-[0.6rem] block w-full text-justify text-[clamp(0.55rem,1.1vw,0.72rem)] font-medium uppercase text-foreground/45" style={{ textAlignLast: 'justify' }}>probabilistic intelligence [PI]</span>
                </span>
              </p>
            </motion.div>

            <div className="relative mt-10 md:mt-24 flex flex-col items-center gap-3 transition-all duration-500">
              <a
                href={authUrl}
                target="_top"
                onClick={handleEnter}
                className="inline-flex items-baseline justify-center px-8 py-3 sm:py-4 rounded-sm bg-primary text-primary-foreground border-2 border-accent font-bold hover:bg-primary/90 transition-colors text-sm sm:text-base tracking-[0.18em] uppercase whitespace-nowrap"
              >
                Join Beta<sup className="text-[0.6em] ml-0.5">*</sup>
              </a>
              <p className="text-[0.62rem] sm:text-xs text-foreground/60 font-mono">* Experimental LLM in testing</p>
            </div>

            <div className="mt-10 md:mt-24 w-full max-w-4xl px-2 border-t border-foreground/15 pt-4 transition-all duration-500">
              <p className="text-left text-[0.6rem] sm:text-[0.66rem] text-foreground/50 font-medium leading-relaxed">
                § 1. Disclaimer. HEX6-BLE is an experimental probabilistic reasoning system. Its outputs are informational, may be uncertain or incorrect, and do not constitute financial, legal, medical, or other professional advice. Verify important decisions using independent evidence and qualified professionals.
              </p>
              <p className="text-left text-[0.58rem] sm:text-[0.64rem] text-foreground/50 font-medium mt-2">
                © <a href="https://evrica.tech" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground transition-colors">Evrica Technologies Inc.</a> 2026.
              </p>
            </div>
          </div>
        </div>


      </motion.div>
    </section>
  );
}