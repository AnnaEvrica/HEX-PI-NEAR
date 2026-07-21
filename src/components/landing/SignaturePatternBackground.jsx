import { motion } from 'framer-motion';
import { useMemo } from 'react';

const ACCENT = '#FF6B35';

function Panel({ children }) {
  return <div className="relative overflow-hidden h-full w-full">{children}</div>;
}

// Recursive fractal branches — used for tree, neuron, capillaries, river delta
function genBranches(x, y, angle, len, depth, segs, spread, shrink) {
  if (depth <= 0 || len < 3) return segs;
  const x2 = x + Math.cos(angle) * len;
  const y2 = y + Math.sin(angle) * len;
  segs.push({ x1: x, y1: y, x2, y2, w: Math.max(0.5, depth * 0.7) });
  genBranches(x2, y2, angle - spread, len * shrink, depth - 1, segs, spread, shrink);
  genBranches(x2, y2, angle + spread, len * shrink, depth - 1, segs, spread, shrink);
  return segs;
}

function Branches({ from = 'bottom', color = ACCENT, depth = 5, len = 40, spread = 0.5, count = 3, shrink = 0.72 }) {
  const segs = useMemo(() => {
    const all = [];
    const W = 100, H = 140;
    const origins = [];
    if (from === 'bottom') {
      for (let i = 0; i < count; i++) origins.push({ x: W / 2, y: H - 4, a: -Math.PI / 2 + (i - (count - 1) / 2) * 0.3 });
    } else if (from === 'top') {
      for (let i = 0; i < count; i++) origins.push({ x: W / 2, y: 4, a: Math.PI / 2 + (i - (count - 1) / 2) * 0.3 });
    } else {
      for (let i = 0; i < count; i++) origins.push({ x: W / 2, y: H / 2, a: (i / count) * Math.PI * 2 });
    }
    for (const o of origins) genBranches(o.x, o.y, o.a, len, depth, all, spread, shrink);
    return all;
  }, [from, depth, len, spread, count, shrink]);
  return (
    <svg viewBox="0 0 100 140" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice">
      {segs.map((s, i) => (
        <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={color} strokeWidth={s.w} strokeLinecap="round" opacity="0.85" />
      ))}
    </svg>
  );
}

// --- Vibration row ---
function Ripples() {
  return (
    <svg viewBox="0 0 100 140" className="absolute inset-0 w-full h-full">
      {[0, 1, 2, 3].map((i) => (
        <motion.circle key={i} cx="50" cy="70" fill="none" stroke={ACCENT} strokeWidth="1.2"
          initial={{ r: 4, opacity: 0.6 }}
          animate={{ r: [4, 58], opacity: [0.6, 0] }}
          transition={{ duration: 3, repeat: Infinity, delay: i * 0.75, ease: 'easeOut' }} />
      ))}
    </svg>
  );
}

