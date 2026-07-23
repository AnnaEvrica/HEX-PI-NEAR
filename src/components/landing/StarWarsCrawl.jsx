import { motion } from 'framer-motion';

// Star-Wars-style opening crawl: bold perspective text receding into the
// distance, scrolling upward on a dark plane. Replaces the static disclaimer
// paragraph that previously lived both here and in the footer.
export default function StarWarsCrawl() {
  return (
    <div
      className="relative w-full overflow-hidden rounded-md border border-border/60"
      style={{
        perspective: '340px',
        height: '11rem',
        background: 'linear-gradient(180deg,#05080f 0%,#0a1020 55%,#02040a 100%)',
      }}
    >
      {/* tilted receding plane */}
      <div
        className="absolute inset-0"
        style={{ transform: 'rotateX(30deg)', transformOrigin: '50% 100%' }}
      >
        <motion.div
          className="absolute left-0 right-0 px-6"
          style={{ top: '100%' }}
          initial={{ y: '0%' }}
          animate={{ y: '-260%' }}
          transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
        >
          <p
            className="text-center font-bold leading-relaxed text-[#FFE81F]"
            style={{ fontSize: '0.8rem', textShadow: '0 0 8px rgba(255,232,31,0.35)' }}
          >
            The Model is an experimental Probabilistic Intelligence{' '}
            <span className="text-white">[PI]</span> framework proposing a systems
            methodology for machine learning. It integrates probabilistic
            inference, semantic analysis, and transformer-based language models
            within a unified architecture for computational reasoning under
            uncertainty. It unifies probabilistic inference, semantic analysis,
            and transformer-based language models within a layered computational
            architecture. © Evrica Technologies Inc. 2026.
          </p>
        </motion.div>
      </div>

      {/* distance fades — top vanishing point + bottom exit */}
      <div
        className="absolute inset-x-0 top-0 h-1/3 pointer-events-none"
        style={{ background: 'linear-gradient(180deg,#05080f,transparent)' }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-1/4 pointer-events-none"
        style={{ background: 'linear-gradient(0deg,#02040a,transparent)' }}
      />
    </div>
  );
}