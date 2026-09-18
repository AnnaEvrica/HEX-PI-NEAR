import { useEffect, useRef, useState } from 'react';
import RavenArt from './RavenArt';

const STEPS = [
  { eyebrow: '01 / Prediction', h2: <>Signal decays.<br /><em>The raven listens.</em></>, p: 'Every signal fades. HEX6-BLE inverts the model — finding and enhancing patterns through semantic weighting where others validate. The decay is where the signal lives.' },
  { eyebrow: '02 / Confidence', h2: <>How sure is <em>&ldquo;sure&rdquo;?</em></>, p: 'The engine makes confidence explicit, so persuasive language can no longer masquerade as certainty.' },
  { eyebrow: '03 / Outcomes', h2: <>One forecast becomes <em>many futures.</em></>, p: 'Possible outcomes receive probabilities. A single answer becomes a decision landscape.' },
  { eyebrow: '04 / Risk', h2: <>A good forecast can be a <em>bad move.</em></>, p: 'Probability meets downside, constraints, and consequence. Being likely is not the same as being worth it.' },
  { eyebrow: '05 / Decision', h2: <>Act. Wait.<br /><em>Walk away.</em></>, p: 'HEX6-BLE converts the signal into a bounded action: what to do, when to do it, and how much to risk.' },
  { eyebrow: '06 / Feedback', h2: <>The decay <em>calibrates.</em></>, p: 'The engine compares its enhanced patterns against what actually happened. Every decayed signal sharpens the next one.' },
  { eyebrow: '07 / PI', h2: <>This is<br /><em>Probabilistic<br />Intelligence.</em></>, p: 'Not another model competing to sound smarter. A decision layer built to know what it knows — and what it does not.' },
  { eyebrow: '08 / Resolution', h2: <span className="lp-resolution-statement"><span className="lp-resolution-lead">One decision ends.</span><span className="lp-resolution-follow"><span className="lp-stamp-word">The</span> <span className="lp-stamp-word">next</span> <span className="lp-stamp-word">one</span> <span className="lp-stamp-word">starts</span> <span className="lp-stamp-word">better</span> <span className="lp-stamp-word">informed.</span></span></span> },
];

const SCORES = [
  ['?', 'unresolved'], ['42%', 'confidence'], ['63%', 'leading path'], ['71%', 'risk adjusted'],
  ['ACT', 'decision'], ['✓', 'observed'], ['PI', 'calibrated'], ['PI', 'resolved'],
];
const FACET_OFFSETS = [[-24, -22, -8], [18, -24, 7], [-18, 18, -5], [25, -4, 8], [16, 18, 5]];

