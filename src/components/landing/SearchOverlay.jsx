import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Search } from 'lucide-react';

// In-page search — best-practices lightweight index over the landing sections:
// case-insensitive substring match across title + keywords, ranked by order,
// keyboard accessible (Esc closes, Enter opens first result), smooth-scrolls.
const INDEX = [
  { title: 'The Model — Hero', keywords: 'probabilistic intelligence model hero welcome evrica', target: 'top' },
  { title: 'Two Minds, One Model — HEX6-BLE & PI-US', keywords: 'mirror reason understand operators hex6 pi-us cognitive', target: 'mirror' },
  { title: 'See it live — HEX6 vs generic AI', keywords: 'comparison invitation live demo gpt generic side by side', target: 'invitation' },
  { title: 'Forefathers of Probability', keywords: 'founders thinkers pascal bayes markov history probability', target: 'founders' },
  { title: 'How It Works — The odds are in your favor', keywords: 'system comparison adaptability uncertainty regime radar chart', target: 'how-it-works' },
  { title: 'Structural Difference', keywords: 'uncertainty advantage structure prediction advisory black box', target: 'structural' },
  { title: 'Compare & Contrast', keywords: 'side by side ai quant models calibration scenarios', target: 'compare' },
  { title: 'Ready to observe — Get started', keywords: 'cta enter get started sign up observe outcomes', target: 'cta' },
];

export default function SearchOverlay({ onClose }) {
  const [q, setQ] = useState('');
  const navigate = useNavigate();

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return INDEX;
    return INDEX.filter(
      (item) =>
        item.title.toLowerCase().includes(query) ||
        item.keywords.toLowerCase().includes(query)
    );
  }, [q]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const go = (target) => {
    if (target === 'top') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      onClose();
      return;
    }
    navigate('/discover', { state: { scrollTo: target } });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 pt-20" onClick={onClose}>
      <div className="bg-card border border-border rounded-lg max-w-xl w-full flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Search className="w-5 h-5 text-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && results[0]) go(results[0].target); }}
            placeholder="Search the page…"
            className="flex-1 bg-transparent outline-none text-sm"
          />
          <button onClick={onClose} className="p-1 hover:bg-muted rounded transition-colors" style={{ minWidth: 'auto', minHeight: 'auto' }}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {results.length === 0 && (
            <p className="px-4 py-6 text-sm text-secondary text-center">No matches.</p>
          )}
          {results.map((item) => (
            <button
              key={item.target}
              onClick={() => go(item.target)}
              className="w-full text-center px-4 py-3 hover:bg-muted transition-colors border-b border-border/50 last:border-0"
              style={{ minWidth: 'auto', minHeight: 'auto' }}
            >
              <p className="text-sm font-medium">{item.title}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}