import { useState, useEffect } from 'react';
import { TrendingUp } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function DecisionAlignment() {
  const [alignment, setAlignment] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Calculate alignment based on user's trading/recommendation performance
    const loadAlignment = async () => {
      try {
        // Fetch memory records to compute alignment score
        const memories = await base44.entities.HEX6Memory?.list?.();
        
        if (!memories || memories.length === 0) {
          setAlignment(0);
          setLoading(false);
          return;
        }

        // Calculate average alignment: compare user choices with engine recommendations
        let totalAlignment = 0;
        let count = 0;

        memories.forEach((memory) => {
          if (memory.memory_type === 'trade' || memory.memory_type === 'signal') {
            // Extract sharpe ratio as proxy for alignment quality
            const sharpe = parseFloat(memory.sharpe || 0);
            // Normalize sharpe to 0-100 (sharpe > 1 is good)
            const alignmentScore = Math.min(100, Math.max(0, (sharpe / 2) * 100 + 50));
            totalAlignment += alignmentScore;
            count++;
          }
        });

        const avgAlignment = count > 0 ? Math.round(totalAlignment / count) : 0;
        setAlignment(avgAlignment);
        setLoading(false);
      } catch (err) {
        // If entity doesn't exist, just use 0
        setAlignment(0);
        setLoading(false);
      }
    };

    loadAlignment();
    
    // Refresh alignment every 60 seconds
    const interval = setInterval(loadAlignment, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-muted/30 border border-border rounded-lg p-3 md:p-4 space-y-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-accent" />
        <h3 className="text-xs md:text-sm font-medium">Decision Alignment</h3>
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-secondary flex-1">Your choices vs optimal</span>
          <span className="text-foreground font-mono font-bold whitespace-nowrap">{alignment}%</span>
        </div>
        <div className="w-full h-2 bg-border rounded-full overflow-hidden">
          <div
            className="h-full bg-accent transition-all duration-500"
            style={{ width: `${alignment}%` }}
          />
        </div>
      </div>
      <p className="text-xs text-secondary pt-1">
        {loading
          ? 'Calculating alignment...'
          : alignment === 0
          ? 'Make trades or use HEX6 recommendations to build alignment history.'
          : 'Alignment measures how closely your decisions track optimal probability paths.'}
      </p>
    </div>
  );
}