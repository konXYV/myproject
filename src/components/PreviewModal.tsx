"use client";
import { useState } from "react";
import {
  X, ChevronLeft, ChevronRight, Calendar, Tag,
  FileText, CheckCircle2, Clock, RefreshCw, ImageOff,
  ZoomIn, Download,
} from "lucide-react";
import type { Issue, IssueStatus } from "@/lib/issueService";

// ── helpers ───────────────────────────────────────────────────────────────────

function tsToStr(ts: unknown): string {
  if (!ts) return "-";
  const t = ts as { seconds: number };
  if (!t.seconds) return "-";
  return new Date(t.seconds * 1000).toLocaleDateString("lo-LA", {
    day: "2-digit", month: "long", year: "numeric",
  });
}

const STATUS_CONFIG: Record<IssueStatus, { label: string; icon: React.ReactNode; cls: string; dot: string }> = {
  pending: {
    label: "ລໍຖ້າ",
    icon: <Clock size={13}/>,
    cls: "bg-amber-50 text-amber-700 border border-amber-200",
    dot: "bg-amber-400",
  },
  in_progress: {
    label: "ກໍາລັງດໍາເນີນ",
    icon: <RefreshCw size={13}/>,
    cls: "bg-blue-50 text-blue-700 border border-blue-200",
    dot: "bg-blue-500",
  },
  done: {
    label: "ສໍາເລັດ",
    icon: <CheckCircle2 size={13}/>,
    cls: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    dot: "bg-emerald-500",
  },
};

// ── Lightbox ──────────────────────────────────────────────────────────────────

