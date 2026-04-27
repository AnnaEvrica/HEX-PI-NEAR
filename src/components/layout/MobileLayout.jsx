import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';

export default function MobileLayout({ children, showHeader = true, showNav = true }) {
  const location = useLocation();
  const navigate = useNavigate();
  
  const showBack = showHeader && location.pathname !== '/app';

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


    </div>
  );
}