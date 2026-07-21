import { motion } from 'framer-motion';
import { ArrowRight, Brain, Waves } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// A live-feel preview of the experience — the exact toggle and voice people will
// meet inside. Makes you want to try it. Non-interactive mock (presentation only).

const SAMPLE_ANSWER = `Bitcoin is breathing in a narrow range, a quiet but firm pulse. The wave is no longer a violent surge — it's a steady tide finding its new level. There's a resonance of stability here, a gathering of strength. This is the market re-learning its own floor.`;

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
          Stop getting one answer. <br className="hidden sm:block" />
          Start seeing the whole space.
        </h2>
        <p className="text-base sm:text-lg text-secondary max-w-2xl mx-auto leading-relaxed">
          Others collapse uncertainty into a single prediction. Evrica holds the entire
          possibility space — and reads what it means. Switch modes mid-conversation;
          the knowledge stays, only the thinking changes.
        </p>
      </motion.div>

      {/* Mock chat preview */}
      <motion.div
        className="mx-auto max-w-2xl border border-border bg-card rounded-lg overflow-hidden shadow-sm"
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.6, delay: 0.15 }}
      >
        {/* Header with the live toggle — Understand active */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
          <span className="text-xs font-bold text-secondary uppercase tracking-wide">Evrica</span>
          <div className="flex items-center bg-muted/60 rounded-full p-1 border border-border">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-secondary">
              <Brain className="w-3.5 h-3.5" />
              <span>Reason</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-accent-foreground bg-accent">
              <Waves className="w-3.5 h-3.5" />
              <span>Understand</span>
            </div>
          </div>
        </div>

        {/* Conversation */}
        <div className="px-4 sm:px-6 py-5 space-y-4 bg-background min-h-[200px]">
          <div className="flex justify-end">
            <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm max-w-[80%]">
              What's Bitcoin doing right now?
            </div>
          </div>
          <motion.div
            className="flex justify-start"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <div className="bg-muted text-foreground rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm max-w-[85%] leading-relaxed">
              {SAMPLE_ANSWER}
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
          Same knowledge in. Same interface out. The only thing that changes is <span className="font-bold text-foreground">how it thinks</span>.
        </p>
        <button
          onClick={() => base44.auth.loginWithProvider('google', '/app')}
          className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-4 rounded-sm bg-accent text-accent-foreground font-medium hover:bg-accent/90 transition-colors text-sm sm:text-base md:text-lg"
        >
          Enter Evrica <ArrowRight className="w-4 h-4" />
        </button>
        <p className="text-xs text-secondary/70">7-day free trial. No charge today. Cancel anytime.</p>
      </motion.div>
    </section>
  );
}