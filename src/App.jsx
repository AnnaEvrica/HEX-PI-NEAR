import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AppLayout from '@/components/layout/AppLayout';
import Dashboard from '@/pages/Dashboard';
import Portfolio from '@/pages/Portfolio';
import AssetDetail from '@/pages/AssetDetail';
import Governance from '@/pages/Governance';
import Legal from '@/pages/Legal';
import Backtest from '@/pages/Backtest';
import Managers from '@/pages/Managers';
import Thesis from '@/pages/Thesis';
import Trading from '@/pages/Trading';
import About from '@/pages/About';
import Settings from '@/pages/Settings';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#080c10]">
        <div className="w-8 h-8 border-4 border-slate-800 border-t-emerald-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/portfolio/:id" element={<AssetDetail />} />
        <Route path="/governance" element={<Governance />} />
        <Route path="/legal" element={<Legal />} />
        <Route path="/backtest" element={<Backtest />} />
        <Route path="/managers" element={<Managers />} />
        <Route path="/thesis" element={<Thesis />} />
        <Route path="/trading" element={<Trading />} />
        <Route path="/about" element={<About />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
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