import { useEffect, useRef } from "react";
import Chart from "chart.js/auto";
import { BarChart3, AlertTriangle, MapPinned } from "lucide-react";
import type { SpatialStats } from "../types";
import type { GovStats } from "./LayersPanel";

const card = { background: "var(--bg-panel-2)", border: "1px solid var(--border)" };

interface Props {
  stats: SpatialStats | null;
  onCompute: () => void;
  govStats: GovStats | null;   // عدد النقاط في كل محافظة (بيتحسب أوتوماتيك لما تفتح التبويب)
  govBusy: boolean;
  names: string[];             // أسماء المحافظات بنفس ترتيب counts
  onFly: (i: number) => void;  // الانتقال للمحافظة على الخريطة
}

export function StatsTab({ stats, onCompute, govStats, govBusy, names, onFly }: Props) {
  return (
    <>
      <GovChart govStats={govStats} busy={govBusy} names={names} onFly={onFly} />

      <button onClick={onCompute} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold font-display text-white transition-all hover:opacity-85 active:scale-95" style={{ background: "#1A1D23" }}>
        <BarChart3 size={14} /> احسب الإحصائيات المكانية
      </button>

      {!stats && <div className="text-[11px] px-1" style={{ color: "var(--text-faint)" }}>تحتاج على الأقل 3 نقاط ظاهرة لحساب الإحصائيات.</div>}

      {stats && (
        <>
          <div className="rounded-2xl p-3.5 grid grid-cols-2 gap-3 text-[11px]" style={card}>
            <Stat label="عدد النقاط" value={stats.n} />
            <Stat label="Standard Distance" value={`${stats.standardDistance.toFixed(2)} م`} />
            <Stat label="متوسط أقرب جار (NN)" value={`${stats.nnMean.toFixed(2)} م`} />
            <Stat label="مؤشر NNI" value={stats.nni ? stats.nni.toFixed(2) : "—"} />
            <Stat label="مساحة Convex Hull" value={stats.hullArea ? `${stats.hullArea.toFixed(1)} م²` : "—"} />
            <Stat label="الكثافة" value={stats.density ? `${stats.density.toExponential(2)} /م²` : "—"} />
          </div>

          <div className="rounded-2xl p-3.5" style={card}>
            <div className="flex items-center gap-2 font-display font-semibold text-[11px] mb-1">
              <AlertTriangle size={13} style={{ color: "#F59E0B" }} /> النقاط الشاذة (Outliers) — {stats.outliers.length}
            </div>
            <div className="text-[10px] leading-relaxed" style={{ color: "var(--text-faint)" }}>أي نقطة تبعد عن المركز الهندسي أكثر من {stats.outlierThreshold.toFixed(1)} م (متوسط + 2 انحراف معياري)</div>
            <div className="mt-2 space-y-1 max-h-28 overflow-y-auto">
              {stats.outliers.length === 0 && <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>لا توجد نقاط شاذة</span>}
              {stats.outliers.map((f) => (
                <div key={f.properties._id} className="mono text-[11px] flex justify-between">
                  <span>#{String(f.properties.PointNum)} ({f.properties.Code_Num})</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={{ color: "var(--text-faint)" }}>{label}</div>
      <div className="font-display font-bold mono text-sm mt-0.5">{value}</div>
    </div>
  );
}

// ---------------------------------------------------------------- عدد النقاط في كل محافظة
function GovChart({ govStats, busy, names, onFly }: { govStats: GovStats | null; busy: boolean; names: string[]; onFly: (i: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);
  const flyRef = useRef(onFly);
  flyRef.current = onFly;

  // الصفوف: المحافظات اللي فيها نقاط بس، من الأكتر للأقل (+ "خارج الحدود" لو فيه)
  const rows: { label: string; count: number; govIndex: number }[] = [];
  if (govStats) {
    govStats.counts
      .map((count, i) => ({ count, i }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count)
      .forEach((r) => rows.push({ label: names[r.i], count: r.count, govIndex: r.i }));
    if (govStats.outside > 0) rows.push({ label: "خارج الحدود", count: govStats.outside, govIndex: -1 });
  }
  const key = rows.map((r) => `${r.label}:${r.count}`).join("|");

  useEffect(() => {
    chartRef.current?.destroy();
    chartRef.current = null;
    if (!canvasRef.current || rows.length === 0) return;
    const total = govStats?.total ?? 0;

    chartRef.current = new Chart(canvasRef.current, {
      type: "bar",
      data: {
        labels: rows.map((r) => `${r.label} (${r.count})`),
        datasets: [{
          data: rows.map((r) => r.count),
          backgroundColor: rows.map((r) => (r.govIndex === -1 ? "#9CA3AF" : "#FF6B00")),
          borderRadius: 4,
          barThickness: 14,
        }],
      },
      options: {
        indexAxis: "y",
        responsive: true, maintainAspectRatio: false, animation: false,
        onClick: (_e, els) => {
          if (!els.length) return;
          const r = rows[els[0].index];
          if (r && r.govIndex >= 0) flyRef.current(r.govIndex);
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => rows[items[0].dataIndex]?.label ?? "",
              label: (ctx) => {
                const c = Number(ctx.raw);
                return `${c} نقطة${total ? ` — ${((c / total) * 100).toFixed(1)}%` : ""}`;
              },
            },
          },
        },
        scales: {
          x: { beginAtZero: true, ticks: { font: { size: 9 }, precision: 0 }, grid: { color: "rgba(128,128,128,0.15)" } },
          y: { ticks: { font: { size: 10 } }, grid: { display: false } },
        },
      },
    });
    return () => { chartRef.current?.destroy(); chartRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <div className="rounded-2xl p-3.5" style={card}>
      <div className="flex items-center gap-2 font-display font-semibold text-[11px] mb-1">
        <MapPinned size={13} style={{ color: "#FF6B00" }} /> عدد النقاط في كل محافظة
      </div>
      {busy && <div className="text-[11px]" style={{ color: "var(--text-faint)" }}>جاري الحساب...</div>}
      {!busy && govStats && rows.length === 0 && (
        <div className="text-[11px]" style={{ color: "var(--text-faint)" }}>لا توجد نقاط ظاهرة داخل أي محافظة.</div>
      )}
      {!busy && !govStats && (
        <div className="text-[11px]" style={{ color: "var(--text-faint)" }}>حمّل نقاط عشان يظهر الرسم.</div>
      )}
      {rows.length > 0 && (
        <>
          <div className="text-[10px] mb-2" style={{ color: "var(--text-faint)" }}>
            على النقاط الظاهرة حاليًا ({govStats?.total}) — اضغط على أي عمود للانتقال للمحافظة
          </div>
          <div className="relative" style={{ height: Math.max(110, rows.length * 24 + 34) }}>
            <canvas ref={canvasRef} />
          </div>
        </>
      )}
    </div>
  );
}
