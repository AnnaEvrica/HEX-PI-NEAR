import { useEffect, useRef } from 'react';

// Wireframe mesh canvas animation — ported from index.html.
// Two canvases: a full-viewport "living" background and a "sheet" canvas
// that overlays the centered shell. Both render the same triangulated mesh
// with orange/khaki/black nodes that drift and react to the mouse.
export default function LandingCanvas() {
  const gutterRef = useRef(null);
  const sheetRef = useRef(null);

  useEffect(() => {
    const gutterCanvas = gutterRef.current;
    const sheetCanvas = sheetRef.current;
    if (!gutterCanvas || !sheetCanvas) return;

    const gutterCtx = gutterCanvas.getContext('2d', { alpha: true });
    const sheetCtx = sheetCanvas.getContext('2d', { alpha: true });
    const colors = { orange: '#ff3b0a', gray: '#cfcfcf', khaki: '#b8ad84', black: '#090909' };
    const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = matchMedia('(pointer: fine)');
    let reducedMotion = motionQuery.matches;
    let width = 0, height = 0, dpr = 1, shellLeft = 0, shellWidth = 0;
    let cols = 0, rows = 0, points = [], frame = 0, resizeFrame = 0;
    const mouse = { x: -9999, y: -9999, active: false };

    const rand = (n) => {
      const v = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
      return v - Math.floor(v);
    };
    const rgba = (hex, a) => {
      const n = parseInt(hex.slice(1), 16);
      return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
    };
    const pointAt = (x, y) => (x < 0 || y < 0 || x >= cols || y >= rows ? null : points[y * cols + x]);

    function createMesh() {
      const spacing = width < 701 ? 96 : 116;
      const rowHeight = spacing * .84;
      cols = Math.ceil(width / spacing) + 4;
      rows = Math.ceil(height / rowHeight) + 4;
      points = [];
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        const baseX = -spacing * 1.35 + x * spacing + (y % 2 ? spacing * .5 : 0);
        const baseY = -spacing * 1.35 + y * rowHeight;
        const colorRoll = rand(i + 31);
        points.push({
          baseX, baseY, x: baseX, y: baseY,
          phaseX: rand(i + 71) * Math.PI * 2,
          phaseY: rand(i + 113) * Math.PI * 2,
          speedX: .65 + rand(i + 151) * .8,
          speedY: .65 + rand(i + 197) * .8,
          amplitude: (width < 701 ? 10 : 16) * (.55 + rand(i + 223) * .85),
          color: colorRoll < .085 ? colors.orange : colorRoll < .235 ? colors.khaki : colors.black,
        });
      }
    }

    function sizeCanvas(canvas, ctx, w, h) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function getShellRect() {
      const shell = document.querySelector('.lp-shell');
      if (!shell) return { left: 0, width: 0 };
      const rect = shell.getBoundingClientRect();
      return { left: rect.left, width: rect.width };
    }

    function resize() {
      width = innerWidth;
      height = innerHeight;
      dpr = Math.min(devicePixelRatio || 1, 1.75);
      const { left, width: sw } = getShellRect();
      shellLeft = left;
      shellWidth = sw;
      sizeCanvas(gutterCanvas, gutterCtx, width, height);
      sizeCanvas(sheetCanvas, sheetCtx, shellWidth, height);
      createMesh();
      if (reducedMotion) draw(0, false);
    }

    function queueResize() {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(resize);
    }

    function updatePoint(p, time) {
      let tx = p.baseX + Math.sin(time * .00034 * p.speedX + p.phaseX) * p.amplitude;
      let ty = p.baseY + Math.cos(time * .00034 * p.speedY + p.phaseY) * p.amplitude;
      let influence = 0;
      if (mouse.active) {
        const dx = tx - mouse.x, dy = ty - mouse.y, dist = Math.hypot(dx, dy), radius = 320;
        if (dist < radius && dist > 0) {
          influence = 1 - dist / radius;
          const force = Math.pow(influence, 1.18) * 78, nx = dx / dist, ny = dy / dist;
          const shear = Math.sin(p.phaseX + time * .0012) * force * .16;
          tx += nx * force - ny * shear;
          ty += ny * force + nx * shear;
        }
      }
      const response = .075 + influence * .12;
      p.x += (tx - p.x) * response;
      p.y += (ty - p.y) * response;
    }

    function line(ctx, a, b, alpha, color, lineWidth) {
      if (!a || !b) return;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = rgba(color, alpha); ctx.lineWidth = lineWidth; ctx.stroke();
    }
    function triangle(ctx, a, b, c, color, alpha) {
      if (!a || !b || !c) return;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y);
      ctx.closePath(); ctx.fillStyle = rgba(color, alpha); ctx.fill();
    }
    function edgeBoost(x) {
      const d = Math.abs(x - width / 2) / (width / 2);
      return .82 + Math.pow(d, 1.55) * 1.05;
    }

    function renderMesh(ctx, time, mode) {
      const sheetMode = mode === 'sheet';
      for (let y = 0; y < rows - 1; y++) for (let x = 0; x < cols - 1; x++) {
        const a = pointAt(x, y), b = pointAt(x + 1, y), c = pointAt(x, y + 1), d = pointAt(x + 1, y + 1);
        const pulse = .5 + .5 * Math.sin(time * .00045 + x * .7 + y * .5);
        const boost = sheetMode ? 1 : edgeBoost((a.x + b.x + c.x + d.x) / 4);
        const edge = (sheetMode ? .095 : .13) * boost;
        const secondary = (sheetMode ? .04 : .06) * boost;
        const fill = (sheetMode ? .009 : .021) * (.58 + pulse * .3) * boost;
        if ((x + y) % 2 === 0) {
          triangle(ctx, a, b, c, sheetMode ? colors.black : colors.gray, fill);
          line(ctx, a, b, edge, sheetMode ? colors.black : colors.gray, .78);
          line(ctx, a, c, edge, sheetMode ? colors.black : colors.gray, .78);
          line(ctx, b, c, secondary, colors.khaki, .7);
        } else {
          triangle(ctx, b, c, d, colors.khaki, fill * .72);
          line(ctx, b, d, edge, sheetMode ? colors.black : colors.gray, .75);
          line(ctx, c, d, edge, sheetMode ? colors.black : colors.gray, .75);
          line(ctx, b, c, secondary, colors.khaki, .7);
        }
        if (a.color === colors.orange) line(ctx, a, b, (sheetMode ? .19 : .23) * (.7 + pulse * .3) * boost, colors.orange, sheetMode ? .9 : 1);
        if (c.color === colors.orange) line(ctx, c, d, (sheetMode ? .16 : .2) * (.7 + pulse * .3) * boost, colors.orange, sheetMode ? .86 : .96);
      }
      for (const p of points) {
        const orange = p.color === colors.orange, khaki = p.color === colors.khaki;
        const pulse = .5 + .5 * Math.sin(time * .0015 + p.phaseX);
        const boost = sheetMode ? 1 : edgeBoost(p.x);
        if (orange) {
          ctx.beginPath(); ctx.arc(p.x, p.y, (sheetMode ? 4.4 : 6) + (sheetMode ? 1.3 : 2.1) * pulse, 0, Math.PI * 2);
          ctx.fillStyle = rgba(colors.orange, (sheetMode ? .014 : .02) * (1 + pulse) * boost); ctx.fill();
        }
        ctx.beginPath(); ctx.arc(p.x, p.y, orange ? (sheetMode ? 1.35 : 1.9) : khaki ? (sheetMode ? 1.05 : 1.4) : .9, 0, Math.PI * 2);
        ctx.fillStyle = rgba(p.color, (orange ? (sheetMode ? .24 : .34) : khaki ? (sheetMode ? .13 : .2) : (sheetMode ? .085 : .12)) * boost); ctx.fill();
      }
    }

    function draw(time, animate = true) {
      if (animate) for (const p of points) updatePoint(p, time);
      gutterCtx.clearRect(0, 0, width, height);
      renderMesh(gutterCtx, time, 'gutter');
      sheetCtx.clearRect(0, 0, shellWidth, height);
      sheetCtx.save(); sheetCtx.translate(-shellLeft, 0);
      renderMesh(sheetCtx, time, 'sheet');
      sheetCtx.restore();
    }

    function render(time) { draw(time, true); frame = requestAnimationFrame(render); }
    function start() { cancelAnimationFrame(frame); if (reducedMotion) { draw(0, false); return; } frame = requestAnimationFrame(render); }
    function onMotionChange(e) { reducedMotion = e.matches; mouse.active = false; start(); }

    if (finePointer.matches) {
      addEventListener('pointermove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true; }, { passive: true });
      addEventListener('pointerout', (e) => { if (!e.relatedTarget) mouse.active = false; }, { passive: true });
    }
    addEventListener('resize', queueResize, { passive: true });
    document.addEventListener('visibilitychange', () => { if (document.hidden) cancelAnimationFrame(frame); else start(); });
    motionQuery.addEventListener?.('change', onMotionChange);
    resize();
    start();

    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(resizeFrame);
    };
  }, []);

  return (
    <>
      <canvas id="lp-living-bg" ref={gutterRef} aria-hidden="true" />
      <canvas id="lp-sheet-bg" ref={sheetRef} aria-hidden="true" />
    </>
  );
}