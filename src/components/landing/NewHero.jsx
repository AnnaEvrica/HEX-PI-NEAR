import { useNavigate } from 'react-router-dom';
import RavenArt from './RavenArt';
import { appParams } from '@/lib/app-params';
import { useAuth } from '@/lib/AuthContext';

export default function NewHero() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const authUrl = `/api/apps/auth/login?app_id=${appParams.appId}&from_url=${encodeURIComponent(`${window.location.origin}/app`)}`;
  const handleEnter = (e) => {
    if (user) { e.preventDefault(); navigate('/app'); return; }
    sessionStorage.setItem('hex6_auth_pending', Date.now().toString());
  };

  return (
    <section className="lp-hero">
      <RavenArt variant="hero" className="lp-raven-top" />
      <div className="lp-logo-lockup">
        <div className="lp-hero-kicker">Probabilistic intelligence for consequential decisions</div>
        <div className="lp-main-logo"><span className="br">[</span><span className="hex">HEX</span><span className="dash">-</span><span className="ble">BLE</span><sup>6</sup><span className="br">]</span></div>
        <h1>AI predicts.<br /><strong>HEX6-BLE decides.</strong></h1>
        <p className="lp-hero-deck">A reasoning layer above AI models that turns predictions into calibrated, risk-bounded actions — and learns from what actually happened.</p>
        <div className="lp-hero-proof"><span>Quantify uncertainty</span><span>Apply explicit risk</span><span>Score reality</span></div>
        <a href={authUrl} target="_top" onClick={handleEnter} className="lp-enter-hex">
          ENTER HEX<sup>*</sup>
        </a>
        <p style={{ marginTop: '6px', font: '10px/1 ui-monospace,monospace', color: '#777', letterSpacing: '.12em' }}>* Experimental LLM in testing</p>
      </div>
      <div className="lp-hero-note"><b>See the difference</b><br />scroll to follow one decision</div>
      <div className="lp-scroll-line" />
    </section>
  );
}