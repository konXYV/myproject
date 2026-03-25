"use client";
import { useState, useEffect, useRef } from "react";
import { X, ImagePlus, Trash2, Loader2, AlertCircle, CheckCircle2, ChevronDown } from "lucide-react";
import type { Issue, IssueFormData, IssueStatus } from "@/lib/issueService";
import { uploadMultiple } from "@/lib/cloudinary";

const DEFAULT_CATEGORIES = [
  "Splus Portal - Topup",
  "Splus Portal - ຫວຍ",
  "Splus Portal - ຈອງປີ້ເຮືອບິນ",
  "JDB",
  "SPIN",
  "ບັນຊີຮັບລາງວັນ",
  "ແອັບ Sokxay One Plus",
  "ການເບີກຈ່າຍລາງວັນ LDB",
  "REFUND ເງິນ LDB",
];

interface Props {
  issue?: Issue | null;
  maxNo: number;
  existingCategories?: string[];
  onSave: (data: IssueFormData) => void;
  onClose: () => void;
}

function tsToDate(ts: unknown): string {
  if (!ts) return "";
  const t = ts as { seconds: number };
  return t.seconds ? new Date(t.seconds * 1000).toISOString().split("T")[0] : "";
}

interface UploadItem {
  id: string;
  file?: File;
  previewUrl: string;
  cloudUrl?: string;
  state: "pending" | "uploading" | "done" | "error";
  error?: string;
}

