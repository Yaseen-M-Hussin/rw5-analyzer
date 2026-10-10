import { Search } from "lucide-react";
import type { SurveyFeature } from "../types";

interface Props {
  query: string; setQuery: (v: string) => void;
  items: SurveyFeature[];
  onSelect: (f: SurveyFeature) => void;
}

export function ListTab({ query, setQuery, items, onSelect }: Props) {
  return (
    <div className="flex flex-col h-full min-h-0 gap-2.5">
      <div className="relative">
        <input
          value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="بحث برقم النقطة / الطلب / الوظيفة..."
          className="focus-ring w-full rounded-lg pr-9 pl-3 py-2.5 text-xs"
          style={{ background: "var(--bg-panel-2)", border: "1px solid var(--border)", color: "var(--text)" }}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-faint)" }}><Search size={14} /></div>
      </div>
      <div className="space-y-1.5 overflow-y-auto">
        {items.length === 0 && <div className="text-[11px] text-center py-6" style={{ color: "var(--text-faint)" }}>لا توجد نقاط مطابقة</div>}
        {items.map((f) => (
          <div
            key={f.properties._id} onClick={() => onSelect(f)}
            className="rounded-xl px-3 py-2.5 flex items-center justify-between cursor-pointer transition-colors hover:border-[color:var(--accent,#FF6B00)]"
            style={{ background: "var(--bg-panel-2)", border: "1px solid var(--border)" }}
          >
            <div>
              <div className="font-display font-semibold text-xs">#{String(f.properties.PointNum ?? "—")} <span className="mono text-[10px] font-normal" style={{ color: "var(--text-faint)" }}>{f.properties.Code_Num}</span></div>
              <div className="text-[10px] mt-0.5" style={{ color: "var(--text-faint)" }}>{f.properties.JobName || ""} · Elev {f.properties.Elev ?? "—"}</div>
            </div>
            {f.properties.IsBase && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: "#FF6B00" }}>BASE</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
