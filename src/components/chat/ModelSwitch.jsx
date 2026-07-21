import { motion } from 'framer-motion';
import { Sparkles, History } from 'lucide-react';

// Model switch — PI-US (default) vs Legacy, like switching models in
// Claude/GPT. One organism, one sequence: Legacy is the pure HEX6-BLE
// structural-probability engine; PI-US layers the intuition (coherence +
// adaptation) on top. The switch adds/removes that intuition layer.

export default function ModelSwitch({ model, onChange }) {
  const isPiUS = model === 'pi-us';
  return (
    <div className="flex items-center bg-muted/60 rounded-full p-0.5 border border-border">
      <button
        type="button"
        onClick={() => onChange('pi-us')}
        style={{ minHeight: 'auto', minWidth: 'auto' }}
        className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
        aria-pressed={isPiUS}
        title="HEX6 BLE + PI-US intuition (contextually calibrated, adapts over time)"
      >
        {isPiUS && (
          <motion.span
            layoutId="model-switch-pill"
            className="absolute inset-0 rounded-full bg-accent"
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
          />
        )}
        <Sparkles className={`w-3.5 h-3.5 relative z-10 ${isPiUS ? 'text-accent-foreground' : 'text-secondary'}`} />
        <span className={`relative z-10 ${isPiUS ? 'text-accent-foreground' : 'text-secondary'}`}>PI-US</span>
      </button>
      <button
        type="button"
        onClick={() => onChange('legacy')}
        style={{ minHeight: 'auto', minWidth: 'auto' }}
        className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
        aria-pressed={!isPiUS}
        title="HEX6 BLE Legacy — pure structural-probability engine, no intuition layer"
      >
        {!isPiUS && (
          <motion.span
            layoutId="model-switch-pill"
            className="absolute inset-0 rounded-full bg-accent"
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
          />
        )}
        <History className={`w-3.5 h-3.5 relative z-10 ${!isPiUS ? 'text-accent-foreground' : 'text-secondary'}`} />
        <span className={`relative z-10 ${!isPiUS ? 'text-accent-foreground' : 'text-secondary'}`}>Legacy</span>
      </button>
    </div>
  );
}