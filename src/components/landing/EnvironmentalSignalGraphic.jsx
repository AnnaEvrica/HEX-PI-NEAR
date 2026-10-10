// Animated SVG: environmental signals — concentric waves emanating from center.
// Blue wave fronts pulse outward; 64 orange signal dots represent signals found
// in 64-state hyperspace scattered across the field.
const BLUE = '#1e6dc4';
const BLUE_SOFT = '#4a9ce8';
const ORANGE = '#ff7a00';

const CX = 200, CY = 150;
const WAVES = [20, 40, 60, 80, 100, 120, 140];

const SIGNAL_DOTS = [];
for (let i = 0; i < 18; i++) {
  const angle = (i / 18) * Math.PI * 2 + i * 0.35;
  const r = 35 + (i % 5) * 22;
  SIGNAL_DOTS.push({ x: CX + r * Math.cos(angle), y: CY + r * Math.sin(angle), delay: (i * 0.17) % 3 });
}

// 64-state hyperspace signals found
const SIGNALS = [];
for (let i = 0; i < 64; i++) {
  const col = i % 8;
  const row = Math.floor(i / 8);
  const x = 30 + col * 48 + Math.sin(i * 1.3) * 10;
  const y = 25 + row * 36 + Math.cos(i * 1.7) * 8;
  SIGNALS.push({ x, y, delay: (i * 0.07) % 2 });
}

export default function EnvironmentalSignalGraphic() {
  return (
    <svg viewBox="0 0 400 300" className="lp-emanation-graphic" role="img" aria-label="Environmental signals with 64-state hyperspace signals">
      <defs>
        <radialGradient id="eman-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={BLUE} stopOpacity="0.12" />
          <stop offset="100%" stopColor={BLUE} stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx={CX} cy={CY} r="150" fill="url(#eman-glow)" />

      {WAVES.map((r, i) => (
        <circle key={i} cx={CX} cy={CY} r={r} fill="none" stroke={BLUE} strokeOpacity="0.08" strokeWidth="0.6" className="lp-emanation-wave" style={{ animationDelay: `${i * 0.4}s` }} />
      ))}

      {SIGNAL_DOTS.map((d, i) => (
        <circle key={`s${i}`} cx={d.x} cy={d.y} r="1.6" fill={BLUE_SOFT} className="lp-stream-dot" style={{ animationDelay: `${d.delay}s` }} />
      ))}

      {/* 64-state hyperspace signals found */}
      {SIGNALS.map((d, i) => (
        <circle key={`sig${i}`} cx={d.x} cy={d.y} r="1.4" fill={ORANGE} className="lp-signal-dot" style={{ animationDelay: `${d.delay}s` }} />
      ))}

      <circle cx={CX} cy={CY} r="3" fill={BLUE} className="lp-pebble-core" />
      <circle cx={CX} cy={CY} r="6" fill="none" stroke={BLUE} strokeOpacity="0.3" strokeWidth="0.8" />
    </svg>
  );
}