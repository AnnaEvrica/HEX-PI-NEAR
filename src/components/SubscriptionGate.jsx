// SubscriptionGate — hard paywall that blocks the chat unless the user has an active subscription or trial.
// Renders children only when subscription_status is 'trialing' or 'active'. Otherwise shows PricingModal.
import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import PricingModal from '@/components/PricingModal';
import { Lock } from 'lucide-react';

const ACTIVE_STATUSES = new Set(['trialing', 'active']);

export default function SubscriptionGate({ user, children }) {
  const [checking, setChecking] = useState(true);
  const [status, setStatus] = useState(user?.subscription_status || 'none');

  // On mount, if the user just came back from Stripe checkout, refresh user data
  // (webhook may have already updated the user). Re-poll for up to 10s.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const justCheckedOut = params.get('checkout') === 'success';

    let cancelled = false;
    const refreshUser = async () => {
      try {
        const fresh = await base44.auth.me();
        if (!cancelled) setStatus(fresh?.subscription_status || 'none');
        return fresh?.subscription_status;
      } catch {
        return null;
      }
    };

    (async () => {
      const current = await refreshUser();
      if (justCheckedOut && !ACTIVE_STATUSES.has(current)) {
        // Poll a few times — webhook usually lands within a couple seconds
        for (let i = 0; i < 5 && !cancelled; i++) {
          await new Promise((r) => setTimeout(r, 2000));
          const next = await refreshUser();
          if (ACTIVE_STATUSES.has(next)) break;
        }
        // Clean the query string
        window.history.replaceState({}, '', window.location.pathname);
      }
      if (!cancelled) setChecking(false);
    })();

    return () => { cancelled = true; };
  }, []);

  if (checking) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-border border-t-accent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (ACTIVE_STATUSES.has(status)) {
    return children;
  }

  // Paywall
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md space-y-6">
        <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto">
          <Lock className="w-8 h-8 text-accent" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Activate HEX6 BLE</h1>
          <p className="text-secondary text-sm leading-relaxed">
            Start your 7-day free trial. Full access to the probabilistic intelligence engine for $9.99/month after. Cancel anytime.
          </p>
        </div>
        <button
          onClick={() => {
            const ev = new CustomEvent('open-pricing');
            window.dispatchEvent(ev);
          }}
          className="px-6 py-3 rounded-sm bg-accent text-accent-foreground font-medium hover:bg-accent/90 transition-colors"
        >
          Start Free Trial
        </button>
        <button
          onClick={() => base44.auth.logout(window.location.origin + '/')}
          className="block mx-auto text-xs text-secondary hover:text-foreground transition-colors"
        >
          Sign out
        </button>
      </div>
      <PricingModalListener />
    </div>
  );
}

function PricingModalListener() {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('open-pricing', handler);
    return () => window.removeEventListener('open-pricing', handler);
  }, []);
  return <PricingModal open={open} onClose={() => setOpen(false)} />;
}