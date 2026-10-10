// Animated SVG: calibration — predictions scored against outcomes.
// Blue dots scatter around a diagonal calibration line; 64 orange signal dots
// represent signals found in 64-state hyperspace converging toward the line.
const BLUE = '#1e6dc4';
const BLUE_SOFT = '#4a9ce8';
const ORANGE = '#ff7a00';

const LINE_X1 = 50, LINE_Y1 = 250, LINE_X2 = 350, LINE_Y2 = 50;

function buildDots() {
  const dots = [];
  for (let i = 0; i < 28; i++) {
    const frac = i / 27;
    const x = LINE_X1 + frac * (LINE_X2 - LINE_X1);
    const lineY = LINE_Y1 + frac * (LINE_Y2 - LINE_Y1);
    const error = (Math.sin(i * 2.3) * 28 + Math.cos(i * 1.7) * 18) * (1 - frac * 0.65);
    const y = lineY + error;
    const onLine = Math.abs(error) < 7;
    dots.push({ x, y, onLine, delay: (i * 0.11) % 3 });
  }
  return dots;
}

// 64-state hyperspace signals found near the calibration line
const SIGNALS = [];
for (let i = 0; i < 64; i++) {
  const frac = i / 63;
  const x = 40 + frac * 320;
  const lineY = 260 - frac * 220;
  const error = (Math.sin(i * 1.9) * 14 + Math.cos(i * 1.3) * 9) * (1 - frac * 0.7);
  const y = lineY + error;
  SIGNALS.push({ x, y, delay: (i * 0.08) % 2 });
}

const DOTS = buildDots();

export default function CalibrationGraphic() {
  return (
    <svg viewBox="0 0 400 300" className="lp-calib-graphic" role="img" aria-label="Calibration with 64-state hyperspace signals">
      <defs>
        <radialGradient id="calib-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={BLUE} stopOpacity="0.08" />
          <stop offset="100%" stopColor={BLUE} stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="200" cy="150" r="140" fill="url(#calib-glow)" />

      <line x1={LINE_X1} y1={LINE_Y1} x2={LINE_X2} y2={LINE_Y2} stroke={BLUE} strokeOpacity="0.3" strokeWidth="1" strokeDasharray="3 4" />

      {DOTS.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={d.onLine ? 2.2 : 1.8} fill={d.onLine ? BLUE : BLUE_SOFT} className="lp-decay-dot" style={{ animationDelay: `${d.delay}s` }} />
      ))}

      {/* 64-state hyperspace signals found */}
      {SIGNALS.map((d, i) => (
        <circle key={`sig${i}`} cx={d.x} cy={d.y} r="1.6" fill={ORANGE} className="lp-signal-dot" style={{ animationDelay: `${d.delay}s` }} />
      ))}
    </svg>
  );
}