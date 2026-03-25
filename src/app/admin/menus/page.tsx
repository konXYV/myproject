"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/authContext";
import {
  getAllMenus, createMenu, updateMenu, deleteMenu,
  ICON_OPTIONS, type AppMenu, type IconName,
} from "@/lib/menuService";
import {
  Plus, Pencil, Trash2, X, AlertCircle, CheckCircle2,
  RefreshCw, LayoutList, Eye, EyeOff, GripVertical, Zap,
  LayoutDashboard, ClipboardList, Users, FileText, BarChart3,
  Settings, Bell, Star, Bookmark, Globe, Database,
  ShieldCheck, Folder, Tag, Package, Layers,
} from "lucide-react";

const ICON_MAP: Record<IconName, React.ElementType> = {
  LayoutDashboard, ClipboardList, Users, FileText, BarChart3,
  Settings, Bell, Star, Bookmark, Globe, Database,
  ShieldCheck, Folder, Tag, Package, Layers,
};

function IconPreview({ name, size = 16 }: { name: IconName; size?: number }) {
  const Icon = ICON_MAP[name] ?? Folder;
  return <Icon size={size}/>;
}

type ModalMode = "create" | "edit" | null;

interface FormState {
  label: string; href: string; icon: IconName;
  order: number; active: boolean;
}

const BLANK: FormState = {
  label: "", href: "/", icon: "Folder", order: 10, active: true,
};

