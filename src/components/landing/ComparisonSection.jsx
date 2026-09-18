import RavenArt from './RavenArt';

export default function ComparisonSection() {
  return (
    <section className="lp-positioning" aria-labelledby="difference-title">
      <RavenArt variant="positioning" className="lp-raven-positioning" />
      <div className="lp-positioning-head">
        <h2 id="difference-title">Most AI stops at <strong>an answer.</strong></h2>
        <p className="lp-positioning-lede">Fluent output can sound certain even when the world is not. HEX6-BLE begins where the model stops: exposing uncertainty, weighing consequences, and deciding whether — and how — to act.</p>
      </div>
      <div className="lp-contrast-grid">
        <article className="lp-contrast">
          <div className="lp-contrast-label">Conventional AI</div>
          <h3>Optimizes the answer.</h3>
          <ul><li>Returns one persuasive prediction</li><li>Uncertainty remains implicit</li><li>Stops when the output is delivered</li></ul>
        </article>
        <article className="lp-contrast">
          <div className="lp-contrast-label">HEX6-BLE</div>
          <h3>Optimizes the decision.</h3>
          <ul><li>Models a distribution of outcomes</li><li>Makes confidence and risk visible</li><li>Learns when reality answers back</li></ul>
        </article>
      </div>
    </section>
  );
}