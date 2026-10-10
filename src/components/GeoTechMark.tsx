// شعار GeoTech — مُقتبَس من Create_GeoTech_Design_System.zip
export function GeoTechMark({ size = 32, color = "#1A1D23", accent = "#FF6B00" }: { size?: number; color?: string; accent?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <circle cx="8" cy="24" r="3.5" fill={color} />
      <circle cx="24" cy="8" r="3.5" fill={color} />
      <circle cx="40" cy="24" r="3.5" fill={color} />
      <circle cx="24" cy="40" r="3.5" fill={color} />
      <circle cx="16" cy="14" r="2.5" fill={color} opacity="0.7" />
      <circle cx="32" cy="14" r="2.5" fill={color} opacity="0.7" />
      <circle cx="32" cy="34" r="2.5" fill={color} opacity="0.7" />
      <circle cx="16" cy="34" r="2.5" fill={color} opacity="0.7" />
      <path d="M8 24 Q16 8 24 8" stroke={color} strokeWidth="1.5" fill="none" opacity="0.6" />
      <path d="M24 8 Q32 8 40 24" stroke={color} strokeWidth="1.5" fill="none" opacity="0.6" />
      <path d="M40 24 Q32 40 24 40" stroke={color} strokeWidth="1.5" fill="none" opacity="0.6" />
      <path d="M24 40 Q16 40 8 24" stroke={color} strokeWidth="1.5" fill="none" opacity="0.6" />
      <path d="M16 14 L32 14" stroke={color} strokeWidth="1.5" opacity="0.4" />
      <path d="M32 14 L32 34" stroke={color} strokeWidth="1.5" opacity="0.4" />
      <path d="M32 34 L16 34" stroke={color} strokeWidth="1.5" opacity="0.4" />
      <path d="M16 34 L16 14" stroke={color} strokeWidth="1.5" opacity="0.4" />
      <circle cx="24" cy="24" r="4" fill={accent} opacity="0.2" />
      <circle cx="24" cy="24" r="2" fill={accent} />
    </svg>
  );
}
