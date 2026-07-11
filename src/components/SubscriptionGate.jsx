import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Loader2, ArrowRight, Check, CreditCard, ArrowLeft } from 'lucide-react';

export default function SubscriptionGate({ children }) {
  const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState(null);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchStatus = async () => {
    const res = await base44.functions.invoke('getSubscriptionStatus', {});
    return res.data;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const justCheckedOut = urlParams.get('checkout') === 'success';
        if (justCheckedOut) window.history.replaceState({}, '', '/');

        let data = await fetchStatus();
        // Webhook may lag the redirect by a second or two — retry briefly on success return.
        if (justCheckedOut) {
          for (let i = 0; i < 6 && !(data && (data.status === 'trialing' || data.status === 'active')); i++) {
            await new Promise((r) => setTimeout(r, 1500));
            data = await fetchStatus();
          }
        }
        if (!cancelled) {
          setSub(data);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || 'Failed to load subscription status');
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleStartTrial = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('createCheckout', { origin: window.location.origin });
      if (res.data?.error) {
        setError(res.data.error);
        return;
      }
      if (res.data?.url) {
        window.location.href = res.data.url;
        return;
      }
      if (res.data?.already_subscribed) {
        const d = await fetchStatus();
        setSub(d);
        return;
      }
      setError('Checkout could not be started. Please try again.');
    } catch (e) {
      setError(e?.message || 'Checkout failed to start');
    } finally {
      setActionLoading(false);
    }
  };

  const handleManageBilling = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('manageBilling', { origin: window.location.origin });
      if (res.data?.error) {
        setError(res.data.error);
        return;
      }
      if (res.data?.url) {
        window.location.href = res.data.url;
      }
    } catch (e) {
      setError(e?.message || 'Billing portal unavailable');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  const isActive = sub && (sub.status === 'trialing' || sub.status === 'active');
  if (isActive) return children;

  const pricing = sub?.pricing || null;
  const priceLabel = pricing
    ? `$${pricing.amount.toFixed(2)}/${pricing.interval === 'year' ? 'yr' : 'mo'}`
    : 'billed monthly';

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full space-y-6">
        <Link to="/" className="flex items-center gap-1.5 text-sm text-secondary hover:text-foreground transition-colors w-fit">
          <ArrowLeft className="w-4 h-4" /> Back to homepage
        </Link>

        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-sm bg-accent/10 border border-accent/30">
            <span className="text-sm font-bold text-accent">7-Day Free Trial</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Unlock HEX6 BLE</h1>
          <p className="text-secondary text-sm">Start your 7-day free trial. No charge today.</p>
        </div>

        <div className="rounded-sm border border-border bg-card p-6 space-y-4">
          <ul className="space-y-3 text-sm">
            {[
              'Full access to the HEX6 probabilistic engine',
              'Real-time analysis & conversation',
              'Probabilistic outcome distributions',
              'Cancel anytime during trial — no charge',
            ].map((f, i) => (
              <li key={i} className="flex items-start gap-3">
                <Check className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <div className="border-t border-border pt-4 flex items-baseline justify-between">
            <span className="text-sm text-secondary">After trial</span>
            <span className="text-xl font-bold">{priceLabel}</span>
          </div>
        </div>

        {sub?.status === 'past_due' && (
          <p className="text-center text-xs text-destructive">Your payment is past due. Update billing to restore access.</p>
        )}

        {error && <p className="text-sm text-destructive text-center">{error}</p>}

        <button
          onClick={handleStartTrial}
          disabled={actionLoading}
          className="w-full px-6 py-3 rounded-sm bg-accent text-accent-foreground font-medium hover:bg-accent/90 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {actionLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              Start Free Trial <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        {sub && (sub.status === 'canceled' || sub.status === 'past_due' || sub.status === 'unpaid') && (
          <button
            onClick={handleManageBilling}
            disabled={actionLoading}
            className="w-full px-6 py-2 rounded-sm border border-border text-sm text-secondary hover:text-foreground hover:bg-muted transition-colors flex items-center justify-center gap-2"
          >
            <CreditCard className="w-4 h-4" /> Manage Billing
          </button>
        )}

        <p className="text-center text-xs text-secondary/70">
          A card is required to start the trial. You can cancel anytime.
        </p>
      </div>
    </div>
  );
}