import { TrendingUp } from 'lucide-react';

export default function DecisionAlignment() {
  const alignment = 84;

  return (
    <div className="bg-muted/30 border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-accent" />
        <h3 className="text-sm font-medium">Decision Alignment</h3>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-secondary">Your choices vs optimal paths</span>
          <span className="text-foreground font-mono font-bold">{alignment}%</span>
        </div>
        <div className="w-full h-2 bg-border rounded-full overflow-hidden">
          <div className="h-full bg-accent" style={{ width: `${alignment}%` }} />
        </div>
      </div>
      <p className="text-xs text-secondary pt-2">
        Alignment measures how closely your decisions track the system-identified optimal probability paths.
      </p>
    </div>
  );
}