import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { ArrowRight, Sparkles, Bot } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { base44 } from '@/api/base44Client';

const QUESTION = 'Is now a good time to invest, or should I wait?';

// Representative generic-AI (e.g. GPT) answer to the same question — shown for
// comparison. The HEX6 column is the LIVE model response from `landingComparison`.
const GPT_ANSWER = `It depends on your goals and time horizon. As a general rule, time in the market tends to beat timing the market, so many advisors suggest dollar-cost averaging — investing a set amount on a regular schedule rather than waiting for the "right" moment. If you're unsure, consider starting with a small, diversified position and speaking with a licensed financial advisor. Past performance doesn't guarantee future results.`;

export default function InvitationSection() {
  const [hex6, setHex6] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await base44.functions.invoke('landingComparison', {});
        if (!alive) return;
        const ans = res?.data?.hex6_answer || res?.hex6_answer;
        if (ans) { setHex6(ans); setError(false); } else setError(true);
      } catch {
        if (alive) setError(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <section id="try-it" className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24 md:py-28 space-y-10 sm:space-y-14">
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
          A question people ask GPT every day.
          <br className="hidden sm:block" /> Two very different answers.
        </h2>
        <p className="text-base sm:text-lg text-secondary max-w-2xl mx-auto leading-relaxed">
          We asked a common question — and put a typical generic-AI answer next to the live HEX6 BLE response. Same question, different intelligence.
        </p>
      </motion.div>

      {/* The question */}
      <motion.div
        className="mx-auto max-w-2xl border border-border bg-card rounded-lg overflow-hidden shadow-sm"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.6, delay: 0.15 }}
      >
        <div className="px-4 py-3 border-b border-border bg-muted/30 text-xs font-bold text-secondary uppercase tracking-wide">The question</div>
        <div className="px-4 sm:px-6 py-5 bg-background">
          <div className="flex justify-end">
            <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm max-w-[90%]">{QUESTION}</div>
          </div>
        </div>
      </motion.div>

      {/* Side-by-side comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* GPT column */}
        <motion.div
          className="border border-border bg-card rounded-lg overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-secondary uppercase tracking-wide"><Bot className="w-3.5 h-3.5" /> Typical GPT</span>
            <span className="text-[10px] text-secondary/70 px-2 py-1 rounded bg-muted/40">generic · representative</span>
          </div>
          <div className="px-4 sm:px-6 py-5 bg-background text-sm leading-relaxed text-secondary">{GPT_ANSWER}</div>
        </motion.div>

        {/* HEX6 column — live model output */}
        <motion.div
          className="border border-accent/40 bg-card rounded-lg overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-accent/30 bg-accent/5">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-accent uppercase tracking-wide"><Sparkles className="w-3.5 h-3.5" /> HEX6 BLE · PI-US</span>
            <span className="text-[10px] text-accent px-2 py-1 rounded bg-accent/10 font-medium">live model response</span>
          </div>
          <div className="px-4 sm:px-6 py-5 bg-background text-sm leading-relaxed min-h-[140px]">
            {loading ? (
              <div className="flex items-center gap-2 text-secondary">
                <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                <span className="text-xs">Reasoning through probability…</span>
              </div>
            ) : error || !hex6 ? (
              <p className="text-secondary text-xs">HEX6 BLE is reasoning — try again in a moment, or enter the Oracle to ask it directly.</p>
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none [&>*]:my-1 [&>p]:my-1 [&>ul]:my-1 [&>li]:my-0">
                <ReactMarkdown
                  components={{
                    a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" className="text-accent underline hover:opacity-80 break-all" />,
                  }}
                >
                  {hex6}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      <motion.div
        className="text-center space-y-4"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.3 }}
      >
        <p className="text-sm text-secondary max-w-md mx-auto">
          Same question in. Different intelligence out — HEX6 reasons through probability and decides through resonance.
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