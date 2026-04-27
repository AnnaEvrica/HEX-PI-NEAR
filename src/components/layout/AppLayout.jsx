import { Link, useLocation, Outlet } from 'react-router-dom';
import { BarChart3, Shield, BookOpen, Activity, FlaskConical, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { path: '/', label: 'Dashboard', icon: BarChart3 },
  { path: '/portfolio', label: 'Portfolio', icon: Activity },
  { path: '/backtest', label: 'Backtest', icon: FlaskConical },
  { path: '/thesis', label: 'Thesis', icon: BookOpen },
  { path: '/trading', label: 'Trading', icon: Users },
  { path: '/managers', label: 'Managers', icon: Users },
  { path: '/governance', label: 'Governance', icon: Shield },
  { path: '/legal', label: 'Legal', icon: BookOpen },
];

export default function AppLayout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Top bar */}
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold tracking-tight text-white">HEX6</span>
          <span className="text-white/20">|</span>
          <span className="text-sm text-white/50">Portfolio Governance</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#C9A84C]" />
          <span className="text-sm text-[#C9A84C] font-medium">EGTS Verified</span>
        </div>
      </header>

      {/* Nav */}
      <nav className="border-b border-white/10 px-6 flex items-center gap-8 shrink-0">
        {NAV.map(({ path, label }) => {
          const active = location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
          return (
            <Link
              key={path}
              to={path}
              className={cn(
                'py-4 text-sm font-medium border-b-2 transition-colors',
                active
                  ? 'border-[#C9A84C] text-white'
                  : 'border-transparent text-white/40 hover:text-white/70'
              )}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-4 text-center">
        <p className="text-xs text-white/30">EGTS v1.0.0 | HEX6-BLE-v5.0</p>
      </footer>
    </div>
  );
}