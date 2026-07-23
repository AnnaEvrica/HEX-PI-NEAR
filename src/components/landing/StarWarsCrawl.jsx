// Static "crawl" — the Star Wars look (perspective receding plane, bold) but
// with NO motion. The heading tapers from a wider line to narrower lines,
// forming a legible wedge shape. Replaces the previously animated crawl.
export default function StarWarsCrawl() {
  const lines = [
    { t: 'The Model is an experimental Probabilistic Intelligence [PI] framework proposing a systems methodology for machine learning.', s: '1.05rem' },
    { t: 'It integrates probabilistic inference, semantic analysis, and transformer-based language models within a unified architecture for computational reasoning under uncertainty.', s: '0.82rem' },
    { t: 'It unifies probabilistic inference, semantic analysis, and transformer-based language models within a layered computational architecture.', s: '0.66rem' },
    { t: '© Evrica Technologies Inc. 2026.', s: '0.56rem' },
  ];

  return (
    <div
      className="relative w-full overflow-hidden rounded-md border border-border/60"
      style={{
        perspective: '360px',
        height: '13rem',
        background: 'linear-gradient(180deg,#05080f 0%,#0a1020 55%,#02040a 100%)',
      }}
    >
      {/* static receding plane — no animation */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6"
        style={{ transform: 'rotateX(26deg)', transformOrigin: '50% 100%' }}
      >
        {lines.map((l, i) => (
          <p
            key={i}
            className="text-center font-bold leading-snug text-[#FFE81F]"
            style={{ fontSize: l.s, textShadow: '0 0 8px rgba(255,232,31,0.3)', maxWidth: '46ch' }}
          >
            {l.t}
          </p>
        ))}
      </div>

      {/* distance fades — keep the vanishing-point feel */}
      <div
        className="absolute inset-x-0 top-0 h-1/3 pointer-events-none"
        style={{ background: 'linear-gradient(180deg,#05080f,transparent)' }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-1/4 pointer-events-none"
        style={{ background: 'linear-gradient(0deg,#02040a,transparent)' }}
      />
    </div>
  );
}