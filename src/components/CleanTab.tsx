import { Sparkles, SlidersHorizontal, Spline, Eraser, Ruler, Target } from "lucide-react";
import type { ToolMode } from "../types";

interface Props {
  bufferValue: number; setBufferValue: (n: number) => void;
  bufferUnit: "cm" | "m"; setBufferUnit: (u: "cm" | "m") => void;
  onDedup: () => void; dedupMsg: React.ReactNode; dedupApplied: boolean; onResetDedup: () => void;
  previewCount: number | null; onConfirmDedup: () => void; onCancelPreview: () => void;
  baseOnly: boolean; setBaseOnly: (v: boolean) => void;
  elevMin: string; setElevMin: (v: string) => void; elevMax: string; setElevMax: (v: string) => void;
  uniqueCodes: string[]; codeChecks: Record<string, boolean>; setCodeChecks: (fn: (prev: Record<string, boolean>) => Record<string, boolean>) => void;
  onClearFilters: () => void;
  mode: ToolMode; startMode: (m: ToolMode) => void; onClearPolygon: () => void;
  toolResult: React.ReactNode;
}

const card = { background: "var(--bg-panel-2)", border: "1px solid var(--border)" };
const input = { background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" };
const outlineBtn = { background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text)" };

function CustomCheckbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={() => onChange(!checked)}
      className="w-[18px] h-[18px] rounded flex items-center justify-center transition-all shrink-0 cursor-pointer"
      style={{ background: checked ? "#FF6B00" : "transparent", border: `2px solid ${checked ? "#FF6B00" : "var(--border)"}` }}
    >
      {checked && <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3}><polyline points="20 6 9 17 4 12" /></svg>}
    </div>
  );
}

