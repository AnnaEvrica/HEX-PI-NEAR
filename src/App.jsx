import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Discover from '@/pages/Discover.jsx';
import ConsentFlow from '@/components/onboarding/ConsentFlow';
import SubscriptionGate from '@/components/SubscriptionGate';
import HEX6ChatInterface from '@/components/chat/HEX6ChatInterface';
import { useState, useEffect } from 'react';

// The authenticated app experience — consent → subscription gate → chat.
// Lives at /app; only reachable after login. "/" is always the public landing.
const AppExperience = () => {
  const { user, isNotRegistered, checkAuth } = useAuth();
  const [consentCompleted, setConsentCompleted] = useState(false);
  const [authRetryCount, setAuthRetryCount] = useState(0);

  const consentDone = user?.hex6_consent_completed === true || !!localStorage.getItem('hex6_consent_timestamp') || consentCompleted;

  // Detect post-redirect auth recovery (Stripe checkout, Google OAuth).
  // Both cause full-page reloads back to /app that can briefly lose auth
  // state during token propagation.
  const authPending = new URLSearchParams(window.location.search).get('checkout') === 'success'
    || !!sessionStorage.getItem('hex6_checkout_pending')
    || !!sessionStorage.getItem('hex6_auth_pending');

  useEffect(() => {
    if (user) {
      sessionStorage.removeItem('hex6_auth_pending');
      sessionStorage.removeItem('hex6_auth_retry_count');
      if (user.hex6_consent_completed === true) {
        setConsentCompleted(true);
      }
    }
  }, [user]);

  // Retry auth with 1.2s polling. 12 retries (14.4s) for post-redirect
  // recovery, 10 retries (12s) for all other cases — enough for token
  // propagation without throwing the user out.
  useEffect(() => {
    if (!user && !isNotRegistered) {
      const maxRetries = authPending ? 12 : 10;
      if (authRetryCount < maxRetries) {
        const timer = setTimeout(() => {
          setAuthRetryCount(prev => prev + 1);
          checkAuth();
        }, 1200);
        return () => clearTimeout(timer);
      }
    }
  }, [user, authRetryCount, isNotRegistered, authPending]);

  // Spinner during retries — me() failures are transient token-propagation
  // delays, not genuinely "unregistered."
  if (!isNotRegistered && !user && authRetryCount < (authPending ? 12 : 10)) {
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
    // Retries exhausted — show a retry button instead of redirecting to the
    // landing page. This handles the edge case where token propagation took
    // longer than 12s (rare, but was throwing users out on mobile).
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-background gap-4 px-6 text-center">
        <p className="text-sm text-secondary">Session not found. If you just logged in, it may take a moment to propagate.</p>
        <button
          onClick={() => {
            setAuthRetryCount(0);
            checkAuth();
          }}
          className="px-6 py-2 bg-accent text-accent-foreground font-medium hover:bg-accent/90 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }
  return consentDone ? (
    <SubscriptionGate user={user}>
      <HEX6ChatInterface />
    </SubscriptionGate>
  ) : <ConsentFlow onComplete={() => setConsentCompleted(true)} />;
};

// Logged-in visitors skip the landing page entirely — straight into the app.
// Only signed-out (or unregistered) visitors see the public landing.
// Logged-in visitors go straight to /app. Logged-out visitors are
// redirected to the public marketing site on evrica.tech — a separate
// origin that can't bounce back into the app's auth loop.
const LandingGate = () => {
  const { user } = useAuth();
  useEffect(() => {
    if (!user) {
      window.location.href = 'https://evrica.tech';
    }
  }, [user]);
  if (user) return <Navigate to="/app" replace />;
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-4 border-border border-t-accent rounded-full animate-spin"></div>
    </div>
  );
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