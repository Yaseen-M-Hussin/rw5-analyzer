// ============================================================================
// تصدير Shapefile (نقاط) | Point Shapefile writer — بدون مكتبات تحويل خارجية
// بيطلّع ZIP فيه: .shp .shx .dbf .prj .cpg  (WGS84 + ترميز UTF-8 للعربي)
// ============================================================================
import JSZip from "jszip";
import { REQUIRED_KEYS } from "../types";
import type { SurveyFeature } from "../types";

type FieldType = "C" | "N" | "L";
interface FieldDef { name: string; type: FieldType; length: number; decimals: number }

const PRJ_WGS84 =
  'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],' +
  'PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]';

// نوع كل حقل في جدول الـ DBF (أسماء الحقول كلها <= 10 حروف فمفيش قص)
const FIELD_KIND: Record<string, { type: FieldType; decimals: number }> = {
  Code_Num: { type: "C", decimals: 0 },
  JobName: { type: "C", decimals: 0 },
  PointNum: { type: "C", decimals: 0 },
  IsBase: { type: "L", decimals: 0 },
  CoordSys: { type: "C", decimals: 0 },
  Datum: { type: "C", decimals: 0 },
  Lat: { type: "N", decimals: 10 },
  Lon: { type: "N", decimals: 10 },
  Elev: { type: "N", decimals: 4 },
  Northing: { type: "N", decimals: 4 },
  Easting: { type: "N", decimals: 4 },
};

const enc = new TextEncoder();

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function cutToBytes(s: string, maxBytes: number): Uint8Array {
  let str = s;
  let b = enc.encode(str);
  while (b.length > maxBytes && str.length > 0) { str = str.slice(0, -1); b = enc.encode(str); }
  return b;
}

function buildDbf(features: SurveyFeature[]): Uint8Array {
  const keys = REQUIRED_KEYS as string[];
  const fields: FieldDef[] = keys.map((k) => {
    const kind = FIELD_KIND[k] ?? { type: "C" as FieldType, decimals: 0 };
    let length = 20;
    if (kind.type === "L") length = 1;
    if (kind.type === "C") {
      let max = 1;
      for (const f of features) {
        const v = f.properties[k];
        const len = enc.encode(v === null || v === undefined ? "" : String(v)).length;
        if (len > max) max = len;
      }
      length = Math.min(254, max);
    }
    return { name: k, type: kind.type, length, decimals: kind.decimals };
  });

  const n = features.length;
  const headerLen = 32 + 32 * fields.length + 1;
  const recLen = 1 + fields.reduce((a, f) => a + f.length, 0);
  const out = new Uint8Array(headerLen + recLen * n + 1);
  const dv = new DataView(out.buffer);

  const now = new Date();
  out[0] = 0x03;
  out[1] = now.getFullYear() - 1900; out[2] = now.getMonth() + 1; out[3] = now.getDate();
  dv.setUint32(4, n, true);
  dv.setUint16(8, headerLen, true);
  dv.setUint16(10, recLen, true);

  fields.forEach((f, i) => {
    const o = 32 + 32 * i;
    out.set(enc.encode(f.name).slice(0, 10), o);
    out[o + 11] = f.type.charCodeAt(0);
    out[o + 16] = f.length;
    out[o + 17] = f.decimals;
  });
  out[headerLen - 1] = 0x0d;

  let p = headerLen;
  for (const feat of features) {
    out[p++] = 0x20; // سجل غير محذوف
    for (const f of fields) {
      const v = feat.properties[f.name];
      const cell = new Uint8Array(f.length).fill(0x20);
      if (f.type === "C") {
        cell.set(cutToBytes(v === null || v === undefined ? "" : String(v), f.length));
      } else if (f.type === "L") {
        cell[0] = (v === true ? "T" : "F").charCodeAt(0);
      } else {
        const num = toNum(v);
        if (num !== null) {
          const txt = num.toFixed(f.decimals).padStart(f.length, " ").slice(-f.length);
          cell.set(enc.encode(txt));
        }
      }
      out.set(cell, p);
      p += f.length;
    }
  }
  out[p] = 0x1a; // نهاية الملف
  return out;
}

function buildShpShx(features: SurveyFeature[]): { shp: Uint8Array; shx: Uint8Array } {
  const n = features.length;
  const shpLen = 100 + 28 * n;
  const shxLen = 100 + 8 * n;
  const shp = new Uint8Array(shpLen);
  const shx = new Uint8Array(shxLen);
  const a = new DataView(shp.buffer);
  const b = new DataView(shx.buffer);

  let xmin = Infinity, ymin = Infinity, xmax = -Infinity, ymax = -Infinity;
  for (const f of features) {
    const [x, y] = f.geometry.coordinates;
    if (x < xmin) xmin = x; if (x > xmax) xmax = x;
    if (y < ymin) ymin = y; if (y > ymax) ymax = y;
  }

  const header = (dv: DataView, bytes: number) => {
    dv.setInt32(0, 9994, false);
    dv.setInt32(24, bytes / 2, false);
    dv.setInt32(28, 1000, true);
    dv.setInt32(32, 1, true); // نوع الشكل: Point
    dv.setFloat64(36, xmin, true); dv.setFloat64(44, ymin, true);
    dv.setFloat64(52, xmax, true); dv.setFloat64(60, ymax, true);
  };
  header(a, shpLen);
  header(b, shxLen);

  features.forEach((f, i) => {
    const o = 100 + 28 * i;
    a.setInt32(o, i + 1, false);
    a.setInt32(o + 4, 10, false); // طول المحتوى بالـ 16-bit words
    a.setInt32(o + 8, 1, true);
    a.setFloat64(o + 12, f.geometry.coordinates[0], true);
    a.setFloat64(o + 20, f.geometry.coordinates[1], true);

    const s = 100 + 8 * i;
    b.setInt32(s, o / 2, false);
    b.setInt32(s + 4, 10, false);
  });
  return { shp, shx };
}

/** يبني ZIP جاهز للتحميل يحتوي Shapefile كامل للنقاط */
export async function buildShapefileZip(features: SurveyFeature[], baseName = "survey_points_clean"): Promise<Blob> {
  if (features.length === 0) throw new Error("مفيش نقاط للتصدير");
  const { shp, shx } = buildShpShx(features);
  const zip = new JSZip();
  zip.file(`${baseName}.shp`, shp);
  zip.file(`${baseName}.shx`, shx);
  zip.file(`${baseName}.dbf`, buildDbf(features));
  zip.file(`${baseName}.prj`, PRJ_WGS84);
  zip.file(`${baseName}.cpg`, "UTF-8");
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}