export function CleanTab(p: Props) {
  return (
    <>
      <div className="rounded-2xl p-3.5 space-y-2.5" style={card}>
        <div className="flex items-center gap-2 font-display font-semibold text-xs">
          <span className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "var(--accent-tint)", color: "#FF6B00" }}><Sparkles size={13} /></span>
          إزالة التكرار الذكية (Buffer)
        </div>
        <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-faint)" }}>
          تتم المقارنة فقط بين نقاط لها نفس <span className="mono">Code_Num</span>. أي نقطتين من نفس الطلب أقرب من المسافة المحددة تُعتبر تكرارًا ويُحتفظ بأكثرها اكتمالاً.
        </p>
        <div className="flex items-center gap-2">
          <input type="number" value={p.bufferValue} min={0} step={0.5} onChange={(e) => p.setBufferValue(parseFloat(e.target.value) || 0)} className="focus-ring w-20 rounded-lg px-2.5 py-2 text-xs mono" style={input} />
          <select value={p.bufferUnit} onChange={(e) => p.setBufferUnit(e.target.value as "cm" | "m")} className="focus-ring rounded-lg px-2 py-2 text-xs" style={input}>
            <option value="cm">سم</option>
            <option value="m">متر</option>
          </select>
          <button onClick={p.onDedup} className="flex-1 py-2 rounded-lg text-xs font-semibold font-display text-white transition-all hover:opacity-90 active:scale-95" style={{ background: "#FF6B00" }}>معاينة التكرار</button>
        </div>
        {p.dedupMsg && <div className="text-[11px] leading-relaxed" style={{ color: "var(--text-faint)" }}>{p.dedupMsg}</div>}
        {p.previewCount !== null && (
          <div className="flex gap-2">
            <button onClick={p.onConfirmDedup} disabled={p.previewCount === 0} className="flex-1 py-2 rounded-lg text-xs font-semibold font-display text-white disabled:opacity-40" style={{ background: "#EF4444" }}>تأكيد حذف {p.previewCount} نقطة</button>
            <button onClick={p.onCancelPreview} className="flex-1 py-2 rounded-lg text-xs font-semibold font-display" style={outlineBtn}>إلغاء المعاينة</button>
          </div>
        )}
        {p.dedupApplied && <button onClick={p.onResetDedup} className="text-[11px] underline" style={{ color: "var(--text-faint)" }}>إلغاء التنظيف واستعادة كل النقاط</button>}
      </div>

      <div className="rounded-2xl p-3.5 space-y-3" style={card}>
        <div className="flex items-center gap-2 font-display font-semibold text-xs">
          <span className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "var(--bg-subtle)" }}><SlidersHorizontal size={13} /></span>
          الفلاتر
        </div>
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-xs" style={{ color: "var(--text-dim)" }}>إظهار نقاط القاعدة (Base) فقط</span>
          <CustomCheckbox checked={p.baseOnly} onChange={p.setBaseOnly} />
        </label>
        <div>
          <div className="text-[11px] mb-1.5 font-medium" style={{ color: "var(--text-dim)" }}>نطاق الارتفاع (م)</div>
          <div className="flex gap-2">
            <input value={p.elevMin} onChange={(e) => p.setElevMin(e.target.value)} placeholder="أدنى" className="focus-ring w-1/2 rounded-lg px-2.5 py-2 text-xs mono" style={input} />
            <input value={p.elevMax} onChange={(e) => p.setElevMax(e.target.value)} placeholder="أعلى" className="focus-ring w-1/2 rounded-lg px-2.5 py-2 text-xs mono" style={input} />
          </div>
        </div>
        <div>
          <div className="text-[11px] mb-1.5 font-medium" style={{ color: "var(--text-dim)" }}>تصفية حسب رقم الطلب (Code_Num)</div>
          <div className="max-h-32 overflow-y-auto space-y-2 rounded-lg p-2.5" style={input}>
            {p.uniqueCodes.length === 0 && <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>لا توجد بيانات بعد</span>}
            {p.uniqueCodes.map((c) => (
              <label key={c} className="flex items-center gap-2.5 text-[11px] cursor-pointer">
                <CustomCheckbox checked={p.codeChecks[c] !== false} onChange={(v) => p.setCodeChecks((prev) => ({ ...prev, [c]: v }))} />
                <span className="mono">{c}</span>
              </label>
            ))}
          </div>
        </div>
        <button onClick={p.onClearFilters} className="w-full py-1.5 rounded-lg text-[11px] font-medium" style={{ color: "var(--text-faint)" }}>مسح كل الفلاتر</button>
      </div>

      <div className="rounded-2xl p-3.5 space-y-2.5" style={card}>
        <div className="font-display font-semibold text-xs">أدوات مكانية على الخريطة</div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => p.startMode("polygon")} className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-semibold font-display transition-all hover:opacity-85 active:scale-95" style={p.mode === "polygon" ? { background: "#FF6B00", color: "#fff" } : outlineBtn}>
            <Spline size={13} /> رسم منطقة
          </button>
          <button onClick={p.onClearPolygon} className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-semibold font-display transition-all hover:opacity-85 active:scale-95" style={outlineBtn}>
            <Eraser size={13} /> مسح المنطقة
          </button>
          <button onClick={() => p.startMode("distance")} className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-semibold font-display transition-all hover:opacity-85 active:scale-95" style={p.mode === "distance" ? { background: "#FF6B00", color: "#fff" } : outlineBtn}>
            <Ruler size={13} /> قياس مسافة
          </button>
          <button onClick={() => p.startMode("nearest")} className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-semibold font-display transition-all hover:opacity-85 active:scale-95" style={p.mode === "nearest" ? { background: "#FF6B00", color: "#fff" } : outlineBtn}>
            <Target size={13} /> أقرب نقطة
          </button>
        </div>
        {p.mode && <div className="text-[11px] font-medium" style={{ color: "#FF6B00" }}>
          {p.mode === "polygon" && "انقر على الخريطة لإضافة رؤوس المضلع، ثم انقر نقرًا مزدوجًا للإنهاء"}
          {p.mode === "distance" && "انقر على نقطتين على الخريطة لقياس المسافة بينهما"}
          {p.mode === "nearest" && "انقر على نقطة لإيجاد أقرب نقطة أخرى لها"}
        </div>}
        {p.toolResult && <div className="text-[11px] leading-relaxed" style={{ color: "var(--text-dim)" }}>{p.toolResult}</div>}
      </div>
    </>
  );
}
