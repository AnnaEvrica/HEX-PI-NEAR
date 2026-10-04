import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Landing from '@/pages/Landing.jsx';
import Discover from '@/pages/Discover.jsx';
import OAuthConsent from '@/pages/OAuthConsent.jsx';
import ConsentFlow from '@/components/onboarding/ConsentFlow';
import SubscriptionGate from '@/components/SubscriptionGate';
import HEX6ChatInterface from '@/components/chat/HEX6ChatInterface';
import { useState, useEffect } from 'react';
import { redirectPending, clearPending } from '@/lib/authPending';

// The authenticated app experience — consent → subscription gate → chat.
// Lives at /app; only reachable after login. "/" is always the public landing.
const AppExperience = () => {
  const { user, isNotRegistered, checkAuth } = useAuth();
  const [consentCompleted, setConsentCompleted] = useState(false);
  const [authRetryCount, setAuthRetryCount] = useState(0);

  const consentDone = user?.hex6_consent_completed === true
    || (!!user?.email && localStorage.getItem('hex6_consent_user') === user.email && !!localStorage.getItem('hex6_consent_timestamp'))
    || consentCompleted;

  useEffect(() => {
    if (user) {
      clearPending();
      if (user.hex6_consent_completed === true) {
        setConsentCompleted(true);
      }
    }
  }, [user]);

  // After a sign-in or Stripe checkout redirect, the session can take a few
  // seconds to become valid. Keep the spinner and re-check (one request per
  // check, never overlapping) instead of bouncing to the landing page. A
  // plain signed-out visit to /app is not retried: it goes straight to "/".
  const authPending = redirectPending();
  const maxRetries = authPending ? 12 : 0;

  useEffect(() => {
    if (user || authRetryCount >= maxRetries) return undefined;
    const timer = setTimeout(async () => {
      await checkAuth({ attempts: 1 });
      setAuthRetryCount((n) => n + 1);
    }, 1200);
    return () => clearTimeout(timer);
  }, [user, authRetryCount, maxRetries, checkAuth]);

  if (!user && !isNotRegistered && authRetryCount < maxRetries) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-border border-t-accent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (isNotRegistered) {
    return <UserNotRegisteredError />;
  }
  if (!user) {
    // Retries exhausted — clean up and fall through to landing redirect
    if (authPending) {
      clearPending();
      window.history.replaceState({}, '', '/app');
    }
    return <Navigate to="/" replace />;
  }
  return consentDone ? (
    <SubscriptionGate user={user}>
      <HEX6ChatInterface />
    </SubscriptionGate>
  ) : <ConsentFlow onComplete={() => { try { localStorage.setItem('hex6_consent_user', user.email); } catch { /* storage unavailable */ } setConsentCompleted(true); }} />;
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