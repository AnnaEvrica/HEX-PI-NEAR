import { motion } from 'framer-motion';

// HEX6 BLE · PI-US v5.5 — a hexagonal brain in two parts.
// The hexagon is split by a fusion seam into two hemispheres:
//   Reason (left, structural — probability)
//   Understand (right, accent — resonance)
// They meet at the Core on the seam and fuse into one Decision (top), spoken in one Voice (bottom).

const HEX = '100,12 174,54 174,146 100,188 26,146 26,54';
const LEFT_HALF = '100,12 26,54 26,146 100,188';
const RIGHT_HALF = '100,12 174,54 174,146 100,188';

const REASON_NODES = [ { x: 60, y: 82 }, { x: 48, y: 112 }, { x: 64, y: 140 } ];
const UNDERSTAND_NODES = [ { x: 140, y: 82 }, { x: 152, y: 112 }, { x: 136, y: 140 } ];
const CORE = { x: 100, y: 100 };
const DECISION = { x: 100, y: 34 };
const VOICE = { x: 100, y: 166 };

const GRAY = 'hsl(var(--muted-foreground))';
const FG = 'hsl(var(--foreground))';

const pulse = (delay) => ({
  animate: { opacity: [0.4, 0.95, 0.4] },
  transition: { duration: 2.4, repeat: Infinity, delay, ease: 'easeInOut' },
});

