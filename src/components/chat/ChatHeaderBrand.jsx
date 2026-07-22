// Chat header brand — "The Model" (bold) with the version right-aligned
// beneath. Replaces the former PI-US / Legacy model toggle: one model, one
// loop (v5.5). Follows the app's Style: Manrope, sharp tracking, muted version.
export default function ChatHeaderBrand() {
  return (
    <div className="flex flex-col items-center leading-tight select-none">
      <span className="text-base md:text-lg font-bold text-foreground tracking-tight">
        The Model
      </span>
      <span className="text-[10px] md:text-xs text-secondary font-medium tracking-[0.16em] uppercase self-end">
        v5.5
      </span>
    </div>
  );
}