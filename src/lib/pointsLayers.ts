// طبقات النقاط عبر deck.gl — دوائر سوليد بسيطة + طبقة حمراء لمعاينة المكررات
import { ScatterplotLayer } from "@deck.gl/layers";
import type { PickingInfo } from "@deck.gl/core";
import type { SurveyFeature, ColorMode } from "../types";
import { getPointColorHex, hexToRgba } from "./colors";

export function buildPointLayers(opts: {
  features: SurveyFeature[];
  colorMode: ColorMode;
  onClick: (info: PickingInfo<SurveyFeature>) => void;
  onHover: (info: PickingInfo<SurveyFeature>) => void;
  duplicates?: SurveyFeature[];
  opacity?: number;
  visible?: boolean;
}) {
  const { features, colorMode, onClick, onHover, duplicates, opacity = 1, visible = true } = opts;

  const layers: ScatterplotLayer<SurveyFeature>[] = [
    new ScatterplotLayer<SurveyFeature>({
      id: "points",
      opacity,
      visible,
      data: features,
      pickable: true,
      autoHighlight: true,
      highlightColor: [255, 255, 255, 110],
      stroked: true,
      filled: true,
      radiusUnits: "pixels",
      lineWidthUnits: "pixels",
      getPosition: (f) => f.geometry.coordinates as [number, number],
      getRadius: (f) => (f.properties.IsBase ? 7 : 5),
      getLineWidth: 1,
      getFillColor: (f) => hexToRgba(getPointColorHex(f.properties, colorMode), 255),
      getLineColor: [255, 255, 255, 200],
      updateTriggers: { getFillColor: [colorMode] },
      onClick,
      onHover,
    }),
  ];

  if (duplicates && duplicates.length > 0) {
    layers.push(
      new ScatterplotLayer<SurveyFeature>({
        id: "dups-preview",
        data: duplicates,
        pickable: false,
        stroked: true,
        filled: true,
        radiusUnits: "pixels",
        lineWidthUnits: "pixels",
        getPosition: (f) => f.geometry.coordinates as [number, number],
        getRadius: 7,
        getLineWidth: 1.5,
        getFillColor: [239, 68, 68, 255],
        getLineColor: [255, 255, 255, 255],
      }),
    );
  }
  return layers;
}