export default function PILayerVisualization() {
  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <div className="relative h-[300px] sm:h-[380px]" style={{ perspective: '1100px' }}>
        {/* accent glow */}
        <motion.div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-44 h-44 sm:w-60 sm:h-60"
          style={{
            clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
            background: 'hsl(12 100% 50%)',
            filter: 'blur(32px)',
          }}
          animate={{ opacity: [0.1, 0.24, 0.1], scale: [1, 1.12, 1] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />

        <motion.div
          className="relative w-full h-full flex items-center justify-center"
          style={{ transformStyle: 'preserve-3d' }}
          animate={{ rotateY: [-7, 7, -7], rotateX: [3, -3, 3] }}
          transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut' }}
        >
          <svg viewBox="0 0 200 200" className="w-[240px] h-[240px] sm:w-[320px] sm:h-[320px]">
            {/* === Two hemispheres — the structure of the hex brain === */}
            {/* Reason hemisphere (left, structural) */}
            <motion.polygon
              points={LEFT_HALF}
              fill={GRAY}
              fillOpacity={0.1}
              stroke={FG}
              strokeWidth={1}
              strokeOpacity={0.55}
              animate={{ fillOpacity: [0.07, 0.14, 0.07] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            />
            {/* Understand hemisphere (right, resonance) */}
            <motion.polygon
              points={RIGHT_HALF}
              fill="hsl(12 100% 50%)"
              fillOpacity={0.12}
              className="text-accent"
              stroke="currentColor"
              strokeWidth={1}
              strokeOpacity={0.7}
              animate={{ fillOpacity: [0.09, 0.18, 0.09] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
            />

            {/* Hexagon braincase outline */}
            <polygon points={HEX} fill="none" className="text-accent" stroke="currentColor" strokeWidth="1.4" opacity="0.6" />

            {/* Fusion seam — where the two parts meet */}
            <line x1="100" y1="18" x2="100" y2="182" className="text-accent" stroke="currentColor" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.4" />

            {/* within-lobe neural connections */}
            {REASON_NODES.map((n, i) => REASON_NODES.slice(i + 1).map((m, j) => (
              <line key={`rl-${i}-${j}`} x1={n.x} y1={n.y} x2={m.x} y2={m.y} stroke={FG} strokeWidth="0.5" opacity="0.3" />
            )))}
            {UNDERSTAND_NODES.map((n, i) => UNDERSTAND_NODES.slice(i + 1).map((m, j) => (
              <line key={`ul-${i}-${j}`} x1={n.x} y1={n.y} x2={m.x} y2={m.y} className="text-accent" stroke="currentColor" strokeWidth="0.5" opacity="0.4" />
            )))}
            {/* each lobe → Core (the seam) */}
            {REASON_NODES.map((n, i) => (
              <line key={`rc-${i}`} x1={n.x} y1={n.y} x2={CORE.x} y2={CORE.y} stroke={FG} strokeWidth="0.5" opacity="0.35" />
            ))}
            {UNDERSTAND_NODES.map((n, i) => (
              <line key={`uc-${i}`} x1={n.x} y1={n.y} x2={CORE.x} y2={CORE.y} className="text-accent" stroke="currentColor" strokeWidth="0.5" opacity="0.45" />
            ))}
            {/* Core → Decision (fused output) and Core → Voice */}
            <line x1={CORE.x} y1={CORE.y} x2={DECISION.x} y2={DECISION.y} className="text-accent" stroke="currentColor" strokeWidth="1.1" opacity="0.55" />
            <line x1={CORE.x} y1={CORE.y} x2={VOICE.x} y2={VOICE.y} className="text-accent" stroke="currentColor" strokeWidth="0.8" opacity="0.35" />

            {/* traveling signals: lobe → core → decision */}
            <circle r="1.6" fill={FG}>
              <animateMotion dur="2.8s" repeatCount="indefinite" path={`M ${REASON_NODES[1].x} ${REASON_NODES[1].y} L ${CORE.x} ${CORE.y}`} />
            </circle>
            <circle r="1.6" className="text-accent" fill="currentColor">
              <animateMotion dur="3.2s" repeatCount="indefinite" path={`M ${UNDERSTAND_NODES[1].x} ${UNDERSTAND_NODES[1].y} L ${CORE.x} ${CORE.y}`} />
            </circle>
            <circle r="1.8" className="text-accent" fill="currentColor">
              <animateMotion dur="2.4s" repeatCount="indefinite" path={`M ${CORE.x} ${CORE.y} L ${DECISION.x} ${DECISION.y}`} />
            </circle>
            <circle r="1.4" className="text-accent" fill="currentColor">
              <animateMotion dur="4s" repeatCount="indefinite" path={`M ${VOICE.x} ${VOICE.y} L ${CORE.x} ${CORE.y}`} />
            </circle>

            {/* Nodes — Reason (structural/gray) */}
            {REASON_NODES.map((n, i) => (
              <motion.circle key={`rn-${i}`} cx={n.x} cy={n.y} r="3.4" fill={FG} {...pulse(i * 0.4)} />
            ))}
            {/* Nodes — Understand (resonance/accent) */}
            {UNDERSTAND_NODES.map((n, i) => (
              <motion.circle key={`un-${i}`} cx={n.x} cy={n.y} r="3.4" className="text-accent" fill="currentColor" {...pulse(i * 0.4 + 0.8)} />
            ))}
            {/* Core — on the seam */}
            <motion.circle cx={CORE.x} cy={CORE.y} r="5.5" className="text-accent" fill="currentColor" animate={{ scale: [1, 1.25, 1], opacity: [0.75, 1, 0.75] }} transition={{ duration: 2, repeat: Infinity }} style={{ filter: 'drop-shadow(0 0 5px hsl(12 100% 50%))' }} />
            {/* Decision — fused */}
            <motion.circle cx={DECISION.x} cy={DECISION.y} r="4.4" className="text-accent" fill="currentColor" animate={{ opacity: [0.6, 1, 0.6], r: [3.8, 5, 3.8] }} transition={{ duration: 2.2, repeat: Infinity }} />
            {/* Voice */}
            <motion.circle cx={VOICE.x} cy={VOICE.y} r="3" className="text-accent" fill="currentColor" opacity="0.55" animate={{ opacity: [0.35, 0.7, 0.35] }} transition={{ duration: 2.8, repeat: Infinity }} />

            {/* Labels — the two parts */}
            <text x="52" y="180" fontSize="7" textAnchor="middle" fill={FG} opacity="0.7" fontWeight="600">Reason</text>
            <text x="148" y="180" fontSize="7" textAnchor="middle" className="text-accent" fill="currentColor" opacity="0.85" fontWeight="600">Understand</text>
            <text x="100" y="106" fontSize="6" textAnchor="middle" className="text-accent" fill="currentColor" opacity="0.7">Core</text>
            <text x="100" y="26" fontSize="6.5" textAnchor="middle" className="text-accent" fill="currentColor" opacity="0.8">Decision</text>
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
          <span className="text-accent font-medium">Understand</span> decides through resonance · fused at the Core
        </p>
      </div>
    </div>
  );
}