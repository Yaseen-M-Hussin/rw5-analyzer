// ============================================================================
// أنواع بيانات نقاط المساحة | Survey point data types
// ============================================================================
import type { Feature, FeatureCollection, Point } from "geojson";

export interface SurveyProps {
  _id: string;
  Code_Num: string;
  JobName: string;
  PointNum: string | number;
  IsBase: boolean;
  CoordSys: string;
  Datum: string;
  Lat: number | null;
  Lon: number | null;
  Elev: number | null;
  Northing: number | null;
  Easting: number | null;
  [key: string]: unknown;
}

export type SurveyFeature = Feature<Point, SurveyProps>;
export type SurveyFC = FeatureCollection<Point, SurveyProps>;

export const REQUIRED_KEYS: (keyof SurveyProps)[] = [
  "Code_Num", "JobName", "PointNum", "IsBase", "CoordSys",
  "Datum", "Lat", "Lon", "Elev", "Northing", "Easting",
];

export interface DedupResult {
  kept: SurveyFeature[];
  removed: SurveyFeature[];
  removedCount: number;
  removedByCode: Record<string, number>;
}

export interface SpatialStats {
  n: number;
  standardDistance: number;
  nnMean: number;
  nni: number | null;
  hullArea: number | null;
  hullFeature: Feature | null;
  density: number | null;
  outliers: SurveyFeature[];
  outlierThreshold: number;
  distFromCenter: number[];
  centroid: [number, number];
}

export type ToolMode = "polygon" | "distance" | "nearest" | null;
export type ColorMode = "code" | "isbase";
