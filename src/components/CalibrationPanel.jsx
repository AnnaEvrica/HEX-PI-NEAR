import { useState, useEffect } from 'react';
import { Zap } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function CalibrationPanel({ messageCount = 0 }) {
  const [metrics, setMetrics] = useState({
    behavioral: 0,
    marketSync: 0,
    loading: true,
  });

  useEffect(() => {
    const loadMetrics = async () => {
      try {
        // Behavioral Modeling: based on conversation depth
        // More messages = better understanding of user patterns
        const conversationDepth = Math.min(100, messageCount * 5);

        // Market Sync: based on HEX6Memory records showing system stability
        let marketSyncScore = 50; // baseline
        try {
          const memories = await base44.entities.HEX6Memory?.list?.();
          if (memories && memories.length > 0) {
            // Calculate based on recent Sharpe ratios and accuracy
            const recent = memories.slice(-10);
            const avgSharpe = recent.reduce((s, m) => s + (parseFloat(m.sharpe) || 0), 0) / recent.length;
            marketSyncScore = Math.min(95, Math.max(50, 50 + (avgSharpe * 10)));
          }
        } catch (err) {
          // Entity may not exist yet, keep baseline
        }

        setMetrics({
          behavioral: Math.round(conversationDepth),
          marketSync: Math.round(marketSyncScore),
          loading: false,
        });
      } catch (err) {
        setMetrics({ behavioral: 0, marketSync: 50, loading: false });
      }
    };

    loadMetrics();
    
    // Refresh metrics whenever messageCount changes or every 30 seconds
    const interval = setInterval(loadMetrics, 30000);
    return () => clearInterval(interval);
  }, [messageCount]);

  return (
    <div className="bg-muted/30 border border-border rounded-lg p-3 md:p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Zap className="w-4 h-4 text-accent" />
        <h3 className="text-xs md:text-sm font-medium">System Calibration</h3>
      </div>
      <div className="space-y-2.5">
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-secondary">Behavioral Modeling</span>
            <span className="text-foreground font-mono font-bold">{metrics.behavioral}%</span>
          </div>
          <div className="w-full h-2 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-500"
              style={{ width: `${metrics.behavioral}%` }}
            />
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-secondary">Market Sync</span>
            <span className="text-foreground font-mono font-bold">{metrics.marketSync}%</span>
          </div>
          <div className="w-full h-2 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-500"
              style={{ width: `${metrics.marketSync}%` }}
            />
          </div>
        </div>
      </div>
      <p className="text-xs text-secondary pt-1">
        {metrics.loading
          ? 'Loading system metrics...'
          : 'System learning in progress. Calibration will improve over time as you interact with the platform.'}
      </p>
    </div>
  );
}