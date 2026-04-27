import { X } from 'lucide-react';

export default function SettingsModal({
  open,
  onClose,
  modelChoice,
  onModelChange,
  traderEnabled,
  onTraderToggle,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-lg max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-bold">Settings</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-6">
          {/* Model Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium">AI Model</label>
            <div className="space-y-2">
              {[
                { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Fast, Cost-Effective)' },
                { value: 'gpt-4', label: 'GPT-4 (Advanced Analysis)' },
              ].map((option) => (
                <label key={option.value} className="flex items-center gap-3 p-3 border border-border rounded-sm hover:bg-muted cursor-pointer transition-colors">
                  <input
                    type="radio"
                    name="model"
                    value={option.value}
                    checked={modelChoice === option.value}
                    onChange={(e) => onModelChange(e.target.value)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">{option.label}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-secondary">
              Choose between a faster, cost-effective model or a more advanced one for complex analysis.
            </p>
          </div>

          {/* Trader Toggle */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Trader Mode</label>
              <button
                onClick={() => onTraderToggle(!traderEnabled)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  traderEnabled ? 'bg-accent' : 'bg-border'
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                    traderEnabled ? 'left-7' : 'left-1'
                  }`}
                />
              </button>
            </div>
            <p className="text-xs text-secondary">
              {traderEnabled
                ? "Trader features are coming soon. You'll be notified when they launch."
                : "Enable to get early access to automated trading features (coming soon)."}
              </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-sm border border-border hover:bg-muted transition-colors text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}