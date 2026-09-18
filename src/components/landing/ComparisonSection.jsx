import RavenArt from './RavenArt';

export default function ComparisonSection() {
  return (
    <section className="lp-positioning" aria-labelledby="difference-title">
      <RavenArt variant="positioning" className="lp-raven-positioning" />
      <div className="lp-positioning-head">
        <h2 id="difference-title">Neural networks validate.<br />HEX6-BLE <strong>enhances.</strong></h2>
        <p className="lp-positioning-lede">Conventional networks validate predictions against training data. HEX6-BLE inverts the model — using semantic weighting to find and enhance patterns in the decay, then calibrating each signal against what actually happens.</p>
      </div>
      <div className="lp-contrast-grid">
        <article className="lp-contrast">
          <div className="lp-contrast-label">Conventional AI</div>
          <h3>Validates the answer.</h3>
          <ul><li>Returns one persuasive prediction</li><li>Confidence is assumed, not earned</li><li>Stops when the output is delivered</li></ul>
        </article>
        <article className="lp-contrast">
          <div className="lp-contrast-label">HEX6-BLE</div>
          <h3>Enhances the signal.</h3>
          <ul><li>Finds patterns in the decay</li><li>Enhances through semantic weighting</li><li>Calibrates against reality</li></ul>
        </article>
      </div>
    </section>
  );
}