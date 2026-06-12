import { useEffect, useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import PricingGate from './PricingGate';

export default function SubscriptionGate({ children, fromCheckout = false }) {
  const [status, setStatus] = useState('checking');
  const resolved = useRef(false);
  const isFromCheckout = useRef(fromCheckout);

  useEffect(() => {
    const maxRetries = isFromCheckout.current ? 12 : 1;
    const delay = isFromCheckout.current ? 3000 : 0;
    const initialWait = isFromCheckout.current ? 2000 : 0;

    const poll = async (attemptsLeft) => {
      if (resolved.current) return;
      try {
        const res = await base44.functions.invoke('getSubscriptionStatus', {});
        if (res?.data?.hasSubscription) {
          resolved.current = true;
          setStatus('active');
          return;
        }
      } catch (err) {
        console.error('Subscription check error:', err);
      }

      if (attemptsLeft > 0) {
        setTimeout(() => poll(attemptsLeft - 1), delay);
      } else {
        resolved.current = true;
        setStatus('inactive');
      }
    };

    setTimeout(() => poll(maxRetries), initialWait);
  }, []);

  if (status === 'checking') {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background flex-col gap-4">
        <div className="w-8 h-8 border-4 border-border border-t-accent rounded-full animate-spin" />
        {isFromCheckout.current && (
          <p className="text-sm text-secondary animate-pulse">Activating your subscription…</p>
        )}
      </div>
    );
  }

  if (status === 'inactive') {
    return <PricingGate />;
  }

  return children;
}