function Lightbox({ images, index, onClose }: { images: string[]; index: number; onClose: () => void }) {
  const [cur, setCur] = useState(index);

  const prev = () => setCur((c) => (c - 1 + images.length) % images.length);
  const next = () => setCur((c) => (c + 1) % images.length);

  return (
    <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4"
      onClick={onClose}>
      <button onClick={onClose}
        className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-10">
        <X size={20}/>
      </button>

      {/* Counter */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black/40 px-3 py-1 rounded-full">
        {cur + 1} / {images.length}
      </div>

      {/* Image */}
      <div className="relative max-w-4xl max-h-[80vh] w-full flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[cur]} alt={`image-${cur}`}
          className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"/>
      </div>

      {/* Nav */}
      {images.length > 1 && (
        <>
          <button onClick={(e) => { e.stopPropagation(); prev(); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-2.5 bg-white/10 hover:bg-white/25 rounded-full text-white transition-colors">
            <ChevronLeft size={22}/>
          </button>
          <button onClick={(e) => { e.stopPropagation(); next(); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 bg-white/10 hover:bg-white/25 rounded-full text-white transition-colors">
            <ChevronRight size={22}/>
          </button>
        </>
      )}

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-black/40 p-2 rounded-xl"
          onClick={(e) => e.stopPropagation()}>
          {images.map((img, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={img} alt="" onClick={() => setCur(i)}
              className={`w-12 h-12 object-cover rounded-lg cursor-pointer transition-all
                ${i === cur ? "ring-2 ring-white scale-110" : "opacity-60 hover:opacity-90"}`}/>
          ))}
        </div>
      )}
    </div>
  );
}

// ── PreviewModal ──────────────────────────────────────────────────────────────

interface Props {
  issue: Issue;
  onClose: () => void;
}

export default function PreviewModal({ issue, onClose }: Props) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [imgErrors, setImgErrors]     = useState<Set<number>>(new Set());

  const images = issue.images ?? [];
  const status = STATUS_CONFIG[issue.status];
  const daysDiff = (() => {
    const r = (issue.reportedDate as { seconds: number } | null)?.seconds;
    const d = (issue.resolvedDate as { seconds: number } | null)?.seconds;
    if (!r) return null;
    const base = d ? d * 1000 : Date.now();
    const diff = Math.floor((base - r * 1000) / 86400000);
    return diff;
  })();

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">

          {/* ── Colored top bar based on status ── */}
          <div className={`h-1.5 w-full ${
            issue.status === "done" ? "bg-emerald-500" :
            issue.status === "in_progress" ? "bg-blue-500" : "bg-amber-400"
          }`}/>

          {/* ── Header ── */}
          <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-2.5 h-2.5 rounded-full shrink-0 mt-0.5 ${status.dot}`}/>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono text-slate-400">#{issue.no}</span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${status.cls}`}>
                    {status.icon}{status.label}
                  </span>
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                    {issue.category}
                  </span>
                </div>
              </div>
            </div>
            <button onClick={onClose}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 shrink-0 ml-3">
              <X size={17}/>
            </button>
          </div>

          {/* ── Scrollable body ── */}
          <div className="flex-1 overflow-y-auto">

            {/* Description */}
            <div className="px-6 pt-5 pb-4 border-b border-slate-100">
              <div className="flex items-start gap-2 mb-1.5">
                <FileText size={15} className="text-slate-400 mt-0.5 shrink-0"/>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">ລາຍການ</p>
              </div>
              <p className="text-sm text-slate-800 leading-relaxed pl-5">{issue.description}</p>
              {issue.note && (
                <div className="mt-3 pl-5">
                  <p className="text-xs text-slate-500 italic">📝 {issue.note}</p>
                </div>
              )}
            </div>

            {/* Meta grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-slate-100 border-b border-slate-100">
              {[
                { icon: <Calendar size={13}/>, label: "ວັນທີ່ສັງລວມ", value: tsToStr(issue.reportedDate) },
                { icon: <CheckCircle2 size={13}/>, label: "ວັນທີ່ແກ້ໄຂ", value: tsToStr(issue.resolvedDate) },
                { icon: <Clock size={13}/>, label: "ໃຊ້ເວລາ",
                  value: daysDiff !== null
                    ? `${daysDiff} ວັນ${issue.status !== "done" ? " (ຍັງດໍາເນີນ)" : ""}`
                    : "-" },
              ].map((m) => (
                <div key={m.label} className="bg-white px-5 py-3">
                  <div className="flex items-center gap-1.5 text-slate-400 mb-0.5">
                    {m.icon}
                    <span className="text-[10px] font-semibold uppercase tracking-wide">{m.label}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-700">{m.value}</p>
                </div>
              ))}
            </div>

            {/* ── Images ── */}
            <div className="px-6 py-5">
              <div className="flex items-center gap-2 mb-3">
                <Tag size={14} className="text-slate-400"/>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  ຮູບພາບ ({images.length})
                </p>
              </div>

              {images.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-slate-300 bg-slate-50 rounded-xl border border-slate-200">
                  <ImageOff size={32} className="mb-2"/>
                  <p className="text-sm">ບໍ່ມີຮູບພາບ</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {images.map((url, i) => (
                    <div key={i} className="group relative aspect-video rounded-xl overflow-hidden bg-slate-100 border border-slate-200 cursor-pointer shadow-sm hover:shadow-md transition-shadow"
                      onClick={() => !imgErrors.has(i) && setLightboxIdx(i)}>

                      {imgErrors.has(i) ? (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                          <ImageOff size={24}/>
                          <span className="text-[10px] mt-1">ໂຫຼດຮູບບໍ່ໄດ້</span>
                        </div>
                      ) : (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt={`screenshot-${i + 1}`}
                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                            onError={() => setImgErrors((prev) => new Set([...prev, i]))}/>

                          {/* Hover overlay */}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                            <ZoomIn size={22} className="text-white opacity-0 group-hover:opacity-100 drop-shadow transition-opacity"/>
                          </div>

                          {/* Index badge */}
                          <div className="absolute bottom-1.5 left-1.5 bg-black/50 text-white text-[9px] px-1.5 py-0.5 rounded-md">
                            {i + 1}/{images.length}
                          </div>

                          {/* Download link */}
                          <a href={url} download target="_blank" rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="absolute top-1.5 right-1.5 p-1 bg-black/50 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70">
                            <Download size={11}/>
                          </a>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Footer ── */}
          <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 shrink-0 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Issue #{issue.no} · {issue.category}
            </p>
            <button onClick={onClose}
              className="px-4 py-1.5 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700 transition-colors">
              ປິດ
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <Lightbox images={images} index={lightboxIdx} onClose={() => setLightboxIdx(null)}/>
      )}
    </>
  );
}
