// ============================================================================
// ألوان النقاط | Point color palette — مبنية على GeoTech Design System
// برتقالي محجوز حصريًا لنقاط القاعدة (Base)؛ باقي الطلبات (Code_Num) توزَّع
// على تدرجات منتقاة بعناية بدل الألوان العشوائية (HSL hash) لمظهر أكثر اتساقًا.
// ============================================================================
import type { SurveyProps } from "../types";
import type { ColorMode } from "../types";

export const BRAND = {
  orange: "#FF6B00",
  orangeLight: "#FF8533",
  orangeDark: "#CC5500",
  orangeTint: "#FFF4ED",
  charcoal: "#1A1D23",
  charcoalLight: "#2D3139",
  success: "#10B981",
  error: "#EF4444",
  warning: "#F59E0B",
  info: "#6366F1",
};

const CATEGORICAL_PALETTE = [
  "#6366F1", // indigo
  "#10B981", // emerald
  "#0EA5E9", // sky
  "#F59E0B", // amber
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#14B8A6", // teal
  "#64748B", // slate
  "#D946EF", // fuchsia
  "#84CC16", // lime
  "#F43F5E", // rose
  "#06B6D4", // cyan
];

function hashIndex(str: string, mod: number): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (str.charCodeAt(i) + ((hash << 5) - hash)) | 0;
  return Math.abs(hash) % mod;
}

export function paletteColorHex(code: string | number | undefined): string {
  return CATEGORICAL_PALETTE[hashIndex(String(code ?? "unknown"), CATEGORICAL_PALETTE.length)];
}

export function hexToRgba(hex: string, alpha = 255): [number, number, number, number] {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return [r, g, b, alpha];
}

/** لون النقطة حسب وضع التلوين الحالي (رقم الطلب أو نقاط القاعدة) */
export function getPointColorHex(props: SurveyProps, mode: ColorMode): string {
  if (props.IsBase) return BRAND.orange;
  if (mode === "isbase") return "#64748B"; // slate محايد لغير نقاط القاعدة في هذا الوضع
  return paletteColorHex(props.Code_Num);
}
