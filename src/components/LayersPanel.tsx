import { useState } from "react";
import { Layers, Eye, EyeOff, ChevronUp, ChevronDown, X } from "lucide-react";

export type LayerKey = "points" | "gov";
const LABELS: Record<LayerKey, string> = { points: "نقاط المساحة", gov: "محافظات مصر" };

export interface GovStats { counts: number[]; outside: number; total: number }

interface Props {
  order: LayerKey[]; setOrder: (o: LayerKey[]) => void; // الترتيب من الأسفل للأعلى
  vis: Record<LayerKey, boolean>; setVis: (v: Record<LayerKey, boolean>) => void;
  opacity: Record<LayerKey, number>; setOpacity: (v: Record<LayerKey, number>) => void;
  statsOpen: boolean; setStatsOpen: (b: boolean) => void;
  stats: GovStats | null; busy: boolean;
  names: string[]; areas: number[]; onFly: (i: number) => void;
}

const btn = { background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text-dim)" };

export function LayersPanel(p: Props) {
  const [open, setOpen] = useState(true);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="absolute z-[7] top-3 left-3 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold font-display"
        style={{ background: "var(--bg-panel)", color: "var(--text)", border: "1px solid var(--border)", boxShadow: "0 4px 14px rgba(0,0,0,0.25)" }}>
        <Layers size={14} /> الطبقات
      </button>
    );
  }

  const top = [...p.order].reverse(); // الأعلى أولًا في القائمة
  function move(key: LayerKey, dir: -1 | 1) {
    const i = p.order.indexOf(key), j = i + dir;
    if (j < 0 || j >= p.order.length) return;
    const next = p.order.slice(); [next[i], next[j]] = [next[j], next[i]];
    p.setOrder(next);
  }

  const rows = p.stats
    ? p.stats.counts.map((c, i) => ({ i, c })).filter((r) => r.c > 0).sort((a, b) => b.c - a.c)
    : [];

  return (
    <div dir="rtl" className="absolute z-[7] top-3 left-3 w-[280px] max-h-[75%] overflow-y-auto rounded-2xl p-3 text-[11px] space-y-3"
      style={{ background: "var(--bg-panel)", color: "var(--text)", border: "1px solid var(--border)", boxShadow: "0 8px 28px rgba(0,0,0,0.3)" }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-display font-bold text-xs"><Layers size={14} /> الطبقات</div>
        <button onClick={() => setOpen(false)} className="w-6 h-6 rounded-md flex items-center justify-center" style={btn}><X size={12} /></button>
      </div>

      <div className="space-y-2.5">
        {top.map((k, idx) => (
          <div key={k} className="rounded-xl p-2.5 space-y-2" style={{ background: "var(--bg-panel-2)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2">
              <button onClick={() => p.setVis({ ...p.vis, [k]: !p.vis[k] })} className="w-7 h-7 rounded-md flex items-center justify-center" style={p.vis[k] ? { background: "#FF6B00", color: "#fff" } : btn} title={p.vis[k] ? "إخفاء" : "إظهار"}>
                {p.vis[k] ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
              <span className="flex-1 font-display font-semibold text-xs">{LABELS[k]}</span>
              <button onClick={() => move(k, 1)} disabled={idx === 0} className="w-6 h-6 rounded-md flex items-center justify-center disabled:opacity-30" style={btn} title="للأعلى"><ChevronUp size={13} /></button>
              <button onClick={() => move(k, -1)} disabled={idx === top.length - 1} className="w-6 h-6 rounded-md flex items-center justify-center disabled:opacity-30" style={btn} title="للأسفل"><ChevronDown size={13} /></button>
            </div>
            <div className="flex items-center gap-2" style={{ opacity: p.vis[k] ? 1 : 0.45 }}>
              <span style={{ color: "var(--text-faint)" }}>الشفافية</span>
              <input type="range" min={0} max={100} value={p.opacity[k]} onChange={(e) => p.setOpacity({ ...p.opacity, [k]: Number(e.target.value) })} className="flex-1" style={{ accentColor: "#FF6B00" }} />
              <span className="mono w-9 text-left">{p.opacity[k]}%</span>
            </div>
          </div>
        ))}
      </div>

      <div>
        <button onClick={() => p.setStatsOpen(!p.statsOpen)} className="w-full py-2 rounded-lg text-[11px] font-semibold font-display" style={p.statsOpen ? { background: "#1A1D23", color: "#fff" } : btn}>
          {p.statsOpen ? "إخفاء عدد النقاط داخل المحافظات" : "عدد النقاط داخل كل محافظة"}
        </button>
        {p.statsOpen && (
          <div className="mt-2">
            {p.busy && <div style={{ color: "var(--text-faint)" }}>جاري الحساب...</div>}
            {!p.busy && p.stats && (
              <>
                <div className="mb-1.5 text-[10px]" style={{ color: "var(--text-faint)" }}>على النقاط الظاهرة حاليًا ({p.stats.total}) — اضغط على اسم محافظة للانتقال إليها</div>
                <table className="w-full">
                  <thead>
                    <tr style={{ color: "var(--text-faint)" }}>
                      <th className="text-right font-medium pb-1">المحافظة</th>
                      <th className="text-left font-medium pb-1">العدد</th>
                      <th className="text-left font-medium pb-1">%</th>
                      <th className="text-left font-medium pb-1">كم²</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ i, c }) => (
                      <tr key={i} onClick={() => p.onFly(i)} className="cursor-pointer hover:opacity-80">
                        <td className="py-0.5">{p.names[i]}</td>
                        <td className="mono text-left">{c}</td>
                        <td className="mono text-left">{p.stats!.total ? ((c / p.stats!.total) * 100).toFixed(1) : "0"}</td>
                        <td className="mono text-left">{p.areas[i].toFixed(0)}</td>
                      </tr>
                    ))}
                    {p.stats.outside > 0 && (
                      <tr style={{ color: "var(--text-faint)" }}>
                        <td className="py-0.5">خارج الحدود</td>
                        <td className="mono text-left">{p.stats.outside}</td>
                        <td className="mono text-left">{((p.stats.outside / p.stats.total) * 100).toFixed(1)}</td>
                        <td />
                      </tr>
                    )}
                  </tbody>
                </table>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
