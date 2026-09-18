import { Settings, BookOpen, LogOut } from 'lucide-react';

// Bottom of the sidebar — line symbols only, no labels. Still fully interactive,
// each one keeps its tooltip so the meaning stays discoverable.
export default function SidebarActions({ onSettings, onLegal, onSignOut }) {
  const items = [
    { icon: Settings, label: 'Settings', onClick: onSettings },
    { icon: BookOpen, label: 'Legal', onClick: onLegal },
    { icon: LogOut, label: 'Sign Out', onClick: onSignOut },
  ];
  return (
    <div className="flex items-center justify-between gap-1 border-t border-border pt-2.5">
      {items.map(({ icon: Icon, label, onClick }) => (
        <button
          key={label}
          onClick={onClick}
          title={label}
          aria-label={label}
          className="flex items-center justify-center rounded-full p-1.5 text-secondary hover:text-foreground hover:bg-muted transition-colors"
          style={{ minWidth: '28px', minHeight: '28px' }}
        >
          <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>
      ))}
    </div>
  );
}