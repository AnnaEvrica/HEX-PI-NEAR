import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

export default function SubscriptionGate({ user, children }) {
  const { checkAuth } = useAuth();
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  const hasSubscription =
    user?.subscription_status === 'active' ||
    user?.subscription_status === 'trialing' ||
    user?.role === 'admin';

  // Handle checkout=success redirect — poll for subscription status update
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') !== 'success') return;

    setProcessing(true);
    let attempts = 0;
    const maxAttempts = 15;

    const poll = async () => {
      attempts++;
      try {
        await checkAuth();
        const me = await base44.auth.me();
        if (me?.subscription_status === 'active' || me?.subscription_status === 'trialing') {
          setProcessing(false);
          window.history.replaceState({}, '', '/app');
          return;
        }
      } catch {
        // transient — keep polling
      }
      if (attempts < maxAttempts) {
        pollRef.current = setTimeout(poll, 2000);
      } else {
        setProcessing(false);
      }
    };

    pollRef.current = setTimeout(poll, 1000);

    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (hasSubscription) return <>{children}</>;

  if (processing) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-border border-t-accent rounded-full animate-spin mb-4" />
        <p className="text-sm text-secondary">Processing your subscription...</p>
      </div>
    );
  }

  const handleCheckout = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await base44.functions.invoke('stripeCheckout', {});
      const url = response?.data?.url;
      if (url) {
        sessionStorage.setItem('hex6_checkout_pending', Date.now().toString());
        window.location.href = url;
      } else {
        setError('Could not start checkout. Please try again.');
      }
    } catch (err) {
      setError('Checkout failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setProcessing(true);
    try {
      await checkAuth();
    } catch {
      // noop
    }
    setProcessing(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-6">
      <div className="max-w-md w-full text-center space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Subscribe to Hex</h1>
        <p className="text-secondary leading-relaxed">
          Activate your subscription to access the Hex probabilistic intelligence engine.
        </p>

        <div className="p-6 border border-border bg-muted/50 text-left space-y-3">
          <ul className="text-sm text-secondary space-y-2">
            <li>• Unlimited probabilistic analysis</li>
            <li>• Real-time market intelligence</li>
            <li>• Calibration scoring</li>
            <li>• Conversation memory</li>
          </ul>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <button
          onClick={handleCheckout}
          disabled={loading}
          className="w-full px-6 py-3 bg-accent text-accent-foreground font-medium hover:bg-accent/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? 'Redirecting...' : 'Subscribe Now'}
        </button>

        <button
          onClick={handleRefresh}
          className="text-xs text-secondary hover:text-foreground transition-colors underline"
        >
          Already subscribed? Refresh
        </button>
      </div>
    </div>
  );
}