export default function MenusPage() {
  const { perm } = useAuth();
  const router = useRouter();

  const [menus, setMenus]         = useState<AppMenu[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [success, setSuccess]     = useState<string | null>(null);
  const [modal, setModal]         = useState<ModalMode>(null);
  const [editTarget, setEditTarget] = useState<AppMenu | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AppMenu | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm]           = useState<FormState>({ ...BLANK });

  useEffect(() => {
    if (!perm("user_manage")) { router.replace("/dashboard"); return; }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async () => {
    setLoading(true);
    try { setMenus(await getAllMenus()); }
    catch { setError("ໂຫຼດ menus ບໍ່ສໍາເລັດ"); }
    finally { setLoading(false); }
  };

  // Auto-generate permKey from href
  const permKeyFromHref = (href: string) =>
    "page_" + href.replace(/^\//, "").replace(/\//g, "_").replace(/[^a-z0-9_]/gi, "").toLowerCase() || "page_custom";

  const openCreate = () => {
    setForm({ ...BLANK, order: menus.length > 0 ? Math.max(...menus.map(m => m.order)) + 10 : 10 });
    setModal("create"); setError(null);
  };

  const openEdit = (m: AppMenu) => {
    setEditTarget(m);
    setForm({ label: m.label, href: m.href, icon: m.icon, order: m.order, active: m.active });
    setModal("edit"); setError(null);
  };

  const closeModal = () => { setModal(null); setEditTarget(null); setError(null); };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.label.trim()) { setError("ກະລຸນາໃສ່ຊື່ Menu"); return; }
    if (!form.href.startsWith("/")) { setError('href ຕ້ອງເລີ່ມດ້ວຍ "/"'); return; }
    setSubmitting(true); setError(null);
    try {
      await createMenu({ ...form, permKey: permKeyFromHref(form.href) });
      setSuccess(`ສ້າງ Menu "${form.label}" ສໍາເລັດ · ສິດໃໝ່ຈະໂຊໃນ Permission checkbox ທັນທີ`);
      closeModal(); await load();
    } catch (err) { setError("ສ້າງ menu ຜິດພາດ: " + (err as Error).message); }
    finally { setSubmitting(false); }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget?.id) return;
    setSubmitting(true); setError(null);
    try {
      await updateMenu(editTarget.id, { ...form, permKey: permKeyFromHref(form.href) });
      setSuccess(`ແກ້ໄຂ Menu "${form.label}" ສໍາເລັດ`);
      closeModal(); await load();
    } catch { setError("ແກ້ໄຂ menu ຜິດພາດ"); }
    finally { setSubmitting(false); }
  };

  const handleToggle = async (m: AppMenu) => {
    try {
      await updateMenu(m.id!, { active: !m.active });
      setSuccess(`${m.active ? "ປິດ" : "ເປີດ"} Menu "${m.label}" ສໍາເລັດ`);
      await load();
    } catch { setError("ດໍາເນີນການຜິດພາດ"); }
  };

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    try {
      await deleteMenu(deleteTarget.id);
      setSuccess(`ລຶບ Menu "${deleteTarget.label}" ສໍາເລັດ`);
      setDeleteTarget(null); await load();
    } catch { setError("ລຶບ menu ຜິດພາດ"); }
  };

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <LayoutList size={18} className="text-blue-500"/>
          <div>
            <h2 className="text-base font-semibold text-slate-800">ຈັດການ Menus</h2>
            <p className="text-xs text-slate-400">ສ້າງ / ແກ້ໄຂ / ລຶບ ເມນູໃນ Sidebar · ສິດໂຊໃນ Permission ທັນທີ</p>
          </div>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-sm">
          <Plus size={15}/> ສ້າງ Menu ໃໝ່
        </button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-2.5 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
        <Zap size={16} className="shrink-0 mt-0.5 text-blue-500"/>
        <p>
          ເມື່ອສ້າງ Menu ໃໝ່ → <strong>ສິດ (Permission)</strong> ຈະໂຊໃນໜ້າ <strong>ຈັດການ Users</strong> ອັດຕະໂນມັດ ·
          Admin ສາມາດ tick ໃຫ້ user ທີ່ຕ້ອງການໄດ້ທັນທີ · User ກໍ່ຈະເຫັນ Menu ໃໝ່ໃນ Sidebar ທັນທີ
        </p>
      </div>

      {/* Banners */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle size={16}/>{error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400">✕</button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
          <CheckCircle2 size={16}/>{success}
          <button onClick={() => setSuccess(null)} className="ml-auto text-emerald-400">✕</button>
        </div>
      )}

      {/* Menus table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <RefreshCw size={22} className="animate-spin mr-2 text-blue-500"/>
            <span className="text-sm">ກໍາລັງໂຫຼດ...</span>
          </div>
        ) : menus.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <LayoutList size={40} className="mb-3 opacity-30"/>
            <p className="text-sm">ຍັງບໍ່ມີ Menu — ກົດ "ສ້າງ Menu ໃໝ່"</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 w-8"></th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">ໄອຄ່ອນ / ຊື່</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Path (href)</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Permission Key</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase w-20">Order</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase w-24">ສະຖານະ</th>
                  <th className="px-4 py-3 w-28"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {menus.map((m) => (
                  <tr key={m.id} className={`transition-colors hover:bg-slate-50/50 ${!m.active ? "opacity-50" : ""}`}>
                    <td className="px-4 py-3 text-slate-300">
                      <GripVertical size={14}/>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                          <IconPreview name={m.icon} size={15}/>
                        </div>
                        <p className="font-medium text-slate-800">{m.label}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">{m.href}</code>
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs bg-violet-50 text-violet-600 border border-violet-100 px-2 py-0.5 rounded-md">
                        {m.permKey}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-center text-slate-500 text-xs font-mono">{m.order}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
                        ${m.active ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-500"}`}>
                        {m.active ? <><CheckCircle2 size={10}/>ໃຊ້ງານ</> : <><X size={10}/>ປິດ</>}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(m)} title="ແກ້ໄຂ"
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <Pencil size={14}/>
                        </button>
                        <button onClick={() => handleToggle(m)} title={m.active ? "ປິດ" : "ເປີດ"}
                          className={`p-1.5 rounded-lg transition-colors
                            ${m.active ? "text-slate-400 hover:text-amber-600 hover:bg-amber-50" : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"}`}>
                          {m.active ? <EyeOff size={14}/> : <Eye size={14}/>}
                        </button>
                        <button onClick={() => setDeleteTarget(m)} title="ລຶບ"
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 size={14}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && menus.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-400">
            ທັງໝົດ {menus.length} menus · Active {menus.filter(m => m.active).length}
          </div>
        )}
      </div>

      {/* ── Create / Edit Modal ── */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-blue-500 to-blue-600 rounded-t-2xl"/>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">
                {modal === "create" ? "ສ້າງ Menu ໃໝ່" : `ແກ້ໄຂ: ${editTarget?.label}`}
              </h3>
              <button onClick={closeModal} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
                <X size={16}/>
              </button>
            </div>

            <form onSubmit={modal === "create" ? handleCreate : handleEdit} className="p-6 space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  <AlertCircle size={14}/>{error}
                </div>
              )}

              {/* Label */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">ຊື່ Menu *</label>
                <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })}
                  required placeholder="ຊື່ທີ່ສະແດງໃນ Sidebar"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"/>
              </div>

              {/* Href */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Path (href) *
                </label>
                <input value={form.href}
                  onChange={(e) => setForm({ ...form, href: e.target.value })}
                  required placeholder="/reports/topup"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 font-mono"/>
                {form.href && (
                  <p className="text-[10px] text-slate-400 mt-1">
                    Permission key: <code className="text-violet-600">{permKeyFromHref(form.href)}</code>
                  </p>
                )}
              </div>

              {/* Icon picker */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">ໄອຄ່ອນ</label>
                <div className="grid grid-cols-8 gap-1.5">
                  {ICON_OPTIONS.map((iconName) => (
                    <button key={iconName} type="button"
                      onClick={() => setForm({ ...form, icon: iconName })}
                      title={iconName}
                      className={`p-2 rounded-lg flex items-center justify-center transition-all
                        ${form.icon === iconName
                          ? "bg-blue-600 text-white shadow-sm"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                      <IconPreview name={iconName} size={15}/>
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5">ເລືອກ: {form.icon}</p>
              </div>

              {/* Order + Active */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">ລໍາດັບ</label>
                  <input type="number" value={form.order}
                    onChange={(e) => setForm({ ...form, order: Number(e.target.value) })}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"/>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">ສະຖານະ</label>
                  <div className="flex items-center h-[42px] gap-2.5 cursor-pointer"
                    onClick={() => setForm({ ...form, active: !form.active })}>
                    <div className={`w-10 h-5 rounded-full transition-colors relative ${form.active ? "bg-blue-600" : "bg-slate-300"}`}>
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.active ? "left-5" : "left-0.5"}`}/>
                    </div>
                    <span className="text-sm text-slate-600">{form.active ? "ໃຊ້ງານ" : "ປິດ"}</span>
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-[10px] text-slate-400 mb-2 uppercase tracking-wide">Preview</p>
                <div className="flex items-center gap-2.5 px-3 py-2 bg-blue-600 rounded-xl w-fit">
                  <div className="text-white"><IconPreview name={form.icon} size={16}/></div>
                  <span className="text-white text-sm font-medium">{form.label || "ຊື່ Menu"}</span>
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={closeModal}
                  className="flex-1 border border-slate-200 rounded-xl py-2.5 text-sm hover:bg-slate-50 transition-colors">
                  ຍົກເລີກ
                </button>
                <button type="submit" disabled={submitting}
                  className="flex-1 bg-blue-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60">
                  {submitting ? "ກໍາລັງບັນທຶກ..." : modal === "create" ? "ສ້າງ Menu" : "ບັນທຶກ"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={20} className="text-red-500"/>
            </div>
            <h3 className="font-semibold text-slate-800 mb-1">ລຶບ Menu ນີ້?</h3>
            <p className="text-sm text-slate-600 mb-1 font-medium">{deleteTarget.label}</p>
            <p className="text-xs text-amber-600 mb-1">⚠️ Permission key <code>{deleteTarget.permKey}</code> ຈະຖືກລຶບອອກດ້ວຍ</p>
            <p className="text-xs text-red-400 mb-5">ການກະທໍານີ້ບໍ່ສາມາດຍ້ອນຄືນໄດ້</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)}
                className="flex-1 border border-slate-200 rounded-xl py-2 text-sm hover:bg-slate-50">ຍົກເລີກ</button>
              <button onClick={handleDelete}
                className="flex-1 bg-red-500 text-white rounded-xl py-2 text-sm font-medium hover:bg-red-600">ລຶບ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
