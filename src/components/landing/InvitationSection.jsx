import { motion } from 'framer-motion';
import { ArrowRight, Link2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// A live-feel preview — no mode toggle, because there's no differentiation.
// One unified answer: a brief reasoning, a sources line, and a reinforcing
// nudge that teaches and learns with the user. Presentation only.

const SAMPLE_Q = 'Walk me through how Bayesian updating actually learns — then quiz me.';
const SAMPLE_A = `Bayesian updating starts with a prior belief and sharpens it with every new observation — your posterior becomes the next prior, so learning never restarts, it refines. The reason: each piece of evidence shifts belief by how surprising it is relative to what you expected. Here's a quick check — I'll give you a coin that came up heads three times in a row; tell me your updated guess for the fourth flip, and I'll show how the math moved beneath your intuition. That back-and-forth is reinforcement, and it's how we both get sharper.`;
const SAMPLE_SOURCES = [{ name: 'Bayes\' theorem', url: 'https://en.wikipedia.org/wiki/Bayes%27_theorem' }];

export default function InvitationSection() {
  return (
    <section
      id="try-it"
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
          <span className="text-sm font-bold text-accent">See it for yourself</span>
        </div>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
          One answer. <br className="hidden sm:block" />
          Reasoning you can follow.
        </h2>
        <p className="text-base sm:text-lg text-secondary max-w-2xl mx-auto leading-relaxed">
          Every response fuses what's possible with what's meaningful — with valid sources,
          brief reasoning, and a nudge that helps it stick. It teaches and learns with you,
          so you walk away sharper every time.
        </p>
      </motion.div>

      {/* Mock chat preview — one unified answer */}
      <motion.div
        className="mx-auto max-w-2xl border border-border bg-card rounded-lg overflow-hidden shadow-sm"
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.6, delay: 0.15 }}
      >
        {/* Header — unified, no toggle */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
          <span className="text-xs font-bold text-secondary uppercase tracking-wide">HEX6 BLE</span>
          <span className="text-[10px] sm:text-xs text-accent px-2 py-1 rounded bg-accent/10 font-medium">
            Reason + Understand · fused
          </span>
        </div>

        {/* Conversation */}
        <div className="px-4 sm:px-6 py-5 space-y-4 bg-background min-h-[200px]">
          <div className="flex justify-end">
            <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm max-w-[85%]">
              {SAMPLE_Q}
            </div>
          </div>
          <motion.div
            className="flex justify-start"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <div className="max-w-[88%]">
              <div className="bg-muted text-foreground rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm leading-relaxed">
                {SAMPLE_A}
              </div>
              {/* Sources — valid, only what was actually referenced */}
              <div className="flex items-center gap-1.5 mt-1.5 ml-1">
                <Link2 className="w-3 h-3 text-secondary" />
                <span className="text-xs text-secondary">Sources:</span>
                {SAMPLE_SOURCES.map((s) => (
                  <a
                    key={s.url}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-accent underline hover:opacity-80 break-all"
                  >
                    {s.name}
                  </a>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Input bar (visual only) */}
        <div className="border-t border-border px-4 py-3 bg-background flex items-center gap-2">
          <div className="flex-1 px-3 py-2 rounded-sm border border-border text-xs text-secondary/60 bg-muted/20">
            Ask anything...
          </div>
          <div className="w-9 h-9 rounded-sm bg-accent flex items-center justify-center shrink-0">
            <ArrowRight className="w-4 h-4 text-accent-foreground" />
          </div>
        </div>
      </motion.div>

      <motion.div
        className="text-center space-y-4"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.3 }}
      >
        <p className="text-sm text-secondary max-w-md mx-auto">
          Same knowledge in. One fused answer out — with the reasoning shown, and a way to make it yours.
        </p>
        <button
          onClick={() => base44.auth.loginWithProvider('google', '/app')}
          className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-4 rounded-sm bg-accent text-accent-foreground font-medium hover:bg-accent/90 transition-colors text-sm sm:text-base md:text-lg"
        >
          Enter Oracle <ArrowRight className="w-4 h-4" />
        </button>
        <p className="text-xs text-secondary/70">7-day free trial. No charge today. Cancel anytime.</p>
      </motion.div>
    </section>
  );
}