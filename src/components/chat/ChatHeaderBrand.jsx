// Chat header brand — HEX6-BLE [BLE: Binaureal Linguistic Engine] with the
// version right-aligned beneath. One model, one loop. Manrope, sharp tracking.
export default function ChatHeaderBrand() {
  return (
    <div className="flex flex-col items-center leading-tight select-none">
      <span className="text-base md:text-lg font-bold text-foreground tracking-tight">
        HEX6-BLE
      </span>
      <span className="text-[10px] md:text-xs text-secondary font-medium tracking-[0.16em] uppercase self-end">
        v6.0
      </span>
    </div>
  );
}