import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Landing from '@/pages/Landing.jsx';
import ConsentFlow from '@/components/onboarding/ConsentFlow';
import HEX6ChatInterface from '@/components/chat/HEX6ChatInterface';
import SubscriptionGate from '@/components/SubscriptionGate';
import { useState, useEffect } from 'react';

const AuthenticatedApp = () => {
  const { isLoading, user, isNotRegistered } = useAuth();
  const [consentCompleted, setConsentCompleted] = useState(false);

  const consentDone = user?.hex6_consent_completed === true || !!localStorage.getItem('hex6_consent_timestamp') || consentCompleted;

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

  if (isNotRegistered) {
    return <UserNotRegisteredError />;
  }

  return (
    <Routes>
      <Route path="/" element={user ? (consentDone ? <SubscriptionGate><HEX6ChatInterface /></SubscriptionGate> : <ConsentFlow onComplete={() => setConsentCompleted(true)} />) : <Landing />} />
      <Route path="/home" element={<Landing />} />
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