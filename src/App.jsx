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
import SubscriptionGate from '@/components/SubscriptionGate';
import { useState, useEffect } from 'react';

// The authenticated app experience — consent → subscription gate → chat.
// Lives at /app; only reachable after login. "/" is always the public landing.
const AppExperience = () => {
  const { user, isNotRegistered, checkAuth } = useAuth();
  const [consentCompleted, setConsentCompleted] = useState(false);
  const [authRetryCount, setAuthRetryCount] = useState(() =>
    Number(sessionStorage.getItem('hex6_auth_retry_count')) || 0
  );

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
      if (authPending && authRetryCount < 5) {
        const timer = setTimeout(() => {
          const next = authRetryCount + 1;
          sessionStorage.setItem('hex6_auth_retry_count', String(next));
          setAuthRetryCount(next);
          checkAuth();
        }, 1500 * (authRetryCount + 1));
        return () => clearTimeout(timer);
      }
    }
  }, [user, authRetryCount]);

  // During post-OAuth recovery, show spinner (not error screen) — me() failures
  // are transient token-propagation delays, not genuinely "unregistered."
  const authPending = new URLSearchParams(window.location.search).get('checkout') === 'success'
    || !!sessionStorage.getItem('hex6_checkout_pending')
    || !!sessionStorage.getItem('hex6_auth_pending');

  if (authPending && authRetryCount < 5 && (isNotRegistered || !user)) {
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
  return consentDone ? <SubscriptionGate><HEX6ChatInterface /></SubscriptionGate> : <ConsentFlow onComplete={() => setConsentCompleted(true)} />;
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
      <Route path="/" element={<Landing />} />
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