// The main brand tagline — HEX-BLE⁶* : THE ROLE MODEL.
// The 6 is rendered as an exponent (the sixth degree), fused directly to the
// wordmark, with a small asterisk riding beside it as one unit.
export default function RoleModelTagline({ className = '' }) {
  return (
    <span className={`font-extrabold uppercase whitespace-nowrap tracking-[-0.02em] ${className}`}>
      <span className="text-foreground">HEX-BLE</span>
      <sup className="text-[0.55em] font-extrabold text-accent" style={{ verticalAlign: 'super', lineHeight: 0 }}>6</sup>
      <sup className="text-[0.38em] font-bold text-foreground/70" style={{ verticalAlign: 'super', lineHeight: 0 }}>*</sup>
      <span className="text-foreground/60 font-bold"> : </span>
      <span className="text-foreground">THE ROLE MODEL</span>
    </span>
  );
}