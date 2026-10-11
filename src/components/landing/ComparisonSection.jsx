import NovelFrameworkGraphic from './NovelFrameworkGraphic';

export default function ComparisonSection() {
  return (
    <section className="lp-section" id="science">
      <div className="lp-section-inner">
        <div className="lp-section-label">The Science</div>
        <div className="lp-section-side">
          <div>
            <h2 className="lp-section-heading">The novel framework for <em>neural engineering.</em></h2>
            <p className="lp-section-body">
              Conventional AI recognizes patterns and responds. Hex weighs evidence, balances against history,
              and adapts through feedback — the way living systems navigate uncertainty.
            </p>
          </div>
          <figure className="lp-section-side-fig">
            <NovelFrameworkGraphic />
          </figure>
        </div>
        <div className="lp-compare-grid">
          <div className="lp-compare-col">
            <div className="lp-compare-label">Conventional AI</div>
            <h3 className="lp-compare-heading">Pattern → response</h3>
            <ul className="lp-compare-list">
              <li>One persuasive prediction</li>
              <li>Confidence assumed, not earned</li>
              <li>Stops at the output</li>
              <li>Recognize. Relate. Respond.</li>
            </ul>
          </div>
          <div className="lp-compare-col">
            <div className="lp-compare-label">Hex</div>
            <h3 className="lp-compare-heading">Evidence ⇄ balance</h3>
            <ul className="lp-compare-list">
              <li>Finds patterns in the decay</li>
              <li>Enhances via semantic weighting</li>
              <li>Calibrates against reality</li>
              <li>Weigh. Adapt. Repeat.</li>
            </ul>
          </div>
        </div>
        <div className="lp-science-teaser">
          <div className="lp-section-label">What's coming</div>
          <p className="lp-science-teaser-body">
            The HEX6-BLE server: a modular computing system investigating how Probabilistic Intelligence
            interacts with mycelium biofeedback to predict, coordinate, and optimize energy and resource
            flows across interconnected environments.
          </p>
          <a className="lp-app-link" href="https://evrica.tech" target="_blank" rel="noopener noreferrer">
            Evrica Technologies Inc. →
          </a>
        </div>
      </div>
    </section>
  );
}