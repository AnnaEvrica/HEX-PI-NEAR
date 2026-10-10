// Animated SVG: two disciplines converging — structural signals (left, precise grid)
// and contextual resonance (right, flowing wave) — meeting at a single point.
const BLUE = '#1e6dc4';
const BLUE_SOFT = '#4a9ce8';

const CX = 200, CY = 150;

// Left discipline: structured grid of dots (signals / precision)
const LEFT_DOTS = [];
for (let row = 0; row < 5; row++) {
  for (let col = 0; col < 6; col++) {
    const x = 20 + col * 24;
    const y = 90 + row * 30;
    LEFT_DOTS.push({ x, y, r: 1.6, delay: (col * 0.15 + row * 0.05) % 2 });
  }
}

// Right discipline: flowing wave dots (resonance / value)
const RIGHT_DOTS = [];
for (let i = 0; i < 30; i++) {
  const frac = i / 29;
  const x = 220 + frac * 160;
  const y = 150 + Math.sin(frac * Math.PI * 3) * 45;
  RIGHT_DOTS.push({ x, y, r: 1.6, delay: ((1 - frac) * 0.15) % 2 });
}

export default function DualDisciplineGraphic() {
  return (
    <svg viewBox="0 0 400 300" className="lp-dual-graphic" role="img" aria-label="Two disciplines converging: structural signals and contextual resonance">
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

      <circle cx={CX} cy={CY} r="4" fill={BLUE} className="lp-pebble-core" />
      <circle cx={CX} cy={CY} r="7" fill="none" stroke={BLUE} strokeOpacity="0.3" strokeWidth="0.8" />
    </svg>
  );
}