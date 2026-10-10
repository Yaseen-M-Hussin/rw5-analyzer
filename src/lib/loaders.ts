// ============================================================================
// تحميل الملفات | File loaders → raw GeoJSON (يُمرَّر بعدها إلى normalizeFeatures)
// ============================================================================
import shp from "shpjs";
import type { FeatureCollection } from "geojson";

export interface LoadResult {
  geojson: FeatureCollection;
  sourceLabel: string;
  warning?: string;
}

export async function loadFiles(fileList: FileList | File[]): Promise<LoadResult> {
  const files = Array.from(fileList);
  if (files.length === 0) throw new Error("لم يتم اختيار أي ملف");

  // GeoJSON/JSON مفرد
  const jsonFile = files.find((f) => /\.(geojson|json)$/i.test(f.name));
  if (jsonFile && files.length === 1) {
    const text = await jsonFile.text();
    return { geojson: JSON.parse(text), sourceLabel: jsonFile.name };
  }

  // ZIP يحتوي شيبفايل كامل
  const zipFile = files.find((f) => /\.zip$/i.test(f.name));
  if (zipFile) {
    const buf = await zipFile.arrayBuffer();
    const result = await shp(buf);
    const geojson = Array.isArray(result) ? result[0] : result;
    return { geojson, sourceLabel: zipFile.name };
  }

  // ملفات shp/dbf/prj منفصلة تم اختيارها معًا
  const shpFile = files.find((f) => /\.shp$/i.test(f.name));
  if (shpFile) {
    const dbfFile = files.find((f) => /\.dbf$/i.test(f.name));
    const prjFile = files.find((f) => /\.prj$/i.test(f.name));
    const shpBuf = await shpFile.arrayBuffer();
    const prjText = prjFile ? await prjFile.text() : undefined;
    const geoms = shp.parseShp(shpBuf, prjText);
    const props = dbfFile ? shp.parseDbf(await dbfFile.arrayBuffer()) : geoms.map(() => ({}));
    const geojson = shp.combine([geoms, props]) as FeatureCollection;
    return {
      geojson,
      sourceLabel: shpFile.name,
      warning: dbfFile ? undefined : "لم يتم إرفاق ملف .dbf — سيتم عرض النقاط بدون خصائص (Code_Num وغيره).",
    };
  }

  throw new Error("صيغة غير مدعومة. اختر GeoJSON أو ZIP (Shapefile) أو ملفات shp/dbf معًا.");
}

export function parsePastedGeoJSON(text: string): FeatureCollection {
  return JSON.parse(text);
}

export function toCSV(features: { properties: Record<string, unknown> }[], cols: string[]): string {
  const rows = features.map((f) =>
    cols.map((c) => {
      const v = f.properties[c];
      const s = v === null || v === undefined ? "" : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    }).join(","),
  );
  return "\uFEFF" + cols.join(",") + "\n" + rows.join("\n");
}

export function downloadBlob(content: string | Blob, filename: string, mime: string) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
