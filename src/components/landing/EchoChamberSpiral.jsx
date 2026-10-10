export default function EchoChamberSpiral() {
  // Reiki-style spiral drawn from the inside out.
  // "Voice shadow points" are plotted along the spiral — the places where
  // an echo bounces back and casts a shadow instead of carrying forward.
  const CENTER = 150;
  const SPIRAL_TURNS = 3.25;
  const POINTS = 220;
  const pathParts = [];
  for (let i = 0; i <= POINTS; i++) {
    const t = (i / POINTS) * SPIRAL_TURNS * Math.PI * 2;
    const r = 8 + (t / (SPIRAL_TURNS * Math.PI * 2)) * 132;
    const x = CENTER + r * Math.cos(t);
    const y = CENTER + r * Math.sin(t);
    pathParts.push(i === 0 ? `M ${x.toFixed(2)} ${y.toFixed(2)}` : `L ${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  const spiralPath = pathParts.join(' ');

  // Voice shadow points — nodes where echoes cast back as shadow.
  const shadowPoints = [
    { t: 0.12, label: 'echo' },
    { t: 0.28, label: 'decay' },
    { t: 0.46, label: 'shadow' },
    { t: 0.64, label: 'noise' },
    { t: 0.82, label: 'signal' },
  ];
  const pointCoords = shadowPoints.map((p) => {
    const t = p.t * SPIRAL_TURNS * Math.PI * 2;
    const r = 8 + (t / (SPIRAL_TURNS * Math.PI * 2)) * 132;
    return {
      ...p,
      x: CENTER + r * Math.cos(t),
      y: CENTER + r * Math.sin(t),
    };
  });

  return (
    <svg
      viewBox="0 0 300 300"
      className="lp-echo-spiral"
      role="img"
      aria-label="Spiral diagram of an echo chamber with voice shadow points"
    >
      <defs>
        <radialGradient id="echo-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#1e6dc4" stopOpacity="0.18" />
          <stop offset="70%" stopColor="#1e6dc4" stopOpacity="0.03" />
          <stop offset="100%" stopColor="#1e6dc4" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="spiral-stroke" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1e6dc4" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#4a9ce8" stopOpacity="0.35" />
        </linearGradient>
        <filter id="shadow-blur">
          <feGaussianBlur stdDeviation="1.4" />
        </filter>
      </defs>

      {/* Faint glow behind the spiral */}
      <circle cx={CENTER} cy={CENTER} r="146" fill="url(#echo-glow)" />

      {/* Concentric echo rings */}
      {[40, 72, 104, 136].map((r) => (
        <circle
          key={r}
          cx={CENTER}
          cy={CENTER}
          r={r}
          fill="none"
          stroke="#1e6dc4"
          strokeOpacity="0.08"
          strokeWidth="0.5"
        />
      ))}

      {/* The spiral itself */}
      <path
        d={spiralPath}
        fill="none"
        stroke="url(#spiral-stroke)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {/* Shadow trace — a faint blurred echo of the spiral */}
      <path
        d={spiralPath}
        fill="none"
        stroke="#1e6dc4"
        strokeOpacity="0.25"
        strokeWidth="3"
        strokeLinecap="round"
        filter="url(#shadow-blur)"
        transform="translate(2 2)"
      />

      {/* Voice shadow points */}
      {pointCoords.map((p, idx) => (
        <g key={idx}>
          <circle
            cx={p.x}
            cy={p.y}
            r="4.5"
            fill="#0a0a0a"
            stroke="#1e6dc4"
            strokeWidth="1.2"
          />
          <circle cx={p.x} cy={p.y} r="1.6" fill="#4a9ce8" />
          <text
            x={p.x + 9}
            y={p.y + 3}
            fontSize="7"
            fill="#8A8A8A"
            fontFamily="ui-monospace, monospace"
            letterSpacing="0.1em"
          >
            {p.label}
          </text>
        </g>
      ))}

      {/* Center origin */}
      <circle cx={CENTER} cy={CENTER} r="2.5" fill="#1e6dc4" />
    </svg>
  );
}