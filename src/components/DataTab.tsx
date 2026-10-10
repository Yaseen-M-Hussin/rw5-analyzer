import { useRef, useState } from "react";
import { UploadCloud, Download, ChevronDown } from "lucide-react";
import type { ColorMode } from "../types";

interface Props {
  onDrop: (e: React.DragEvent) => void;
  onPick: (files: FileList) => void;
  loadStatus: { text: string; error?: boolean } | null;
  onExportGeojson: () => void;
  onExportCsv: () => void;
  onExportShp: () => void;
  colorMode: ColorMode;
  setColorMode: (m: ColorMode) => void;
  onPasteLoad: (text: string) => void;
}

const card = { background: "var(--bg-panel-2)", border: "1px solid var(--border)" };
const outlineBtn = { background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text)" };

export function DataTab({ onDrop, onPick, loadStatus, onExportGeojson, onExportCsv, onExportShp, colorMode, setColorMode, onPasteLoad }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pasteText, setPasteText] = useState("");

  return (
    <>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { setDragOver(false); onDrop(e); }}
        className="border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-colors"
        style={{ borderColor: dragOver ? "#FF6B00" : "var(--border)", background: dragOver ? "var(--accent-tint)" : "transparent" }}
      >
        <div className="w-11 h-11 mx-auto mb-2 rounded-xl flex items-center justify-center" style={{ background: "var(--bg-subtle)", color: "#FF6B00" }}>
          <UploadCloud size={20} />
        </div>
        <div className="font-display font-semibold text-sm">اسحب وأفلت ملفات هنا</div>
        <div className="text-[11px] mt-1" style={{ color: "var(--text-faint)" }}>GeoJSON · ZIP (Shapefile) · shp/dbf/prj معًا</div>
        <input ref={inputRef} type="file" multiple accept=".geojson,.json,.zip,.shp,.dbf,.prj" className="hidden" onChange={(e) => e.target.files && onPick(e.target.files)} />
      </div>

      <details className="rounded-2xl p-3.5" style={card}>
        <summary className="cursor-pointer font-display font-semibold text-xs" style={{ color: "var(--text-dim)" }}>أو الصق GeoJSON مباشرة</summary>
        <textarea rows={5} value={pasteText} onChange={(e) => setPasteText(e.target.value)} className="focus-ring w-full mt-2.5 rounded-lg p-2.5 text-xs mono" style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }} placeholder='{"type":"FeatureCollection","features":[...]}' />
        <button onClick={() => onPasteLoad(pasteText)} className="w-full mt-2.5 py-2 rounded-lg text-xs font-semibold font-display text-white transition-all hover:opacity-85 active:scale-95" style={{ background: "#1A1D23" }}>تحميل النص</button>
      </details>

      {loadStatus && <div className="text-xs leading-relaxed px-1" style={{ color: loadStatus.error ? "#EF4444" : "var(--text-dim)" }}>{loadStatus.text}</div>}

      <div className="rounded-2xl p-3.5 space-y-2.5" style={card}>
        <div className="font-display font-semibold text-xs" style={{ color: "var(--text-dim)" }}>تصدير النتيجة الحالية</div>
        <div className="flex gap-2">
          <button onClick={onExportGeojson} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold font-display transition-all hover:opacity-85 active:scale-95" style={outlineBtn}>
            <Download size={14} /> GeoJSON
          </button>
          <button onClick={onExportCsv} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold font-display transition-all hover:opacity-85 active:scale-95" style={outlineBtn}>
            <Download size={14} /> CSV
          </button>
          <button onClick={onExportShp} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold font-display transition-all hover:opacity-85 active:scale-95" style={outlineBtn}>
            <Download size={14} /> Shapefile
          </button>
        </div>
      </div>

      <div className="rounded-2xl p-3.5 space-y-2" style={card}>
        <div className="font-display font-semibold text-xs" style={{ color: "var(--text-dim)" }}>التلوين حسب</div>
        <div className="relative">
          <select value={colorMode} onChange={(e) => setColorMode(e.target.value as ColorMode)} className="focus-ring w-full appearance-none rounded-lg px-3 py-2 text-xs" style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }}>
            <option value="code">رقم الطلب (Code_Num)</option>
            <option value="isbase">نقاط القاعدة (IsBase)</option>
          </select>
          <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-faint)" }}><ChevronDown size={14} /></div>
        </div>
      </div>
    </>
  );
}
