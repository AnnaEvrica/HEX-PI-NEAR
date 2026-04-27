import { useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, Briefcase, Zap, Shield, Settings, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';

const NAV_ITEMS = [
  { path: '/app/dashboard', label: 'Dashboard', icon: BarChart3 },
  { path: '/app/portfolio', label: 'Portfolio', icon: Briefcase },
  { path: '/app/trading', label: 'Trade', icon: Zap },
  { path: '/app/governance', label: 'Governance', icon: Shield },
  { path: '/app/settings', label: 'Settings', icon: Settings },
];

export default function MobileLayout({ children, showHeader = true, showNav = true }) {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Check if current route is a root nav route or a child route
  const isRootRoute = NAV_ITEMS.some(item => item.path === location.pathname);
  const showBack = showHeader && !isRootRoute && location.pathname !== '/app';

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Header with safe-area padding */}
      {showHeader && (
        <header 
          className="flex items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0"
          style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
        >
          {showBack ? (
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-muted rounded-sm transition-colors select-none active:bg-muted"
              style={{ minWidth: '44px', minHeight: '44px' }}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : (
            <div className="text-lg font-bold">HEX6 BLE</div>
          )}
          <div className="flex-1" />
          <div className="text-xs text-secondary">Mobile</div>
        </header>
      )}

      {/* Main content with route transition animation */}
      <motion.main
        className="flex-1 overflow-y-auto"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.3 }}
        key={location.pathname}
      >
        {children}
      </motion.main>

      {/* Bottom Navigation with safe-area padding */}
      {showNav && (
        <nav 
          className="grid grid-cols-5 gap-1 border-t border-border bg-card shrink-0"
          style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center justify-center py-2 transition-colors select-none active:bg-muted rounded-sm ${
                  isActive
                    ? 'text-accent'
                    : 'text-secondary hover:text-foreground'
                }`}
                style={{ minHeight: '44px' }}
                title={item.label}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs mt-0.5">{item.label}</span>
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}