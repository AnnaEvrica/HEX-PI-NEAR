export default function DualStructureSection() {
  return (
    <section className="lp-positioning lp-dual-structure" aria-labelledby="dual-structure-title">
      <div className="lp-positioning-head">
        <h2 id="dual-structure-title">One engine.<br />Two <strong>disciplines.</strong></h2>
        <p className="lp-positioning-lede">One layer finds precision through structural signals. The other extracts value through contextual resonance. Together: a decision both accurate and useful.</p>
      </div>
      <div className="lp-contrast-grid">
        <article className="lp-contrast">
          <div className="lp-contrast-label">Layer I — Signals</div>
          <h3>Precision.</h3>
          <ul>
            <li>Structural probability from decay</li>
            <li>Semantic weighting enhances what others discard</li>
            <li>Every call carries earned confidence</li>
            <li>Calibrated against realized outcomes</li>
          </ul>
        </article>
        <article className="lp-contrast">
          <div className="lp-contrast-label">Layer II — Resonance</div>
          <h3>Value.</h3>
          <ul>
            <li>Context calibrates tone and register</li>
            <li>Conviction translated into weighted language</li>
            <li>Readable, bounded, honest about limits</li>
            <li>A decision you can act on</li>
          </ul>
        </article>
      </div>
    </section>
  );
}