import { useEffect, useRef } from 'react';

// React's `muted` prop is not reliably applied to <video>, and without muted
// browsers block autoplay — so the clip appears not to load. We force muted
// and call play() imperatively via a ref to guarantee autoplay.
// The video is rendered in black & white (grayscale filter), with a matrix-style
// stream of orange probability digits cascading across it.
export default function BrainVideo() {
  const ref = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    const tryPlay = () => { v.play().catch(() => {}); };
    tryPlay();
    v.addEventListener('loadeddata', tryPlay, { once: true });
    return () => v.removeEventListener('loadeddata', tryPlay);
  }, []);

  // Matrix rain of orange digits over the brain — "probability" in motion.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf;
    let cols = 0;
    let drops = [];
    const FONT_SIZE = 14;
    const CHARS = '0123456789.';

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = 1;
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.max(1, Math.floor(rect.width / FONT_SIZE));
      drops = Array.from({ length: cols }, () => Math.random() * -rect.height);
    };
    resize();

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      // Translucent fade trail
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fillRect(0, 0, rect.width, rect.height);
      ctx.font = `${FONT_SIZE}px ui-monospace, Menlo, Consolas, monospace`;
      for (let i = 0; i < cols; i++) {
        const ch = CHARS[(Math.random() * CHARS.length) | 0];
        const x = i * FONT_SIZE;
        const y = drops[i];
        // Leading glyph brighter (accent orange)
        ctx.fillStyle = 'rgba(255,140,0,0.95)';
        ctx.fillText(ch, x, y);
        // Trailing glyph dimmer
        ctx.fillStyle = 'rgba(255,106,0,0.45)';
        ctx.fillText(ch, x, y - FONT_SIZE);
        if (y > rect.height && Math.random() > 0.975) drops[i] = 0;
        else drops[i] += FONT_SIZE * 0.85;
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    let rafResize = null;
    const ro = new ResizeObserver(() => {
      if (rafResize) cancelAnimationFrame(rafResize);
      rafResize = requestAnimationFrame(resize);
    });
    ro.observe(canvas);
    return () => { cancelAnimationFrame(raf); if (rafResize) cancelAnimationFrame(rafResize); ro.disconnect(); };
  }, []);

  return (
    <div className="relative w-full overflow-hidden rounded-lg bg-black shadow-[0_0_40px_rgba(255,255,255,0.12),0_14px_40px_rgba(0,0,0,0.5)] ring-1 ring-white/20">
      <video
        ref={ref}
        src="https://media.base44.com/videos/public/69eef3d514386627566a9bf6/570ff9804_Brain_Hero_Video.mp4"
        autoPlay loop muted playsInline preload="auto"
        className="block w-full h-full object-cover grayscale contrast-125"
      />
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="absolute inset-0 w-full h-full mix-blend-screen pointer-events-none will-change-transform"
      />
    </div>
  );
}