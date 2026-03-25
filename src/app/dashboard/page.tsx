"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { subscribeToIssues } from "@/lib/issueService";
import type { Issue } from "@/lib/issueService";
import { useAuth } from "@/lib/authContext";
import {
  CheckCircle2, Clock, RefreshCw, AlertTriangle,
  TrendingUp, TrendingDown, ArrowRight, Settings2,
  ShieldOff,
} from "lucide-react";

function tsToMs(ts: unknown): number {
  if (!ts) return 0;
  const t = ts as { seconds: number };
  return t.seconds ? t.seconds * 1000 : 0;
}

const LAO_MONTHS     = ["ມັງ","ກຸມ","ມີນ","ເມສ","ພຶດ","ມິຖ","ກລ","ສິງ","ກັນ","ຕຸລ","ພະຈ","ທັນ"];
const LAO_MONTHS_FULL= ["ມັງກອນ","ກຸມພາ","ມີນາ","ເມສາ","ພຶດສະພາ","ມິຖຸນາ","ກໍລະກົດ","ສິງຫາ","ກັນຍາ","ຕຸລາ","ພະຈິກ","ທັນວາ"];

// ── Donut SVG ─────────────────────────────────────────────────────────────────
function DonutChart({ pct, color, size = 120 }: { pct: number; color: string; size?: number }) {
  const r = (size - 20) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f1f5f9" strokeWidth="10" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="10"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.8s ease" }} />
    </svg>
  );
}

// ── Bar chart with tooltip ────────────────────────────────────────────────────
function BarChart({ data, max, colorA, colorB }:
  { data: { label: string; monthFull: string; a: number; b: number }[]; max: number; colorA: string; colorB: string }) {

  const [tooltip, setTooltip] = useState<{ x: number; y: number; d: typeof data[0] } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const H = 160; const barW = 12; const gap = 4; const colW = barW * 2 + gap + 10;
  const totalW = data.length * colW;

  return (
    <div className="relative w-full" style={{ height: H + 40 }}>
      <svg ref={svgRef} width="100%" height={H + 24} viewBox={`0 0 ${totalW} ${H + 24}`}
        preserveAspectRatio="none"
        onMouseLeave={() => setTooltip(null)}>
        {data.map((d, i) => {
          const x = i * colW + 2;
          const hA = max > 0 ? (d.a / max) * H : 0;
          const hB = max > 0 ? (d.b / max) * H : 0;
          // Hit area for hover
          const handleMove = (e: React.MouseEvent<SVGRectElement>) => {
            const rect = svgRef.current?.getBoundingClientRect();
            if (!rect) return;
            setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, d });
          };
          return (
            <g key={i}>
              <rect x={x} y={H - hA} width={barW} height={hA} rx="2" fill={colorA} opacity="0.85" />
              <rect x={x + barW + 2} y={H - hB} width={barW} height={hB} rx="2" fill={colorB} opacity="0.85" />
              <text x={x + barW + 1} y={H + 16} textAnchor="middle" fontSize="8" fill="#94a3b8">{d.label}</text>
              {/* transparent hit area */}
              <rect x={x - 2} y={0} width={colW - 2} height={H + 20} fill="transparent"
                onMouseMove={handleMove} onMouseEnter={handleMove} />
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-20 bg-slate-800 text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap"
          style={{
            left: Math.min(tooltip.x + 10, totalW - 120),
            top: Math.max(tooltip.y - 60, 0),
          }}>
          <p className="font-semibold mb-1">{tooltip.d.monthFull}</p>
          <p className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-sm bg-blue-400 inline-block"/>
            ແຈ້ງບັນຫາ: <span className="font-bold">{tooltip.d.a}</span>
          </p>
          <p className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-sm bg-emerald-400 inline-block"/>
            ແກ້ໄຂສໍາເລັດ: <span className="font-bold">{tooltip.d.b}</span>
          </p>
        </div>
      )}
    </div>
  );
}

