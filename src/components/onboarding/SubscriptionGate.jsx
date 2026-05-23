import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import PricingGate from './PricingGate';

export default function SubscriptionGate({ children }) {
  const [checking, setChecking] = useState(true);
  const [hasSubscription, setHasSubscription] = useState(false);

  const checkSubscription = async () => {
    try {
      const res = await base44.functions.invoke('getSubscriptionStatus', {});
      setHasSubscription(!!res?.data?.hasSubscription);
    } catch (err) {
      console.error('Subscription check failed:', err);
      setHasSubscription(false);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkSubscription();

    // If returning from Stripe checkout, poll briefly for webhook to land.
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === 'success') {
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts += 1;
        await checkSubscription();
        if (attempts >= 6) {
          clearInterval(poll);
          // Clean URL
          window.history.replaceState({}, '', window.location.pathname);
        }
      }, 2000);
      return () => clearInterval(poll);
    }
  }, []);

  if (checking) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-border border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (!hasSubscription) {
    return <PricingGate />;
  }

  return children;
}