import { motion } from 'framer-motion';

const THINKERS = [
  {
    name: 'Pierre-Simon Laplace',
    years: '1749–1827',
    theory: 'Prior probabilities update with observed data to yield posterior beliefs — the rule of succession.',
    application: 'Systematized Bayesian inference and inverse probability — the engine of all probabilistic modeling.',
    portrait: 'https://upload.wikimedia.org/wikipedia/commons/3/39/Laplace%2C_Pierre-Simon%2C_marquis_de.jpg',
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
    name: 'Carl Jung',
    years: '1875–1961',
    theory: 'Archetypal patterns structure the psyche through a collective unconscious.',
    application: 'Reveals deep structural frameworks shared across human cognition and meaning-making.',
    portrait: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/ETH-BIB-Jung%2C_Carl_Gustav_%281875-1961%29-Portrait-Portr_14163_%28cropped%29.tif/lossy-page1-330px-ETH-BIB-Jung%2C_Carl_Gustav_%281875-1961%29-Portrait-Portr_14163_%28cropped%29.tif.jpg',
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
    name: 'Wolfgang Pauli',
    years: '1900–1958',
    theory: 'No two identical fermions can occupy the same quantum state (exclusion principle).',
    application: 'Quantum exclusion governs atomic structure — and inspired acausal synchronicity with Jung.',
    portrait: 'https://upload.wikimedia.org/wikipedia/commons/4/43/Pauli.jpg',
    span: 'narrow',
  },
  {
    name: 'Andrey Markov',
    years: '1856–1922',
    theory: 'Future states depend only on the present state, not the past — memoryless transitions.',
    application: 'Markov chains model sequential state transitions — the backbone of HEX6\'s probabilistic engine.',
    portrait: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Andrei_Markov.jpg/330px-Andrei_Markov.jpg',
    span: 'narrow',
  },
  {
    name: 'Alan Turing',
    years: '1912–1954',
    theory: 'Intelligence can be measured by a machine\'s ability to exhibit indistinguishable human reasoning.',
    application: 'Founded computational theory and asked "Can machines think?" — the genesis of machine learning.',
    portrait: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/Alan_turing_header.jpg/330px-Alan_turing_header.jpg',
    span: 'wide',
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
            style={{ filter: 'grayscale(100%) contrast(1.1)', objectPosition: 'center 25%' }}
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