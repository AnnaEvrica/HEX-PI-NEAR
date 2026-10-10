import { useNavigate } from 'react-router-dom';
import { appParams } from '@/lib/app-params';
import { useAuth } from '@/lib/AuthContext';
import CalibrationGraphic from './CalibrationGraphic';

export default function AppSection() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const authUrl = `/api/apps/auth/login?app_id=${appParams.appId}&from_url=${encodeURIComponent(`${window.location.origin}/app`)}`;
  const handleEnter = (e) => {
    if (user) { e.preventDefault(); navigate('/app'); return; }
    sessionStorage.setItem('hex6_auth_pending', Date.now().toString());
  };

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
        <div className="lp-app-card">
          <h3 className="lp-app-card-title">Hex</h3>
          <p className="lp-app-card-body">
            Forecasting. Know the odds before you commit. For statistical accuracy, and any call where accuracy matters.
          </p>
          <a href={authUrl} target="_top" onClick={handleEnter} className="lp-app-link">Enter Hex →</a>
        </div>
      </div>
    </section>
  );
}