import { Link, useLocation, Outlet } from 'react-router-dom';
import { BarChart3, Shield, BookOpen, Activity, FlaskConical, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { path: '/', label: 'Dashboard', icon: BarChart3 },
  { path: '/portfolio', label: 'Portfolio', icon: Activity },
  { path: '/backtest', label: 'Backtest', icon: FlaskConical },
  { path: '/managers', label: 'Managers', icon: Users },
  { path: '/governance', label: 'Governance', icon: Shield },
  { path: '/legal', label: 'Legal', icon: BookOpen },
];

export default function AppLayout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-[#080c10] text-white flex">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 border-r border-white/8 flex flex-col hidden md:flex">
        {/* Logo */}
        <div className="p-5 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold tracking-tight">HEX6</p>
              <p className="text-xs text-slate-500">Portfolio Governance</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(({ path, label, icon: Icon }) => {
            const active = location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
            return (
              <Link
                key={path}
                to={path}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                  active
                    ? 'bg-white/10 text-white'
                    : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'
                )}
              >
                <Icon className={cn('w-4 h-4', active ? 'text-emerald-400' : '')} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-white/8">
          <p className="text-xs text-slate-600 font-mono">EGTS v1.0.0</p>
          <p className="text-xs text-slate-700 font-mono">HEX6-BLE-v5.0</p>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-[#080c10]/95 backdrop-blur border-b border-white/8 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center">
            <Shield className="w-3.5 h-3.5 text-white" />
          </div>
          <p className="text-sm font-bold">HEX6</p>
        </div>
        <nav className="flex items-center gap-1">
          {NAV.map(({ path, icon: Icon }) => {
            const active = location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
            return (
              <Link
                key={path}
                to={path}
                className={cn(
                  'p-2 rounded-lg',
                  active ? 'bg-white/10 text-emerald-400' : 'text-slate-500'
                )}
              >
                <Icon className="w-4 h-4" />
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-auto md:pt-0 pt-16">
        <Outlet />
      </main>
    </div>
  );
}