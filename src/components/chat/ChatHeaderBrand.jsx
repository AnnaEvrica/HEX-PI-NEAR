// Chat header brand — the main tagline (HEX-BLE⁶* : THE ROLE MODEL) with the
// version right-aligned beneath. One model, one loop. Manrope, sharp tracking.
import RoleModelTagline from '@/components/branding/RoleModelTagline';

export default function ChatHeaderBrand() {
  return (
    <div className="flex flex-col items-center leading-tight select-none">
      <RoleModelTagline className="text-sm md:text-base" />
      <span className="text-[10px] md:text-xs text-secondary font-medium tracking-[0.16em] uppercase self-end">
        v6.0
      </span>
    </div>
  );
}