// Two-panel 2D infographic: Artificial Intelligence vs Probabilistic Intelligence
//  LEFT  (AI)  — Animated pebble-drop spiral: ripples radiate outward and
//                a return spiral draws them back inward, reinforcing endlessly.
//  RIGHT (PI)  — Harmonization: opposing signal pairs converge into alignment.
const BLUE = '#1e6dc4';
const BLUE_SOFT = '#4a9ce8';
const BG = '#0a0a0a';

function spiralPath(cx, cy, turns, rMin, rMax, points, dir) {
  const parts = [];
  for (let i = 0; i <= points; i++) {
    const frac = i / points;
    const t = frac * turns * Math.PI * 2 * dir;
    const r = rMin + frac * (rMax - rMin);
    const x = cx + r * Math.cos(t);
    const y = cy + r * Math.sin(t);
    parts.push(i === 0 ? `M ${x.toFixed(2)} ${y.toFixed(2)}` : `L ${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return parts.join(' ');
}

function PebbleDropSpiral() {
  const C = 150;
  const ripples = [18, 36, 54, 72, 90, 108, 126];
  const outSpiral = spiralPath(C, C, 3.25, 8, 134, 220, 1);
  const inSpiral = spiralPath(C, C, 3.0, 134, 10, 200, -1);

  const reinforce = [
    { frac: 0.2 }, { frac: 0.45 }, { frac: 0.7 }, { frac: 0.9 },
  ].map((p) => {
    const t = p.frac * 3.25 * Math.PI * 2;
    const r = 8 + p.frac * 126;
    return { x: C + r * Math.cos(t), y: C + r * Math.sin(t) };
  });

  return (
    <g>
      <circle cx={C} cy={C} r="140" fill="url(#drop-glow)" />
      {ripples.map((r, i) => (
        <circle
          key={r}
          cx={C}
          cy={C}
          r={r}
          fill="none"
          stroke={BLUE}
          strokeOpacity="0.07"
          strokeWidth="0.6"
          className="lp-ripple"
          style={{ animationDelay: `${i * 0.3}s` }}
        />
      ))}
      <path d={outSpiral} fill="none" stroke="url(#spiral-out)" strokeWidth="1.6" strokeLinecap="round" />
      <path d={inSpiral} fill="none" stroke="url(#spiral-in)" strokeWidth="1.2" strokeLinecap="round" strokeDasharray="2 3" opacity="0.7" className="lp-spiral-return" />
      {reinforce.map((p, i) => (
        <g key={i} className="lp-reinforce-node" style={{ animationDelay: `${i * 0.4}s` }}>
          <circle cx={p.x} cy={p.y} r="3.5" fill={BG} stroke={BLUE} strokeWidth="1" />
          <circle cx={p.x} cy={p.y} r="1.2" fill={BLUE_SOFT} />
        </g>
      ))}
      <circle cx={C} cy={C} r="4" fill={BLUE} className="lp-pebble-core" />
      <circle cx={C} cy={C} r="7" fill="none" stroke={BLUE} strokeOpacity="0.3" strokeWidth="0.8" />
    </g>
  );
}

function AlignmentDiagram() {
  const C = 150;
  const R = 115;
  const pairs = [
    { a: -90, b: 90 },
    { a: 0, b: 180 },
    { a: 45, b: 225 },
    { a: 135, b: 315 },
  ];
  const toXY = (deg, radius) => ({
    x: C + radius * Math.cos((deg * Math.PI) / 180),
    y: C + radius * Math.sin((deg * Math.PI) / 180),
  });

  return (
    <g>
      <circle cx={C} cy={C} r="130" fill="url(#align-glow)" />
      <circle cx={C} cy={C} r={R} fill="none" stroke={BLUE} strokeOpacity="0.06" strokeWidth="0.6" />
      <circle cx={C} cy={C} r={R * 0.66} fill="none" stroke={BLUE} strokeOpacity="0.05" strokeWidth="0.5" />
      <circle cx={C} cy={C} r={R * 0.33} fill="none" stroke={BLUE} strokeOpacity="0.04" strokeWidth="0.5" />

      {pairs.map((pair, i) => {
        const p1 = toXY(pair.a, R);
        const p2 = toXY(pair.b, R);
        return (
          <g key={i}>
            <line x1={p1.x} y1={p1.y} x2={C} y2={C} stroke={BLUE} strokeOpacity="0.35" strokeWidth="0.8" />
            <line x1={p2.x} y1={p2.y} x2={C} y2={C} stroke={BLUE} strokeOpacity="0.35" strokeWidth="0.8" />
            <circle cx={p1.x} cy={p1.y} r="3.5" fill={BG} stroke={BLUE} strokeWidth="1" />
            <circle cx={p1.x} cy={p1.y} r="1.3" fill={BLUE_SOFT} />
            <circle cx={p2.x} cy={p2.y} r="3.5" fill={BG} stroke={BLUE} strokeWidth="1" />
            <circle cx={p2.x} cy={p2.y} r="1.3" fill={BLUE_SOFT} />
          </g>
        );
      })}

      <line x1={C - R} y1={C} x2={C + R} y2={C} stroke={BLUE_SOFT} strokeOpacity="0.5" strokeWidth="1.2" />
      <line x1={C} y1={C - R} x2={C} y2={C + R} stroke={BLUE_SOFT} strokeOpacity="0.5" strokeWidth="1.2" />

      <circle cx={C} cy={C} r="4" fill={BLUE} />
      <circle cx={C} cy={C} r="7" fill="none" stroke={BLUE} strokeOpacity="0.4" strokeWidth="0.8" />
    </g>
  );
}

export default function EchoChamberSpiral() {
  return (
    <svg
      viewBox="0 0 620 330"
      className="lp-echo-spiral"
      role="img"
      aria-label="Two-panel comparison: Artificial Intelligence spiral on the left, Probabilistic Intelligence harmonization on the right"
    >
      <defs>
        <radialGradient id="drop-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={BLUE} stopOpacity="0.16" />
          <stop offset="70%" stopColor={BLUE} stopOpacity="0.02" />
          <stop offset="100%" stopColor={BLUE} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="align-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={BLUE} stopOpacity="0.14" />
          <stop offset="70%" stopColor={BLUE} stopOpacity="0.02" />
          <stop offset="100%" stopColor={BLUE} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="spiral-out" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={BLUE} stopOpacity="0.95" />
          <stop offset="100%" stopColor={BLUE_SOFT} stopOpacity="0.3" />
        </linearGradient>
        <linearGradient id="spiral-in" x1="100%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor={BLUE_SOFT} stopOpacity="0.6" />
          <stop offset="100%" stopColor={BLUE} stopOpacity="0.9" />
        </linearGradient>
      </defs>

      {/* divider */}
      <line x1="310" y1="20" x2="310" y2="310" stroke={BLUE} strokeOpacity="0.1" strokeWidth="0.5" strokeDasharray="3 4" />

      {/* left panel — AI spiral */}
      <g transform="translate(5 5) scale(0.97 0.97)">
        <PebbleDropSpiral />
      </g>

      {/* right panel — PI harmonization */}
      <g transform="translate(310 5)">
        <AlignmentDiagram />
      </g>

      {/* labels */}
      <text x="150" y="320" textAnchor="middle" fontSize="8" fill="#8A8A8A" fontFamily="ui-monospace, monospace" letterSpacing="0.15em">ARTIFICIAL INTELLIGENCE</text>
      <text x="465" y="320" textAnchor="middle" fontSize="8" fill="#8A8A8A" fontFamily="ui-monospace, monospace" letterSpacing="0.15em">PROBABILISTIC INTELLIGENCE</text>
    </svg>
  );
}