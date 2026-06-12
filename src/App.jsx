import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AppLayout from '@/components/layout/AppLayout';
import Landing from '@/pages/Landing.jsx';
import ConsentFlow from '@/components/onboarding/ConsentFlow';
import SubscriptionGate from '@/components/onboarding/SubscriptionGate';
import HEX6ChatInterface from '@/components/chat/HEX6ChatInterface';
import { useState, useEffect, useRef } from 'react';

// Capture checkout param IMMEDIATELY on script load — before any React renders clear the URL
const checkoutSuccessOnLoad = new URLSearchParams(window.location.search).get('checkout') === 'success';
if (checkoutSuccessOnLoad) {
  window.history.replaceState({}, '', window.location.pathname);
}

const AuthenticatedApp = () => {
  const { isLoading, user } = useAuth();
  const [consentCompleted, setConsentCompleted] = useState(false);
  const fromCheckout = useRef(checkoutSuccessOnLoad);

  // Sync from user object — runs synchronously after user is available
  const consentDone = user?.hex6_consent_completed === true || consentCompleted;

  useEffect(() => {
    if (user?.hex6_consent_completed === true) {
      setConsentCompleted(true);
    }
  }, [user]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-border border-t-accent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={user ? (consentDone ? <SubscriptionGate fromCheckout={fromCheckout.current}><HEX6ChatInterface /></SubscriptionGate> : <ConsentFlow onComplete={() => { base44.auth.updateMe({ hex6_consent_completed: true }); setConsentCompleted(true); }} />) : <Landing />} />
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