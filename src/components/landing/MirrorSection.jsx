import { motion } from 'framer-motion';

// The Mirror — HEX6-BLE (Reason) and PI-US (Understand) facing each other,
// both drawing from one Core, both feeding one Response. Same knowledge,
// different questions. This is the visual heart of the page.

// Left visual: the probability distribution (possibility space) — bars.
const BAR_HEIGHTS = [18, 32, 48, 66, 82, 92, 88, 74, 56, 40, 28, 20];

function ReasonVisual() {
  return (
    <svg viewBox="0 0 200 120" className="w-full h-auto" aria-hidden="true">
      <line x1="0" y1="100" x2="200" y2="100" stroke="hsl(var(--border))" strokeWidth="1" />
      {BAR_HEIGHTS.map((h, i) => (
        <motion.rect
          key={i}
          x={5 + i * 16}
          width="12"
          rx="1"
          fill="hsl(var(--accent))"
          style={{ transformBox: 'fill-box', transformOrigin: 'bottom' }}
          initial={{ height: 0, y: 100 }}
          whileInView={{ height: h, y: 100 - h }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: i * 0.05 }}
        />
      ))}
      {BAR_HEIGHTS.map((h, i) => (
        <motion.rect
          key={`p-${i}`}
          x={5 + i * 16}
          width="12"
          rx="1"
          fill="hsl(var(--accent))"
          opacity={0.25}
          style={{ transformBox: 'fill-box', transformOrigin: 'bottom' }}
          animate={{ scaleY: [1, 1.12, 1], opacity: [0.2, 0.45, 0.2] }}
          transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.12 }}
          initial={{ height: h, y: 100 - h }}
        />
      ))}
    </svg>
  );
}

// Right visual: the wave / resonance (what is meaningful) — a flowing sine with a glowing peak.
function UnderstandVisual() {
  return (
    <svg viewBox="0 0 200 120" className="w-full h-auto" aria-hidden="true">
      <motion.path
        d="M 5 60 Q 30 25 55 60 T 105 60 T 155 60 T 195 60"
        fill="none"
        stroke="hsl(var(--accent))"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="6 8"
        animate={{ strokeDashoffset: [0, -28] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
      />
      <motion.path
        d="M 5 60 Q 30 25 55 60 T 105 60 T 155 60 T 195 60"
        fill="none"
        stroke="hsl(var(--accent))"
        strokeWidth="2"
        strokeLinecap="round"
        opacity={0.3}
        animate={{ opacity: [0.2, 0.5, 0.2] }}
        transition={{ duration: 3, repeat: Infinity }}
      />
      {/* glowing resonance peak */}
      <motion.circle
        cx="30"
        cy="25"
        r="5"
        fill="hsl(var(--accent))"
        animate={{ cx: [30, 80, 130, 180, 130, 80, 30], cy: [25, 60, 25, 60, 25, 60, 25], r: [5, 4, 5, 4, 5, 4, 5] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        style={{ filter: 'drop-shadow(0 0 6px hsl(var(--accent)))' }}
      />
    </svg>
  );
}

function ModeColumn({ side, label, engine, question, visual, caption }) {
  const isLeft = side === 'left';
  return (
    <motion.div
      className={`border border-border bg-card p-5 sm:p-6 space-y-4 ${isLeft ? '' : 'border-accent/30'}`}
      initial={{ opacity: 0, x: isLeft ? -24 : 24 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.55 }}
    >
      <div className="flex items-center justify-between">
        <span className={`text-xs uppercase tracking-widest font-bold ${isLeft ? 'text-secondary' : 'text-accent'}`}>{label}</span>
        <span className={`text-xs font-mono ${isLeft ? 'text-secondary/60' : 'text-accent/70'}`}>{engine}</span>
      </div>
      <p className={`text-lg sm:text-xl font-bold ${isLeft ? '' : 'text-accent'}`}>{question}</p>
      <div className="h-24 sm:h-28 flex items-center">{visual}</div>
      <p className="text-xs sm:text-sm text-secondary leading-relaxed">{caption}</p>
    </motion.div>
  );
}

export default function MirrorSection() {
  return (
    <section
      id="mirror"
      className="relative max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 md:py-28 overflow-hidden"
    >
      <motion.div
        className="space-y-4 text-center mb-12 sm:mb-16"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6 }}
      >
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-sm bg-accent/10 border border-accent/30">
          <span className="text-sm font-bold text-accent">Two lenses · one mind</span>
        </div>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
          Same knowledge. Different questions.
        </h2>
        <p className="text-base sm:text-lg text-secondary max-w-2xl mx-auto leading-relaxed">
          One intelligence that thinks two ways at once. <span className="font-bold text-foreground">Reason</span> maps
          everything that could happen. <span className="font-bold text-accent">Understand</span> reads what it means.
          Both draw from the same Core. Both shape every answer.
        </p>
      </motion.div>

      {/* Response — the convergence at the top */}
      <motion.div
        className="flex justify-center mb-6 sm:mb-8"
        initial={{ opacity: 0, y: -10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <div className="text-center px-6 sm:px-8 py-3 rounded-sm border border-accent/40 bg-accent/5">
          <span className="text-xs uppercase tracking-widest text-accent font-bold">Response</span>
          <span className="text-sm text-secondary ml-3">one answer · both lenses</span>
        </div>
      </motion.div>

      {/* The two mirrored columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 relative">
        {/* connecting lines down to Core */}
        <svg className="hidden md:block absolute left-0 right-0 -bottom-10 h-10 pointer-events-none" viewBox="0 0 800 40" preserveAspectRatio="none" aria-hidden="true">
          <motion.path d="M 200 0 C 200 25, 400 25, 400 40" fill="none" stroke="hsl(var(--accent))" strokeWidth="1.5" strokeOpacity="0.3" strokeLinecap="round" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 0.8, delay: 0.4 }} />
          <motion.path d="M 600 0 C 600 25, 400 25, 400 40" fill="none" stroke="hsl(var(--accent))" strokeWidth="1.5" strokeOpacity="0.3" strokeLinecap="round" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 0.8, delay: 0.4 }} />
        </svg>

        <ModeColumn
          side="left"
          label="Reason"
          engine="HEX6-BLE"
          question="What is possible?"
          visual={<ReasonVisual />}
          caption="Holds the full probability space — every outcome, weighted by evidence. Structural. Precise. Never collapses to a single guess."
        />
        <ModeColumn
          side="right"
          label="Understand"
          engine="PI-US"
          question="What is meaningful?"
          visual={<UnderstandVisual />}
          caption="Reads the waves — resonance, coherence, and where the value lives. It tailors the answer to what matters, and sets the tone."
        />
      </div>

      {/* Core — the shared foundation */}
      <motion.div
        className="flex justify-center mt-10 sm:mt-12"
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.3 }}
      >
        <div className="text-center px-8 sm:px-12 py-5 rounded-sm border border-border bg-muted/40">
          <p className="text-base sm:text-lg font-bold tracking-tight">Core</p>
          <p className="text-xs text-secondary mt-1 max-w-xs">
            One evolving knowledge. Both modes read it; neither changes it.
            Only validated experience returns.
          </p>
        </div>
      </motion.div>
    </section>
  );
}