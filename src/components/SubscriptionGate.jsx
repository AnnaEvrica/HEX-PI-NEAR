import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Loader2, ArrowRight, Check, CreditCard, ArrowLeft } from 'lucide-react';

export default function SubscriptionGate({ children }) {
  const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState(null);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const fetchStatus = async () => {
    const res = await base44.functions.invoke('getSubscriptionStatus', {});
    if (res.data?.error) throw new Error(res.data.error);
    return res.data;
  };

  const AUTH_ERR = /logged in|unauthorized|401|must be authenticated|authentication required|auth required/i;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const checkoutResult = urlParams.get('checkout');
        const billingReturn = urlParams.get('billing') === 'return';
        const justCheckedOut = checkoutResult === 'success';
        if (checkoutResult === 'cancel') sessionStorage.removeItem('hex6_checkout_pending');
        if (checkoutResult || billingReturn) window.history.replaceState({}, '', '/app');

        // If a checkout was initiated in this session, the user may reload BEFORE Stripe
        // redirects back (slow connection / drop). Without this guard the paywall re-shows
        // and a second "Start Free Trial" click would mint a second checkout → double charge.
        const pendingTs = sessionStorage.getItem('hex6_checkout_pending');
        const pendingRecent = checkoutResult !== 'cancel' && pendingTs && (Date.now() - Number(pendingTs) < 10 * 60 * 1000);
        const pollForActive = justCheckedOut || billingReturn || pendingRecent;

        let data;
        let lastErr = null;
        // Retry up to 4× on auth errors — the OAuth redirect can land here before
        // the token fully propagates to the backend. Bouncing to '/' on a transient
        // 401 traps the user in a landing-page loop with no paywall (and no price).
        for (let attempt = 0; attempt < 4; attempt++) {
          try { data = await fetchStatus(); lastErr = null; break; }
          catch (e) {
            lastErr = e;
            if (AUTH_ERR.test(e?.message || '') && attempt < 3) {
              await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
              continue;
            }
            break;
          }
        }
        if (lastErr) throw lastErr;

        // Webhook may lag the redirect by a second or two — retry briefly on success return.
        if (pollForActive) {
          for (let i = 0; i < 6 && !(data && (data.status === 'trialing' || data.status === 'active')); i++) {
            await new Promise((r) => setTimeout(r, 1500));
            try { data = await fetchStatus(); } catch { /* tolerate transient failure during webhook lag */ }
          }
        }
        // Clear the pending flag once we've confirmed an active/trialing sub.
        if (data && (data.status === 'trialing' || data.status === 'active')) {
          sessionStorage.removeItem('hex6_checkout_pending');
        }
        if (!cancelled) {
          setSub(data);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          const msg = e?.message || 'Failed to load subscription status';
          // Don't redirect on auth errors — show the paywall (with price) + a
          // "Try again" button so the user can retry once the token propagates.
          // The "Back to homepage" link lets them re-login if genuinely logged out.
          setError(msg);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [retryKey]);

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
        // Mark a pending checkout so a reload during the (possibly slow) Stripe redirect
        // polls for the active sub instead of re-offering the trial button.
        sessionStorage.setItem('hex6_checkout_pending', Date.now().toString());
        window.location.href = res.data.url;
        return;
      }
      if (res.data?.requires_billing_update) {
        setSub((current) => ({ ...current, status: res.data.status, action: 'billing', access_allowed: false }));
        setError('Your subscription needs a billing update before access can resume.');
        return;
      }
      if (res.data?.already_subscribed) {
        // createCheckout self-healed the DB record; poll briefly for the
        // active/trialing status so the user lands in the app instead of the paywall.
        let d = await fetchStatus();
        for (let i = 0; i < 4 && !(d && (d.status === 'trialing' || d.status === 'active')); i++) {
          await new Promise((r) => setTimeout(r, 1500));
          try { d = await fetchStatus(); } catch { /* tolerate transient failure */ }
        }
        if (d && (d.status === 'trialing' || d.status === 'active')) {
          sessionStorage.removeItem('hex6_checkout_pending');
        }
        setSub(d);
        return;
      }
      setError('Checkout could not be started. Please try again.');
    } catch (e) {
      const msg = e?.message || 'Checkout failed to start';
      if (/logged in|unauthorized|401|must be authenticated|authentication required|auth required/i.test(msg)) {
        sessionStorage.removeItem('hex6_auth_pending');
        window.location.href = '/';
        return;
      }
      setError(msg);
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

  const isActive = sub && (sub.access_allowed === true || sub.status === 'trialing' || sub.status === 'active');
  if (isActive) return children;

  const needsBilling = sub?.action === 'billing' || ['past_due', 'unpaid', 'paused', 'incomplete'].includes(sub?.status);
  const isRestart = ['canceled', 'incomplete_expired'].includes(sub?.status);

  const pricing = sub?.pricing || null;
  const priceLabel = pricing
    ? `$${pricing.amount.toFixed(2)}/${pricing.interval === 'year' ? 'yr' : 'mo'}`
    : '$19.99/mo';

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

        {error && (
          <div className="text-center space-y-2">
            <p className="text-sm text-destructive">{error}</p>
            <button
              onClick={() => { setError(null); setLoading(true); setRetryKey(k => k + 1); }}
              className="text-sm text-accent hover:underline font-medium"
            >
              Try again
            </button>
          </div>
        )}

        <button
          onClick={needsBilling ? handleManageBilling : handleStartTrial}
          disabled={actionLoading}
          className="w-full px-6 py-3 rounded-sm bg-accent text-accent-foreground font-medium hover:bg-accent/90 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {actionLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              {needsBilling ? 'Update Billing' : isRestart ? 'Restart Subscription' : 'Start Free Trial'} <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        {sub?.status === 'canceled' && (
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