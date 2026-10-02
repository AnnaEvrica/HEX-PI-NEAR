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
        <div className="lp-hero-kicker">Probabilistic Intelligence</div>
        <h1>Hex</h1>
        <p className="lp-hero-deck">An inverted language model. Where others validate, Hex finds patterns in the decay — then calibrates each signal against reality.</p>
        <div className="lp-hero-proof"><span>Quantify uncertainty</span><span>Apply explicit risk</span><span>Score reality</span></div>
        <a href={authUrl} target="_top" onClick={handleEnter} className="lp-enter-hex">
          ENTER HEX
        </a>
        <p style={{ marginTop: '6px', font: '10px/1 ui-monospace,monospace', color: '#8a8a8a', letterSpacing: '.12em' }}>Experimental LLM in testing</p>
      </div>
      <div className="lp-hero-note"><b>Scroll</b><br />follow one decision</div>
      <div className="lp-scroll-line" />
    </section>
  );
}