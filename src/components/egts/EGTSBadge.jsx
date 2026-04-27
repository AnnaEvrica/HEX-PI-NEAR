import { Shield, ShieldCheck, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

const variants = {
  verified: {
    icon: ShieldCheck,
    label: 'EGTS Verified',
    classes: 'bg-emerald-950/60 text-emerald-300 border-emerald-700/50',
    dot: 'bg-emerald-400',
  },
  pending: {
    icon: Shield,
    label: 'EGTS Pending',
    classes: 'bg-amber-950/60 text-amber-300 border-amber-700/50',
    dot: 'bg-amber-400',
  },
  failed: {
    icon: ShieldAlert,
    label: 'EGTS Failed',
    classes: 'bg-red-950/60 text-red-300 border-red-700/50',
    dot: 'bg-red-400',
  },
};

export default function EGTSBadge({ status = 'verified', showLabel = true, size = 'md' }) {
  const variant = variants[status] || variants.verified;
  const Icon = variant.icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-mono font-medium tracking-wide',
        sizeClasses[size],
        variant.classes
      )}
    >
      <span className={cn('rounded-full animate-pulse', variant.dot, size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2')} />
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      {showLabel && <span>{variant.label}</span>}
    </span>
  );
}