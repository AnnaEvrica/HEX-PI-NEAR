import { Link } from 'react-router-dom';
import RavenArt from './RavenArt';

export default function ClosingCTA({ onOpenPolicy }) {
  return (
    <section className="lp-finale" id="finale">
      <RavenArt variant="finale" className="lp-raven-finale" />
      <div className="lp-finale-inner">
        <div className="lp-finale-kicker">The source of truth is the outcome</div>
        <div className="lp-finale-logo"><span className="br">[</span><span className="hex">HEX</span><span className="dash">-</span><span className="ble">BLE</span><sup>6</sup><span className="br">]</span></div>
        <div className="lp-finale-copy">Find the pattern.<br /><b>Enhance the signal.</b></div>
        <div className="lp-finale-sub">Patterns found in the decay. Enhanced through calibrated accuracy. Scored against reality.</div>
        <div className="lp-finale-actions">
          <Link to="/discover" className="lp-btn primary">Join the experiment ↗</Link>
          <a href="https://evrica.tech" target="_blank" rel="noopener noreferrer" className="lp-btn">Explore the method ↗</a>
        </div>
      </div>
      <div className="lp-finale-footer">
        <span>HEX6-BLE // PROBABILISTIC INTELLIGENCE</span>
        <span>Binaural Linguistic Engine</span>
      </div>
    </section>
  );
}