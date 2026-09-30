import RavenArt from './RavenArt';

export default function DomainsSection() {
  return (
    <section className="lp-after">
      <RavenArt variant="domains" className="lp-raven-middle" />
      <div className="lp-after-grid">
        <div>
          <div className="lp-eyebrow">One engine / Many domains</div>
          <h3>Different questions.<br />The same <em>discipline.</em></h3>
        </div>
        <div className="lp-modules">
          <div className="lp-module"><b>Trading</b><p>Calibrated timing, exposure, and restraint — without mistaking confidence for certainty.</p></div>
          <div className="lp-module"><b>Learning</b><p>Update confidence as evidence arrives, preserving what the system knew at each decision point.</p></div>
          <div className="lp-module"><b>Assisting</b><p>Transparent reasoning for plans and choices where consequences matter.</p></div>
        </div>
      </div>
      <div className="lp-proof-line">
        <span>Built to be inspected</span>
        <div className="lp-proof-item"><strong>Probability attached</strong><small>Every recommendation carries its confidence.</small></div>
        <div className="lp-proof-item"><strong>Constraints explicit</strong><small>Risk visible before action, not after failure.</small></div>
        <div className="lp-proof-item"><strong>Outcomes scored</strong><small>What happened measured against what was expected.</small></div>
      </div>
    </section>
  );
}