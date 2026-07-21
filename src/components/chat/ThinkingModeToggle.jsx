import { motion } from 'framer-motion';
import { Brain, Waves } from 'lucide-react';

// The 50/50 Thinking Mode switch — Reason (HEX6-BLE) / Understand (PI-US).
// One intelligence, two ways of thinking about the same knowledge.
export default function ThinkingModeToggle({ mode, onChange }) {
  const isReason = mode === 'reason';

  return (
    <div className="flex items-center justify-center">
      <div className="relative flex items-center bg-muted/60 rounded-full p-1 border border-border">
        {/* Sliding indicator */}
        <motion.div
          className="absolute top-1 bottom-1 rounded-full bg-accent"
          initial={false}
          animate={{ left: isReason ? '4px' : '50%', width: 'calc(50% - 4px)' }}
          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        />
        <button
          onClick={() => onChange('reason')}
          className={`relative z-10 flex items-center gap-1.5 px-3 md:px-4 py-1.5 rounded-full text-xs md:text-sm font-medium transition-colors ${
            isReason ? 'text-accent-foreground' : 'text-secondary hover:text-foreground'
          }`}
        >
          <Brain className="w-3.5 h-3.5" />
          <span>Reason</span>
        </button>
        <button
          onClick={() => onChange('understand')}
          className={`relative z-10 flex items-center gap-1.5 px-3 md:px-4 py-1.5 rounded-full text-xs md:text-sm font-medium transition-colors ${
            !isReason ? 'text-accent-foreground' : 'text-secondary hover:text-foreground'
          }`}
        >
          <Waves className="w-3.5 h-3.5" />
          <span>Understand</span>
        </button>
      </div>
    </div>
  );
}