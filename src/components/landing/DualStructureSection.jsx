import DualDisciplineGraphic from './DualDisciplineGraphic';

export default function DualStructureSection() {
  return (
    <section className="lp-section" id="method">
      <div className="lp-section-inner">
        <div className="lp-section-label">The Method</div>
        <div className="lp-section-side">
          <div>
            <h2 className="lp-section-heading">One engine. Two <em>disciplines.</em></h2>
            <p className="lp-section-body">
              One layer finds precision through structural signals. The other extracts value through contextual
              resonance. Together: a decision both accurate and useful.
            </p>
          </div>
          <figure className="lp-section-side-fig">
            <DualDisciplineGraphic />
          </figure>
        </div>
        <div className="lp-compare-grid">
          <div className="lp-compare-col">
            <div className="lp-compare-label">Layer I — Signals</div>
            <h3 className="lp-compare-heading">Precision.</h3>
            <ul className="lp-compare-list">
              <li>Structural probability from decay</li>
              <li>Semantic weighting enhances what others discard</li>
              <li>Every call carries earned confidence</li>
              <li>Calibrated against realized outcomes</li>
            </ul>
          </div>
          <div className="lp-compare-col">
            <div className="lp-compare-label">Layer II — Resonance</div>
            <h3 className="lp-compare-heading">Value.</h3>
            <ul className="lp-compare-list">
              <li>Context calibrates tone and register</li>
              <li>Conviction translated into weighted language</li>
              <li>Readable, bounded, honest about limits</li>
              <li>A decision you can act on</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}