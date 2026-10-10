// Animated SVG: a feedback loop — evidence weighed, adapted, calibrated.
// Blue particles orbit the loop; 64 orange signal dots represent signals found
// in 64-state hyperspace distributed around the field.
const BLUE = '#1e6dc4';
const BLUE_SOFT = '#4a9ce8';
const ORANGE = '#ff7a00';
const BG = '#0a0a0a';

const CX = 200, CY = 150, R = 80;

const NODES = [{ angle: -90 }, { angle: 30 }, { angle: 150 }];
const PARTICLES = Array.from({ length: 6 }, (_, i) => ({ delay: (i * 4) / 6 }));

// 64-state hyperspace signals found around the loop
const SIGNALS = [];
for (let i = 0; i < 64; i++) {
  const angle = (i / 64) * Math.PI * 2;
  const r = 95 + Math.sin(i * 2.1) * 18;
  SIGNALS.push({ x: CX + r * Math.cos(angle), y: CY + r * Math.sin(angle), delay: (i * 0.06) % 2 });
}

export default function NovelFrameworkGraphic() {
  return (
    <svg viewBox="0 0 400 300" className="lp-framework-graphic" role="img" aria-label="Feedback loop with 64-state hyperspace signals">
      <defs>
        <radialGradient id="loop-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={BLUE} stopOpacity="0.10" />
          <stop offset="100%" stopColor={BLUE} stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx={CX} cy={CY} r="110" fill="url(#loop-glow)" />
      <circle cx={CX} cy={CY} r={R} fill="none" stroke={BLUE} strokeOpacity="0.15" strokeWidth="1" />
      <circle cx={CX} cy={CY} r={R * 0.5} fill="none" stroke={BLUE} strokeOpacity="0.08" strokeWidth="0.6" />

      {NODES.map((n, i) => {
        const rad = (n.angle * Math.PI) / 180;
        const x = CX + R * Math.cos(rad);
        const y = CY + R * Math.sin(rad);
        return (
          <g key={i}>
            <circle cx={x} cy={y} r="5" fill={BG} stroke={BLUE} strokeWidth="1.2" />
            <circle cx={x} cy={y} r="1.8" fill={BLUE_SOFT} />
          </g>
        );
      })}

      {PARTICLES.map((p, i) => (
        <g key={i} className="lp-loop-particle" style={{ animationDelay: `${p.delay}s` }}>
          <circle cx={CX + R} cy={CY} r="1.8" fill={BLUE_SOFT} />
        </g>
      ))}

      {/* 64-state hyperspace signals found */}
      {SIGNALS.map((d, i) => (
        <circle key={`sig${i}`} cx={d.x} cy={d.y} r="1.3" fill={ORANGE} className="lp-signal-dot" style={{ animationDelay: `${d.delay}s` }} />
      ))}

      <circle cx={CX} cy={CY} r="3" fill={BLUE} />
    </svg>
  );
}