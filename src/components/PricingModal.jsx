import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Check, Loader2 } from 'lucide-react';

export default function PricingModal({ open, onClose }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const prices = [
    {
      name: '7 Day Free Trial',
      description: 'Then $9.99 billed monthly',
      amount: '$9.99',
      period: '/month',
      priceId: 'price_1TZoLPAUnMzNlphWv2ioPGPx',
      features: [
        'Full HEX6 system access',
        'Real-time market analysis',
        'Probabilistic allocation models',
        'Conversation history',
        'Priority support',
        'Cancel anytime during trial',
      ],
      highlighted: true,
    },
  ];

  const handleCheckout = async (priceId) => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('createCheckoutSession', {
        priceId,
      });

      if (res.data?.url) {
        window.location.href = res.data.url;
      } else {
        setError('Failed to create checkout session');
      }
    } catch (err) {
      setError(err.message || 'Checkout failed');
      console.error('Checkout error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-2xl font-bold">Choose Your Plan</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-8">
          {error && (
            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-sm text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 max-w-md mx-auto gap-6">
            {prices.map((plan, idx) => (
              <div
                key={idx}
                className={`p-6 rounded-lg border transition-all ${
                  plan.highlighted
                    ? 'border-accent bg-accent/5 shadow-lg scale-105'
                    : 'border-border bg-muted/30'
                }`}
              >
                {plan.highlighted && (
                  <div className="mb-4 text-xs font-bold text-accent uppercase tracking-wide">
                    ★ Most Popular
                  </div>
                )}

                <div className="space-y-2 mb-6">
                  <h3 className="text-xl font-bold">{plan.name}</h3>
                  <p className="text-sm text-secondary">{plan.description}</p>
                </div>

                <div className="mb-6">
                  <span className="text-4xl font-bold text-accent">{plan.amount}</span>
                  <span className="text-secondary text-sm ml-2">{plan.period}</span>
                </div>

                <button
                  onClick={() => handleCheckout(plan.priceId)}
                  disabled={loading}
                  className={`w-full py-3 rounded-sm font-medium mb-6 transition-colors flex items-center justify-center gap-2 ${
                    plan.highlighted
                      ? 'bg-accent text-accent-foreground hover:bg-accent/90'
                      : 'border border-border hover:bg-muted'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Start Free Trial'
                  )}
                </button>

                <div className="space-y-3">
                  {plan.features.map((feature, i) => (
                    <div key={i} className="flex gap-3 text-sm">
                      <Check className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 p-6 bg-muted/30 border border-border rounded-sm text-sm text-secondary text-center">
            <p>All plans include a 7-day free trial. Cancel anytime, no questions asked.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border px-6 py-4 flex justify-end shrink-0">
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