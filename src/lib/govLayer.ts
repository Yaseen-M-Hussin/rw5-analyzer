// طبقة محافظات مصر عبر deck.gl — تعبئة شفافة (بدرجة تتحكم فيها) + حدود واضحة
import { GeoJsonLayer } from "@deck.gl/layers";
import type { PickingInfo } from "@deck.gl/core";
import type { FeatureCollection, MultiPolygon } from "geojson";
import type { GovProps } from "../data/governorates";
import { paletteColorHex, hexToRgba } from "./colors";

export function buildGovLayer(opts: {
  data: FeatureCollection<MultiPolygon, GovProps>;
  opacity: number; // 0..100
  visible: boolean;
  pickable: boolean;
  onHover: (info: PickingInfo) => void;
}) {
  const { data, opacity, visible, pickable, onHover } = opts;
  const fillA = Math.round((opacity / 100) * 255);
  const lineA = Math.round(90 + (opacity / 100) * 165);
  return new GeoJsonLayer<GovProps>({
    id: "governorates",
    data: data as any,
    visible,
    pickable,
    autoHighlight: pickable,
    highlightColor: [255, 255, 255, 40],
    filled: true,
    stroked: true,
    lineWidthUnits: "pixels",
    getLineWidth: 1.5,
    getFillColor: (f: any) => hexToRgba(paletteColorHex(f.properties.iso), fillA),
    getLineColor: [148, 163, 184, lineA],
    updateTriggers: { getFillColor: [fillA], getLineColor: [lineA] },
    onHover,
  });
}
