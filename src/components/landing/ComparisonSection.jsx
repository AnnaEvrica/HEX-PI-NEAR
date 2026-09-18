import RavenArt from './RavenArt';

export default function ComparisonSection() {
  return (
    <section className="lp-positioning" aria-labelledby="difference-title">
      <RavenArt variant="positioning" className="lp-raven-positioning" />
      <div className="lp-positioning-head">
        <h2 id="difference-title">Most AI fears<br /><strong>the dark.</strong></h2>
        <p className="lp-positioning-lede">Conventional models retreat when signal decays into noise. HEX6-BLE works where the data thins — finding structure in the aftermath, weighing consequences, and deciding whether — and how — to act.</p>
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