export default function StoryEngine() {
  const wrapRef = useRef(null);
  const engineRef = useRef(null);
  const outcomesRef = useRef(null);
  const decisionRef = useRef(null);
  const scoreRef = useRef(null);
  const logoMarkRef = useRef(null);
  const resolutionRavenRef = useRef(null);
  const resolutionLeadRef = useRef(null);
  const stampWordsRef = useRef(null);
  const logoPiecesRef = useRef([]);
  const matrixRef = useRef(null);
  const [activeStep, setActiveStep] = useState(0);

  // Generate matrix rain columns
  useEffect(() => {
    const matrix = matrixRef.current;
    if (!matrix) return;
    const chars = '01ABCDEF∆∑πPXRISKHEXBLE6//';
    const cols = [];
    for (let i = 0; i < 16; i++) {
      let text = '';
      for (let j = 0; j < 56; j++) {
        let line = '';
        for (let k = 0; k < 4; k++) line += chars[Math.floor(Math.random() * chars.length)];
        text += line + '\n';
      }
      cols.push({ text, left: i * 6.6 + Math.random() * 2, dur: 16 + Math.random() * 18, delay: -Math.random() * 20 });
    }
    matrix.innerHTML = cols.map(c =>
      `<div class="lp-matrix-col" style="left:${c.left}%;animation-duration:${c.dur}s;animation-delay:${c.delay}s">${c.text}</div>`
    ).join('');
  }, []);

  // Scroll-driven animation
  useEffect(() => {
    const wrap = wrapRef.current;
    const engine = engineRef.current;
    const outcomes = outcomesRef.current;
    const decision = decisionRef.current;
    const score = scoreRef.current;
    const logoMark = logoMarkRef.current;
    const resolutionRaven = resolutionRavenRef.current;
    const resolutionLead = resolutionLeadRef.current;
    const stampWords = stampWordsRef.current?.querySelectorAll('.lp-stamp-word') || [];
    const logoPieces = logoPiecesRef.current;
    if (!wrap || !engine) return;

    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const clamp01 = v => Math.max(0, Math.min(1, v));
    const smooth = v => v * v * (3 - 2 * v);

    function updateAssembly(p, release) {
      const staticMode = reduced.matches, settled = staticMode || p >= .82;
      if (logoMark) logoMark.classList.toggle('unresolved', !settled);
      logoPieces.forEach((piece, i) => {
        if (!piece) return;
        const start = i * .105;
        const raw = staticMode ? 1 : Math.max(0, Math.min(1, (p - start) / .24));
        const attached = 1 - Math.pow(1 - raw, 3);
        const [x, y, rotation] = FACET_OFFSETS[i];
        const remaining = 1 - attached;
        piece.style.opacity = String((.025 + attached * .975) * (1 - release));
        piece.style.transform = `translate(${x * (remaining + release * 1.45)}px, ${y * (remaining + release * 1.45)}px) rotate(${rotation * (remaining + release * 1.2)}deg) scale(${.9 + attached * .1 - release * .08})`;
        const shadowY = 15 - attached * 9 + release * 5;
        const shadowBlur = 13 - attached * 5 + release * 6;
        const shadowAlpha = (.14 - attached * .06) * (1 - release);
        piece.style.filter = `drop-shadow(0 ${shadowY}px ${shadowBlur}px rgba(0,0,0,${shadowAlpha}))`;
      });
    }

    function updateResolution(progress, active) {
      const isReduced = reduced.matches;
      const t = isReduced && active ? 1 : progress;
      const lift = smooth(clamp01(t / .22));
      const lead = smooth(clamp01((t - .08) / .18));
      const travel = innerWidth < 701 ? 0 : -24;
      if (resolutionRavenRef.current) {
        resolutionRavenRef.current.style.transform = active ? `translateY(${travel * lift}vh)` : '';
      }
      if (resolutionLead) {
        resolutionLead.style.opacity = String(lead);
        resolutionLead.style.transform = `translateY(${(1 - lead) * 22}px) rotate(${(1 - lead) * -2.4}deg) scale(${1 + (1 - lead) * .65})`;
        resolutionLead.style.filter = `blur(${(1 - lead) * 4}px)`;
      }
      stampWords.forEach((word, i) => {
        const hit = smooth(clamp01((t - (.3 + i * .085)) / .12));
        const direction = i % 2 === 0 ? -1 : 1;
        word.style.opacity = String(hit);
        word.style.transform = `translateY(${(1 - hit) * (16 + i % 3 * 5)}px) rotate(${direction * (1 - hit) * (3 + i * .35)}deg) scale(${1 + (1 - hit) * .82})`;
        word.style.filter = `blur(${(1 - hit) * 3.5}px)`;
      });
    }

    function update() {
      const r = wrap.getBoundingClientRect();
      const max = wrap.offsetHeight - innerHeight;
      const p = Math.max(0, Math.min(1, -r.top / max));
      const step = Math.min(7, Math.floor(p * 8));
      const resolving = step === 7;
      const beatProgress = clamp01((p - .875) / .125);
      const resolutionProgress = reduced.matches && resolving ? 1 : beatProgress;
      const release = smooth(clamp01((resolutionProgress - .08) / .68));
      const fade = smooth(clamp01((resolutionProgress - .34) / .5));
      const rotationProgress = Math.min(1, p / .875);
      const motionP = Math.min(p, .875);

      setActiveStep(step);

      if (score) score.innerHTML = SCORES[step][0] + '<small>' + SCORES[step][1] + '</small>';
      if (outcomes) { outcomes.classList.toggle('active', step === 2); outcomes.setAttribute('aria-hidden', String(step !== 2)); }
      if (decision) { decision.classList.toggle('active', step === 4 || step === 5); decision.setAttribute('aria-hidden', String(step !== 4 && step !== 5)); }
      engine.classList.toggle('resolving', resolving);
      if (resolutionRaven) resolutionRaven.classList.toggle('active', resolving && resolutionProgress > .3);
      engine.style.setProperty('--release', release);
      engine.style.setProperty('--fade', fade);
      engine.style.setProperty('--fade-blur', `${fade * 9}px`);
      engine.style.setProperty('--outer-blur', `${fade * 6}px`);
      engine.style.setProperty('--ring-blur', `${fade * 5}px`);
      engine.style.setProperty('--glow-blur', `${24 + fade * 12}px`);
      engine.style.setProperty('--glow-opacity', String(.9 - fade * .9));
      updateAssembly(p, release);
      updateResolution(resolutionProgress, resolving);
      const coreRot = rotationProgress * 360, rimRot = rotationProgress * -360;
      const sc = 1 + Math.sin(motionP * Math.PI) * .12;
      const wobbleX = Math.sin(motionP * Math.PI * 8) * 1.8;
      const wobbleY = Math.cos(motionP * Math.PI * 6) * 1.25;
      const baseX = innerWidth < 701 ? 8 : 10;
      const baseY = innerWidth < 701 ? 12 : 0;
      engine.style.setProperty('--scrollRot', coreRot + 'deg');
      engine.style.setProperty('--rimRot', rimRot + 'deg');
      engine.style.transform = `translateX(${baseX + wobbleX}vw) translateY(${baseY + wobbleY}vh) scale(${sc})`;
    }

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    reduced.addEventListener?.('change', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return (
    <section className="lp-story-wrap" id="story" ref={wrapRef}>
      <div className="lp-stage">
        <RavenArt variant="resolution" className="lp-raven-resolution" id="resolution-raven" ref={resolutionRavenRef} />
        <div className="lp-story-intro"><b>One signal. Six transitions.</b><br />A decision moving through the engine.</div>
        <div className="lp-matrix" id="matrix" ref={matrixRef} />
        <div className="lp-copy">
          {STEPS.map((s, i) => (
            <article key={i} className={`lp-step ${i === 0 ? 'active' : ''} ${i === 7 ? 'lp-resolution-step' : ''}`} aria-hidden={i !== 0}>
              <div className="lp-eyebrow">{s.eyebrow}</div>
              <h2>{s.h2}</h2>
              {s.p && <p>{s.p}</p>}
            </article>
          ))}
        </div>
        <div className="lp-engine" id="engine" ref={engineRef}>
          <div className="lp-outer-hex-scroll" aria-hidden="true">
            <svg className="lp-outer-hex" viewBox="0 0 400 400" role="presentation">
              <path d="M130 30 L270 30 Q286 30 296 44 L374 178 Q382 192 374 206 L296 356 Q288 370 270 370 L130 370 Q112 370 104 356 L26 206 Q18 192 26 178 L104 44 Q112 30 130 30 Z" />
              <path className="dash" d="M130 30 L270 30 Q286 30 296 44 L374 178 Q382 192 374 206 L296 356 Q288 370 270 370 L130 370 Q112 370 104 356 L26 206 Q18 192 26 178 L104 44 Q112 30 130 30 Z" />
              <circle className="node" cx="0" cy="0" r="4" /><circle className="node" cx="0" cy="0" r="3" /><circle className="node" cx="0" cy="0" r="3.5" />
            </svg>
          </div>
          <div className="lp-ring" /><div className="lp-ring r2" /><div className="lp-ring r3" />
          <span className="lp-engine-node n1" /><span className="lp-engine-node n2" /><span className="lp-engine-node n3" /><span className="lp-engine-node n4" /><span className="lp-engine-node n5" /><span className="lp-engine-node n6" />
          <div className="lp-core-wrap">
            <div className="lp-hex-glow" />
            <div className="lp-hex-core">
              <svg className="lp-logo-mark unresolved" ref={logoMarkRef} viewBox="300 300 410 410" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FFFFFF" /><stop offset="1" stopColor="#FFFFFF" /></linearGradient>
                  <linearGradient id="g2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#F2F2F2" /><stop offset="1" stopColor="#F2F2F2" /></linearGradient>
                  <linearGradient id="g3" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#E6E6E6" /><stop offset="1" stopColor="#E6E6E6" /></linearGradient>
                  <linearGradient id="g4" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#D9D9D9" /><stop offset="1" stopColor="#D9D9D9" /></linearGradient>
                  <linearGradient id="g5" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#CCCCCC" /><stop offset="1" stopColor="#CCCCCC" /></linearGradient>
                </defs>
                <path className="lp-logo-piece" ref={el => logoPiecesRef.current[0] = el} fill="url(#g1)" d="M500 498 L557 325 L402 356 L386 362 Z" />
                <path className="lp-logo-piece" ref={el => logoPiecesRef.current[1] = el} fill="url(#g2)" d="M500 498 L386 362 Q376 371 371 379 L319 537 Z" />
                <path className="lp-logo-piece" ref={el => logoPiecesRef.current[2] = el} fill="url(#g3)" d="M500 498 L319 537 L441 674 Z" />
                <path className="lp-logo-piece" ref={el => logoPiecesRef.current[3] = el} fill="url(#g4)" d="M500 498 L441 674 L597 643 Q609 640 616 634 Z" />
                <path className="lp-logo-piece" ref={el => logoPiecesRef.current[4] = el} fill="url(#g5)" d="M500 498 L616 634 Q624 626 629 617 L679 467 Z" />
              </svg>
              <div className="lp-hex-inner">
                <div className="lp-core-logo"><span className="br">[</span><span className="hex">HEX</span><span className="dash">-</span><span className="ble">BLE</span><sup>6</sup><span className="br">]</span></div>
                <div className="lp-score" ref={scoreRef}>?<small>unresolved</small></div>
              </div>
            </div>
          </div>
        </div>
        <div className="lp-outcomes" id="outcomes" ref={outcomesRef} aria-hidden="true">
          <div className="lp-outcome o1"><div className="lp-o-label">Outcome A</div><div className="lp-o-val">63%</div></div>
          <div className="lp-outcome o2"><div className="lp-o-label">Outcome B</div><div className="lp-o-val">24%</div></div>
          <div className="lp-outcome o3"><div className="lp-o-label">Outcome C</div><div className="lp-o-val">13%</div></div>
        </div>
        <div className="lp-decision-card" id="decision" ref={decisionRef} aria-hidden="true">
          <div className="lp-row"><span>Prediction</span><strong>71%</strong></div>
          <div className="lp-row"><span>Risk</span><strong>LOW</strong></div>
          <div className="lp-row"><span>Decision</span><strong className="act">ACT</strong></div>
        </div>
        <div className="lp-progress" aria-hidden="true">
          {[0,1,2,3,4,5,6,7].map(i => <i key={i} className={i === activeStep ? 'active' : ''} />)}
        </div>
      </div>
    </section>
  );
}