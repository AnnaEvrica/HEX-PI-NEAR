import { motion } from 'framer-motion';

const THINKERS = [
  {
    name: 'Thomas Bayes',
    years: 'c. 1701–1761',
    theory: 'Prior knowledge updates with new evidence to produce posterior probability.',
    application: 'Bayesian inference underpins all modern probabilistic learning and prediction systems.',
    portrait: 'https://upload.wikimedia.org/wikipedia/commons/d/d4/Thomas_Bayes.gif',
    span: 'wide',
  },
  {
    name: 'Blaise Pascal',
    years: '1623–1662',
    theory: 'Expected value governs rational decisions under uncertainty.',
    application: 'Foundation of modern risk assessment and decision theory.',
    portrait: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/Blaise_Pascal_Versailles.JPG/330px-Blaise_Pascal_Versailles.JPG',
    span: 'narrow',
  },
  {
    name: 'Nikola Tesla',
    years: '1856–1943',
    theory: 'Every system has a natural resonant frequency that amplifies energy.',
    application: 'Resonant frequency tuning enables wireless energy and signal processing.',
    portrait: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/79/Tesla_circa_1890.jpeg/330px-Tesla_circa_1890.jpeg',
    span: 'narrow',
  },
  {
    name: 'Max Planck',
    years: '1858–1947',
    theory: 'Energy is emitted in discrete quanta proportional to frequency (E = hf).',
    application: 'Planck\'s constant links frequency to energy — the bedrock of quantum mechanics.',
    portrait: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ee/Max_Planck_by_Hugo_Erfurth_1938cr_-_restoration1.jpg/330px-Max_Planck_by_Hugo_Erfurth_1938cr_-_restoration1.jpg',
    span: 'wide',
  },
  {
    name: 'Albert Einstein',
    years: '1879–1955',
    theory: 'Light energy is quantized — frequency determines the energy of each photon.',
    application: 'Photoelectric effect converts light frequency into electrical current — birthed quantum theory.',
    portrait: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Albert_Einstein_Head_cleaned.jpg/330px-Albert_Einstein_Head_cleaned.jpg',
    span: 'wide',
  },
  {
    name: 'Niels Bohr',
    years: '1885–1962',
    theory: 'Electrons orbit at discrete energy levels, emitting photons at specific frequencies.',
    application: 'Atomic frequency spectra reveal quantum state transitions — matter as frequency.',
    portrait: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Niels_Bohr.jpg/330px-Niels_Bohr.jpg',
    span: 'narrow',
  },
];

function ThinkerCard({ thinker }) {
  return (
    <div className={`relative border border-border bg-card/80 backdrop-blur-sm p-5 sm:p-6 space-y-4 overflow-hidden ${thinker.span === 'wide' ? 'md:col-span-3' : 'md:col-span-2'}`}>
      <div className="flex items-center gap-3">
        <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 hex-clip overflow-hidden bg-muted">
          <img
            src={thinker.portrait}
            alt={thinker.name}
            loading="lazy"
            className="w-full h-full object-cover"
            style={{ filter: 'grayscale(100%) contrast(1.1)' }}
          />
        </div>
        <div className="min-w-0">
          <h3 className="font-bold text-sm sm:text-base leading-tight">{thinker.name}</h3>
          <p className="text-xs text-secondary mt-0.5">{thinker.years}</p>
        </div>
      </div>
      <div className="space-y-2 text-xs sm:text-sm">
        <p className="text-foreground leading-relaxed"><span className="text-accent font-medium">Theory: </span>{thinker.theory}</p>
        <p className="text-secondary leading-relaxed"><span className="text-accent font-medium" style={{ opacity: 0.7 }}>Applied: </span>{thinker.application}</p>
      </div>
    </div>
  );
}

