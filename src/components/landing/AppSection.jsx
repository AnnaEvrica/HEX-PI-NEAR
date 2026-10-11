import CalibrationGraphic from './CalibrationGraphic';
import TestHex from './TestHex';

export default function AppSection() {
  return (
    <section className="lp-section" id="app">
      <div className="lp-section-inner">
        <div className="lp-section-label">01 / The app</div>
        <div className="lp-section-side">
          <div>
            <h2 className="lp-section-heading">Precision through <em>signals.</em></h2>
            <p className="lp-section-body">
              Hex is an experimental probabilistic reasoning system. It quantifies uncertainty, applies explicit
              risk constraints, and scores every call against realized outcomes — so confidence is earned, not assumed.
            </p>
          </div>
          <figure className="lp-section-side-fig">
            <CalibrationGraphic />
          </figure>
        </div>
        <TestHex />
      </div>
    </section>
  );
}