import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { LANDING_IMAGES } from './landingImages';
import { appParams } from '@/lib/app-params';
import { useAuth } from '@/lib/AuthContext';

export default function NewHero() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const authUrl = `/api/apps/auth/login?app_id=${appParams.appId}&from_url=${encodeURIComponent(`${window.location.origin}/app`)}`;
  const handleEnter = (e) => {
    if (user) { e.preventDefault(); navigate('/app'); return; }
    sessionStorage.setItem('hex6_auth_pending', Date.now().toString());
  };

  return (
    <section className="relative bg-landing-bg pt-8 pb-20 lg:pt-12 lg:pb-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Hero image */}
        <motion.div
          className="mb-10 lg:mb-16"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
        >
          <img
            src={LANDING_IMAGES.hero}
            alt="HEX6-BLE probabilistic intelligence"
            className="w-full h-[35vh] sm:h-[45vh] lg:h-[55vh] object-cover"
          />
        </motion.div>

        {/* Tagline */}
        <motion.p
          className="text-accent font-mono text-xs sm:text-sm tracking-widest uppercase mb-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          Probabilistic intelligence for consequential decisions
        </motion.p>

        {/* Wordmark */}
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <span className="font-mono font-bold text-2xl sm:text-3xl text-landing-sheet">
            [HEX-BLE<sup className="text-accent text-[0.6em] relative -top-[0.5em]">6</sup>]
          </span>
        </motion.div>

        {/* H1 */}
        <motion.h1
          className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-landing-sheet mb-6 max-w-4xl leading-[1.05]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          AI predicts. <span className="text-accent">HEX6-BLE</span> decides.
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          className="text-base sm:text-lg lg:text-xl text-landing-muted max-w-2xl mb-10 leading-relaxed"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          A reasoning layer above AI models that turns predictions into calibrated, risk-bounded
          actions — and learns from what actually happened.
        </motion.p>

        {/* Three chips */}
        <motion.div
          className="flex flex-wrap items-center gap-2 sm:gap-3 mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          {['Quantify uncertainty', 'Apply explicit risk', 'Score reality'].map((chip, i) => (
            <div key={chip} className="flex items-center gap-2 sm:gap-3">
              <span className="px-3 sm:px-4 py-2 border border-landing-sheet/20 rounded-sm text-xs sm:text-sm text-landing-sheet font-mono whitespace-nowrap">
                {chip}
              </span>
              {i < 2 && <span className="text-accent text-sm">→</span>}
            </div>
          ))}
        </motion.div>

        {/* CTA — ENTER HEX */}
        <motion.a
          href={authUrl}
          target="_top"
          onClick={handleEnter}
          className="inline-block px-6 sm:px-8 py-3 bg-accent text-white font-mono text-xs sm:text-sm uppercase tracking-widest hover:bg-accent/90 transition-colors"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          ENTER HEX<sup className="text-[0.6em] ml-0.5">*</sup>
        </motion.a>

        {/* Experimental note */}
        <motion.p
          className="mt-3 text-landing-muted text-[0.62rem] font-mono"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          * Experimental LLM in testing
        </motion.p>

        {/* Scroll hint */}
        <motion.p
          className="mt-8 text-landing-muted text-xs font-mono"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
        >
          ↓ scroll to follow one decision
        </motion.p>
      </div>
    </section>
  );
}