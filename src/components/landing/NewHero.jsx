import { useNavigate } from 'react-router-dom';
import { appParams } from '@/lib/app-params';
import { useAuth } from '@/lib/AuthContext';
import RavenArt from './RavenArt';

export default function NewHero() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const authUrl = `/api/apps/auth/login?app_id=${appParams.appId}&from_url=${encodeURIComponent(`${window.location.origin}/app`)}`;
  const handleEnter = (e) => {
    if (user) { e.preventDefault(); navigate('/app'); return; }
    sessionStorage.setItem('hex6_auth_pending', Date.now().toString());
  };

  return (
    <section className="lp-hero" id="top">
      <h1 className="lp-hero-heading">Probabilistic Intelligence</h1>
      <hr className="lp-hero-rule" />
      <a href={authUrl} target="_top" onClick={handleEnter} className="lp-hero-enter-btn">ENTER <strong>HEX [PI]</strong></a>
      <RavenArt variant="hero" className="lp-hero-image" />
      <div className="lp-hero-caption">Fig. 01 · Raven — listens to the decay</div>
    </section>
  );
}