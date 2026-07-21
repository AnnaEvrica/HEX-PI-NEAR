import { motion } from 'framer-motion';

// HEX6 BLE · PI-US v5.5 — a hexagonal brain.
// One organism: a Core (shared knowledge), two lobes — Reason (probability) and
// Understand (resonance) — fusing into a single Decision, spoken in one Voice.
// 3D, in the app's accent style. Replaces the old traditional-LLM → PI → output panels.

const REASON_NODES = [ { x: 55, y: 80 }, { x: 42, y: 112 }, { x: 64, y: 140 } ];
const UNDERSTAND_NODES = [ { x: 145, y: 80 }, { x: 158, y: 112 }, { x: 136, y: 140 } ];
const CORE = { x: 100, y: 110 };
const DECISION = { x: 100, y: 50 };
const VOICE = { x: 100, y: 160 };

const HEX = '100,12 174,54 174,146 100,188 26,146 26,54';

const pulse = (delay) => ({
  animate: { opacity: [0.35, 0.9, 0.35] },
  transition: { duration: 2.4, repeat: Infinity, delay, ease: 'easeInOut' },
});

export default function PILayerVisualization() {
  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <div className="relative h-[280px] sm:h-[360px]" style={{ perspective: '1100px' }}>
        {/* soft accent glow behind the brain */}
        <motion.div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 sm:w-56 sm:h-56"
          style={{
            clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
            background: 'hsl(12 100% 50%)',
            filter: 'blur(28px)',
          }}
          animate={{ opacity: [0.12, 0.26, 0.12], scale: [1, 1.12, 1] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />

        <motion.div
          className="relative w-full h-full flex items-center justify-center"
          style={{ transformStyle: 'preserve-3d' }}
          animate={{ rotateY: [-6, 6, -6], rotateX: [3, -3, 3] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
        >
          <svg viewBox="0 0 200 200" className="w-[230px] h-[230px] sm:w-[300px] sm:h-[300px] text-accent">
            {/* Hexagon braincase */}
            <polygon points={HEX} fill="none" stroke="currentColor" strokeWidth="1.4" opacity="0.5" />

            {/* Lobe enclosures */}
            <motion.ellipse cx="52" cy="112" rx="26" ry="34" fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.18" animate={{ opacity: [0.12, 0.24, 0.12] }} transition={{ duration: 3, repeat: Infinity }} />
            <motion.ellipse cx="148" cy="112" rx="26" ry="34" fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.18" animate={{ opacity: [0.12, 0.24, 0.12] }} transition={{ duration: 3, repeat: Infinity, delay: 1.5 }} />

            {/* Lobe nodes → Core */}
            {[...REASON_NODES, ...UNDERSTAND_NODES].map((n, i) => (
              <line key={`c-${i}`} x1={n.x} y1={n.y} x2={CORE.x} y2={CORE.y} stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
            ))}
            {/* within-lobe connections */}
            {REASON_NODES.map((n, i) => REASON_NODES.slice(i + 1).map((m, j) => (
              <line key={`rl-${i}-${j}`} x1={n.x} y1={n.y} x2={m.x} y2={m.y} stroke="currentColor" strokeWidth="0.4" opacity="0.22" />
            )))}
            {UNDERSTAND_NODES.map((n, i) => UNDERSTAND_NODES.slice(i + 1).map((m, j) => (
              <line key={`ul-${i}-${j}`} x1={n.x} y1={n.y} x2={m.x} y2={m.y} stroke="currentColor" strokeWidth="0.4" opacity="0.22" />
            )))}
            {/* cross-lobe fusion */}
            <line x1="64" y1="140" x2="136" y2="140" stroke="currentColor" strokeWidth="0.6" opacity="0.3" strokeDasharray="3 3" />
            <line x1="55" y1="80" x2="145" y2="80" stroke="currentColor" strokeWidth="0.6" opacity="0.3" strokeDasharray="3 3" />
            {/* Core → Decision, Core → Voice */}
            <line x1={CORE.x} y1={CORE.y} x2={DECISION.x} y2={DECISION.y} stroke="currentColor" strokeWidth="1" opacity="0.5" />
            <line x1={CORE.x} y1={CORE.y} x2={VOICE.x} y2={VOICE.y} stroke="currentColor" strokeWidth="0.8" opacity="0.35" />

            {/* traveling signals */}
            <circle r="1.6" fill="currentColor">
              <animateMotion dur="2.6s" repeatCount="indefinite" path={`M ${CORE.x} ${CORE.y} L ${DECISION.x} ${DECISION.y}`} />
            </circle>
            <circle r="1.6" fill="currentColor">
              <animateMotion dur="3.4s" repeatCount="indefinite" path={`M ${VOICE.x} ${VOICE.y} L ${CORE.x} ${CORE.y}`} />
            </circle>
            <circle r="1.4" fill="currentColor">
              <animateMotion dur="4s" repeatCount="indefinite" path={`M ${REASON_NODES[0].x} ${REASON_NODES[0].y} Q 100 72 ${UNDERSTAND_NODES[0].x} ${UNDERSTAND_NODES[0].y}`} />
            </circle>

            {/* Nodes */}
            {REASON_NODES.map((n, i) => (
              <motion.circle key={`rn-${i}`} cx={n.x} cy={n.y} r="3.2" fill="currentColor" {...pulse(i * 0.4)} />
            ))}
            {UNDERSTAND_NODES.map((n, i) => (
              <motion.circle key={`un-${i}`} cx={n.x} cy={n.y} r="3.2" fill="currentColor" {...pulse(i * 0.4 + 0.8)} />
            ))}
            <motion.circle cx={CORE.x} cy={CORE.y} r="5" fill="currentColor" animate={{ scale: [1, 1.25, 1], opacity: [0.7, 1, 0.7] }} transition={{ duration: 2, repeat: Infinity }} style={{ filter: 'drop-shadow(0 0 4px hsl(12 100% 50%))' }} />
            <motion.circle cx={DECISION.x} cy={DECISION.y} r="4.2" fill="currentColor" animate={{ opacity: [0.6, 1, 0.6], r: [3.6, 4.8, 3.6] }} transition={{ duration: 2.2, repeat: Infinity }} />
            <motion.circle cx={VOICE.x} cy={VOICE.y} r="3" fill="currentColor" opacity="0.55" animate={{ opacity: [0.35, 0.7, 0.35] }} transition={{ duration: 2.8, repeat: Infinity }} />

            {/* Labels */}
            <text x="52" y="176" fontSize="6.5" textAnchor="middle" fill="currentColor" opacity="0.6">Reason</text>
            <text x="148" y="176" fontSize="6.5" textAnchor="middle" fill="currentColor" opacity="0.6">Understand</text>
            <text x="100" y="40" fontSize="6.5" textAnchor="middle" fill="currentColor" opacity="0.7">Decision</text>
          </svg>
        </motion.div>

        {/* streaming particles */}
        {[...Array(4)].map((_, i) => (
          <motion.div
            key={`p-${i}`}
            className="absolute w-1.5 h-1.5 rounded-full bg-accent pointer-events-none"
            style={{ top: '50%', marginTop: '-3px', boxShadow: '0 0 8px hsl(12 100% 50%)' }}
            animate={{ left: ['14%', '50%', '86%'], opacity: [0, 1, 0] }}
            transition={{ duration: 3.2, repeat: Infinity, delay: i * 0.7, ease: 'easeInOut' }}
          />
        ))}
      </div>

      <div className="mt-3 text-center space-y-1">
        <p className="text-[9px] sm:text-xs font-bold text-accent">HEX6 BLE · PI-US Neural Architecture v5.5</p>
        <p className="text-[9px] sm:text-xs text-secondary">
          <span className="text-foreground font-medium">Reason</span> reasons through probability ·{' '}
          <span className="text-accent font-medium">Understand</span> decides through resonance · fused in one Core
        </p>
      </div>
    </div>
  );
}