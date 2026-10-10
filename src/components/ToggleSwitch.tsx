interface Props {
  checked: boolean;
  onChange: (v: boolean) => void;
  onIcon?: React.ReactNode;
  offIcon?: React.ReactNode;
}

/** مفتاح تبديل أنيق بأيقونة متحركة داخل المقبض (بدل زر الإيموجي الدائري) — مطابق لنمط "Toggle Switch" في GeoTech DS */
export function ToggleSwitch({ checked, onChange, onIcon, offIcon }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative w-[50px] h-7 rounded-full transition-colors shrink-0"
      style={{ background: checked ? "#FF6B00" : "var(--bg-subtle)", border: "1px solid var(--border)" }}
    >
      <span
        className="absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-all flex items-center justify-center"
        style={{ left: checked ? "26px" : "2px", color: checked ? "#FF6B00" : "var(--text)" }}
      >
        {checked ? onIcon : offIcon}
      </span>
    </button>
  );
}
