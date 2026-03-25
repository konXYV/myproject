"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import {
  Plus, Search, Pencil, Trash2, RefreshCw, AlertCircle,
  CheckCircle2, Clock, BarChart3, Filter, Upload, Download, Eye,
  RotateCcw, Flame,
} from "lucide-react";
import * as XLSX from "xlsx";
import type { Issue, IssueFormData, IssueStatus } from "@/lib/issueService";
import {
  subscribeToIssues, subscribeToDeletedIssues,
  addIssue, updateIssue,
  softDeleteIssue, restoreIssue, permanentDeleteIssue,
} from "@/lib/issueService";
// updateIssue kept for handleSave
import IssueModal from "@/components/IssueModal";
import PreviewModal from "@/components/PreviewModal";
import { useAuth } from "@/lib/authContext";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tsToMs(ts: unknown): number {
  if (!ts) return 0;
  const t = ts as { seconds: number };
  return t.seconds ? t.seconds * 1000 : 0;
}
function formatDate(ts: unknown): string {
  const ms = tsToMs(ts);
  if (!ms) return "-";
  return new Date(ms).toLocaleDateString("lo-LA", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function formatDateForExcel(ts: unknown): string {
  const ms = tsToMs(ts);
  if (!ms) return "";
  return new Date(ms).toISOString().split("T")[0];
}
function statusLabel(s: IssueStatus) {
  return { pending: "ລໍຖ້າ", in_progress: "ກໍາລັງດໍາເນີນ", done: "ສໍາເລັດ" }[s];
}
function parseExcelDate(val: unknown): string {
  if (!val) return "";
  if (typeof val === "number") {
    const d = XLSX.SSF.parse_date_code(val);
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  if (typeof val === "string") { const d = new Date(val); if (!isNaN(d.getTime())) return d.toISOString().split("T")[0]; }
  if (val instanceof Date) return val.toISOString().split("T")[0];
  return "";
}
function parseStatus(val: unknown): IssueStatus {
  const s = String(val || "").trim();
  if (s === "ສໍາເລັດ" || s === "done") return "done";
  if (s === "ກໍາລັງດໍາເນີນ" || s === "in_progress") return "in_progress";
  return "pending";
}

type FilterStatus = "all" | IssueStatus;
type TabView = "active" | "trash";

// ─── Component ────────────────────────────────────────────────────────────────

export default function IssuesPage() {
  const { user, perm } = useAuth();
  const isAdmin = user?.isAdmin ?? false;

  const [issues, setIssues]               = useState<Issue[]>([]);
  const [deletedIssues, setDeletedIssues] = useState<Issue[]>([]);
  const [loading, setLoading]             = useState(true);
  const [tab, setTab]                     = useState<TabView>("active");
  const [error, setError]                 = useState<string | null>(null);
  const [search, setSearch]               = useState("");
  const [filterStatus, setFilterStatus]   = useState<FilterStatus>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [showModal, setShowModal]         = useState(false);
  const [editingIssue, setEditingIssue]   = useState<Issue | null>(null);
  const [previewIssue, setPreviewIssue]   = useState<Issue | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; permanent: boolean } | null>(null);
  const [selected, setSelected]           = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [importing, setImporting]         = useState(false);
  const [importResult, setImportResult]   = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsub1 = subscribeToIssues((data) => { setIssues(data); setLoading(false); });
    const unsub2 = subscribeToDeletedIssues((data) => setDeletedIssues(data));
    return () => { unsub1(); unsub2(); };
  }, []);

  const allCategories = useMemo(() =>
    Array.from(new Set(issues.map((i) => i.category))).sort(),
  [issues]);

  const activeFiltered = useMemo(() => issues
    .filter((issue) => {
      const q = search.toLowerCase();
      const matchSearch = !search || issue.description.toLowerCase().includes(q) ||
        issue.category.toLowerCase().includes(q) || issue.no.toString().includes(q);
      return matchSearch &&
        (filterStatus === "all" || issue.status === filterStatus) &&
        (filterCategory === "all" || issue.category === filterCategory);
    })
    .sort((a, b) => {
      const aMs = tsToMs(a.reportedDate), bMs = tsToMs(b.reportedDate);
      if (!aMs && !bMs) return a.no - b.no;
      if (!aMs) return 1; if (!bMs) return -1;
      return aMs - bMs;
    }),
  [issues, search, filterStatus, filterCategory]);

  const trashFiltered = useMemo(() => deletedIssues
    .filter((issue) => {
      const q = search.toLowerCase();
      return !search || issue.description.toLowerCase().includes(q) ||
        issue.category.toLowerCase().includes(q) || issue.no.toString().includes(q);
    }),
  [deletedIssues, search]);

  const filtered = tab === "active" ? activeFiltered : trashFiltered;

  const stats = useMemo(() => ({
    total: issues.length,
    pending: issues.filter((i) => i.status === "pending").length,
    in_progress: issues.filter((i) => i.status === "in_progress").length,
    done: issues.filter((i) => i.status === "done").length,
  }), [issues]);

  // ── Checkbox ────────────────────────────────────────────────────────────────
  const allIds = filtered.map((i) => i.id!).filter(Boolean);
  const allChecked = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const someChecked = allIds.some((id) => selected.has(id));
  const toggleAll = () => {
    if (allChecked) setSelected((p) => { const n = new Set(p); allIds.forEach((id) => n.delete(id)); return n; });
    else setSelected((p) => { const n = new Set(p); allIds.forEach((id) => n.add(id)); return n; });
  };
  const toggleOne = (id: string) => setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // Switch tab → clear selection
  const switchTab = (t: TabView) => { setTab(t); setSelected(new Set()); };

  // ── Export ──────────────────────────────────────────────────────────────────
  const handleExport = () => {
    const rows = activeFiltered.map((i) => ({
      No: i.no, ໝວດ: i.category, ລາຍການ: i.description,
      ສະຖານະ: statusLabel(i.status),
      ມື້ສັງລວມ: formatDateForExcel(i.reportedDate),
      ມື້ແກ້ໄຂສໍາເລັດ: formatDateForExcel(i.resolvedDate),
      ໝາຍເຫດ: i.note || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 6 }, { wch: 28 }, { wch: 60 }, { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Issues");
    XLSX.writeFile(wb, `Sokxay_Plus_Issue_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  // ── Import ──────────────────────────────────────────────────────────────────
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setImporting(true); setImportResult(null);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, blankrows: false });
      let headerRowIdx = -1; const colMap: Record<string, number> = {};
      for (let r = 0; r < raw.length; r++) {
        const row = raw[r] as unknown[];
        const cells = row.map((c) => String(c ?? "").trim());
        if (cells.some((c) => c === "No" || c === "no") || cells.some((c) => c === "ລາຍການ" || c === "description")) {
          headerRowIdx = r; cells.forEach((l, i) => { if (l) colMap[l.toLowerCase()] = i; }); break;
        }
      }
      if (headerRowIdx === -1) { headerRowIdx = 0; (raw[0] as unknown[]).map((c) => String(c ?? "").trim()).forEach((l, i) => { if (l) colMap[l.toLowerCase()] = i; }); }
      const col = (...keys: string[]) => { for (const k of keys) if (colMap[k.toLowerCase()] !== undefined) return colMap[k.toLowerCase()]; return -1; };
      const iCat=col("ໝວດ","category"), iNo=col("no"), iDesc=col("ລາຍການ","description");
      const iStat=col("ສະຖານະ","status"), iRep=col("ມື້ສັງລວມ","reporteddate");
      const iRes=col("ມື້ແກ້ໄຂສໍາເລັດ","resolveddate"), iNote=col("ໝາຍເຫດ","note");
      const dataRows = raw.slice(headerRowIdx + 1) as unknown[][];
      let imported=0, skipped=0, duplicates=0;
      const usedNos = new Set(issues.map((i) => i.no));
      let nextAvail = Math.max(0, ...Array.from(usedNos)) + 1;
      let lastCat = "";
      const getNextNo = () => { while (usedNos.has(nextAvail)) nextAvail++; const n=nextAvail; usedNos.add(n); nextAvail++; return n; };
      for (const row of dataRows) {
        const gc = (idx: number) => idx >= 0 && row[idx] != null ? String(row[idx]).trim() : "";
        const rawCat = gc(iCat); if (rawCat) lastCat = rawCat;
        const desc = gc(iDesc); if (!desc) { skipped++; continue; }
        const rawNo = Number(gc(iNo));
        let no: number;
        if (rawNo && !usedNos.has(rawNo)) { no=rawNo; usedNos.add(no); }
        else { if (rawNo && usedNos.has(rawNo)) duplicates++; no=getNextNo(); }
        await addIssue({ no, category: lastCat||"ອື່ນໆ", description: desc,
          status: parseStatus(iStat>=0?row[iStat]:""),
          reportedDate: parseExcelDate(iRep>=0?row[iRep]:null),
          resolvedDate: parseExcelDate(iRes>=0?row[iRes]:null),
          note: gc(iNote) });
        imported++;
      }
      const d = duplicates>0?` (ປ່ຽນ No ຊໍ້າ ${duplicates})`:"";
      const s = skipped>0?` (ຂ້າມ ${skipped} ຫວ່າງ)`:"";
      setImportResult(`✅ Import ສໍາເລັດ: ${imported} ລາຍການ${d}${s}`);
    } catch (err) { setError("Import ຜິດພາດ: "+(err as Error).message); }
    finally { setImporting(false); if (fileInputRef.current) fileInputRef.current.value=""; }
  };

  // ── CRUD ────────────────────────────────────────────────────────────────────
  const handleSave = async (data: IssueFormData) => {
    try {
      if (editingIssue?.id) await updateIssue(editingIssue.id, data);
      else await addIssue(data);
      setShowModal(false); setEditingIssue(null);
    } catch (err) { setError("ເກີດຂໍ້ຜິດພາດ: "+(err as Error).message); }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      if (deleteConfirm.permanent) {
        await permanentDeleteIssue(deleteConfirm.id);
      } else {
        await softDeleteIssue(deleteConfirm.id);
      }
      setDeleteConfirm(null);
    } catch (err) { setError("ເກີດຂໍ້ຜິດພາດ: "+(err as Error).message); }
  };

  const handleRestore = async (id: string) => {
    try { await restoreIssue(id); }
    catch (err) { setError("ຄືນຄ່າຜິດພາດ: "+(err as Error).message); }
  };

  const handleBulkSoftDelete = async () => {
    try {
      await Promise.all(Array.from(selected).map((id) => softDeleteIssue(id)));
      setSelected(new Set()); setBulkDeleteConfirm(false);
    } catch (err) { setError("ລຶບຜິດພາດ: "+(err as Error).message); }
  };

  const handleBulkPermanentDelete = async () => {
    try {
      await Promise.all(Array.from(selected).map((id) => permanentDeleteIssue(id)));
      setSelected(new Set()); setBulkDeleteConfirm(false);
    } catch (err) { setError("ລຶບຜິດພາດ: "+(err as Error).message); }
  };



  const nextNo = useMemo(() => {
    const used = new Set(issues.map((i) => i.no));
    let n = Math.max(0, ...Array.from(used)) + 1;
    while (used.has(n)) n++; return n;
  }, [issues]);

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-400">
      <RefreshCw size={28} className="animate-spin mr-3 text-blue-500" />
      <span className="text-sm">ກໍາລັງໂຫຼດ...</span>
    </div>
  );

  return (
    <div className="space-y-4">

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        <button onClick={() => switchTab("active")}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            tab === "active" ? "bg-white shadow text-slate-800" : "text-slate-500 hover:text-slate-700"
          }`}>
          ລາຍການ ({issues.length})
        </button>
        {isAdmin && (
          <button onClick={() => switchTab("trash")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === "trash" ? "bg-white shadow text-red-700" : "text-slate-500 hover:text-slate-700"
            }`}>
            <Trash2 size={13}/>
            ຖັງຂີ້ເຫຍື່ອ
            {deletedIssues.length > 0 && (
              <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full leading-none">
                {deletedIssues.length}
              </span>
            )}
          </button>
        )}
      </div>

      {/* ── Action bar (active tab only) ── */}
      {tab === "active" && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleImportFile} className="hidden" />
            {perm("issue_import") && <button onClick={() => fileInputRef.current?.click()} disabled={importing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50">
              <Upload size={13} />
              <span className="hidden sm:inline">{importing?"ກໍາລັງ Import...":"Import Excel"}</span>
              <span className="sm:hidden">Import</span>
            </button>}
            {perm("issue_export") && <button onClick={handleExport} disabled={activeFiltered.length===0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50">
              <Download size={13} />
              <span className="hidden sm:inline">Export Excel</span>
              <span className="sm:hidden">Export</span>
            </button>}
          </div>
          {perm("issue_add") && (
            <button onClick={() => { setEditingIssue(null); setShowModal(true); }}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
              <Plus size={15} /> ເພີ່ມ Issue
            </button>
          )}
        </div>
      )}

      {/* ── Trash action bar ── */}
      {tab === "trash" && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
          <Trash2 size={15} className="text-red-500 shrink-0"/>
          <p className="text-sm text-red-700 flex-1">ຂໍ້ມູນທີ່ຖືກລົບ — ສາມາດຄືນຄ່າ ຫຼື ລຶບຖາວອນໄດ້</p>
        </div>
      )}

      {/* ── Banners ── */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-sm text-red-700">
          <AlertCircle size={16}/>{error}
          <button onClick={()=>setError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
        </div>
      )}
      {importResult && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-sm text-emerald-700">
          <CheckCircle2 size={16}/>{importResult}
          <button onClick={()=>setImportResult(null)} className="ml-auto text-emerald-400 hover:text-emerald-600">✕</button>
        </div>
      )}

      {/* ── Stats (active only) ── */}
      {tab === "active" && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label:"ທັງໝົດ",    value:stats.total,       color:"bg-slate-100 text-slate-700",    icon:<BarChart3 size={16}/> },
            { label:"ລໍຖ້າ",      value:stats.pending,     color:"bg-amber-50 text-amber-700",     icon:<Clock size={16}/> },
            { label:"ດໍາເນີນການ", value:stats.in_progress, color:"bg-blue-50 text-blue-700",       icon:<RefreshCw size={16}/> },
            { label:"ສໍາເລັດ",    value:stats.done,        color:"bg-emerald-50 text-emerald-700", icon:<CheckCircle2 size={16}/> },
          ].map((s) => (
            <div key={s.label} className={`${s.color} rounded-xl p-4 flex items-center justify-between`}>
              <div><p className="text-xs opacity-70 mb-0.5">{s.label}</p><p className="text-2xl font-bold">{s.value}</p></div>
              <div className="opacity-60">{s.icon}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Filters ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4">
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <div className="relative flex-1 min-w-[160px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="ຄົ້ນຫາ..."
              className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"/>
          </div>
          {tab === "active" && (
            <>
              <Filter size={14} className="self-center text-slate-400 hidden sm:block"/>
              <select value={filterStatus} onChange={(e)=>setFilterStatus(e.target.value as FilterStatus)}
                className="border border-slate-200 rounded-lg px-2 sm:px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="all">ທຸກສະຖານະ</option>
                <option value="pending">ລໍຖ້າ</option>
                <option value="in_progress">ດໍາເນີນການ</option>
                <option value="done">ສໍາເລັດ</option>
              </select>
              <select value={filterCategory} onChange={(e)=>setFilterCategory(e.target.value)}
                className="border border-slate-200 rounded-lg px-2 sm:px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[160px] sm:max-w-[200px]">
                <option value="all">ທຸກໝວດ</option>
                {allCategories.map((c)=><option key={c} value={c}>{c}</option>)}
              </select>
            </>
          )}
        </div>
      </div>

      {/* ── Bulk action bar ── */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
          <span className="text-sm font-medium text-red-700">ເລືອກ {selected.size} ລາຍການ</span>
          {tab === "active" && isAdmin && (
            <button onClick={()=>setBulkDeleteConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 transition-colors">
              <Trash2 size={13}/> ລຶບທີ່ເລືອກ
            </button>
          )}
          {tab === "trash" && isAdmin && (
            <button onClick={()=>setBulkDeleteConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-700 text-white text-xs font-medium rounded-lg hover:bg-red-800 transition-colors">
              <Flame size={13}/> ລຶບຖາວອນທີ່ເລືອກ
            </button>
          )}
          <button onClick={()=>setSelected(new Set())} className="ml-auto text-xs text-red-400 hover:text-red-600">ຍົກເລີກ</button>
        </div>
      )}

      {/* ── Table ── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <AlertCircle size={40} className="mb-3 opacity-40"/>
            <p className="text-sm">
              {tab === "trash" ? "ຖັງຂີ້ເຫຍື່ອຫວ່າງ" :
                issues.length===0 ? 'ຍັງບໍ່ມີຂໍ້ມູນ — ກົດ "Import Excel" ຫຼື "ເພີ່ມ Issue"' : "ບໍ່ພົບຂໍ້ມູນທີ່ຄົ້ນຫາ"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm min-w-[640px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {isAdmin && (
                    <th className="px-3 py-3 w-10">
                      <input type="checkbox" checked={allChecked}
                        ref={(el)=>{ if(el) el.indeterminate=someChecked&&!allChecked; }}
                        onChange={toggleAll}
                        className="w-4 h-4 rounded border-slate-300 accent-blue-600 cursor-pointer"/>
                    </th>
                  )}
                  <th className="text-left px-2 py-3 text-xs font-semibold text-slate-500 uppercase w-12">No</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase">ໝວດ</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase">ລາຍການ</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase w-28">ສະຖານະ</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase w-24">ມື້ສັງລວມ ↑</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase w-24">ແກ້ໄຂສໍາເລັດ</th>
                  <th className="px-3 py-3 w-24"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((issue) => {
                  const isSel = selected.has(issue.id!);
                  const isDone = issue.status === "done";
                  return (
                    <tr key={issue.id} className={`transition-colors ${isSel?"bg-blue-50":"hover:bg-slate-50/50"} ${tab==="trash"?"opacity-70":""}`}>
                      {isAdmin && (
                        <td className="px-3 py-3">
                          <input type="checkbox" checked={isSel} onChange={()=>toggleOne(issue.id!)}
                            className="w-4 h-4 rounded border-slate-300 accent-blue-600 cursor-pointer"/>
                        </td>
                      )}
                      <td className="px-2 py-3 text-slate-400 font-mono text-xs">#{issue.no}</td>
                      <td className="px-3 py-3">
                        <span className="inline-block bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-md whitespace-nowrap">{issue.category}</span>
                      </td>
                      <td className="px-3 py-3 text-slate-700 max-w-xs">
                        <p className="line-clamp-2 leading-relaxed">{issue.description}</p>
                        {issue.note && <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">📝 {issue.note}</p>}
                      </td>
                      <td className="px-3 py-3">
                        {isDone ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">
                            <CheckCircle2 size={11}/> ສໍາເລັດ
                          </span>
                        ) : issue.status === "in_progress" ? (
                          <span className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full font-medium">
                            🔄 ດໍາເນີນການ
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
                            ⏳ ລໍຖ້າ
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-slate-500 text-xs whitespace-nowrap">{formatDate(issue.reportedDate)}</td>
                      <td className="px-3 py-3 text-xs whitespace-nowrap">
                        {issue.resolvedDate
                          ? <span className="text-emerald-600 font-medium">{formatDate(issue.resolvedDate)}</span>
                          : <span className="text-slate-300">-</span>}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {tab === "active" && (
                            <>
                              <button onClick={()=>setPreviewIssue(issue)}
                                className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors" title="Preview">
                                <Eye size={13}/>
                              </button>
                              {perm("issue_edit") && (
                                <button onClick={()=>{ setEditingIssue(issue); setShowModal(true); }}
                                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                  <Pencil size={13}/>
                                </button>
                              )}
                              {isAdmin && (
                                <button onClick={()=>setDeleteConfirm({ id: issue.id!, permanent: false })}
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="ລຶບ (ໄປຖັງຂີ້ເຫຍື່ອ)">
                                  <Trash2 size={13}/>
                                </button>
                              )}
                            </>
                          )}
                          {tab === "trash" && isAdmin && (
                            <>
                              <button onClick={()=>handleRestore(issue.id!)}
                                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="ຄືນຄ່າ">
                                <RotateCcw size={13}/>
                              </button>
                              <button onClick={()=>setDeleteConfirm({ id: issue.id!, permanent: true })}
                                className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors" title="ລຶບຖາວອນ">
                                <Flame size={13}/>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-400 flex justify-between">
            <span>ສະແດງ {filtered.length} {tab==="trash"?"(ຖັງຂີ້ເຫຍື່ອ)":"/ "+issues.length} ລາຍການ{selected.size>0&&<span className="ml-2 text-blue-500 font-medium">· ເລືອກ {selected.size}</span>}</span>
            <span>ອັບເດດ: {new Date().toLocaleDateString("lo-LA")}</span>
          </div>
        )}
      </div>

      {/* ── Preview Modal ── */}
      {previewIssue && (
        <PreviewModal issue={previewIssue} onClose={() => setPreviewIssue(null)} />
      )}

      {/* ── Issue Modal ── */}
      {showModal && (
        <IssueModal
          issue={editingIssue}
          maxNo={nextNo}
          existingCategories={allCategories}
          onSave={handleSave}
          onClose={()=>{ setShowModal(false); setEditingIssue(null); }}
        />
      )}

      {/* ── Delete Confirm ── */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <div className={`w-12 h-12 ${deleteConfirm.permanent ? "bg-red-100" : "bg-amber-100"} rounded-full flex items-center justify-center mx-auto mb-4`}>
              {deleteConfirm.permanent ? <Flame size={20} className="text-red-600"/> : <Trash2 size={20} className="text-amber-500"/>}
            </div>
            <h3 className="text-center font-semibold text-slate-800 mb-2">
              {deleteConfirm.permanent ? "ລຶບຖາວອນ?" : "ລຶບ Issue ນີ້?"}
            </h3>
            <p className="text-center text-sm text-slate-500 mb-5">
              {deleteConfirm.permanent
                ? "ຂໍ້ມູນຈະຫາຍໄປຖາວອນ ບໍ່ສາມາດຄືນຄ່າໄດ້"
                : "ຂໍ້ມູນຈະໄປຢູ່ຖັງຂີ້ເຫຍື່ອ ສາມາດຄືນຄ່າໄດ້ພາຍຫຼັງ"}
            </p>
            <div className="flex gap-3">
              <button onClick={()=>setDeleteConfirm(null)} className="flex-1 border border-slate-200 rounded-lg py-2 text-sm hover:bg-slate-50">ຍົກເລີກ</button>
              <button onClick={handleDelete}
                className={`flex-1 text-white rounded-lg py-2 text-sm font-medium ${deleteConfirm.permanent ? "bg-red-600 hover:bg-red-700" : "bg-amber-500 hover:bg-amber-600"}`}>
                {deleteConfirm.permanent ? "ລຶບຖາວອນ" : "ລຶບ"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Delete Confirm ── */}
      {bulkDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              {tab === "trash" ? <Flame size={20} className="text-red-600"/> : <Trash2 size={20} className="text-red-500"/>}
            </div>
            <h3 className="text-center font-semibold text-slate-800 mb-2">
              {tab === "trash" ? `ລຶບຖາວອນ ${selected.size} ລາຍການ?` : `ລຶບ ${selected.size} ລາຍການ?`}
            </h3>
            <p className="text-center text-sm text-slate-500 mb-5">
              {tab === "trash" ? "ຂໍ້ມູນຈະຫາຍໄປຖາວອນທັງໝົດ" : "ຂໍ້ມູນຈະໄປຢູ່ຖັງຂີ້ເຫຍື່ອ"}
            </p>
            <div className="flex gap-3">
              <button onClick={()=>setBulkDeleteConfirm(false)} className="flex-1 border border-slate-200 rounded-lg py-2 text-sm hover:bg-slate-50">ຍົກເລີກ</button>
              <button
                onClick={tab === "trash" ? handleBulkPermanentDelete : handleBulkSoftDelete}
                className="flex-1 bg-red-500 text-white rounded-lg py-2 text-sm font-medium hover:bg-red-600">
                {tab === "trash" ? "ລຶບຖາວອນ" : `ລຶບ ${selected.size} ລາຍການ`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