export default function IssueModal({ issue, maxNo, existingCategories = [], onSave, onClose }: Props) {
  const allCategories = Array.from(new Set([...DEFAULT_CATEGORIES, ...existingCategories])).sort();

  const [form, setForm] = useState<IssueFormData>({
    no: maxNo, category: DEFAULT_CATEGORIES[0], description: "",
    reportedDate: new Date().toISOString().split("T")[0],
    resolvedDate: "", note: "", status: "pending", images: [],
  });

  const [uploads, setUploads]       = useState<UploadItem[]>([]);
  const [uploading, setUploading]   = useState(false);
  const [uploadErr, setUploadErr]   = useState<string | null>(null);
  const [saving, setSaving]         = useState(false);
  const [catOpen, setCatOpen]       = useState(false);
  const [catInput, setCatInput]     = useState("");
  const fileRef   = useRef<HTMLInputElement>(null);
  const catRef    = useRef<HTMLDivElement>(null);

  // Populate form when editing
  useEffect(() => {
    if (issue) {
      setForm({
        no: issue.no, category: issue.category, description: issue.description,
        reportedDate: tsToDate(issue.reportedDate),
        resolvedDate: tsToDate(issue.resolvedDate),
        note: issue.note || "", status: issue.status,
        images: issue.images ?? [],
      });
      setCatInput(issue.category);
      setUploads(
        (issue.images ?? []).map((url, i) => ({
          id: `existing-${i}`, previewUrl: url, cloudUrl: url, state: "done",
        }))
      );
    }
  }, [issue]);

  // Sync catInput with form.category on open
  useEffect(() => {
    if (!issue) setCatInput(DEFAULT_CATEGORIES[0]);
  }, [issue]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (catRef.current && !catRef.current.contains(e.target as Node)) setCatOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Auto set status to done when resolvedDate is filled
  const handleResolvedDateChange = (val: string) => {
    setForm((prev) => ({
      ...prev,
      resolvedDate: val,
      status: val ? "done" : (prev.status === "done" ? "in_progress" : prev.status),
    }));
  };

  // Category combobox select
  const selectCategory = (cat: string) => {
    setForm((prev) => ({ ...prev, category: cat }));
    setCatInput(cat);
    setCatOpen(false);
  };

  // Filtered dropdown list
  const filteredCats = allCategories.filter((c) =>
    c.toLowerCase().includes(catInput.toLowerCase())
  );

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      uploads.forEach((u) => { if (u.file) URL.revokeObjectURL(u.previewUrl); });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const newItems: UploadItem[] = files.map((f) => ({
      id: `${Date.now()}-${Math.random()}`,
      file: f,
      previewUrl: URL.createObjectURL(f),
      state: "pending",
    }));
    setUploads((prev) => [...prev, ...newItems]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeUpload = (id: string) => {
    setUploads((prev) => {
      const item = prev.find((u) => u.id === id);
      if (item?.file) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((u) => u.id !== id);
    });
  };

  const uploadPending = async (): Promise<string[]> => {
    const pending = uploads.filter((u) => u.state === "pending" && u.file);
    if (!pending.length) return [];
    setUploading(true);
    setUploadErr(null);
    try {
      setUploads((prev) =>
        prev.map((u) => u.state === "pending" && u.file ? { ...u, state: "uploading" } : u)
      );
      const files = pending.map((u) => u.file!);
      const urls = await uploadMultiple(files, (done) => {
        setUploads((prev) => {
          const next = [...prev];
          const uploadingItems = next.filter((u) => u.state === "uploading");
          for (let i = 0; i < done; i++) {
            const item = uploadingItems[i];
            if (item) item.state = "done";
          }
          return next;
        });
      });
      setUploads((prev) => {
        const next = [...prev];
        let urlIdx = 0;
        for (const item of next) {
          if (item.state === "done" && !item.cloudUrl && item.file) {
            item.cloudUrl = urls[urlIdx++];
          }
        }
        return next;
      });
      return urls;
    } catch (err) {
      setUploadErr((err as Error).message);
      setUploads((prev) =>
        prev.map((u) => u.state === "uploading" ? { ...u, state: "error", error: "Upload failed" } : u)
      );
      throw err;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Use catInput as category (allows custom typed value)
    const finalCategory = catInput.trim() || form.category;
    setSaving(true);
    try {
      const existingUrls = uploads
        .filter((u) => u.state === "done" && u.cloudUrl && !u.file)
        .map((u) => u.cloudUrl!);
      let newUrls: string[] = [];
      if (uploads.some((u) => u.state === "pending")) {
        newUrls = await uploadPending();
      }
      const alreadyUploadedUrls = uploads
        .filter((u) => u.state === "done" && u.cloudUrl && u.file)
        .map((u) => u.cloudUrl!);
      const imageUrls = [...existingUrls, ...alreadyUploadedUrls, ...newUrls];
      onSave({ ...form, category: finalCategory, images: imageUrls });
    } finally {
      setSaving(false);
    }
  };

  const hasPending = uploads.some((u) => u.state === "pending");
  const hasError   = uploads.some((u) => u.state === "error");
  const isDone     = form.status === "done";

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="h-1 bg-gradient-to-r from-blue-500 to-blue-600 rounded-t-2xl" />
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h2 className="text-base font-semibold text-slate-800">
            {issue ? "ແກ້ໄຂ Issue" : "ເພີ່ມ Issue ໃໝ່"}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={17} className="text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">

          {/* No + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">No.</label>
              <input type="number" value={form.no}
                onChange={(e) => setForm({ ...form, no: Number(e.target.value) })} required
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">ສະຖານະ</label>
              {isDone ? (
                <div className="w-full border border-emerald-200 rounded-xl px-3 py-2 text-sm bg-emerald-50 text-emerald-700 flex items-center gap-2 cursor-not-allowed">
                  <CheckCircle2 size={14}/> ສໍາເລັດ
                </div>
              ) : (
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as IssueStatus })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50">
                  <option value="pending">⏳ ລໍຖ້າ</option>
                  <option value="in_progress">🔄 ກໍາລັງດໍາເນີນ</option>
                </select>
              )}
              {isDone && (
                <p className="text-[10px] text-emerald-600 mt-1">ກໍານົດໂດຍວັນທີ່ແກ້ໄຂ</p>
              )}
            </div>
          </div>

          {/* Category — combobox */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">ໝວດ</label>
            <div ref={catRef} className="relative">
              <input
                type="text"
                value={catInput}
                onChange={(e) => { setCatInput(e.target.value); setForm((p) => ({ ...p, category: e.target.value })); setCatOpen(true); }}
                onFocus={() => setCatOpen(true)}
                placeholder="ພິມຫຼືເລືອກໝວດ..."
                className="w-full border border-slate-200 rounded-xl px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
              />
              <button type="button" onClick={() => setCatOpen((o) => !o)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <ChevronDown size={15} className={`transition-transform ${catOpen ? "rotate-180" : ""}`}/>
              </button>
              {catOpen && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                  {catInput.trim() && !allCategories.some((c) => c.toLowerCase() === catInput.toLowerCase()) && (
                    <button type="button"
                      onClick={() => selectCategory(catInput.trim())}
                      className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 border-b border-slate-100 font-medium">
                      + ເພີ່ມ "{catInput.trim()}"
                    </button>
                  )}
                  {filteredCats.length === 0 && !catInput.trim() && (
                    <div className="px-3 py-2 text-xs text-slate-400">ບໍ່ມີໝວດ</div>
                  )}
                  {filteredCats.map((c) => (
                    <button key={c} type="button" onClick={() => selectCategory(c)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors
                        ${form.category === c ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-700"}`}>
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">ລາຍການ</label>
            <textarea value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3} required
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-slate-50"/>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">ມື້ສັງລວມ</label>
              <input type="date" value={form.reportedDate}
                onChange={(e) => setForm({ ...form, reportedDate: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                ມື້ແກ້ໄຂ
                <span className="ml-1 text-emerald-600 font-normal normal-case">(→ ສໍາເລັດ)</span>
              </label>
              <input type="date" value={form.resolvedDate}
                onChange={(e) => handleResolvedDateChange(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"/>
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">ໝາຍເຫດ</label>
            <input type="text" value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"/>
          </div>

          {/* Image Upload */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                ຮູບພາບ ({uploads.length})
              </label>
              <button type="button" onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors">
                <ImagePlus size={13}/> ເພີ່ມຮູບ
              </button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple
              onChange={handlePickFiles} className="hidden"/>

            {uploadErr && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 mb-2">
                <AlertCircle size={13}/>{uploadErr}
              </div>
            )}

            {uploads.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {uploads.map((item) => (
                  <div key={item.id} className="relative group aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.previewUrl} alt="" className="w-full h-full object-cover"/>
                    {item.state === "uploading" && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Loader2 size={20} className="text-white animate-spin"/>
                      </div>
                    )}
                    {item.state === "done" && (
                      <div className="absolute top-1 left-1">
                        <CheckCircle2 size={16} className="text-white drop-shadow"/>
                      </div>
                    )}
                    {item.state === "error" && (
                      <div className="absolute inset-0 bg-red-500/50 flex items-center justify-center">
                        <AlertCircle size={20} className="text-white"/>
                      </div>
                    )}
                    {item.state !== "uploading" && (
                      <button type="button" onClick={() => removeUpload(item.id)}
                        className="absolute top-1 right-1 p-1 bg-red-500 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity shadow">
                        <Trash2 size={11}/>
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="aspect-square rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-colors bg-slate-50">
                  <ImagePlus size={20}/>
                  <span className="text-[10px] mt-1">ເພີ່ມ</span>
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center text-slate-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50/30 transition-all">
                <ImagePlus size={28} className="mb-2"/>
                <p className="text-sm font-medium">ກົດເພື່ອເລືອກຮູບ</p>
                <p className="text-xs mt-0.5">PNG, JPG, WEBP · ໄດ້ຫຼາຍຮູບ</p>
              </button>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2.5 text-sm font-medium hover:bg-slate-50 transition-colors">
              ຍົກເລີກ
            </button>
            <button type="submit" disabled={saving || uploading || hasError}
              className="flex-1 bg-blue-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {(saving || uploading) && <Loader2 size={15} className="animate-spin"/>}
              {uploading ? "ກໍາລັງອັບໂຫຼດຮູບ..." : saving ? "ກໍາລັງບັນທຶກ..." : issue ? "ບັນທຶກ" : "ເພີ່ມ Issue"}
              {hasPending && !uploading && !saving && (
                <span className="text-[10px] bg-white/20 rounded px-1">+ອັບໂຫຼດ {uploads.filter(u=>u.state==="pending").length} ຮູບ</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
