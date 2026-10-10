import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapboxOverlay } from "@deck.gl/mapbox";
import type { PickingInfo } from "@deck.gl/core";
import * as turf from "@turf/turf";
import type { Feature, FeatureCollection, Polygon } from "geojson";
import {
  Satellite, Moon, Sun, Pencil, Trash2, X,
  Database, SlidersHorizontal, BarChart3, List,
} from "lucide-react";

import {
  SurveyFeature, SurveyProps, REQUIRED_KEYS, ColorMode, ToolMode, SpatialStats,
} from "./types";
import { normalizeFeatures, dedupeByBuffer, computeStats, toBool, countByGovernorate } from "./lib/geo";
import { buildGovLayer } from "./lib/govLayer";
import { GOVERNORATES } from "./data/governorates";
import { LayersPanel, type LayerKey, type GovStats } from "./components/LayersPanel";
import { loadFiles, parsePastedGeoJSON, toCSV, downloadBlob } from "./lib/loaders";
import { buildShapefileZip } from "./lib/shpwrite";
import { buildPointLayers } from "./lib/pointsLayers";
import { BRAND } from "./lib/colors";
import { DataTab } from "./components/DataTab";
import { CleanTab } from "./components/CleanTab";
import { StatsTab } from "./components/StatsTab";
import { ListTab } from "./components/ListTab";
import { GeoTechMark } from "./components/GeoTechMark";
import { ToggleSwitch } from "./components/ToggleSwitch";

const SRC_DRAW = "draw-preview-src";
const LYR_DRAW_LINE = "draw-preview-line";
const LYR_DRAW_FILL = "draw-preview-fill";
const LYR_DRAW_PTS = "draw-preview-pts";
const SRC_HULL = "hull-src";
const LYR_HULL = "hull-layer";
const SRC_TOOL = "tool-line-src";
const LYR_TOOL = "tool-line-layer";

const STYLE_DARK = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const STYLE_LIGHT = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
const STYLE_SAT: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    sat: {
      type: "raster",
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "Esri World Imagery",
    },
  },
  layers: [{ id: "sat", type: "raster", source: "sat" }],
};

const fmt = (v: unknown) =>
  v === null || v === undefined || v === "" || (typeof v === "number" && !isFinite(v)) ? "—" : v === true ? "✔" : v === false ? "✘" : String(v);

const emptyFC = (): FeatureCollection => ({ type: "FeatureCollection", features: [] });

