import { motion } from 'framer-motion';

const THINKERS = [
  {
    name: 'Blaise Pascal',
    years: '1623–1662',
    theory: 'Expected value governs rational decisions under uncertainty.',
    application: 'Foundation of modern risk assessment and expected-value calculation.',
    visual: 'pascal',
    badge: 'Coming Soon',
    span: 'wide',
  },
  {
    name: 'Carl Jung & Wolfgang Pauli',
    years: '1875–1961 · 1900–1958',
    theory: 'Archetypal patterns structure both psyche and matter through acausal orderedness.',
    application: 'Reveals structural resonance between consciousness and physical systems.',
    visual: 'mandala',
    badge: 'Coming Soon',
    span: 'narrow',
  },
  {
    name: 'Warren McCulloch',
    years: '1898–1969',
    theory: 'Neural activity is computation — neurons as logical gates processing reality.',
    application: 'Birthed every artificial neural network from biological first principles.',
    visual: 'neuron',
    badge: 'Coming Soon',
    span: 'narrow',
  },
  {
    name: 'Karl Friston',
    years: '1959–present',
    theory: 'Living systems minimize surprise to maintain structural integrity.',
    application: 'Active inference models self-organizing intelligence across all life.',
    visual: 'wave',
    badge: 'Coming Soon',
    span: 'wide',
  },
];

function PascalVisual() {
  const rows = [[1], [1, 1], [1, 2, 1], [1, 3, 3, 1]];
  return (
    <svg viewBox="0 0 100 80" className="w-full h-full">
      {rows.slice(0, -1).map((row, ri) =>
        row.map((_, ci) => {
          const x1 = 50 + (ci - (row.length - 1) / 2) * 18;
          const y1 = 12 + ri * 18;
          const nextRow = rows[ri + 1];
          const x2a = 50 + (ci - (nextRow.length - 1) / 2) * 18;
          const x2b = 50 + (ci + 1 - (nextRow.length - 1) / 2) * 18;
          const y2 = y1 + 18;
          return (
            <g key={`l-${ri}-${ci}`}>
              <line x1={x1} y1={y1 + 7.5} x2={x2a} y2={y2 - 7.5} stroke="currentColor" strokeWidth="0.4" className="text-accent" opacity="0.25" />
              <line x1={x1} y1={y1 + 7.5} x2={x2b} y2={y2 - 7.5} stroke="currentColor" strokeWidth="0.4" className="text-accent" opacity="0.25" />
            </g>
          );
        })
      )}
      {rows.map((row, ri) =>
        row.map((num, ci) => {
          const x = 50 + (ci - (row.length - 1) / 2) * 18;
          const y = 12 + ri * 18;
          return (
            <g key={`n-${ri}-${ci}`}>
              <circle cx={x} cy={y} r="7.5" fill="none" stroke="currentColor" strokeWidth="0.8" className="text-accent" opacity="0.5" />
              <text x={x} y={y + 2.5} textAnchor="middle" fontSize="6" fill="currentColor" className="text-accent">{num}</text>
            </g>
          );
        })
      )}
    </svg>
  );
}

function MandalaVisual() {
  return (
    <svg viewBox="0 0 100 80" className="w-full h-full">
      {[12, 22, 32].map((r) => (
        <circle key={r} cx="50" cy="40" r={r} fill="none" stroke="currentColor" strokeWidth="0.6" className="text-accent" opacity="0.4" />
      ))}
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i * 45) * Math.PI / 180;
        return (
          <line key={i} x1={50 + 12 * Math.cos(angle)} y1={40 + 12 * Math.sin(angle)} x2={50 + 32 * Math.cos(angle)} y2={40 + 32 * Math.sin(angle)} stroke="currentColor" strokeWidth="0.5" className="text-accent" opacity="0.3" />
        );
      })}
      <circle cx="50" cy="40" r="4" fill="currentColor" className="text-accent" opacity="0.6" />
    </svg>
  );
}

function NeuronVisual() {
  const nodes = [{ x: 15, y: 18 }, { x: 15, y: 62 }, { x: 50, y: 40 }, { x: 85, y: 18 }, { x: 85, y: 62 }];
  const edges = [[0, 2], [1, 2], [2, 3], [2, 4]];
  return (
    <svg viewBox="0 0 100 80" className="w-full h-full">
      {edges.map(([a, b], i) => (
        <line key={i} x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y} stroke="currentColor" strokeWidth="0.6" className="text-accent" opacity="0.35" />
      ))}
      {nodes.map((n, i) => (
        <circle key={i} cx={n.x} cy={n.y} r="5" fill={i === 2 ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="0.8" className="text-accent" opacity={i === 2 ? 0.7 : 0.5} />
      ))}
    </svg>
  );
}

function WaveVisual() {
  const points = Array.from({ length: 50 }, (_, i) => {
    const x = (i / 49) * 90 + 5;
    const decay = Math.exp(-i / 15);
    const y = 15 + (1 - decay) * 45 + Math.sin(i * 0.8) * decay * 12;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg viewBox="0 0 100 80" className="w-full h-full">
      <line x1="5" y1="62" x2="95" y2="62" stroke="currentColor" strokeWidth="0.4" className="text-accent" opacity="0.2" />
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1" className="text-accent" opacity="0.6" />
      <circle cx="92" cy="60" r="2.5" fill="currentColor" className="text-accent" opacity="0.7" />
    </svg>
  );
}

const VISUALS = { pascal: PascalVisual, mandala: MandalaVisual, neuron: NeuronVisual, wave: WaveVisual };

function ThinkerCard({ thinker }) {
  const Visual = VISUALS[thinker.visual];
  return (
    <div className={`relative border border-border bg-card/80 backdrop-blur-sm p-5 sm:p-6 space-y-4 overflow-hidden ${thinker.span === 'wide' ? 'md:col-span-3' : 'md:col-span-2'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-14 h-14 sm:w-16 sm:h-16 shrink-0 hex-clip bg-accent/10 flex items-center justify-center p-2">
            <Visual />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-sm sm:text-base leading-tight">{thinker.name}</h3>
            <p className="text-xs text-secondary mt-0.5">{thinker.years}</p>
          </div>
        </div>
        {thinker.badge && (
          <span className="text-[10px] uppercase tracking-wide text-accent bg-accent/10 px-2 py-1 rounded-sm border border-accent/30 shrink-0">
            {thinker.badge}
          </span>
        )}
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

        {/* Hex-tetris grid: wide + narrow cards interlock in an S-curve */}
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