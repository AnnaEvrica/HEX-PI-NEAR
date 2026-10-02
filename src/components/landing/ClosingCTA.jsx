import { useNavigate } from 'react-router-dom';
import { appParams } from '@/lib/app-params';
import { useAuth } from '@/lib/AuthContext';

export default function ClosingCTA() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const authUrl = `/api/apps/auth/login?app_id=${appParams.appId}&from_url=${encodeURIComponent(`${window.location.origin}/app`)}`;
  const handleEnter = (e) => {
    if (user) { e.preventDefault(); navigate('/app'); return; }
    sessionStorage.setItem('hex6_auth_pending', Date.now().toString());
  };

  return (
    <section className="lp-section" id="enter" style={{ textAlign: 'center' }}>
      <div className="lp-section-inner" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div className="lp-section-label">03 / Enter</div>
        <h2 className="lp-section-heading" style={{ margin: '0 auto 28px', textAlign: 'center' }}>Be <em>first.</em></h2>
        <p className="lp-section-body" style={{ textAlign: 'center', margin: '0 auto 32px' }}>
          Join the beta. Experience probabilistic intelligence that knows what it knows — and what it does not.
        </p>
        <a href={authUrl} target="_top" onClick={handleEnter} className="lp-app-link">Enter Hex →</a>
      </div>
    </section>
  );
}