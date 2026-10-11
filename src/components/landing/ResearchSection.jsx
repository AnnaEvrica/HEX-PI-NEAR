import FalsificationGraphic from './FalsificationGraphic';

export default function ResearchSection() {
  return (
    <section className="lp-section" id="research">
      <div className="lp-section-inner">
        <div className="lp-section-label">05 / R&amp;D</div>
        <div className="lp-section-side">
          <div>
            <h2 className="lp-section-heading">The <em>science</em> behind the signal.</h2>
            <p className="lp-section-body">
              PI predicts the next outcome, by reading signals the way living things do.
              The HEX6-BLE server extends this into regenerative infrastructure.
            </p>
            <a className="lp-app-link" href="https://evrica.tech" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: '24px' }}>
              See what's coming →
            </a>
          </div>
          <figure className="lp-section-side-fig">
            <FalsificationGraphic />
          </figure>
        </div>
      </div>
    </section>
  );
}