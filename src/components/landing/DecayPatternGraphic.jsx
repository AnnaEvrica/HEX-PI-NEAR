// Full-width animated SVG: points studying patterns of decay.
// Dots scatter along an exponential decay curve — dense and bright on the left,
// thinning and dimming to the right. A scan sweeps across, studying the pattern.
const BLUE = '#1e6dc4';
const BLUE_SOFT = '#4a9ce8';

function buildDots() {
  const dots = [];
  for (let i = 0; i < 56; i++) {
    const frac = i / 55;
    const x = 30 + frac * 1140;
    const decay = Math.exp(-2.2 * frac);
    const y = 120 + Math.sin(i * 0.9) * 38 * decay + Math.cos(i * 1.7) * 22 * decay;
    const r = Math.max(0.6, 3.0 * decay + 0.4);
    dots.push({ x, y, r, delay: (i * 0.1) % 3 });
  }
  return dots;
}

const DOTS = buildDots();
const CURVE = DOTS.map((d, i) =>
  i === 0 ? `M ${d.x.toFixed(1)} ${d.y.toFixed(1)}` : `L ${d.x.toFixed(1)} ${d.y.toFixed(1)}`
).join(' ');

export default function DecayPatternGraphic() {
  return (
    <svg viewBox="0 0 1200 240" className="lp-decay-graphic" role="img" aria-label="Points studying patterns of decay">
      <defs>
        <linearGradient id="decay-curve-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={BLUE} stopOpacity="0.35" />
          <stop offset="100%" stopColor={BLUE} stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="decay-scan-grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={BLUE_SOFT} stopOpacity="0" />
          <stop offset="50%" stopColor={BLUE_SOFT} stopOpacity="0.12" />
          <stop offset="100%" stopColor={BLUE_SOFT} stopOpacity="0" />
        </linearGradient>
      </defs>

      <path d={CURVE} fill="none" stroke="url(#decay-curve-grad)" strokeWidth="1" />

      {DOTS.map((d, i) => (
        <circle
          key={i}
          cx={d.x}
          cy={d.y}
          r={d.r}
          fill={BLUE}
          className="lp-decay-dot"
          style={{ animationDelay: `${d.delay}s` }}
        />
      ))}

      <rect x="0" y="0" width="50" height="240" fill="url(#decay-scan-grad)" className="lp-decay-scan" />
    </svg>
  );
}