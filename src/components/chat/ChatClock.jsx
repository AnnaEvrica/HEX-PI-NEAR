import { useState, useEffect } from 'react';

// The chat header IS the clock — the user's own local date and time, ticking.
// Hex reads the same clock on the backend, so what's shown here is exactly
// what he's aware of.
export default function ChatClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const date = now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const time = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' });

  return (
    <div className="flex flex-col items-center leading-tight select-none">
      <span className="text-sm md:text-base font-semibold tracking-tight text-foreground">{time}</span>
      <span className="text-[10px] md:text-xs text-secondary font-medium tracking-[0.14em] uppercase">{date}</span>
    </div>
  );
}