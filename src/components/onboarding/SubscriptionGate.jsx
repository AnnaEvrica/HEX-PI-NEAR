import { useEffect, useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import PricingGate from './PricingGate';

const CACHE_KEY = 'hex6_sub_status';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { value, ts } = JSON.parse(raw);
    if (Date.now() - ts < CACHE_TTL) return value;
    sessionStorage.removeItem(CACHE_KEY);
  } catch {}
  return null;
}

function setCache(value) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ value, ts: Date.now() }));
  } catch {}
}

export default function SubscriptionGate({ children, fromCheckout = false }) {
  const [status, setStatus] = useState('checking');
  const resolved = useRef(false);
  const isFromCheckout = useRef(fromCheckout);

  useEffect(() => {
    // From checkout: clear cache and poll up to 40s for webhook to fire
    if (isFromCheckout.current) {
      sessionStorage.removeItem(CACHE_KEY);
    } else {
      // For normal loads, check session cache first (avoids Stripe round-trip on every page load)
      const cached = getCached();
      if (cached === true) { setStatus('active'); return; }
      if (cached === false) { setStatus('inactive'); return; }
    }

    const maxRetries = isFromCheckout.current ? 13 : 4;
    const delay = isFromCheckout.current ? 3000 : 2000;

    const poll = async (attemptsLeft) => {
      if (resolved.current) return;
      try {
        const res = await base44.functions.invoke('getSubscriptionStatus', {});
        if (res?.data?.hasSubscription) {
          resolved.current = true;
          setCache(true);
          setStatus('active');
          return;
        }
        // Got a clean "no subscription" response — don't retry, it's definitive
        if (res?.data?.hasSubscription === false && !isFromCheckout.current) {
          resolved.current = true;
          setCache(false);
          setStatus('inactive');
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

    poll(maxRetries);
  }, []);

  if (status === 'checking') {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background flex-col gap-4">
        <div className="w-8 h-8 border-4 border-border border-t-accent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground animate-pulse">
          {isFromCheckout.current ? 'Activating your subscription…' : 'Checking access…'}
        </p>
      </div>
    );
  }

  if (status === 'inactive') {
    return <PricingGate />;
  }

  return children;
}