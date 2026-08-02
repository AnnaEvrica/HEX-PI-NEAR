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
  const [authRetryCount, setAuthRetryCount] = useState(0);

  const consentDone = user?.hex6_consent_completed === true || !!localStorage.getItem('hex6_consent_timestamp') || consentCompleted;

  useEffect(() => {
    if (user?.hex6_consent_completed === true) {
      setConsentCompleted(true);
    }
  }, [user]);

  // Post-checkout auth recovery: Stripe's redirect causes a full-page reload
  // that can briefly lose auth state (token-propagation delay). If we detect
  // a checkout signal (URL param or sessionStorage flag), retry auth with
  // backoff instead of bouncing to the landing page — keeps the user in the app.
  useEffect(() => {
    if (!user) {
      const checkoutSignal = new URLSearchParams(window.location.search).get('checkout') === 'success'
        || !!sessionStorage.getItem('hex6_checkout_pending');
      if (checkoutSignal && authRetryCount < 5) {
        const timer = setTimeout(() => {
          setAuthRetryCount(c => c + 1);
          checkAuth();
        }, 1500 * (authRetryCount + 1));
        return () => clearTimeout(timer);
      }
    }
  }, [user, authRetryCount]);

  if (isNotRegistered) {
    return <UserNotRegisteredError />;
  }
  if (!user) {
    const checkoutSignal = new URLSearchParams(window.location.search).get('checkout') === 'success'
      || !!sessionStorage.getItem('hex6_checkout_pending');
    if (checkoutSignal && authRetryCount < 5) {
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-background">
          <div className="w-8 h-8 border-4 border-border border-t-accent rounded-full animate-spin"></div>
        </div>
      );
    }
    // Retries exhausted — clean up and fall through to landing redirect
    if (checkoutSignal) {
      sessionStorage.removeItem('hex6_checkout_pending');
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