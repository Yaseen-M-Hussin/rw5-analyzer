declare module "shpjs" {
  import type { FeatureCollection, Geometry, GeoJsonProperties } from "geojson";
  type ShpBuffer = ArrayBuffer | Buffer;
  interface ShpJS {
    (base: ShpBuffer): Promise<FeatureCollection | FeatureCollection[]>;
    parseZip(buffer: ShpBuffer): Promise<FeatureCollection | FeatureCollection[]>;
    parseShp(shp: ShpBuffer, prj?: string): Geometry[];
    parseDbf(dbf: ShpBuffer, cpg?: ShpBuffer): GeoJsonProperties[];
    combine(arr: [Geometry[], GeoJsonProperties[]]): FeatureCollection;
  }
  const shp: ShpJS;
  export default shp;
}