// ── Mini line sparkline ───────────────────────────────────────────────────────
function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const W = 80; const H = 30;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * W},${H - (v / max) * H}`).join(" ");
  return (
    <svg width={W} height={H} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user, perm, loading: authLoading } = useAuth();
  const router = useRouter();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const now = new Date();
  const [selYear, setSelYear]   = useState(now.getFullYear());
  const [selMonth, setSelMonth] = useState(now.getMonth());

  // ── Permission guard ───────────────────────────────────────────────────────
  const canView = perm("page_dashboard");

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace("/login"); return; }
    if (!canView) return; // show "no permission" UI — don't redirect
    const unsub = subscribeToIssues((data) => { setIssues(data); setLoading(false); });
    return () => unsub();
  }, [authLoading, user, canView, router]);

  const years = useMemo(() => {
    const ys = new Set<number>([now.getFullYear()]);
    issues.forEach((i) => {
      const ms = tsToMs(i.reportedDate); if (ms) ys.add(new Date(ms).getFullYear());
      const ms2 = tsToMs(i.resolvedDate); if (ms2) ys.add(new Date(ms2).getFullYear());
    });
    return Array.from(ys).sort((a, b) => b - a);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issues]);

  const totals = useMemo(() => ({
    total:       issues.length,
    pending:     issues.filter((i) => i.status === "pending").length,
    in_progress: issues.filter((i) => i.status === "in_progress").length,
    done:        issues.filter((i) => i.status === "done").length,
    resolveRate: issues.length > 0 ? Math.round((issues.filter((i) => i.status === "done").length / issues.length) * 100) : 0,
  }), [issues]);

  // Monthly bars with full month name for tooltip
  const monthlyBars = useMemo(() => LAO_MONTHS.map((label, m) => ({
    label,
    monthFull: `${LAO_MONTHS_FULL[m]} ${selYear}`,
    a: issues.filter((i) => { const ms=tsToMs(i.reportedDate); return ms && new Date(ms).getFullYear()===selYear && new Date(ms).getMonth()===m; }).length,
    b: issues.filter((i) => { const ms=tsToMs(i.resolvedDate); return ms && new Date(ms).getFullYear()===selYear && new Date(ms).getMonth()===m; }).length,
  })), [issues, selYear]);

  const barMax = useMemo(() => Math.max(1, ...monthlyBars.flatMap((d) => [d.a, d.b])), [monthlyBars]);

  const sparkData = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, k) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - k), 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
    return months.map(({ y, m }) =>
      issues.filter((i) => { const ms=tsToMs(i.reportedDate); return ms && new Date(ms).getFullYear()===y && new Date(ms).getMonth()===m; }).length
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issues]);

  const monthDetail = useMemo(() => {
    const rep = issues.filter((i) => { const ms=tsToMs(i.reportedDate); return ms && new Date(ms).getFullYear()===selYear && new Date(ms).getMonth()===selMonth; });
    const res = issues.filter((i) => { const ms=tsToMs(i.resolvedDate); return ms && new Date(ms).getFullYear()===selYear && new Date(ms).getMonth()===selMonth; });
    const catMap: Record<string, { r: number; d: number }> = {};
    rep.forEach((i) => { if (!catMap[i.category]) catMap[i.category]={r:0,d:0}; catMap[i.category].r++; });
    res.forEach((i) => { if (!catMap[i.category]) catMap[i.category]={r:0,d:0}; catMap[i.category].d++; });
    return {
      reported: rep.length,
      resolved: res.length,
      rate: rep.length > 0 ? Math.round((res.length / rep.length) * 100) : 0,
      cats: Object.entries(catMap).sort((a,b) => b[1].r - a[1].r).slice(0, 6),
    };
  }, [issues, selYear, selMonth]);

  // ── No permission UI ───────────────────────────────────────────────────────
  if (!authLoading && user && !canView) {
    return (
      <div className="flex flex-col items-center justify-center h-72 text-slate-400 gap-4">
        <ShieldOff size={48} className="text-slate-300" />
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-600">ບໍ່ມີສິດເຂົ້າໜ້ານີ້</p>
          <p className="text-xs mt-1">ກະລຸນາຕິດຕໍ່ Admin ເພື່ອຂໍສິດ</p>
        </div>
      </div>
    );
  }

  if (loading || authLoading) return (
    <div className="flex items-center justify-center h-64 text-slate-400">
      <RefreshCw size={26} className="animate-spin mr-3 text-blue-500" />
      <span className="text-sm">ກໍາລັງໂຫຼດ...</span>
    </div>
  );

  return (
    <div className="space-y-4">

      {/* ── Row 1: 4 stat cards ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Issue ທັງໝົດ</p>
            <p className="text-3xl font-bold text-slate-800">{totals.total}</p>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp size={12} className="text-emerald-500" />
              <span className="text-xs text-emerald-600 font-medium">ທຸກລາຍການ</span>
            </div>
          </div>
          <div className="relative">
            <DonutChart pct={totals.resolveRate} color="#3b82f6" size={64} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold text-slate-700">{totals.resolveRate}%</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">ລໍຖ້າດໍາເນີນ</p>
            <p className="text-3xl font-bold text-amber-500">{totals.pending}</p>
            <div className="flex items-center gap-1 mt-1">
              <Clock size={12} className="text-amber-400" />
              <span className="text-xs text-amber-600 font-medium">ຮໍ້ດ່ວນ</span>
            </div>
          </div>
          <div className="relative">
            <DonutChart pct={totals.total>0?Math.round((totals.pending/totals.total)*100):0} color="#f59e0b" size={64} />
            <div className="absolute inset-0 flex items-center justify-center">
              <AlertTriangle size={14} className="text-amber-500" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">ກໍາລັງດໍາເນີນ</p>
            <p className="text-3xl font-bold text-blue-500">{totals.in_progress}</p>
            <div className="flex items-center gap-1 mt-1">
              <RefreshCw size={12} className="text-blue-400" />
              <span className="text-xs text-blue-600 font-medium">In Progress</span>
            </div>
          </div>
          <div className="relative">
            <DonutChart pct={totals.total>0?Math.round((totals.in_progress/totals.total)*100):0} color="#3b82f6" size={64} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold text-blue-500">{totals.total>0?Math.round((totals.in_progress/totals.total)*100):0}%</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">ແກ້ໄຂສໍາເລັດ</p>
            <p className="text-3xl font-bold text-emerald-500">{totals.done}</p>
            <div className="flex items-center gap-1 mt-1">
              <CheckCircle2 size={12} className="text-emerald-500" />
              <span className="text-xs text-emerald-600 font-medium">Resolved</span>
            </div>
          </div>
          <div className="relative">
            <DonutChart pct={totals.resolveRate} color="#10b981" size={64} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold text-emerald-600">{totals.resolveRate}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 2: Bar chart + Donut summary ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Issue ປະຈໍາເດືອນ</h3>
              <p className="text-xs text-slate-400 mt-0.5">ຈໍານວນ Issue ທີ່ແຈ້ງ ແລະ ແກ້ໄຂ ແຕ່ລະເດືອນ (hover ເພື່ອເບິ່ງລາຍລະອຽດ)</p>
            </div>
            <div className="flex items-center gap-2">
              <select value={selYear} onChange={(e)=>setSelYear(Number(e.target.value))}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50">
                {years.map((y)=><option key={y} value={y}>{y}</option>)}
              </select>
              <button className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><Settings2 size={14}/></button>
            </div>
          </div>

          <BarChart data={monthlyBars} max={barMax} colorA="#3b82f6" colorB="#10b981" />

          <div className="flex items-center gap-5 mt-1 pt-2 border-t border-slate-100">
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="w-3 h-3 rounded-sm bg-blue-400 inline-block" />ແຈ້ງບັນຫາ
            </span>
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="w-3 h-3 rounded-sm bg-emerald-400 inline-block" />ແກ້ໄຂສໍາເລັດ
            </span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col items-center justify-center">
          <h3 className="text-sm font-semibold text-slate-800 self-start mb-4">ອັດຕາການແກ້ໄຂ</h3>
          <div className="relative">
            <DonutChart pct={totals.resolveRate} color="#10b981" size={140} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-slate-800">{totals.resolveRate}%</span>
              <span className="text-xs text-slate-400">Resolved</span>
            </div>
          </div>
          <div className="w-full mt-4 space-y-2">
            {[
              { label: "ສໍາເລັດ",   val: totals.done,        pct: totals.resolveRate, color: "bg-emerald-500" },
              { label: "ລໍຖ້າ",      val: totals.pending,     pct: totals.total>0?Math.round((totals.pending/totals.total)*100):0, color: "bg-amber-400" },
              { label: "ດໍາເນີນການ", val: totals.in_progress, pct: totals.total>0?Math.round((totals.in_progress/totals.total)*100):0, color: "bg-blue-400" },
            ].map((s) => (
              <div key={s.label}>
                <div className="flex justify-between text-xs text-slate-500 mb-0.5">
                  <span>{s.label}</span><span className="font-medium">{s.pct}%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${s.color} rounded-full transition-all`} style={{ width: `${s.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row 3: 3 mini stat cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          {
            label: "6 ເດືອນຜ່ານມາ",
            value: sparkData.reduce((a,b)=>a+b,0),
            unit: "Issues ແຈ້ງ",
            trend: sparkData[sparkData.length-1] >= sparkData[0] ? "up" : "down",
            color: "#3b82f6",
            data: sparkData,
          },
          {
            label: "ເດືອນນີ້",
            value: monthDetail.reported,
            unit: "Issues ໃໝ່",
            trend: monthDetail.reported > 0 ? "up" : "flat",
            color: "#f59e0b",
            data: Array.from({length:6},(_,k)=>{
              const d=new Date(now.getFullYear(),now.getMonth()-(5-k),1);
              return issues.filter((i)=>{const ms=tsToMs(i.reportedDate);return ms&&new Date(ms).getFullYear()===d.getFullYear()&&new Date(ms).getMonth()===d.getMonth();}).length;
            }),
          },
          {
            label: "ເດືອນນີ້",
            value: monthDetail.resolved,
            unit: "Issues ແກ້ໄຂ",
            trend: monthDetail.rate >= 50 ? "up" : "down",
            color: "#10b981",
            data: Array.from({length:6},(_,k)=>{
              const d=new Date(now.getFullYear(),now.getMonth()-(5-k),1);
              return issues.filter((i)=>{const ms=tsToMs(i.resolvedDate);return ms&&new Date(ms).getFullYear()===d.getFullYear()&&new Date(ms).getMonth()===d.getMonth();}).length;
            }),
          },
        ].map((card,idx) => (
          <div key={idx} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">{card.label}</p>
              <p className="text-2xl font-bold text-slate-800 mt-0.5">{card.value}</p>
              <div className="flex items-center gap-1 mt-1">
                {card.trend === "up"
                  ? <TrendingUp size={12} className="text-emerald-500"/>
                  : <TrendingDown size={12} className="text-red-400"/>}
                <span className={`text-xs font-medium ${card.trend==="up"?"text-emerald-600":"text-red-500"}`}>
                  {card.unit}
                </span>
              </div>
            </div>
            <Sparkline values={card.data} color={card.color} />
          </div>
        ))}
      </div>

      {/* ── Row 4: Monthly detail + Target ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">ສະຖິຕິປະຈໍາເດືອນ</h3>
              <p className="text-xs text-slate-400">{LAO_MONTHS_FULL[selMonth]} {selYear}</p>
            </div>
            <select value={selMonth} onChange={(e)=>setSelMonth(Number(e.target.value))}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50">
              {LAO_MONTHS_FULL.map((m,i)=><option key={i} value={i}>{m}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label:"ແຈ້ງ",   val:monthDetail.reported, color:"text-blue-600 bg-blue-50"    },
              { label:"ແກ້ໄຂ",  val:monthDetail.resolved, color:"text-emerald-600 bg-emerald-50" },
              { label:"ສໍາເລັດ", val:`${monthDetail.rate}%`, color:"text-violet-600 bg-violet-50" },
            ].map((s)=>(
              <div key={s.label} className={`${s.color} rounded-xl p-3 text-center`}>
                <p className="text-xs opacity-70 mb-1">{s.label}</p>
                <p className="text-xl font-bold">{s.val}</p>
              </div>
            ))}
          </div>
          {monthDetail.cats.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">ບໍ່ມີຂໍ້ມູນເດືອນນີ້</p>
          ) : (
            <div className="space-y-2.5">
              {monthDetail.cats.map(([cat, v]) => {
                const pct = monthDetail.reported > 0 ? Math.round((v.r/monthDetail.reported)*100) : 0;
                return (
                  <div key={cat}>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-slate-600 truncate max-w-[65%]">{cat}</span>
                      <span className="text-xs text-slate-400 shrink-0">{v.r} issue · {pct}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-400 rounded-full transition-all" style={{width:`${pct}%`}} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-800">Target Section</h3>
            <a href="/issues" className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 transition-colors">
              View All <ArrowRight size={12}/>
            </a>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label:"Resolve Rate",   pct: totals.resolveRate, color:"text-blue-600",   bar:"bg-blue-500"   },
              { label:"Issue Pending",  pct: totals.total>0?Math.round((totals.pending/totals.total)*100):0,    color:"text-red-500",    bar:"bg-red-400"    },
              { label:"In Progress",    pct: totals.total>0?Math.round((totals.in_progress/totals.total)*100):0, color:"text-amber-500",  bar:"bg-amber-400"  },
              { label:"Monthly Target", pct: monthDetail.rate, color:"text-emerald-600", bar:"bg-emerald-500" },
            ].map((t) => (
              <div key={t.label} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <p className={`text-lg font-bold ${t.color}`}>{t.pct}%</p>
                <div className="h-1.5 bg-slate-200 rounded-full my-2 overflow-hidden">
                  <div className={`h-full ${t.bar} rounded-full transition-all`} style={{width:`${t.pct}%`}} />
                </div>
                <p className="text-xs text-slate-500">{t.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Recent Issues</p>
            <div className="space-y-2">
              {issues.slice(-4).reverse().map((issue) => (
                <div key={issue.id} className="flex items-center gap-2.5">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${
                    issue.status==="done"?"bg-emerald-500":issue.status==="in_progress"?"bg-blue-500":"bg-amber-400"
                  }`}/>
                  <p className="text-xs text-slate-600 truncate flex-1">{issue.description}</p>
                  <span className="text-[10px] text-slate-400 shrink-0">#{issue.no}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
