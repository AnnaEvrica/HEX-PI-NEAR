import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Check, Loader2, LogOut } from 'lucide-react';

export default function PricingGate() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleStartTrial = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('createCheckoutSession', {
        origin: window.location.origin,
      });
      const url = res?.data?.url;
      if (url) {
        window.location.href = url;
      } else {
        setError('Could not start checkout. Please try again.');
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      setError(err?.message || 'Could not start checkout.');
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await base44.auth.logout(window.location.origin + '/');
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-4 py-12">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-sm bg-accent/10 border border-accent/30 mx-auto w-fit">
            <span className="text-sm font-bold text-accent">HEX6 BLE</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Start your free trial</h1>
          <p className="text-secondary text-sm sm:text-base">
            7 days free. Then $9.99/month. Cancel anytime.
          </p>
        </div>

        <div className="border border-border bg-card rounded-sm p-6 space-y-5">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold">$9.99</span>
            <span className="text-secondary text-sm">/ month</span>
          </div>

          <ul className="space-y-3 text-sm">
            {[
              'Full access to HEX6 BLE Oracle',
              'Probabilistic market analysis',
              'Voice + image input',
              'Conversation history',
              'Cancel anytime — no commitment',
            ].map((feature) => (
              <li key={feature} className="flex items-start gap-2">
                <Check className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <button
            onClick={handleStartTrial}
            disabled={loading}
            className="w-full px-6 py-3 rounded-sm bg-accent text-accent-foreground font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Redirecting to checkout...
              </>
            ) : (
              'Start 7-Day Free Trial'
            )}
          </button>

          {error && (
            <p className="text-xs text-destructive text-center">{error}</p>
          )}

          <p className="text-xs text-secondary/70 text-center leading-relaxed">
            You won't be charged today. We'll email you before your trial ends.
            Payment processed securely by Stripe.
          </p>
        </div>

        <button
          onClick={handleSignOut}
          className="w-full text-xs text-secondary hover:text-foreground transition-colors flex items-center justify-center gap-2"
        >
          <LogOut className="w-3 h-3" />
          Sign out
        </button>
      </div>
    </div>
  );
}