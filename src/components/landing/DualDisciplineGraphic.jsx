// Animated SVG: two disciplines converging — structural signals (left) and
// contextual resonance (right). 64 orange signal dots represent signals found
// in 64-state hyperspace distributed across both streams.
const BLUE = '#1e6dc4';
const BLUE_SOFT = '#4a9ce8';
const ORANGE = '#ff7a00';

const CX = 200, CY = 150;

const LEFT_DOTS = [];
for (let row = 0; row < 5; row++) {
  for (let col = 0; col < 6; col++) {
    LEFT_DOTS.push({ x: 20 + col * 24, y: 90 + row * 30, r: 1.6, delay: (col * 0.15 + row * 0.05) % 2 });
  }
}

const RIGHT_DOTS = [];
for (let i = 0; i < 30; i++) {
  const frac = i / 29;
  const x = 220 + frac * 160;
  const y = 150 + Math.sin(frac * Math.PI * 3) * 45;
  RIGHT_DOTS.push({ x, y, r: 1.6, delay: ((1 - frac) * 0.15) % 2 });
}

// 64-state hyperspace signals found across both streams
const SIGNALS = [];
for (let i = 0; i < 64; i++) {
  if (i < 32) {
    const col = i % 8;
    const row = Math.floor(i / 8) % 4;
    const x = 25 + col * 22;
    const y = 80 + row * 35;
    SIGNALS.push({ x, y, delay: (i * 0.07) % 2 });
  } else {
    const frac = (i - 32) / 31;
    const x = 220 + frac * 160;
    const y = 150 + Math.sin(frac * Math.PI * 4) * 40;
    SIGNALS.push({ x, y, delay: (i * 0.07) % 2 });
  }
}

export default function DualDisciplineGraphic() {
  return (
    <svg viewBox="0 0 400 300" className="lp-dual-graphic" role="img" aria-label="Two disciplines converging with 64-state hyperspace signals">
      <defs>
        <radialGradient id="dual-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={BLUE} stopOpacity="0.12" />
          <stop offset="100%" stopColor={BLUE} stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx={CX} cy={CY} r="120" fill="url(#dual-glow)" />

      {LEFT_DOTS.map((d, i) => (
        <circle key={`l${i}`} cx={d.x} cy={d.y} r={d.r} fill={BLUE} className="lp-stream-dot" style={{ animationDelay: `${d.delay}s` }} />
      ))}

      {RIGHT_DOTS.map((d, i) => (
        <circle key={`r${i}`} cx={d.x} cy={d.y} r={d.r} fill={BLUE} className="lp-stream-dot" style={{ animationDelay: `${d.delay}s` }} />
      ))}

      {/* 64-state hyperspace signals found */}
      {SIGNALS.map((d, i) => (
        <circle key={`sig${i}`} cx={d.x} cy={d.y} r="1.4" fill={ORANGE} className="lp-signal-dot" style={{ animationDelay: `${d.delay}s` }} />
      ))}

      <circle cx={CX} cy={CY} r="4" fill={BLUE} className="lp-pebble-core" />
      <circle cx={CX} cy={CY} r="7" fill="none" stroke={BLUE} strokeOpacity="0.3" strokeWidth="0.8" />
    </svg>
  );
}