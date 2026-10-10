// Animated SVG: calibration — predictions scored against outcomes.
// A diagonal line represents perfect calibration. Dots scatter around it,
// converging tighter toward the right as the engine learns.
const BLUE = '#1e6dc4';
const BLUE_SOFT = '#4a9ce8';

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

const DOTS = buildDots();

export default function CalibrationGraphic() {
  return (
    <svg viewBox="0 0 400 300" className="lp-calib-graphic" role="img" aria-label="Calibration: predictions scored against outcomes">
      <defs>
        <radialGradient id="calib-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={BLUE} stopOpacity="0.08" />
          <stop offset="100%" stopColor={BLUE} stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="200" cy="150" r="140" fill="url(#calib-glow)" />

      {/* perfect calibration line */}
      <line x1={LINE_X1} y1={LINE_Y1} x2={LINE_X2} y2={LINE_Y2} stroke={BLUE} strokeOpacity="0.3" strokeWidth="1" strokeDasharray="3 4" />

      {/* dots */}
      {DOTS.map((d, i) => (
        <circle
          key={i}
          cx={d.x}
          cy={d.y}
          r={d.onLine ? 2.2 : 1.8}
          fill={d.onLine ? BLUE : BLUE_SOFT}
          className="lp-decay-dot"
          style={{ animationDelay: `${d.delay}s` }}
        />
      ))}
    </svg>
  );
}