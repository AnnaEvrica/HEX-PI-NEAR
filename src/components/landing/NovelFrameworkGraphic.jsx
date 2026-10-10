// Animated SVG: a feedback loop — evidence weighed, adapted, calibrated.
// Particles orbit the loop continuously, representing the cycle of learning.
const BLUE = '#1e6dc4';
const BLUE_SOFT = '#4a9ce8';
const BG = '#0a0a0a';

const CX = 200, CY = 150, R = 80;

const NODES = [
  { angle: -90 },
  { angle: 30 },
  { angle: 150 },
];

const PARTICLES = Array.from({ length: 6 }, (_, i) => ({ delay: (i * 4) / 6 }));

export default function NovelFrameworkGraphic() {
  return (
    <svg viewBox="0 0 400 300" className="lp-framework-graphic" role="img" aria-label="Feedback loop: evidence weighed and calibrated">
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

      <circle cx={CX} cy={CY} r="3" fill={BLUE} />
    </svg>
  );
}