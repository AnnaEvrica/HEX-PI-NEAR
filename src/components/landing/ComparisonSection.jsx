import RavenArt from './RavenArt';

export default function ComparisonSection() {
  return (
    <section className="lp-positioning" aria-labelledby="difference-title">
      <RavenArt variant="positioning" className="lp-raven-positioning" />
      <div className="lp-positioning-head">
        <h2 id="difference-title">Networks validate.<br />Hex <strong>enhances.</strong></h2>
        <p className="lp-positioning-lede">Conventional AI validates against training data. Hex inverts the model — finding and enhancing patterns in the decay, then calibrating against what actually happens.</p>
      </div>
      <div className="lp-contrast-grid">
        <article className="lp-contrast">
          <div className="lp-contrast-label">Conventional AI</div>
          <h3>Validates the answer.</h3>
          <ul><li>One persuasive prediction</li><li>Confidence assumed, not earned</li><li>Stops at the output</li></ul>
        </article>
        <article className="lp-contrast">
          <div className="lp-contrast-label">Hex</div>
          <h3>Enhances the signal.</h3>
          <ul><li>Finds patterns in the decay</li><li>Enhances via semantic weighting</li><li>Calibrates against reality</li></ul>
        </article>
      </div>
    </section>
  );
}