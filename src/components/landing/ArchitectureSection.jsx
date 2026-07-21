import { motion } from 'framer-motion';

// The inverted structure: Core at the FOUNDATION (bottom), Reason & Understand
// rising from it like two branches, converging at Response (the bloom), then
// Experience flowing back down to nourish the Core. Organic — a tree from its roots.
//
// Law 1: Core is permanent. Everything comes from it; everything returns to it.

export default function ArchitectureSection() {
  return (
    <section
      id="architecture"
      className="relative max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24 md:py-28 overflow-hidden"
    >
      <motion.div
        className="space-y-4 text-center mb-12 sm:mb-16"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6 }}
      >
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-sm bg-accent/10 border border-accent/30">
          <span className="text-sm font-bold text-accent">The Structure</span>
        </div>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
          One foundation. Two ways of thinking.
        </h2>
        <p className="text-base sm:text-lg text-secondary max-w-2xl mx-auto leading-relaxed">
          Everything comes from the <span className="font-bold text-foreground">Core</span>.
          Everything returns to it. Reason and Understand are simply two ways of engaging
          with the same knowledge — the mathematics lives underneath; the experience stays human.
        </p>
      </motion.div>

      {/* Inverted vertical diagram — Core at the bottom */}
      <motion.div
        className="relative mx-auto max-w-3xl"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.7, delay: 0.15 }}
      >
        {/* Connecting lines (SVG) — branches rising, loop returning */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 600 520"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {/* Core → Reason (left branch rising) */}
          <motion.path
            d="M 300 470 C 200 400, 160 340, 150 230"
            fill="none"
            stroke="hsl(var(--accent))"
            strokeWidth="1.5"
            strokeOpacity="0.35"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, delay: 0.3 }}
          />
          {/* Core → Understand (right branch rising) */}
          <motion.path
            d="M 300 470 C 400 400, 440 340, 450 230"
            fill="none"
            stroke="hsl(var(--accent))"
            strokeWidth="1.5"
            strokeOpacity="0.35"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, delay: 0.3 }}
          />
          {/* Reason → Response (converging left) */}
          <motion.path
            d="M 150 200 C 160 130, 230 90, 300 70"
            fill="none"
            stroke="hsl(var(--accent))"
            strokeWidth="1.5"
            strokeOpacity="0.35"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, delay: 0.5 }}
          />
          {/* Understand → Response (converging right) */}
          <motion.path
            d="M 450 200 C 440 130, 370 90, 300 70"
            fill="none"
            stroke="hsl(var(--accent))"
            strokeWidth="1.5"
            strokeOpacity="0.35"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, delay: 0.5 }}
          />
          {/* Response → Experience → Core (the return loop, right side) */}
          <motion.path
            d="M 360 70 C 540 120, 560 380, 360 460"
            fill="none"
            stroke="hsl(var(--secondary))"
            strokeWidth="1.25"
            strokeOpacity="0.3"
            strokeDasharray="5 6"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.4, delay: 0.8 }}
          />
        </svg>

        <div className="relative space-y-10 sm:space-y-14">
          {/* Response — the bloom */}
          <motion.div
            className="flex justify-center"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            <div className="text-center px-6 py-4 rounded-sm border border-accent/40 bg-accent/5">
              <p className="text-xs uppercase tracking-widest text-accent font-bold mb-1">Response</p>
              <p className="text-sm font-medium">What you receive</p>
            </div>
          </motion.div>

          {/* Reason & Understand — two branches */}
          <div className="flex justify-center gap-6 sm:gap-16">
            <motion.div
              className="text-center px-4 sm:px-6 py-4 rounded-sm border border-border bg-card"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <p className="text-xs uppercase tracking-widest text-secondary font-bold mb-1">Reason</p>
              <p className="text-sm font-bold">HEX6-BLE</p>
              <p className="text-xs text-secondary mt-1">"What is possible?"</p>
            </motion.div>
            <motion.div
              className="text-center px-4 sm:px-6 py-4 rounded-sm border border-accent/40 bg-card"
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <p className="text-xs uppercase tracking-widest text-accent font-bold mb-1">Understand</p>
              <p className="text-sm font-bold">PI-US</p>
              <p className="text-xs text-secondary mt-1">"What is meaningful?"</p>
            </motion.div>
          </div>

          {/* Core — the foundation */}
          <motion.div
            className="flex justify-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="text-center px-8 sm:px-12 py-5 rounded-sm border border-border bg-muted/40">
              <p className="text-base sm:text-lg font-bold tracking-tight">Core</p>
              <p className="text-xs text-secondary mt-1 max-w-xs">
                Permanent knowledge — concepts, relationships, memory.
                Never opinions. Never conclusions.
              </p>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* The loop caption */}
      <motion.p
        className="text-center text-sm text-secondary max-w-xl mx-auto mt-12 sm:mt-16 leading-relaxed"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.5 }}
      >
        Every response becomes experience. Validated experience returns to the Core —
        so the intelligence grows the way a living thing does: slowly, honestly, from its roots.
      </motion.p>
    </section>
  );
}