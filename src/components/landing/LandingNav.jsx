import { Search, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function LandingNav({ onSearch, onContact }) {
  return (
    <nav
      className="sticky top-0 z-50 bg-landing-bg/95 backdrop-blur-sm border-b border-landing-sheet/10"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <Link
          to="/"
          className="font-mono font-bold text-lg tracking-tight text-landing-sheet"
          style={{ minWidth: 'auto', minHeight: 'auto' }}
        >
          [HEX-BLE<sup className="text-accent text-[0.6em] relative -top-[0.5em]">6</sup>]
        </Link>
        <div className="flex items-center gap-2 sm:gap-4">
          <Link
            to="/discover"
            className="text-sm text-landing-muted hover:text-landing-sheet transition-colors px-2 py-2"
            style={{ minWidth: 'auto', minHeight: 'auto' }}
          >
            Discover
          </Link>
          <button
            onClick={onSearch}
            aria-label="Search the page"
            className="p-2 rounded-sm hover:bg-landing-sheet/10 transition-colors text-landing-muted hover:text-landing-sheet"
            style={{ minWidth: 'auto', minHeight: 'auto' }}
          >
            <Search className="w-4 h-4" />
          </button>
          <button
            onClick={onContact}
            aria-label="Contact us"
            className="p-2 rounded-sm hover:bg-landing-sheet/10 transition-colors text-landing-muted hover:text-landing-sheet"
            style={{ minWidth: 'auto', minHeight: 'auto' }}
          >
            <Mail className="w-4 h-4" />
          </button>
        </div>
      </div>
    </nav>
  );
}