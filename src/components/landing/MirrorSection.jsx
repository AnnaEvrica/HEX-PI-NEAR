import { motion } from 'framer-motion';

// The unity — Reason (structure) and Understand (meaning) are never separate
// or competing. They fuse into ONE answer. This visual shows both layers living
// together in a single composition: the probability bars and the resonance wave,
// in one frame, feeding one response.

const BAR_HEIGHTS = [16, 30, 46, 62, 78, 88, 84, 72, 56, 42, 28, 16];

function FusedVisual() {
  return (
    <svg viewBox="0 0 240 150" className="w-full h-auto" aria-hidden="true">
      <line x1="8" y1="120" x2="232" y2="120" stroke="hsl(var(--border))" strokeWidth="1" />
      {/* Structure — probability distribution (what's possible) */}
      {BAR_HEIGHTS.map((h, i) => (
        <motion.rect
          key={`b-${i}`}
          x={10 + i * 18}
          width="14"
          rx="1"
          fill="hsl(var(--accent))"
          style={{ transformBox: 'fill-box', transformOrigin: 'bottom' }}
          initial={{ height: 0, y: 120 }}
          whileInView={{ height: h, y: 120 - h }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: i * 0.05 }}
        />
      ))}
      {BAR_HEIGHTS.map((h, i) => (
        <motion.rect
          key={`p-${i}`}
          x={10 + i * 18}
          width="14"
          rx="1"
          fill="hsl(var(--accent))"
          opacity={0.22}
          style={{ transformBox: 'fill-box', transformOrigin: 'bottom' }}
          animate={{ scaleY: [1, 1.12, 1], opacity: [0.18, 0.4, 0.18] }}
          transition={{ duration: 2.6, repeat: Infinity, delay: i * 0.12 }}
          initial={{ height: h, y: 120 - h }}
        />
      ))}
      {/* Meaning — the resonance wave (what matters), flowing across the structure */}
      <motion.path
        d="M 8 70 Q 38 28 68 70 T 128 70 T 188 70 T 232 70"
        fill="none"
        stroke="hsl(var(--accent))"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="6 7"
        animate={{ strokeDashoffset: [0, -26] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
      />
      <motion.path
        d="M 8 70 Q 38 28 68 70 T 128 70 T 188 70 T 232 70"
        fill="none"
        stroke="hsl(var(--accent))"
        strokeWidth="2"
        strokeLinecap="round"
        opacity={0.3}
        animate={{ opacity: [0.2, 0.5, 0.2] }}
        transition={{ duration: 3, repeat: Infinity }}
      />
      <motion.circle
        r="5"
        fill="hsl(var(--accent))"
        animate={{ cx: [38, 98, 158, 218, 158, 98, 38], cy: [28, 70, 28, 70, 28, 70, 28] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
        style={{ filter: 'drop-shadow(0 0 6px hsl(var(--accent)))' }}
      />
    </svg>
  );
}

export default function MirrorSection() {
  return (
    <section
      id="mirror"
      className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24 md:py-28 space-y-10 sm:space-y-14"
    >
      <motion.div
        className="space-y-4 text-center"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6 }}
      >
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-sm bg-accent/10 border border-accent/30">
          <span className="text-sm font-bold text-accent">One intelligence</span>
        </div>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
          Every answer thinks two ways at once
        </h2>
        <p className="text-base sm:text-lg text-secondary max-w-2xl mx-auto leading-relaxed">
          <span className="font-bold text-foreground">Reason</span> maps what's possible.
          <span className="font-bold text-accent"> Understand</span> reads what's meaningful.
          They never compete and you never choose — they fuse into one answer, with sources
          and reasoning you can follow.
        </p>
      </motion.div>

      {/* One Response — the single fused answer */}
      <motion.div
        className="flex justify-center"
        initial={{ opacity: 0, y: -10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.25 }}
      >
        <div className="text-center px-6 sm:px-8 py-3 rounded-sm border border-accent/40 bg-accent/5">
          <span className="text-xs uppercase tracking-widest text-accent font-bold">One response</span>
          <span className="text-sm text-secondary ml-3">structure + meaning, fused</span>
        </div>
      </motion.div>

      {/* The fused composition — both layers in one frame */}
      <motion.div
        className="border border-border bg-card p-5 sm:p-8 space-y-4"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.6, delay: 0.15 }}
      >
        <div className="flex items-center justify-between text-xs">
          <span className="text-secondary font-bold uppercase tracking-wide">Structure · what's possible</span>
          <span className="text-accent font-bold uppercase tracking-wide">Meaning · what matters</span>
        </div>
        <FusedVisual />
        <p className="text-center text-sm text-secondary leading-relaxed max-w-xl mx-auto pt-2">
          The probability space and the resonance wave live in the same answer. You get the
          full picture — what could happen, and what it means — every time.
        </p>
      </motion.div>

      {/* Core — the shared foundation */}
      <motion.div
        className="flex justify-center"
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.3 }}
      >
        <div className="text-center px-8 sm:px-12 py-5 rounded-sm border border-border bg-muted/40">
          <p className="text-base sm:text-lg font-bold tracking-tight">Core</p>
          <p className="text-xs text-secondary mt-1 max-w-xs">
            One evolving knowledge. Both ways of thinking read it; neither changes it.
            Only validated experience returns.
          </p>
        </div>
      </motion.div>
    </section>
  );
}