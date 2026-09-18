import { LANDING_IMAGES } from './landingImages';

export default function DomainsSection() {
  return (
    <section className="lp-after">
      <img className="lp-raven-art lp-raven-middle" src={LANDING_IMAGES.domains} alt="" aria-hidden="true" loading="lazy" decoding="async" />
      <div className="lp-after-grid">
        <div>
          <div className="lp-eyebrow">One engine / Many domains</div>
          <h3>Different questions.<br />The same <em>discipline.</em></h3>
        </div>
        <div className="lp-modules">
          <div className="lp-module"><b>Trading</b><p>Turn market forecasts into calibrated timing, exposure, and restraint — without mistaking confidence for certainty.</p></div>
          <div className="lp-module"><b>Learning</b><p>Update confidence as new evidence arrives, while preserving what the system knew at each decision point.</p></div>
          <div className="lp-module"><b>Assisting</b><p>Apply the same transparent reasoning to plans and personal choices where consequences matter.</p></div>
        </div>
      </div>
      <div className="lp-proof-line">
        <span>Built to be inspected</span>
        <div className="lp-proof-item"><strong>Probability attached</strong><small>Every recommendation carries the confidence behind it.</small></div>
        <div className="lp-proof-item"><strong>Constraints explicit</strong><small>Risk is visible before action, not explained after failure.</small></div>
        <div className="lp-proof-item"><strong>Outcomes scored</strong><small>What happened is measured against what was expected.</small></div>
      </div>
    </section>
  );
}