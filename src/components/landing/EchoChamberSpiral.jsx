// Two-panel 2D infographic:
//  LEFT  — "Pebble drop": concentric ripples radiate from center, then a
//          return spiral draws them back inward so signals reinforce.
//  RIGHT — "Alignment": signals enter from opposite points and converge
//          into a shared axis of harmony.
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
  // Outward ripples (pebble drop)
  const ripples = [18, 36, 54, 72, 90, 108, 126];
  // Outward spiral
  const outSpiral = spiralPath(C, C, 3.25, 8, 134, 220, 1);
  // Inward return spiral (signals feeding back into center)
  const inSpiral = spiralPath(C, C, 3.0, 134, 10, 200, -1);

  // Reinforcement points — where outward and inward spirals cross
  const reinforce = [
    { frac: 0.2 }, { frac: 0.45 }, { frac: 0.7 }, { frac: 0.9 },
  ].map((p) => {
    const t = p.frac * 3.25 * Math.PI * 2;
    const r = 8 + p.frac * 126;
    return { x: C + r * Math.cos(t), y: C + r * Math.sin(t) };
  });

  return (
    <g>
      {/* glow */}
      <circle cx={C} cy={C} r="140" fill="url(#drop-glow)" />
      {/* ripples */}
      {ripples.map((r) => (
        <circle key={r} cx={C} cy={C} r={r} fill="none" stroke={BLUE} strokeOpacity="0.07" strokeWidth="0.6" />
      ))}
      {/* outward spiral (signal radiating) */}
      <path d={outSpiral} fill="none" stroke="url(#spiral-out)" strokeWidth="1.6" strokeLinecap="round" />
      {/* inward return spiral (signal returning, reinforcing) */}
      <path d={inSpiral} fill="none" stroke="url(#spiral-in)" strokeWidth="1.2" strokeLinecap="round" strokeDasharray="2 3" opacity="0.7" />
      {/* reinforcement points */}
      {reinforce.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3.5" fill={BG} stroke={BLUE} strokeWidth="1" />
          <circle cx={p.x} cy={p.y} r="1.2" fill={BLUE_SOFT} />
        </g>
      ))}
      {/* center — the dropped pebble */}
      <circle cx={C} cy={C} r="4" fill={BLUE} />
      <circle cx={C} cy={C} r="7" fill="none" stroke={BLUE} strokeOpacity="0.3" strokeWidth="0.8" />
    </g>
  );
}

function AlignmentDiagram() {
  const C = 150;
  const R = 115;
  // Four pairs of opposing signal points that converge to center harmony
  const pairs = [
    { a: -90, b: 90 },   // vertical
    { a: 0, b: 180 },   // horizontal
    { a: 45, b: 225 },   // diagonal 1
    { a: 135, b: 315 },  // diagonal 2
  ];
  const toXY = (deg, radius) => ({
    x: C + radius * Math.cos((deg * Math.PI) / 180),
    y: C + radius * Math.sin((deg * Math.PI) / 180),
  });

  return (
    <g>
      {/* glow */}
      <circle cx={C} cy={C} r="130" fill="url(#align-glow)" />
      {/* outer reading field */}
      <circle cx={C} cy={C} r={R} fill="none" stroke={BLUE} strokeOpacity="0.06" strokeWidth="0.6" />
      <circle cx={C} cy={C} r={R * 0.66} fill="none" stroke={BLUE} strokeOpacity="0.05" strokeWidth="0.5" />
      <circle cx={C} cy={C} r={R * 0.33} fill="none" stroke={BLUE} strokeOpacity="0.04" strokeWidth="0.5" />

      {/* opposing signal pairs — lines converging from opposite points */}
      {pairs.map((pair, i) => {
        const p1 = toXY(pair.a, R);
        const p2 = toXY(pair.b, R);
        return (
          <g key={i}>
            <line x1={p1.x} y1={p1.y} x2={C} y2={C} stroke={BLUE} strokeOpacity="0.35" strokeWidth="0.8" />
            <line x1={p2.x} y1={p2.y} x2={C} y2={C} stroke={BLUE} strokeOpacity="0.35" strokeWidth="0.8" />
            {/* signal nodes popping up from opposite points */}
            <circle cx={p1.x} cy={p1.y} r="3.5" fill={BG} stroke={BLUE} strokeWidth="1" />
            <circle cx={p1.x} cy={p1.y} r="1.3" fill={BLUE_SOFT} />
            <circle cx={p2.x} cy={p2.y} r="3.5" fill={BG} stroke={BLUE} strokeWidth="1" />
            <circle cx={p2.x} cy={p2.y} r="1.3" fill={BLUE_SOFT} />
          </g>
        );
      })}

      {/* harmony axis — the alignment they converge to */}
      <line x1={C - R} y1={C} x2={C + R} y2={C} stroke={BLUE_SOFT} strokeOpacity="0.5" strokeWidth="1.2" />
      <line x1={C} y1={C - R} x2={C} y2={C + R} stroke={BLUE_SOFT} strokeOpacity="0.5" strokeWidth="1.2" />

      {/* center harmony point */}
      <circle cx={C} cy={C} r="4" fill={BLUE} />
      <circle cx={C} cy={C} r="7" fill="none" stroke={BLUE} strokeOpacity="0.4" strokeWidth="0.8" />
    </g>
  );
}

export default function EchoChamberSpiral() {
  return (
    <svg
      viewBox="0 0 620 300"
      className="lp-echo-spiral"
      role="img"
      aria-label="Two-panel infographic: pebble-drop spiral on the left, signal alignment on the right"
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
      <line x1="310" y1="20" x2="310" y2="280" stroke={BLUE} strokeOpacity="0.08" strokeWidth="0.5" />

      {/* left panel — pebble drop spiral */}
      <g transform="translate(5 0) scale(0.97 0.97) translate(0 0)">
        <PebbleDropSpiral />
      </g>

      {/* right panel — alignment */}
      <g transform="translate(310 0)">
        <AlignmentDiagram />
      </g>
    </svg>
  );
}