function MorseBand({ speed = 35, delay = 0, opacity = 0.25 }) {
  const morse = '···· · —··— —····   —··· ·—·· ·   ——— ·—· ·— —·—· ·—·· ·';
  return (
    <div style={{ opacity }}>
      <div className="flex whitespace-nowrap text-xs sm:text-sm font-mono tracking-[0.3em] text-accent" style={{ animation: `morse-scroll ${speed}s linear infinite`, animationDelay: `${delay}s` }}>
        <span className="px-8">{morse.repeat(6)}</span>
        <span className="px-8">{morse.repeat(6)}</span>
      </div>
    </div>
  );
}

export default function FoundersSection() {
  return (
    <section id="forefathers" className="relative max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 md:py-32 overflow-hidden">
      {/* Solar orb — large circular animation, radiant energy */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0">
        <div className="relative w-[250px] h-[250px] sm:w-[350px] sm:h-[350px] md:w-[450px] md:h-[450px]">
          <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full text-accent" style={{ animation: 'solar-rotate 40s linear infinite' }}>
            {Array.from({ length: 16 }).map((_, i) => (
              <line key={i} x1="100" y1="100" x2="100" y2="25" stroke="currentColor" strokeWidth="1" opacity="0.12" transform={`rotate(${i * 22.5} 100 100)`} />
            ))}
          </svg>
          <div className="absolute inset-[12%] rounded-full border-2 border-accent/25" style={{ animation: 'solar-expand 4s ease-out infinite' }} />
          <div className="absolute inset-[12%] rounded-full border-2 border-accent/25" style={{ animation: 'solar-expand 4s ease-out infinite', animationDelay: '1.3s' }} />
          <div className="absolute inset-[12%] rounded-full border-2 border-accent/25" style={{ animation: 'solar-expand 4s ease-out infinite', animationDelay: '2.6s' }} />
          <div className="absolute inset-[35%] rounded-full" style={{
            background: 'radial-gradient(circle, hsl(12 100% 55%) 0%, hsl(12 100% 45%) 50%, transparent 80%)',
            animation: 'solar-pulse 4s ease-in-out infinite',
            filter: 'blur(6px)',
          }} />
        </div>
      </div>

      {/* Morse code bands — flowing through, 3D parallax depth */}
      <div className="absolute inset-0 pointer-events-none z-[5]">
        <div className="absolute top-[6%] left-0 right-0 overflow-hidden" style={{ transform: 'perspective(800px) rotateX(10deg)' }}>
          <MorseBand speed={35} opacity={0.18} />
        </div>
        <div className="absolute top-[44%] left-0 right-0 overflow-hidden">
          <MorseBand speed={45} delay={3} opacity={0.12} />
        </div>
        <div className="absolute bottom-[8%] left-0 right-0 overflow-hidden" style={{ transform: 'perspective(800px) rotateX(-10deg)' }}>
          <MorseBand speed={40} delay={6} opacity={0.15} />
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 space-y-10 sm:space-y-14">
        <motion.div
          className="space-y-4 text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-sm bg-accent/10 border border-accent/30">
            <span className="text-sm font-bold text-accent">Standing on the Shoulders of Giants</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">The Forefathers of Probability</h2>
          <p className="text-base sm:text-lg text-secondary max-w-2xl mx-auto leading-relaxed">
            HEX6 BLE is built on a lineage of thinkers who dared to formalize uncertainty. We honor their foundations — the science beneath the system.
          </p>
        </motion.div>

        {/* Hex-tetris grid: wide + narrow cards interlock in an S-curve across 3 rows */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-5 gap-3 sm:gap-4 items-stretch"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          {THINKERS.map((t) => (
            <ThinkerCard key={t.name} thinker={t} />
          ))}
        </motion.div>
      </div>

      <style>{`
        @keyframes solar-rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes solar-expand { 0% { transform: scale(0.5); opacity: 0.5; } 100% { transform: scale(1.8); opacity: 0; } }
        @keyframes solar-pulse { 0%, 100% { transform: scale(1); opacity: 0.85; } 50% { transform: scale(1.12); opacity: 0.6; } }
        @keyframes morse-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .hex-clip { clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%); }
      `}</style>
    </section>
  );
}