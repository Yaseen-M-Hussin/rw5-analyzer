// ============================================================================
// منطق التحليل المكاني | Spatial analysis core (pure functions, no React/Mapbox deps)
// ============================================================================
import * as turf from "@turf/turf";
import type { Feature, FeatureCollection } from "geojson";
import {
  SurveyFeature, SurveyProps, REQUIRED_KEYS, DedupResult, SpatialStats,
} from "../types";

let idCounter = 1;

export function toBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") return ["true", "1", "yes", "y", "base"].includes(v.trim().toLowerCase());
  return false;
}

export function completeness(props: SurveyProps): number {
  return REQUIRED_KEYS.reduce<number>((score, k) => score + (props[k] !== undefined && props[k] !== null && props[k] !== "" ? 1 : 0), 0);
}

/** يحوّل أي FeatureCollection خام (خصائص غير موحّدة) إلى SurveyFeature[] موحّدة البنية */
export function normalizeFeatures(rawFeatures: Feature[]): SurveyFeature[] {
  return rawFeatures
    .filter((f): f is Feature<any> => !!f.geometry && f.geometry.type === "Point" && Number.isFinite((f.geometry as any).coordinates?.[0]) && Number.isFinite((f.geometry as any).coordinates?.[1]))
    .map((f) => {
      const p: any = f.properties || {};
      const [lon, lat] = (f.geometry as any).coordinates;
      const props: SurveyProps = {
        _id: "_pt" + idCounter++,
        Code_Num: p.Code_Num ?? p.CODE_NUM ?? p.code_num ?? "غير محدد",
        JobName: p.JobName ?? p.JOBNAME ?? p.job_name ?? "",
        PointNum: p.PointNum ?? p.POINTNUM ?? p.point_num ?? "",
        IsBase: toBool(p.IsBase ?? p.ISBASE ?? p.is_base),
        CoordSys: p.CoordSys ?? p.COORDSYS ?? "",
        Datum: p.Datum ?? p.DATUM ?? "",
        Lat: lat,
        Lon: lon,
        Elev: (() => { const v = p.Elev ?? p.ELEV; const n = v === undefined || v === null || v === "" ? NaN : Number(v); return Number.isFinite(n) ? n : null; })(),
        Northing: p.Northing ?? p.NORTHING ?? null,
        Easting: p.Easting ?? p.EASTING ?? null,
      };
      return { type: "Feature", geometry: { type: "Point", coordinates: [lon, lat] }, properties: props } as SurveyFeature;
    });
}

/**
 * إزالة التكرار حسب Buffer (سريعة: شبكة مكانية بدل مقارنة كل نقطة بكل نقطة).
 * المقارنة فقط بين نقاط لها نفس Code_Num. تُرتَّب النقاط الأكثر اكتمالًا أولًا،
 * وأي نقطة تقع على مسافة <= bufferMeters من نقطة تم الاحتفاظ بها تُعتبر تكرارًا.
 */
export function dedupeByBuffer(features: SurveyFeature[], bufferMeters: number): DedupResult {
  const groups = new Map<string, number[]>();
  features.forEach((f, i) => {
    const k = String(f.properties.Code_Num);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(i);
  });

  const keep = new Array<boolean>(features.length).fill(true);
  const removedByCode: Record<string, number> = {};
  const R = 6371008.8, RAD = Math.PI / 180;

  groups.forEach((idxs, code) => {
    if (idxs.length < 2) return;
    const lat0 = idxs.reduce((a, i) => a + features[i].geometry.coordinates[1], 0) / idxs.length;
    const kx = R * RAD * Math.cos(lat0 * RAD), ky = R * RAD;
    const cell = Math.max(bufferMeters, 0.001);
    const order = idxs.slice().sort(
      (a, b) => completeness(features[b].properties) - completeness(features[a].properties) || a - b,
    );
    const grid = new Map<string, [number, number][]>();
    let removed = 0;
    for (const i of order) {
      const [lon, lat] = features[i].geometry.coordinates;
      const x = lon * kx, y = lat * ky;
      const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
      let dup = false;
      for (let dx = -1; dx <= 1 && !dup; dx++) {
        for (let dy = -1; dy <= 1 && !dup; dy++) {
          const bucket = grid.get((cx + dx) + "," + (cy + dy));
          if (!bucket) continue;
          for (const [bx, by] of bucket) {
            if (Math.hypot(bx - x, by - y) <= bufferMeters) { dup = true; break; }
          }
        }
      }
      if (dup) { keep[i] = false; removed++; }
      else {
        const key = cx + "," + cy;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key)!.push([x, y]);
      }
    }
    if (removed > 0) removedByCode[code] = removed;
  });

  const kept = features.filter((_, i) => keep[i]);
  const removed = features.filter((_, i) => !keep[i]);
  return { kept, removed, removedCount: removed.length, removedByCode };
}

