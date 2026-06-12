import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import PricingGate from './PricingGate';

export default function SubscriptionGate({ children }) {
  const [checking, setChecking] = useState(true);
  const [hasSubscription, setHasSubscription] = useState(false);
  // Capture before replaceState clears the URL
  const [fromCheckout] = useState(() => {
    const val = new URLSearchParams(window.location.search).get('checkout') === 'success';
    if (val) window.history.replaceState({}, '', window.location.pathname);
    return val;
  });

  const checkSubscription = async (retries = 5, delay = 2000) => {
    try {
      const res = await base44.functions.invoke('getSubscriptionStatus', {});
      const active = !!res?.data?.hasSubscription;
      if (active) {
        setHasSubscription(true);
        setChecking(false);
        return;
      }
      // Not active yet — retry if we have attempts left
      if (retries > 0) {
        await new Promise((r) => setTimeout(r, delay));
        return checkSubscription(retries - 1, delay);
      }
      // Exhausted retries
      setHasSubscription(false);
      setChecking(false);
    } catch (err) {
      console.error('Subscription check failed:', err);
      if (retries > 0) {
        await new Promise((r) => setTimeout(r, delay));
        return checkSubscription(retries - 1, delay);
      }
      setHasSubscription(false);
      setChecking(false);
    }
  };

  useEffect(() => {
    if (fromCheckout) {
      // Wait 4s for webhook to land, then poll aggressively
      setTimeout(() => checkSubscription(8, 3000), 4000);
    } else {
      // Normal load — still give a few retries in case of brief latency
      checkSubscription(3, 2000);
    }
  }, []);

  if (checking) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background flex-col gap-4">
        <div className="w-8 h-8 border-4 border-border border-t-accent rounded-full animate-spin" />
        {fromCheckout && <p className="text-sm text-secondary animate-pulse">Activating your subscription…</p>}
      </div>
    );
  }

  if (!hasSubscription) {
    return <PricingGate />;
  }

  return children;
}