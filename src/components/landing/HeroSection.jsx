import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const POOL = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ∑∫π∞≈±∇√∂λμ';

// GeneratingMotif — a 3D stream of numbers + letters "generating" in depth.
// Used for both Probability and Resonance (same generating behavior).
function GeneratingMotif({ seed = 0 }) {
  const [chars, setChars] = useState(() =>
    Array.from({ length: 16 }, () => POOL[Math.floor(Math.random() * POOL.length)])
  );
  useEffect(() => {
    const id = setInterval(() => {
      setChars((prev) =>
        prev.map((c, i) => (Math.random() < 0.55 ? POOL[Math.floor(Math.random() * POOL.length)] : c))
      );
    }, 230);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ perspective: '720px' }}>
      {chars.map((c, i) => {
        const left = ((i * 6.1 + seed * 4) % 90) + 4;
        const top = ((i * 23 + seed * 13) % 80) + 8;
        const size = 9 + (i % 5) * 6;
        return (
          <motion.span
            key={i}
            className="absolute font-mono font-bold text-accent"
            style={{ left: `${left}%`, top: `${top}%`, fontSize: `${size}px` }}
            initial={{ opacity: 0, z: -280, scale: 0.4, rotateX: 35 }}
            animate={{ opacity: [0, 0.3, 0.05], z: [-280, 70], scale: [0.4, 1.1], rotateX: [35, 0] }}
            transition={{
              duration: 2.6 + (i % 4) * 0.6,
              repeat: Infinity,
              delay: (i * 0.12 + seed * 0.25) % 3,
              ease: 'easeOut',
            }}
          >
            {c}
          </motion.span>
        );
      })}
    </div>
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

export default function HeroSection() {
  return (
    <motion.section
      className="max-w-4xl mx-auto px-4 sm:px-6 pt-10 sm:pt-14 md:pt-20 pb-10 sm:pb-16"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
    >
      {/* Math-notebook framed panel — gridded via global .bg-background */}
      <div className="relative mx-auto max-w-3xl border-2 border-foreground/15 bg-background p-6 sm:p-10 min-h-[560px] sm:min-h-[640px] flex flex-col">
        <div className="pointer-events-none absolute inset-2 sm:inset-3 border border-foreground/10" />
        <div className="relative flex items-center gap-2 text-[10px] sm:text-xs font-mono text-secondary/70 uppercase tracking-widest mb-6 sm:mb-8">
          <span className="w-6 h-px bg-foreground/25" />
          <span>HEX6 · notebook</span>
          <span className="flex-1 h-px bg-foreground/10" />
        </div>

        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-sm bg-accent/10 border border-accent/30 w-fit">
            <span className="text-sm font-bold text-accent">HEX6 BLE</span>
            <span className="text-sm font-medium text-accent">Probabilistic Intelligence</span>
          </div>
        </div>

        <div className="space-y-1 sm:space-y-2 mt-4">
          <HeroWord word="Probability" motif={<GeneratingMotif seed={1} />} delay={0.1} />
          <HeroWord word="Resonance" motif={<GeneratingMotif seed={5} />} delay={0.25} />
          <HeroWord word="=" motif={null} delay={0.4} />
        </div>

        <motion.div
          className="flex items-center justify-center gap-3 sm:gap-5 mt-2"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.55 }}
        >
          <span className="text-2xl sm:text-4xl font-bold text-secondary line-through decoration-2 decoration-accent">AI</span>
          <ArrowRight className="w-5 h-5 sm:w-7 sm:h-7 text-accent" />
          <span className="text-3xl sm:text-5xl font-bold text-accent">PI</span>
        </motion.div>

        <div className="flex flex-col items-center gap-4 pt-6 sm:pt-8 mt-auto">
          <button
            onClick={() => base44.auth.loginWithProvider('google', '/app')}
            className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-4 rounded-sm bg-accent text-accent-foreground font-medium hover:bg-accent/90 transition-colors text-sm sm:text-base md:text-lg"
          >
            Enter Oracle <ArrowRight className="w-4 h-4" />
          </button>
          <span className="font-bold text-accent text-xs sm:text-sm tracking-tight">[PI-US · PROBABILISTIC INTELLIGENCE MODEL V5.5]</span>
        </div>
      </div>
    </motion.section>
  );
}