export default function App() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);

  const [theme, setTheme] = useState<"dark" | "light">(() => (localStorage.getItem("survey_theme") as "dark" | "light") || "dark");
  const [satOn, setSatOn] = useState<boolean>(() => localStorage.getItem("survey_sat") !== "0"); // الافتراضي: صورة القمر الصناعي
  const [activeTab, setActiveTab] = useState<"data" | "clean" | "stats" | "list">("data");
  const [colorMode, setColorMode] = useState<ColorMode>("code");

  const [allFeatures, setAllFeatures] = useState<SurveyFeature[]>([]);
  const [workingFeatures, setWorkingFeatures] = useState<SurveyFeature[]>([]);
  const [dedupApplied, setDedupApplied] = useState(false);
  const [dedupMsg, setDedupMsg] = useState<React.ReactNode>(null);
  const [loadStatus, setLoadStatus] = useState<{ text: string; error?: boolean } | null>(null);

  const [bufferValue, setBufferValue] = useState(10);
  const [bufferUnit, setBufferUnit] = useState<"cm" | "m">("m");

  const [baseOnly, setBaseOnly] = useState(false);
  const [elevMin, setElevMin] = useState("");
  const [elevMax, setElevMax] = useState("");
  const [codeChecks, setCodeChecks] = useState<Record<string, boolean>>({});
  const [selectionPolygon, setSelectionPolygon] = useState<Feature<Polygon> | null>(null);

  const [mode, setMode] = useState<ToolMode>(null);
  const [polygonPts, setPolygonPts] = useState<[number, number][]>([]);
  const [dupPreview, setDupPreview] = useState<{ kept: SurveyFeature[]; removed: SurveyFeature[] } | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number; f: SurveyFeature } | null>(null);
  const hoverIdRef = useRef<string | null>(null);
  const govHoverRef = useRef<string | null>(null);

  // ----- الطبقات: الترتيب (من الأسفل للأعلى) / الإظهار / الشفافية
  const [layerOrder, setLayerOrder] = useState<LayerKey[]>(["gov", "points"]);
  const [layerVis, setLayerVis] = useState<Record<LayerKey, boolean>>({ gov: true, points: true });
  const [layerOpacity, setLayerOpacity] = useState<Record<LayerKey, number>>({ gov: 30, points: 100 });
  const [govStatsOpen, setGovStatsOpen] = useState(false);
  const [govStats, setGovStats] = useState<GovStats | null>(null);
  const [govBusy, setGovBusy] = useState(false);
  const [govHover, setGovHover] = useState<{ x: number; y: number; i: number } | null>(null);
  const govAreas = useMemo(() => GOVERNORATES.features.map((g) => turf.area(g as any) / 1e6), []);
  const govNames = useMemo(() => GOVERNORATES.features.map((g) => g.properties.name_ar), []);
  const [pinned, setPinned] = useState<{ x: number; y: number; f: SurveyFeature } | null>(null);
  const [toolResult, setToolResult] = useState<React.ReactNode>(null);

  const [stats, setStats] = useState<SpatialStats | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [editing, setEditing] = useState<SurveyFeature | null>(null);
  const [editDraft, setEditDraft] = useState<SurveyProps | null>(null);

  // refs تحمل آخر قيمة للحالة، لأن مستمعي أحداث الخريطة/deck.gl يُسجَّلون مرة واحدة فقط
  const modeRef = useRef<ToolMode>(null);
  const visibleRef = useRef<SurveyFeature[]>([]);
  const distancePtsRef = useRef<SurveyFeature[]>([]);
  const polygonPtsRef = useRef<[number, number][]>([]);
  const syncAllRef = useRef<() => void>(() => {});
  const styleKeyRef = useRef<string>("");

  // ---------------------------------------------------------------- derived
  const uniqueCodes = useMemo(() => [...new Set(workingFeatures.map((f) => String(f.properties.Code_Num)))].sort(), [workingFeatures]);

  const visibleFeatures = useMemo(() => {
    let feats = workingFeatures;
    if (baseOnly) feats = feats.filter((f) => f.properties.IsBase);
    const eMin = parseFloat(elevMin), eMax = parseFloat(elevMax);
    if (!isNaN(eMin)) feats = feats.filter((f) => f.properties.Elev === null || f.properties.Elev! >= eMin);
    if (!isNaN(eMax)) feats = feats.filter((f) => f.properties.Elev === null || f.properties.Elev! <= eMax);
    if (Object.keys(codeChecks).length) feats = feats.filter((f) => codeChecks[String(f.properties.Code_Num)] !== false);
    if (selectionPolygon) feats = feats.filter((f) => turf.booleanPointInPolygon(f, selectionPolygon));
    return feats;
  }, [workingFeatures, baseOnly, elevMin, elevMax, codeChecks, selectionPolygon]);

  // ---------------------------------------------------------------- map init
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    const initKey = satOn ? "sat" : theme;
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: initKey === "sat" ? STYLE_SAT : initKey === "dark" ? STYLE_DARK : STYLE_LIGHT,
      center: [30.84, 29.31], // الفيوم كموقع افتراضي
      zoom: 9,
      attributionControl: {},
    });
    mapRef.current = map;
    styleKeyRef.current = initKey;
    map.once("load", () => map.resize()); // يضمن إن الخريطة ترسم بالمقاس الصح أول ما تفتح

    const overlay = new MapboxOverlay({
      interleaved: false,
      layers: [],
      getCursor: ({ isDragging, isHovering }) => (isDragging ? "grabbing" : isHovering ? "pointer" : "grab"),
    });
    overlayRef.current = overlay;
    map.addControl(overlay as any);

    map.on("error", (e) => {
      const msg = String(e.error?.message ?? "");
      console.error("Mapbox error:", msg);
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-left");
    map.on("style.load", () => addSourcesAndLayers(map));
    map.on("click", onMapClick);
    map.on("movestart", () => setPinned(null));
    map.on("dblclick", onMapDblClick);
    return () => { map.remove(); mapRef.current = null; overlayRef.current = null; }; // مهم لـ React.StrictMode
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addSourcesAndLayers(map: maplibregl.Map) {
    if (!map.getSource(SRC_DRAW)) {
      map.addSource(SRC_DRAW, { type: "geojson", data: emptyFC() });
      map.addLayer({ id: LYR_DRAW_FILL, type: "fill", source: SRC_DRAW, filter: ["==", "$type", "Polygon"], paint: { "fill-color": BRAND.orange, "fill-opacity": 0.08 } });
      map.addLayer({ id: LYR_DRAW_LINE, type: "line", source: SRC_DRAW, filter: ["==", "$type", "LineString"], paint: { "line-color": BRAND.orange, "line-width": 2, "line-dasharray": [2, 2] } });
      map.addLayer({ id: LYR_DRAW_PTS, type: "circle", source: SRC_DRAW, filter: ["==", "$type", "Point"], paint: { "circle-radius": 4, "circle-color": BRAND.orange } });
    }
    if (!map.getSource(SRC_HULL)) {
      map.addSource(SRC_HULL, { type: "geojson", data: emptyFC() });
      map.addLayer({ id: LYR_HULL, type: "line", source: SRC_HULL, paint: { "line-color": BRAND.info, "line-width": 1.5, "line-dasharray": [3, 3] } });
    }
    if (!map.getSource(SRC_TOOL)) {
      map.addSource(SRC_TOOL, { type: "geojson", data: emptyFC() });
      map.addLayer({ id: LYR_TOOL, type: "line", source: SRC_TOOL, paint: { "line-color": ["get", "color"], "line-width": 3 } });
    }
    syncAllRef.current();
  }

  // -------------------------------------------------------------- style / theme swaps (re-adds layers on style.load)
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    const key = satOn ? "sat" : theme;
    if (key !== styleKeyRef.current) {
      styleKeyRef.current = key;
      map.setStyle(key === "sat" ? STYLE_SAT : key === "dark" ? STYLE_DARK : STYLE_LIGHT);
    }
    localStorage.setItem("survey_theme", theme);
    localStorage.setItem("survey_sat", satOn ? "1" : "0");
  }, [theme, satOn]);

  // -------------------------------------------------------------- points via deck.gl (GPU، أداء عالٍ مع آلاف النقاط)
  useEffect(() => {
    const overlay = overlayRef.current; if (!overlay) return;
    const byKey: Record<LayerKey, any[]> = {
      points: buildPointLayers({ features: visibleFeatures, colorMode, onClick: onPointClick, onHover: onPointHover, duplicates: dupPreview?.removed, opacity: layerOpacity.points / 100, visible: layerVis.points }),
      gov: [buildGovLayer({ data: GOVERNORATES, opacity: layerOpacity.gov, visible: layerVis.gov, pickable: layerOrder.indexOf("gov") < layerOrder.indexOf("points"), onHover: onGovHover })],
    };
    overlay.setProps({ layers: layerOrder.flatMap((k) => byKey[k]) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleFeatures, colorMode, dupPreview, layerOrder, layerVis, layerOpacity]);

  // عدّ النقاط داخل المحافظات (يُحسب فقط عند فتح الجدول)
  useEffect(() => {
    if (!govStatsOpen && activeTab !== "stats") return;
    let cancelled = false;
    setGovBusy(true);
    const t = setTimeout(() => {
      if (cancelled) return;
      const r = countByGovernorate(visibleFeatures, GOVERNORATES);
      if (cancelled) return;
      setGovStats({ ...r, total: visibleFeatures.length });
      setGovBusy(false);
    }, 30);
    return () => { cancelled = true; clearTimeout(t); };
  }, [govStatsOpen, activeTab, visibleFeatures]);

  const syncDrawSource = useCallback(() => {
    const map = mapRef.current; if (!map || !map.getSource(SRC_DRAW)) return;
    const feats: Feature[] = polygonPts.map((c) => turf.point(c));
    if (polygonPts.length >= 2) feats.push(turf.lineString(polygonPts.length >= 3 ? [...polygonPts, polygonPts[0]] : polygonPts));
    (map.getSource(SRC_DRAW) as maplibregl.GeoJSONSource).setData(turf.featureCollection(feats));
  }, [polygonPts]);
  useEffect(syncDrawSource, [syncDrawSource]);

  const syncHullSource = useCallback(() => {
    const map = mapRef.current; if (!map || !map.getSource(SRC_HULL)) return;
    (map.getSource(SRC_HULL) as maplibregl.GeoJSONSource).setData(stats?.hullFeature ? turf.featureCollection([stats.hullFeature]) : emptyFC());
  }, [stats]);
  useEffect(syncHullSource, [syncHullSource]);
  syncAllRef.current = () => { syncDrawSource(); syncHullSource(); };
  modeRef.current = mode;
  visibleRef.current = visibleFeatures;
  polygonPtsRef.current = polygonPts;

  function setToolLine(a: [number, number] | null, b: [number, number] | null, color: string) {
    const map = mapRef.current; if (!map || !map.getSource(SRC_TOOL)) return;
    const data = a && b ? turf.featureCollection([turf.lineString([a, b], { color })]) : emptyFC();
    (map.getSource(SRC_TOOL) as maplibregl.GeoJSONSource).setData(data);
  }

  // -------------------------------------------------------------- fit bounds on new data
  function fitToData(feats: SurveyFeature[]) {
    const map = mapRef.current; if (!map || feats.length === 0) return;
    const lons = feats.map((f) => f.geometry.coordinates[0]);
    const lats = feats.map((f) => f.geometry.coordinates[1]);
    map.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], { padding: 40, duration: 500 });
  }

  // ================================================================= loading
  async function handleFiles(fileList: FileList | File[]) {
    try {
      setLoadStatus({ text: "جاري التحميل..." });
      const { geojson, sourceLabel, warning } = await loadFiles(fileList);
      ingest(geojson, sourceLabel, warning);
    } catch (e: any) {
      setLoadStatus({ text: e.message || "تعذّر تحميل الملف", error: true });
    }
  }

  function ingest(geojson: FeatureCollection | FeatureCollection[], label: string, warning?: string) {
    const raw = Array.isArray(geojson) ? geojson.flatMap((g) => g.features) : geojson.features;
    const normalized = normalizeFeatures(raw as Feature[]);
    if (normalized.length === 0) { setLoadStatus({ text: `لم يتم العثور على نقاط صالحة في: ${label}`, error: true }); return; }
    const merged = [...allFeatures, ...normalized];
    setDupPreview(null);
    setAllFeatures(merged);
    setWorkingFeatures(merged);
    setDedupApplied(false);
    setDedupMsg(null);
    setLoadStatus({ text: (warning ? warning + " — " : "") + `تم تحميل ${normalized.length} نقطة من "${label}". الإجمالي: ${merged.length}`, error: !!warning });
    setCodeChecks(Object.fromEntries([...new Set(merged.map((f) => String(f.properties.Code_Num)))].map((c) => [c, true])));
    fitToData(merged);
  }

  function onDrop(e: React.DragEvent) { e.preventDefault(); handleFiles(e.dataTransfer.files); }

  // ================================================================= dedup
  function runDedup() {
    if (allFeatures.length === 0) { setLoadStatus({ text: "حمّل بيانات أولاً.", error: true }); return; }
    const meters = bufferUnit === "cm" ? bufferValue / 100 : bufferValue;
    const { kept, removed, removedCount, removedByCode } = dedupeByBuffer(allFeatures, meters);
    setDupPreview({ kept, removed });
    setDedupMsg(
      <>
        معاينة: ستُحذف <b>{removedCount}</b> نقطة مكررة (بمسافة ≤ {meters} م) وتظهر <b style={{ color: BRAND.error }}>بالأحمر</b> على الخريطة — الباقي: {kept.length} نقطة.
        {Object.entries(removedByCode).map(([c, n]) => <div key={c}>• {c}: {n} نقطة</div>)}
      </>,
    );
  }
  function confirmDedup() {
    if (!dupPreview) return;
    const { kept, removed } = dupPreview;
    setWorkingFeatures(kept);
    setDedupApplied(true);
    setDupPreview(null);
    setCodeChecks(Object.fromEntries([...new Set(kept.map((f) => String(f.properties.Code_Num)))].map((c) => [c, true])));
    setDedupMsg(<>تم حذف <b>{removed.length}</b> نقطة مكررة — الباقي: {kept.length} نقطة.</>);
  }
  function cancelPreview() { setDupPreview(null); setDedupMsg(null); }
  function resetDedup() {
    setDupPreview(null);
    setWorkingFeatures(allFeatures);
    setDedupApplied(false);
    setDedupMsg(null);
    setCodeChecks(Object.fromEntries([...new Set(allFeatures.map((f) => String(f.properties.Code_Num)))].map((c) => [c, true])));
  }

  // ================================================================= tools: polygon / distance / nearest
  function startMode(m: ToolMode) {
    modeRef.current = m; distancePtsRef.current = []; polygonPtsRef.current = [];
    setMode(m); setPolygonPts([]); setToolResult(null);
    setToolLine(null, null, "");
    if (mapContainer.current) mapContainer.current.style.cursor = m ? "crosshair" : "";
  }

  function onMapClick(e: maplibregl.MapMouseEvent) {
    if (modeRef.current !== "polygon") return;
    const next: [number, number][] = [...polygonPtsRef.current, [e.lngLat.lng, e.lngLat.lat]];
    polygonPtsRef.current = next;
    setPolygonPts(next);
  }

  function onMapDblClick(e: maplibregl.MapMouseEvent) {
    if (modeRef.current !== "polygon") return;
    e.preventDefault();
    // النقرة المزدوجة تُطلق نقرتين عاديتين قبلها، فنزيل آخر نقطة مكررة إن وُجدت
    const pts = polygonPtsRef.current.slice();
    if (pts.length >= 2) {
      const a = pts[pts.length - 1], b = pts[pts.length - 2];
      if (a[0] === b[0] && a[1] === b[1]) pts.pop();
    }
    if (pts.length < 3) return;
    setSelectionPolygon(turf.polygon([[...pts, pts[0]]]));
    startMode(null);
  }

  function onPointClick(info: PickingInfo<SurveyFeature>) {
    const full = info.object; if (!full) return;
    const currentMode = modeRef.current;

    if (currentMode === "distance") {
      const next = [...distancePtsRef.current, full];
      distancePtsRef.current = next;
      if (next.length === 2) {
        const d = turf.distance(next[0], next[1], { units: "meters" });
        const a = next[0].geometry.coordinates as [number, number];
        const b = next[1].geometry.coordinates as [number, number];
        const result = <>المسافة بين النقطتين <b>{String(next[0].properties.PointNum)}</b> و <b>{String(next[1].properties.PointNum)}</b>: <span className="mono">{d.toFixed(3)} م</span></>;
        startMode(null);
        setToolLine(a, b, BRAND.orange);
        setToolResult(result);
      }
      return;
    }
    if (currentMode === "nearest") {
      const others = visibleRef.current.filter((o) => o.properties._id !== full.properties._id);
      if (others.length === 0) return;
      const nearest = turf.nearestPoint(full, turf.featureCollection(others));
      const d = turf.distance(full, nearest, { units: "meters" });
      const result = <>أقرب نقطة لـ <b>{String(full.properties.PointNum)}</b> هي <b>{String(nearest.properties!.PointNum)}</b> على بُعد <span className="mono">{d.toFixed(3)} م</span></>;
      startMode(null);
      setToolLine(full.geometry.coordinates as [number, number], nearest.geometry.coordinates as [number, number], BRAND.info);
      setToolResult(result);
      return;
    }

    // الوضع الافتراضي: افتح Popup لعرض/تعديل الخصائص
    pinPoint(full);
  }

  function onPointHover(info: PickingInfo<SurveyFeature>) {
    const f = info.object;
    const id = f ? f.properties._id : null;
    if (id === hoverIdRef.current) return;
    hoverIdRef.current = id;
    setHover(f ? { x: info.x, y: info.y, f } : null);
  }

  function onGovHover(info: PickingInfo) {
    const iso = info.object ? (info.object as any).properties?.iso : null;
    if (iso === govHoverRef.current) return;
    govHoverRef.current = iso ?? null;
    const i = iso ? GOVERNORATES.features.findIndex((g) => g.properties.iso === iso) : -1;
    setGovHover(i >= 0 ? { x: info.x, y: info.y, i } : null);
  }

  function flyToGov(i: number) {
    const map = mapRef.current; if (!map) return;
    const b = turf.bbox(GOVERNORATES.features[i] as any);
    map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 40, duration: 600 });
  }

  function pinPoint(f: SurveyFeature) {
    const map = mapRef.current; if (!map) return;
    const p = map.project(f.geometry.coordinates as [number, number]);
    setHover(null); hoverIdRef.current = null;
    setPinned({ x: p.x, y: p.y, f });
  }

  function place(x: number, y: number) {
    const W = mapContainer.current?.clientWidth ?? 2000, H = mapContainer.current?.clientHeight ?? 2000;
    return { left: Math.max(8, Math.min(x + 14, W - 260)), top: Math.max(8, Math.min(y + 14, H - 330)) };
  }

  // ================================================================= edit / delete
  function openEditModal(f: SurveyFeature) { setEditing(f); setEditDraft({ ...f.properties }); setPinned(null); }
  function saveEdit() {
    if (!editing || !editDraft) return;
    const id = editing.properties._id;
    const old = editing.properties;
    const d = editDraft;
    const moved = d.Lon !== old.Lon || d.Lat !== old.Lat;
    const validXY = typeof d.Lon === "number" && typeof d.Lat === "number" && isFinite(d.Lon) && isFinite(d.Lat);
    const upd = (f: SurveyFeature): SurveyFeature => {
      if (f.properties._id !== id) return f;
      return { ...f, geometry: moved && validXY ? { type: "Point", coordinates: [d.Lon as number, d.Lat as number] } : f.geometry, properties: d };
    };
    setAllFeatures((prev) => prev.map(upd));
    setWorkingFeatures((prev) => prev.map(upd));
    setDupPreview(null);
    setEditing(null); setEditDraft(null);
  }
  function deletePoint() {
    if (!editing) return;
    setAllFeatures((prev) => prev.filter((f) => f.properties._id !== editing.properties._id));
    setWorkingFeatures((prev) => prev.filter((f) => f.properties._id !== editing.properties._id));
    setDupPreview(null);
    setEditing(null); setEditDraft(null);
  }

  // ================================================================= stats
  function runStats() { setStats(computeStats(visibleFeatures)); }

  // ================================================================= export
  function exportGeoJSON() {
    if (visibleFeatures.length === 0) return;
    const clean = visibleFeatures.map((f) => ({ type: "Feature" as const, geometry: f.geometry, properties: Object.fromEntries(Object.entries(f.properties).filter(([k]) => k !== "_id")) }));
    downloadBlob(JSON.stringify({ type: "FeatureCollection", features: clean }, null, 2), "survey_points_clean.geojson", "application/geo+json");
  }
  function exportCSV() {
    if (visibleFeatures.length === 0) return;
    downloadBlob(toCSV(visibleFeatures, REQUIRED_KEYS as string[]), "survey_points_clean.csv", "text/csv;charset=utf-8");
  }

  async function exportShapefile() {
    if (visibleFeatures.length === 0) return;
    try {
      const blob = await buildShapefileZip(visibleFeatures);
      downloadBlob(blob, "survey_points_clean.zip", "application/zip");
      setLoadStatus({ text: `تم تصدير ${visibleFeatures.length} نقطة كـ Shapefile (ملف ZIP).` });
    } catch (e: any) {
      setLoadStatus({ text: "تعذّر تصدير Shapefile: " + (e?.message || e), error: true });
    }
  }

  const filteredList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return visibleFeatures.slice(0, 400);
    return visibleFeatures.filter((f) => String(f.properties.PointNum).toLowerCase().includes(q) || String(f.properties.Code_Num).toLowerCase().includes(q) || String(f.properties.JobName).toLowerCase().includes(q)).slice(0, 400);
  }, [visibleFeatures, searchQuery]);

  const TABS = [
    { key: "data", label: "البيانات", Icon: Database },
    { key: "clean", label: "التنظيف والفلاتر", Icon: SlidersHorizontal },
    { key: "stats", label: "الإحصائيات", Icon: BarChart3 },
    { key: "list", label: "القائمة", Icon: List },
  ] as const;

  // ================================================================= render
  return (
    <div dir="rtl" className="flex flex-col h-screen overflow-hidden font-body" style={{ background: "var(--bg)", color: "var(--text)" }} data-theme={theme}>
      <header className="h-16 shrink-0 flex items-center justify-between px-5 border-b" style={{ background: "var(--bg-panel)", borderColor: "var(--border)" }}>
        <div className="flex items-center gap-3">
          <GeoTechMark size={34} color={theme === "dark" ? "#F8F9FB" : "#1A1D23"} accent={BRAND.orange} />
          <div>
            <div className="font-display font-bold leading-tight text-[15px]">محلل نقاط المساحة</div>
            <div className="text-[10px] tracking-wide" style={{ color: "var(--text-faint)" }}>SURVEY POINTS ANALYZER · GEOTECH</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-medium px-3 py-1.5 rounded-full mono" style={{ background: "var(--bg-subtle)", color: "var(--text-dim)", border: "1px solid var(--border)" }}>
            {allFeatures.length === 0 ? "لا توجد بيانات" : `${visibleFeatures.length} / ${allFeatures.length} نقطة`}
          </span>
          <button
            onClick={() => setSatOn((s) => !s)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold font-display transition-all hover:opacity-85 active:scale-95"
            style={satOn ? { background: BRAND.orange, color: "#fff" } : { background: "var(--bg-subtle)", color: "var(--text)", border: "1px solid var(--border)" }}
          >
            <Satellite size={15} /> قمر صناعي
          </button>
          <ToggleSwitch
            checked={theme === "light"}
            onChange={(v) => setTheme(v ? "light" : "dark")}
            onIcon={<Sun size={12} />}
            offIcon={<Moon size={12} />}
          />
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <aside className="w-[390px] shrink-0 border-l flex flex-col min-h-0" style={{ background: "var(--bg-panel)", borderColor: "var(--border)" }}>
          <div className="flex text-[11px] shrink-0 border-b" style={{ borderColor: "var(--border)" }}>
            {TABS.map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className="flex-1 flex flex-col items-center gap-1 py-2.5 border-b-2 font-semibold font-display transition-colors"
                style={{ borderColor: activeTab === key ? BRAND.orange : "transparent", color: activeTab === key ? BRAND.orange : "var(--text-faint)" }}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 p-3.5 space-y-3">
            {activeTab === "data" && (
              <DataTab
                onDrop={onDrop}
                onPick={(files) => handleFiles(files)}
                loadStatus={loadStatus}
                onExportGeojson={exportGeoJSON}
                onExportCsv={exportCSV}
                onExportShp={exportShapefile}
                colorMode={colorMode}
                setColorMode={setColorMode}
                onPasteLoad={(text) => { try { ingest(parsePastedGeoJSON(text), "نص ملصوق"); } catch (e: any) { setLoadStatus({ text: "نص GeoJSON غير صالح: " + e.message, error: true }); } }}
              />
            )}
            {activeTab === "clean" && (
              <CleanTab
                bufferValue={bufferValue} setBufferValue={setBufferValue}
                bufferUnit={bufferUnit} setBufferUnit={setBufferUnit}
                onDedup={runDedup} previewCount={dupPreview ? dupPreview.removed.length : null} onConfirmDedup={confirmDedup} onCancelPreview={cancelPreview} dedupMsg={dedupMsg} dedupApplied={dedupApplied} onResetDedup={resetDedup}
                baseOnly={baseOnly} setBaseOnly={setBaseOnly}
                elevMin={elevMin} setElevMin={setElevMin} elevMax={elevMax} setElevMax={setElevMax}
                uniqueCodes={uniqueCodes} codeChecks={codeChecks} setCodeChecks={setCodeChecks}
                onClearFilters={() => { setBaseOnly(false); setElevMin(""); setElevMax(""); setCodeChecks(Object.fromEntries(uniqueCodes.map((c) => [c, true]))); setSelectionPolygon(null); }}
                mode={mode} startMode={startMode} onClearPolygon={() => setSelectionPolygon(null)} toolResult={toolResult}
              />
            )}
            {activeTab === "stats" && <StatsTab stats={stats} onCompute={runStats} govStats={govStats} govBusy={govBusy} names={govNames} onFly={flyToGov} />}
            {activeTab === "list" && (
              <ListTab
                query={searchQuery} setQuery={setSearchQuery} items={filteredList}
                onSelect={(f) => { const map = mapRef.current; if (!map) return; map.flyTo({ center: f.geometry.coordinates as [number, number], zoom: Math.max(map.getZoom(), 17) }); map.once("moveend", () => pinPoint(f)); }}
              />
            )}
          </div>
        </aside>

        <main className="flex-1 relative min-h-0">
          <div ref={mapContainer} className="w-full h-full" />
          <LayersPanel
            order={layerOrder} setOrder={setLayerOrder} vis={layerVis} setVis={setLayerVis} opacity={layerOpacity} setOpacity={setLayerOpacity}
            statsOpen={govStatsOpen} setStatsOpen={setGovStatsOpen} stats={govStats} busy={govBusy}
            names={govNames} areas={govAreas} onFly={flyToGov}
          />
          {govHover && !hover && !pinned && layerVis.gov && (
            <div className="absolute z-[5] pointer-events-none rounded-xl px-3 py-2 text-[11px]" dir="rtl" style={{ ...place(govHover.x, govHover.y), background: "var(--bg-panel)", color: "var(--text)", border: "1px solid var(--border)", boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}>
              <div className="font-display font-bold text-xs">{govNames[govHover.i]}</div>
              <div className="mono mt-0.5" style={{ color: "var(--text-faint)" }}>
                {govAreas[govHover.i].toFixed(0)} كم²{govStats ? ` · ${govStats.counts[govHover.i]} نقطة` : ""}
              </div>
            </div>
          )}
          {pinned && (
            <div className="absolute z-[6] rounded-xl px-3 py-2.5 text-[11px]" dir="rtl" style={{ ...place(pinned.x, pinned.y), background: "var(--bg-panel)", color: "var(--text)", border: "1px solid var(--border)", boxShadow: "0 12px 32px rgba(0,0,0,0.35)" }}>
              <button onClick={() => setPinned(null)} className="absolute top-1.5 left-1.5 w-5 h-5 rounded-md flex items-center justify-center" style={{ background: "var(--bg-subtle)" }}><X size={11} /></button>
              <table className="mt-3">
                <tbody>
                  {REQUIRED_KEYS.map((k) => (
                    <tr key={k}>
                      <td style={{ paddingLeft: 10, color: "var(--text-faint)" }}>{k}</td>
                      <td className="mono">{fmt(pinned.f.properties[k])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button onClick={() => openEditModal(pinned.f)} className="mt-2 w-full py-1.5 rounded-lg text-[11px] font-semibold font-display text-white" style={{ background: BRAND.charcoal }}>تعديل / حذف</button>
            </div>
          )}
          {hover && !pinned && (
            <div className="absolute z-[5] pointer-events-none rounded-xl px-3 py-2 text-[11px]" dir="rtl" style={{ ...place(hover.x, hover.y), background: "var(--bg-panel)", color: "var(--text)", border: "1px solid var(--border)", boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}>
              <table>
                <tbody>
                  {REQUIRED_KEYS.map((k) => {
                    const v = hover.f.properties[k];
                    return (
                      <tr key={k}>
                        <td style={{ paddingLeft: 10, color: "var(--text-faint)" }}>{k}</td>
                        <td className="mono">{fmt(v)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>

      {editing && editDraft && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[2000]" onClick={(e) => e.target === e.currentTarget && setEditing(null)}>
          <div className="rounded-2xl p-5 w-[360px] max-h-[80vh] overflow-y-auto border" style={{ background: "var(--bg-panel)", borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between mb-4">
              <div className="font-display font-bold text-sm">تعديل خصائص النقطة</div>
              <button onClick={() => setEditing(null)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "var(--bg-subtle)" }}><X size={14} /></button>
            </div>
            <div className="space-y-2.5">
              {REQUIRED_KEYS.map((k) => (
                <div key={k}>
                  <label className="text-[10px] font-medium" style={{ color: "var(--text-faint)" }}>{k}</label>
                  <input
                    className="focus-ring w-full rounded-lg px-2.5 py-2 text-xs mono"
                    style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }}
                    value={editDraft[k] === null ? "" : String(editDraft[k])}
                    onChange={(e) => {
                      let v: unknown = e.target.value;
                      if (k === "IsBase") v = toBool(v);
                      else if (["Elev", "Northing", "Easting", "Lat", "Lon"].includes(k as string)) v = v === "" ? null : Number(v);
                      setEditDraft({ ...editDraft, [k]: v } as SurveyProps);
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={saveEdit} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold font-display text-white transition-all hover:opacity-85 active:scale-95" style={{ background: BRAND.charcoal }}>
                <Pencil size={14} /> حفظ
              </button>
              <button onClick={deletePoint} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold font-display text-white transition-all hover:opacity-85 active:scale-95" style={{ background: BRAND.error }}>
                <Trash2 size={14} /> حذف النقطة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