/** إحصائيات مكانية: Standard Distance, أقرب جار, Convex Hull, الكثافة, والنقاط الشاذة */
export function computeStats(feats: SurveyFeature[]): SpatialStats | null {
  const n = feats.length;
  if (n < 3) return null;

  const lons = feats.map((f) => f.geometry.coordinates[0]);
  const lats = feats.map((f) => f.geometry.coordinates[1]);
  const meanLon = lons.reduce((a, b) => a + b, 0) / n;
  const meanLat = lats.reduce((a, b) => a + b, 0) / n;

  // إسقاط محلي مسطّح للمتر حول المركز (دقيق بما يكفي لنطاقات المساحة الصغيرة)
  const xy = feats.map((f) => {
    const [lon, lat] = f.geometry.coordinates;
    const dx = turf.distance([meanLon, meanLat], [lon, meanLat], { units: "meters" }) * (lon >= meanLon ? 1 : -1);
    const dy = turf.distance([meanLon, meanLat], [meanLon, lat], { units: "meters" }) * (lat >= meanLat ? 1 : -1);
    return [dx, dy];
  });

  const distFromCenter = xy.map(([x, y]) => Math.sqrt(x * x + y * y));
  const standardDistance = Math.sqrt(distFromCenter.reduce((a, d) => a + d * d, 0) / n);
  const meanDist = distFromCenter.reduce((a, d) => a + d, 0) / n;
  const stdOfDist = Math.sqrt(distFromCenter.reduce((a, d) => a + (d - meanDist) ** 2, 0) / n);
  const outlierThreshold = meanDist + 2 * stdOfDist;
  const outliers = feats.filter((_, i) => distFromCenter[i] > outlierThreshold);

  // متوسط أقرب جار (ترتيب حسب x ثم مسح محلي — أسرع بكثير من n²)
  const order = xy.map((_, i) => i).sort((p, q) => xy[p][0] - xy[q][0]);
  let nnSum = 0;
  for (let p = 0; p < n; p++) {
    const i = order[p];
    let best = Infinity;
    for (let q = p + 1; q < n; q++) {
      const dx = xy[order[q]][0] - xy[i][0];
      if (dx >= best) break;
      const d = Math.hypot(dx, xy[order[q]][1] - xy[i][1]);
      if (d < best) best = d;
    }
    for (let q = p - 1; q >= 0; q--) {
      const dx = xy[i][0] - xy[order[q]][0];
      if (dx >= best) break;
      const d = Math.hypot(dx, xy[order[q]][1] - xy[i][1]);
      if (d < best) best = d;
    }
    nnSum += best;
  }
  const nnMean = nnSum / n;

  let hullArea: number | null = null;
  let hullFeature: Feature | null = null;
  try {
    const hull = turf.convex(turf.featureCollection(feats));
    if (hull) { hullArea = turf.area(hull); hullFeature = hull; }
  } catch { /* not enough distinct points for a hull */ }

  const density = hullArea ? n / hullArea : null;
  const expectedNN = hullArea ? 0.5 / Math.sqrt(n / hullArea) : null;
  const nni = expectedNN ? nnMean / expectedNN : null;

  return {
    n, standardDistance, nnMean, nni, hullArea, hullFeature, density,
    outliers, outlierThreshold, distFromCenter, centroid: [meanLon, meanLat],
  };
}

/** عدد النقاط داخل كل محافظة (المحافظات لا تتداخل، فكل نقطة تُحسب مرة واحدة) */
export function countByGovernorate(features: SurveyFeature[], gov: FeatureCollection) {
  const items = gov.features.map((g) => ({ g, b: turf.bbox(g) }));
  const counts = new Array<number>(items.length).fill(0);
  let outside = 0;
  for (const f of features) {
    const [x, y] = f.geometry.coordinates;
    let hit = -1;
    for (let k = 0; k < items.length; k++) {
      const b = items[k].b;
      if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue;
      if (turf.booleanPointInPolygon([x, y], items[k].g as any)) { hit = k; break; }
    }
    if (hit >= 0) counts[hit]++; else outside++;
  }
  return { counts, outside };
}
