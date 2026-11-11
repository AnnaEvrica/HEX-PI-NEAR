import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import Landing from '@/pages/Landing.jsx';
import Discover from '@/pages/Discover.jsx';
import OAuthConsent from '@/pages/OAuthConsent.jsx';
import ConsentFlow from '@/components/onboarding/ConsentFlow';
// SubscriptionGate is not used in the hackathon build (see AuthenticatedApp below).
import HEX6ChatInterface from '@/components/chat/HEX6ChatInterface';
import { useState, useEffect } from 'react';

// The authenticated app experience — consent → subscription gate → chat.
// Lives at /app; only reachable after login. "/" is always the public landing.
const AppExperience = () => {
  const { user } = useAuth();
  const [consentCompleted, setConsentCompleted] = useState(false);

  const consentDone = user?.hex6_consent_completed === true
    || (!!user?.email && localStorage.getItem('hex6_consent_user') === user.email && !!localStorage.getItem('hex6_consent_timestamp'))
    || consentCompleted;

  useEffect(() => {
    if (user?.hex6_consent_completed === true) {
      setConsentCompleted(true);
    }
  }, [user]);

  if (!user) {
    return <Navigate to="/" replace />;
  }
  // Hackathon build: no subscription gate, so judges and testers go straight in
  // after sign-in. The production app (hex6-ble.com) keeps its gate.
  return consentDone ? (
    <HEX6ChatInterface />
  ) :<ConsentFlow onComplete={() => { try { localStorage.setItem('hex6_consent_user', user.email); } catch { /* storage unavailable */ } setConsentCompleted(true); }} />;
};

// Logged-in visitors skip the landing page entirely — straight into the app.
// Only signed-out (or unregistered) visitors see the public landing.
const LandingGate = () => {
  const { user } = useAuth();
  if (user) return <Navigate to="/app" replace />;
  return <Landing />;
};

// The OAuth consent page (for AI clients connecting to this app's MCP server)
// runs its own session check against the server, so it is mounted outside the
// app's loading gate. The path must match `consent_path` in the app's MCP
// settings on Base44.
const CONSENT_PATHS = ['/oauth/consent', '/OAuthConsent'];

const AuthenticatedApp = () => {
  const { isLoading } = useAuth();

  if (CONSENT_PATHS.includes(window.location.pathname.replace(/\/+$/, ''))) {
    return (
      <Routes>
        {CONSENT_PATHS.map((path) => <Route key={path} path={path} element={<OAuthConsent />} />)}
      </Routes>
    );
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-border border-t-accent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<LandingGate />} />
      <Route path="/discover" element={<Discover />} />
      <Route path="/app" element={<AppExperience />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App