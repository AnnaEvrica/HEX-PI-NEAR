import { Zap } from 'lucide-react';

export default function CalibrationPanel() {
  return (
    <div className="bg-muted/30 border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Zap className="w-4 h-4 text-accent" />
        <h3 className="text-sm font-medium">System Calibration</h3>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-secondary">Behavioral Modeling</span>
          <span className="text-foreground font-mono">72%</span>
        </div>
        <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
          <div className="h-full bg-accent" style={{ width: '72%' }} />
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-secondary">Market Sync</span>
          <span className="text-foreground font-mono">58%</span>
        </div>
        <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
          <div className="h-full bg-accent" style={{ width: '58%' }} />
        </div>
      </div>
      <p className="text-xs text-secondary pt-2">
        System learning in progress. Calibration will improve over time as you interact with the platform.
      </p>
    </div>
  );
}