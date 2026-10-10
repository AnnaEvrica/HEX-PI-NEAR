// Full-width animated SVG: points studying patterns of decay.
// Two layered decay curves with dots, study lines connecting samples,
// measurement ticks, and a scan sweeping across the field.
const BLUE = '#1e6dc4';
const BLUE_SOFT = '#4a9ce8';

function buildDots() {
  const dots = [];
  for (let i = 0; i < 80; i++) {
    const frac = i / 79;
    const x = 20 + frac * 1160;
    const decay = Math.exp(-2.0 * frac);
    const y = 120 + Math.sin(i * 0.8) * 36 * decay + Math.cos(i * 1.5) * 20 * decay;
    const r = Math.max(0.5, 2.8 * decay + 0.3);
    dots.push({ x, y, r, delay: (i * 0.08) % 3 });
  }
  return dots;
}

function buildSecondaryDots() {
  const dots = [];
  for (let i = 0; i < 40; i++) {
    const frac = i / 39;
    const x = 40 + frac * 1120;
    const decay = Math.exp(-1.5 * frac);
    const y = 120 + Math.sin(i * 1.3 + 1.5) * 28 * decay + Math.cos(i * 2.1 + 0.7) * 16 * decay;
    const r = Math.max(0.4, 1.6 * decay + 0.2);
    dots.push({ x, y, r, delay: (i * 0.12 + 0.5) % 3 });
  }
  return dots;
}

const DOTS = buildDots();
const DOTS_2 = buildSecondaryDots();

const CURVE = DOTS.map((d, i) =>
  i === 0 ? `M ${d.x.toFixed(1)} ${d.y.toFixed(1)}` : `L ${d.x.toFixed(1)} ${d.y.toFixed(1)}`
).join(' ');

const CURVE_2 = DOTS_2.map((d, i) =>
  i === 0 ? `M ${d.x.toFixed(1)} ${d.y.toFixed(1)}` : `L ${d.x.toFixed(1)} ${d.y.toFixed(1)}`
).join(' ');

// Study lines: connect every 4th dot to show analysis pattern
const STUDY_LINES = [];
for (let i = 0; i < DOTS.length - 4; i += 4) {
  STUDY_LINES.push({ x1: DOTS[i].x, y1: DOTS[i].y, x2: DOTS[i + 4].x, y2: DOTS[i + 4].y, delay: (i * 0.05) % 4 });
}

// Vertical measurement ticks
const TICKS = [];
for (let i = 0; i < 14; i++) {
  TICKS.push({ x: 30 + (i / 13) * 1140, delay: (i * 0.2) % 3 });
}

export default function DecayPatternGraphic() {
  return (
    <svg viewBox="0 0 1200 240" className="lp-decay-graphic" role="img" aria-label="Points studying patterns of decay">
      <defs>
        <linearGradient id="decay-curve-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={BLUE} stopOpacity="0.35" />
          <stop offset="100%" stopColor={BLUE} stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="decay-curve-2-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={BLUE_SOFT} stopOpacity="0.2" />
          <stop offset="100%" stopColor={BLUE_SOFT} stopOpacity="0.01" />
        </linearGradient>
        <linearGradient id="decay-scan-grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={BLUE_SOFT} stopOpacity="0" />
          <stop offset="50%" stopColor={BLUE_SOFT} stopOpacity="0.12" />
          <stop offset="100%" stopColor={BLUE_SOFT} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* measurement ticks */}
      {TICKS.map((t, i) => (
        <line key={`t${i}`} x1={t.x} y1="10" x2={t.x} y2="230" stroke={BLUE} strokeOpacity="0.04" strokeWidth="0.5" strokeDasharray="2 6" className="lp-measure-tick" style={{ animationDelay: `${t.delay}s` }} />
      ))}

      {/* study lines */}
      {STUDY_LINES.map((l, i) => (
        <line key={`s${i}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={BLUE} strokeOpacity="0.06" strokeWidth="0.5" className="lp-study-line" style={{ animationDelay: `${l.delay}s` }} />
      ))}

      {/* secondary decay curve */}
      <path d={CURVE_2} fill="none" stroke="url(#decay-curve-2-grad)" strokeWidth="0.8" />
      {DOTS_2.map((d, i) => (
        <circle key={`d2${i}`} cx={d.x} cy={d.y} r={d.r} fill={BLUE_SOFT} className="lp-decay-dot" style={{ animationDelay: `${d.delay}s` }} />
      ))}

      {/* primary decay curve */}
      <path d={CURVE} fill="none" stroke="url(#decay-curve-grad)" strokeWidth="1" />
      {DOTS.map((d, i) => (
        <circle key={`d${i}`} cx={d.x} cy={d.y} r={d.r} fill={BLUE} className="lp-decay-dot" style={{ animationDelay: `${d.delay}s` }} />
      ))}

      {/* scan sweep */}
      <rect x="0" y="0" width="50" height="240" fill="url(#decay-scan-grad)" className="lp-decay-scan" />
    </svg>
  );
}