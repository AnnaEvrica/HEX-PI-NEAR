// Animated SVG: environmental signals — concentric waves emanating from a center,
// with scattered signal dots around the field. Waves pulse outward continuously.
const BLUE = '#1e6dc4';
const BLUE_SOFT = '#4a9ce8';

const CX = 200, CY = 150;

const WAVES = [20, 40, 60, 80, 100, 120, 140];

const SIGNAL_DOTS = [];
for (let i = 0; i < 18; i++) {
  const angle = (i / 18) * Math.PI * 2 + i * 0.35;
  const r = 35 + (i % 5) * 22;
  SIGNAL_DOTS.push({
    x: CX + r * Math.cos(angle),
    y: CY + r * Math.sin(angle),
    delay: (i * 0.17) % 3,
  });
}

export default function EnvironmentalSignalGraphic() {
  return (
    <svg viewBox="0 0 400 300" className="lp-emanation-graphic" role="img" aria-label="Environmental signals emanating outward">
      <defs>
        <radialGradient id="eman-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={BLUE} stopOpacity="0.12" />
          <stop offset="100%" stopColor={BLUE} stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx={CX} cy={CY} r="150" fill="url(#eman-glow)" />

      {/* emanation waves */}
      {WAVES.map((r, i) => (
        <circle
          key={i}
          cx={CX}
          cy={CY}
          r={r}
          fill="none"
          stroke={BLUE}
          strokeOpacity="0.08"
          strokeWidth="0.6"
          className="lp-emanation-wave"
          style={{ animationDelay: `${i * 0.4}s` }}
        />
      ))}

      {/* scattered signal dots */}
      {SIGNAL_DOTS.map((d, i) => (
        <circle key={`s${i}`} cx={d.x} cy={d.y} r="1.6" fill={BLUE_SOFT} className="lp-stream-dot" style={{ animationDelay: `${d.delay}s` }} />
      ))}

      {/* center */}
      <circle cx={CX} cy={CY} r="3" fill={BLUE} className="lp-pebble-core" />
      <circle cx={CX} cy={CY} r="6" fill="none" stroke={BLUE} strokeOpacity="0.3" strokeWidth="0.8" />
    </svg>
  );
}