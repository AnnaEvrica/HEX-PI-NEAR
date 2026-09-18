import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Landing from '@/pages/Landing.jsx';
import Discover from '@/pages/Discover.jsx';
import ConsentFlow from '@/components/onboarding/ConsentFlow';
import HEX6ChatInterface from '@/components/chat/HEX6ChatInterface';
import { useState, useEffect } from 'react';

// The authenticated app experience — consent → subscription gate → chat.
// Lives at /app; only reachable after login. "/" is always the public landing.
const AppExperience = () => {
  const { user, isNotRegistered, checkAuth } = useAuth();
  const [consentCompleted, setConsentCompleted] = useState(false);
  // Always start at 0 on fresh mount. The old code read a stale count from
  // sessionStorage — if a previous slow load had pushed it to the max, every
  // subsequent page load would immediately redirect to the landing page
  // before checkAuth() even finished, logging the user out on refresh.
  // Post-OAuth recovery still works: authPending is detected separately and
  // grants 12 retries (14.4s) starting from 0.
  const [authRetryCount, setAuthRetryCount] = useState(0);

  const consentDone = user?.hex6_consent_completed === true || !!localStorage.getItem('hex6_consent_timestamp') || consentCompleted;

  useEffect(() => {
    if (user) {
      sessionStorage.removeItem('hex6_auth_pending');
      sessionStorage.removeItem('hex6_auth_retry_count');
      if (user.hex6_consent_completed === true) {
        setConsentCompleted(true);
      }
    }
  }, [user]);

  // Post-redirect auth recovery: Stripe checkout and Google OAuth both cause
  // full-page reloads back to /app that can briefly lose auth state (token-
  // propagation delay). If we detect a pending signal, retry auth with backoff
  // instead of bouncing to the landing page — keeps the user in the app.
  useEffect(() => {
    if (!user) {
      const authPending = new URLSearchParams(window.location.search).get('checkout') === 'success'
        || !!sessionStorage.getItem('hex6_checkout_pending')
        || !!sessionStorage.getItem('hex6_auth_pending');
      // Fixed 1.2s polling — same total recovery window as before, but success
      // is detected within ~1.2s of the token landing instead of after a
      // multi-second backoff step (this was the mobile "long load" after login).
      const maxRetries = authPending ? 12 : 4;
      if (authRetryCount < maxRetries) {
        const timer = setTimeout(() => {
          const next = authRetryCount + 1;
          sessionStorage.setItem('hex6_auth_retry_count', String(next));
          setAuthRetryCount(next);
          checkAuth();
        }, 1200);
        return () => clearTimeout(timer);
      }
    }
  }, [user, authRetryCount]);

  // During post-OAuth recovery, show spinner (not error screen) — me() failures
  // are transient token-propagation delays, not genuinely "unregistered."
  const authPending = new URLSearchParams(window.location.search).get('checkout') === 'success'
    || !!sessionStorage.getItem('hex6_checkout_pending')
    || !!sessionStorage.getItem('hex6_auth_pending');

  if (authRetryCount < (authPending ? 12 : 4) && (isNotRegistered || !user)) {
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
      sessionStorage.removeItem('hex6_checkout_pending');
      sessionStorage.removeItem('hex6_auth_pending');
      sessionStorage.removeItem('hex6_auth_retry_count');
      window.history.replaceState({}, '', '/app');
    }
    return <Navigate to="/" replace />;
  }
  return consentDone ? <HEX6ChatInterface /> : <ConsentFlow onComplete={() => setConsentCompleted(true)} />;
};

// Logged-in visitors skip the landing page entirely — straight into the app.
// Only signed-out (or unregistered) visitors see the public landing.
const LandingGate = () => {
  const { user } = useAuth();
  if (user) return <Navigate to="/app" replace />;
  return <Landing />;
};

const AuthenticatedApp = () => {
  const { isLoading } = useAuth();

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