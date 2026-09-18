import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function ClosingCTA({ onOpenPolicy }) {
  return (
    <section className="bg-landing-bg py-20 lg:py-32 border-t border-landing-sheet/10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
        {/* Wordmark */}
        <motion.span
          className="font-mono font-bold text-2xl text-landing-sheet mb-8 block"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          [HEX-BLE<sup className="text-accent text-[0.6em] relative -top-[0.5em]">6</sup>]
        </motion.span>

        {/* Headline */}
        <motion.h2
          className="text-4xl sm:text-6xl font-bold text-landing-sheet mb-6 leading-[1.05]"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          Don't just ask AI.
          <br />
          <span className="text-accent">Know when to act.</span>
        </motion.h2>

        {/* Body */}
        <motion.p
          className="text-base sm:text-lg text-landing-muted mb-12 max-w-xl mx-auto leading-relaxed"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
        >
          Prediction becomes probability. Probability meets risk. Reality improves the next decision.
        </motion.p>

        {/* Links */}
        <motion.div
          className="flex flex-wrap items-center justify-center gap-6 mb-20"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
        >
          <Link
            to="/discover"
            className="text-accent font-mono text-xs sm:text-sm uppercase tracking-widest hover:underline"
          >
            Join the experiment ↗
          </Link>
          <a
            href="https://evrica.tech"
            target="_blank"
            rel="noopener noreferrer"
            className="text-landing-muted font-mono text-xs sm:text-sm uppercase tracking-widest hover:text-landing-sheet transition-colors"
          >
            Explore the method ↗
          </a>
        </motion.div>

        {/* Footer */}
        <div className="border-t border-landing-sheet/10 pt-8">
          <p className="font-mono text-xs text-landing-muted mb-4">
            HEX6-BLE // PROBABILISTIC INTELLIGENCE — Binaural Linguistic Engine
          </p>
          <div className="flex gap-6 justify-center text-xs text-landing-muted">
            <button
              onClick={() => onOpenPolicy('terms')}
              className="hover:text-landing-sheet transition-colors"
            >
              Terms of Service
            </button>
            <button
              onClick={() => onOpenPolicy('privacy')}
              className="hover:text-landing-sheet transition-colors"
            >
              Privacy Policy
            </button>
            <button
              onClick={() => onOpenPolicy('disclosure')}
              className="hover:text-landing-sheet transition-colors"
            >
              Risk Disclosure
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}