function Liquid() {
  return (
    <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 42% 38%, #1a2a3a, #05070a)' }}>
      <motion.div className="absolute inset-0"
        style={{ background: 'conic-gradient(from 0deg, rgba(255,107,53,0.14), rgba(80,140,200,0.14), rgba(255,107,53,0.14))' }}
        animate={{ rotate: 360 }} transition={{ duration: 26, repeat: Infinity, ease: 'linear' }} />
      {Array.from({ length: 12 }).map((_, i) => (
        <motion.span key={i} className="absolute rounded-full bg-white"
          style={{ width: 2, height: 2, left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%` }}
          animate={{ opacity: [0.1, 0.9, 0.1] }} transition={{ duration: 2 + (i % 3), repeat: Infinity, delay: i * 0.2 }} />
      ))}
    </div>
  );
}

function Dunes() {
  const base = [70, 92, 114];
  return (
    <svg viewBox="0 0 100 140" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
      {['#3a1d0a', '#5a2d10', '#7a3d14'].map((c, i) => (
        <motion.path key={i} d={`M0 ${base[i]} Q 25 ${base[i] - 20} 50 ${base[i]} T 100 ${base[i]} L100 140 L0 140 Z`} fill={c}
          animate={{ d: [
            `M0 ${base[i]} Q 25 ${base[i] - 20} 50 ${base[i]} T 100 ${base[i]} L100 140 L0 140 Z`,
            `M0 ${base[i]} Q 25 ${base[i] + 20} 50 ${base[i]} T 100 ${base[i]} L100 140 L0 140 Z`,
            `M0 ${base[i]} Q 25 ${base[i] - 20} 50 ${base[i]} T 100 ${base[i]} L100 140 L0 140 Z`,
          ] }}
          transition={{ duration: 8 + i * 2, repeat: Infinity, ease: 'easeInOut' }} />
      ))}
    </svg>
  );
}

function Coral() {
  return (
    <svg viewBox="0 0 100 140" className="absolute inset-0 w-full h-full">
      <g stroke="#b34a2a" strokeWidth="2" fill="none" opacity="0.8">
        {Array.from({ length: 6 }).map((_, r) => (
          <path key={r} d={`M0 ${20 + r * 18} q 10 -10 20 0 t 20 0 t 20 0 t 20 0 t 20 0`} />
        ))}
      </g>
    </svg>
  );
}

function Brain() {
  return (
    <svg viewBox="0 0 100 140" className="absolute inset-0 w-full h-full">
      {Array.from({ length: 7 }).map((_, r) => (
        <path key={r}
          d={`M0 ${18 + r * 16} C 20 ${8 + r * 16}, 30 ${28 + r * 16}, 50 ${18 + r * 16} S 80 ${8 + r * 16}, 100 ${18 + r * 16}`}
          stroke="#c98a7a" strokeWidth="2" fill="none" opacity="0.7" />
      ))}
    </svg>
  );
}

// --- Discharge row ---
function Lightning() {
  return (
    <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,#0a1230,#02050f)' }}>
      <motion.svg viewBox="0 0 100 140" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid meet"
        animate={{ opacity: [0.4, 1, 0.5, 1, 0.4] }} transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}>
        <path d="M58 4 L42 60 L56 60 L40 136" stroke="#ffffff" strokeWidth="2.2" fill="none" strokeLinejoin="round"
          style={{ filter: 'drop-shadow(0 0 6px #fff)' }} />
      </motion.svg>
    </div>
  );
}

function Tree() {
  return (
    <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,#1a3a6a,#0a1a3a)' }}>
      <Branches from="bottom" color="#05070a" depth={5} len={42} count={2} spread={0.5} />
    </div>
  );
}

function Neuron() {
  return (
    <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 50%, #1a0f08, #050302)' }}>
      <Branches from="radial" color={ACCENT} depth={4} len={30} count={6} spread={0.55} />
      <div className="absolute left-1/2 top-1/2 w-3 h-3 -ml-1.5 -mt-1.5 rounded-full"
        style={{ background: ACCENT, boxShadow: `0 0 12px ${ACCENT}` }} />
    </div>
  );
}

function Capillaries() {
  return (
    <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg,#1a0a02,#050201)' }}>
      <Branches from="radial" color="#d2691e" depth={5} len={32} count={5} spread={0.5} />
    </div>
  );
}

function RiverDelta() {
  return (
    <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,#0a0a0a,#050505)' }}>
      <Branches from="top" color="#9a8466" depth={5} len={30} count={2} spread={0.5} />
    </div>
  );
}

function LabelBar({ children }) {
  return (
    <div className="bg-black text-white text-center uppercase tracking-[0.3em] py-2 text-[10px] sm:text-xs font-medium z-10">
      {children}
    </div>
  );
}

export default function SignaturePatternBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 flex flex-col">
        <div className="grid grid-cols-5 flex-1 min-h-0">
          <Panel><Ripples /></Panel>
          <Panel><Liquid /></Panel>
          <Panel><Dunes /></Panel>
          <Panel><Coral /></Panel>
          <Panel><Brain /></Panel>
        </div>
        <LabelBar>Signature Pattern of Discharge</LabelBar>
        <div className="grid grid-cols-5 flex-1 min-h-0">
          <Panel><Lightning /></Panel>
          <Panel><Tree /></Panel>
          <Panel><Neuron /></Panel>
          <Panel><Capillaries /></Panel>
          <Panel><RiverDelta /></Panel>
        </div>
      </div>
      {/* scrim + grid for foreground readability */}
      <div className="absolute inset-0 bg-black/55" />
      <div className="absolute inset-0" style={{ backgroundImage: 'var(--calc-grid)', opacity: 0.4 }} />
    </div>
  );
}