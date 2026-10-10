// Animated SVG: falsifiable predictions — a ledger of preregistered calls.
// Solid dots are confirmed, hollow dots are falsified. Accuracy improves rightward.
const BLUE = '#1e6dc4';
const BLUE_SOFT = '#4a9ce8';
const BG = '#0a0a0a';

const COLS = 6, ROWS = 5;
const PREDICTIONS = [];
for (let row = 0; row < ROWS; row++) {
  for (let col = 0; col < COLS; col++) {
    const x = 55 + col * 52;
    const y = 45 + row * 45;
    const seed = (row * 7 + col * 13) % 10;
    const confirmed = seed < 3 + col;
    PREDICTIONS.push({ x, y, confirmed, delay: (col * 0.1 + row * 0.07) % 2.5 });
  }
}

export default function FalsificationGraphic() {
  return (
    <svg viewBox="0 0 400 300" className="lp-falsify-graphic" role="img" aria-label="Falsifiable predictions: confirmed and falsified calls">
      <defs>
        <radialGradient id="falsify-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={BLUE} stopOpacity="0.08" />
          <stop offset="100%" stopColor={BLUE} stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="200" cy="150" r="140" fill="url(#falsify-glow)" />

      {/* grid lines */}
      <line x1="30" y1="150" x2="370" y2="150" stroke={BLUE} strokeOpacity="0.05" strokeWidth="0.5" />
      <line x1="200" y1="20" x2="200" y2="280" stroke={BLUE} strokeOpacity="0.05" strokeWidth="0.5" />

      {/* prediction dots */}
      {PREDICTIONS.map((d, i) =>
        d.confirmed ? (
          <circle key={i} cx={d.x} cy={d.y} r="2.2" fill={BLUE} className="lp-stream-dot" style={{ animationDelay: `${d.delay}s` }} />
        ) : (
          <circle key={i} cx={d.x} cy={d.y} r="2.2" fill={BG} stroke={BLUE_SOFT} strokeOpacity="0.5" strokeWidth="1" className="lp-stream-dot" style={{ animationDelay: `${d.delay}s` }} />
        )
      )}
    </svg>
  );
}