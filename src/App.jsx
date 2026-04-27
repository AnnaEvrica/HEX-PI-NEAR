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
import Dashboard from '@/pages/Dashboard.jsx';
import Portfolio from '@/pages/Portfolio';
import AssetDetail from '@/pages/AssetDetail';
import Governance from '@/pages/Governance.jsx';
import Legal from '@/pages/Legal';
import Backtest from '@/pages/Backtest';
import Managers from '@/pages/Managers';
import Thesis from '@/pages/Thesis';
import Trading from '@/pages/Trading.jsx';
import About from '@/pages/About';
import Settings from '@/pages/Settings.jsx';
import ConsentFlow from '@/components/onboarding/ConsentFlow';
import HEX6ChatInterface from '@/components/chat/HEX6ChatInterface';
import { useState, useEffect } from 'react';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, user } = useAuth();
  const [consentCompleted, setConsentCompleted] = useState(false);

  useEffect(() => {
    // Check if user has completed consent flow (from backend user data)
    if (user) {
      // Check if user already has consent flag in their profile
      setConsentCompleted(user.hex6_consent_completed === true);
    }
  }, [user]);

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-border border-t-accent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      return <Routes><Route path="/" element={<Landing />} /><Route path="*" element={<Landing />} /></Routes>;
    }
  }

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route 
        path="/app" 
        element={
          !user ? (
            <UserNotRegisteredError />
          ) : !consentCompleted ? (
            <ConsentFlow
              onComplete={() => {
                base44.auth.updateMe({ hex6_consent_completed: true });
                setConsentCompleted(true);
              }}
            />
          ) : (
            <HEX6ChatInterface />
          )
        } 
      />
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