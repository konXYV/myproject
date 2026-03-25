"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/authContext";
import { subscribeToMenus, type AppMenu } from "@/lib/menuService";
import {
  getAllUsers, createUser, updateUserProfile, toggleUserActive, deleteUserProfile,
  ALL_PERMISSIONS, DEFAULT_PERMISSIONS, ADMIN_PERMISSIONS,
  type AppUser, type Permissions,
} from "@/lib/authService";
import {
  Plus, Pencil, Trash2, Power, PowerOff, X,
  AlertCircle, CheckCircle2, Shield, Eye, EyeOff,
  Users, RefreshCw, Crown,
} from "lucide-react";

// group permissions by their group label
const PERM_GROUPS = ALL_PERMISSIONS.reduce((acc, p) => {
  if (!acc[p.group]) acc[p.group] = [];
  acc[p.group].push(p);
  return acc;
}, {} as Record<string, typeof ALL_PERMISSIONS[number][]>);

type ModalMode = "create" | "edit" | null;

interface FormState {
  email: string; password: string; displayName: string;
  isAdmin: boolean; permissions: Permissions;
}

const BLANK_FORM: FormState = {
  email: "", password: "", displayName: "",
  isAdmin: false, permissions: { ...DEFAULT_PERMISSIONS },
};

export default function UsersPage() {
  const { user: me, perm } = useAuth();
  const router = useRouter();

  const [users, setUsers]             = useState<AppUser[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [success, setSuccess]         = useState<string | null>(null);
  const [modal, setModal]             = useState<ModalMode>(null);
  const [editTarget, setEditTarget]   = useState<AppUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null);
  const [submitting, setSubmitting]   = useState(false);
  const [showPwd, setShowPwd]         = useState(false);
  const [form, setForm]               = useState<FormState>({ ...BLANK_FORM });
  const [dynamicMenus, setDynamicMenus] = useState<AppMenu[]>([]);

  useEffect(() => {
    if (!perm("user_manage") && !perm("page_users")) { router.replace("/dashboard"); return; }
    load();
    const unsub = subscribeToMenus((m) => setDynamicMenus(m));
    return () => unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async () => {
    setLoading(true);
    try { setUsers(await getAllUsers()); }
    catch { setError("ໂຫຼດ users ບໍ່ສໍາເລັດ"); }
    finally { setLoading(false); }
  };

  // ── form helpers ────────────────────────────────────────────────────────────

  const openCreate = () => {
    setForm({ ...BLANK_FORM, permissions: { ...DEFAULT_PERMISSIONS } });
    setModal("create"); setError(null); setShowPwd(false);
  };

  const openEdit = (u: AppUser) => {
    setEditTarget(u);
    setForm({ email: u.email, password: "", displayName: u.displayName,
      isAdmin: u.isAdmin, permissions: { ...u.permissions } });
    setModal("edit"); setError(null);
  };

  const closeModal = () => { setModal(null); setEditTarget(null); setError(null); };

  const togglePerm = (key: keyof Permissions) => {
    if (form.isAdmin) return; // admin has all — no toggle needed
    setForm((f) => ({ ...f, permissions: { ...f.permissions, [key]: !f.permissions[key] } }));
  };

  const setAdmin = (v: boolean) => {
    setForm((f) => ({ ...f, isAdmin: v, permissions: v ? { ...ADMIN_PERMISSIONS } : { ...DEFAULT_PERMISSIONS } }));
  };

  const selectAllPerms = (all: boolean) => {
    if (form.isAdmin) return;
    const p = {} as Permissions;
    ALL_PERMISSIONS.forEach(({ key }) => { (p as Record<string, boolean>)[key] = all; });
    setForm((f) => ({ ...f, permissions: p }));
  };

  // ── submit ──────────────────────────────────────────────────────────────────

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.displayName.trim()) { setError("ກະລຸນາໃສ່ຊື່"); return; }
    if (form.password.length < 6) { setError("Password ຕ້ອງ 6 ຕົວຂຶ້ນໄປ"); return; }
    setSubmitting(true); setError(null);
    try {
      await createUser({ email: form.email, password: form.password,
        displayName: form.displayName, isAdmin: form.isAdmin, permissions: form.permissions });
      setSuccess(`ສ້າງ user "${form.displayName}" ສໍາເລັດ`);
      closeModal(); await load();
    } catch (e: unknown) {
      const msg = (e as Error).message ?? "";
      setError(msg.includes("email-already-in-use") ? "Email ນີ້ຖືກໃຊ້ແລ້ວ" : "ສ້າງ user ຜິດພາດ: " + msg);
    } finally { setSubmitting(false); }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    if (!form.displayName.trim()) { setError("ກະລຸນາໃສ່ຊື່"); return; }
    setSubmitting(true); setError(null);
    try {
      await updateUserProfile(editTarget.uid, {
        displayName: form.displayName, isAdmin: form.isAdmin, permissions: form.permissions });
      setSuccess(`ແກ້ໄຂ "${form.displayName}" ສໍາເລັດ`);
      closeModal(); await load();
    } catch { setError("ແກ້ໄຂ user ຜິດພາດ"); }
    finally { setSubmitting(false); }
  };

  const handleToggleActive = async (u: AppUser) => {
    if (u.uid === me?.uid) { setError("ບໍ່ສາມາດປິດໃຊ້ງານຕົນເອງໄດ້"); return; }
    try {
      await toggleUserActive(u.uid, !u.active);
      setSuccess(`${u.active ? "ປິດ" : "ເປີດ"}ໃຊ້ງານ "${u.displayName}" ສໍາເລັດ`);
      await load();
    } catch { setError("ດໍາເນີນການຜິດພາດ"); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.uid === me?.uid) { setError("ບໍ່ສາມາດລຶບຕົນເອງ"); setDeleteTarget(null); return; }
    try {
      await deleteUserProfile(deleteTarget.uid);
      setSuccess(`ລຶບ "${deleteTarget.displayName}" ສໍາເລັດ`);
      setDeleteTarget(null); await load();
    } catch { setError("ລຶບ user ຜິດພາດ"); }
  };

  // ── render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-blue-500" />
          <div>
            <h2 className="text-base font-semibold text-slate-800">ຈັດການ Users</h2>
            <p className="text-xs text-slate-400">ສ້າງ / ແກ້ໄຂ / ກໍານົດສິດ User</p>
          </div>
        </div>
        {perm("user_manage") && (
          <button onClick={openCreate}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-sm">
            <Plus size={15} /> ສ້າງ User ໃໝ່
          </button>
        )}
      </div>

      {/* Banners */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle size={16}/>{error}
          <button onClick={()=>setError(null)} className="ml-auto text-red-400">✕</button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
          <CheckCircle2 size={16}/>{success}
          <button onClick={()=>setSuccess(null)} className="ml-auto text-emerald-400">✕</button>
        </div>
      )}

      {/* Users table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <RefreshCw size={22} className="animate-spin mr-2 text-blue-500"/>
            <span className="text-sm">ກໍາລັງໂຫຼດ...</span>
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Users size={40} className="mb-3 opacity-30"/>
            <p className="text-sm">ຍັງບໍ່ມີ User</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">ຊື່ / Email</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">ປະເພດ</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">ສິດຫຍໍ້</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase w-24">ສະຖານະ</th>
                  <th className="px-4 py-3 w-28"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.uid} className={`transition-colors hover:bg-slate-50/50 ${!u.active ? "opacity-50" : ""}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                          ${u.isAdmin ? "bg-violet-100 text-violet-700" : "bg-blue-100 text-blue-700"}`}>
                          {u.displayName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800 flex items-center gap-1">
                            {u.displayName}
                            {u.uid === me?.uid && <span className="text-[9px] text-blue-500 border border-blue-200 rounded px-1">ທ່ານ</span>}
                          </p>
                          <p className="text-xs text-slate-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {u.isAdmin ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700 border border-violet-200">
                          <Crown size={10}/> Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          <Shield size={10}/> Custom
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {u.isAdmin ? (
                        <span className="text-xs text-violet-600">ທຸກສິດ</span>
                      ) : (
                        <div className="flex flex-wrap gap-1 max-w-[240px]">
                          {ALL_PERMISSIONS.filter(p => u.permissions[p.key]).map(p => (
                            <span key={p.key} className="text-[10px] bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded-md">
                              {p.label}
                            </span>
                          ))}
                          {!ALL_PERMISSIONS.some(p => u.permissions[p.key]) && (
                            <span className="text-xs text-slate-300">ບໍ່ມີສິດ</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
                        ${u.active ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
                        {u.active ? <><CheckCircle2 size={10}/>ໃຊ້ງານ</> : <><X size={10}/>ປິດ</>}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {perm("user_manage") && (
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={()=>openEdit(u)} title="ແກ້ໄຂ"
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                            <Pencil size={14}/>
                          </button>
                          <button onClick={()=>handleToggleActive(u)} disabled={u.uid===me?.uid}
                            title={u.active?"ປິດໃຊ້ງານ":"ເປີດໃຊ້ງານ"}
                            className={`p-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed
                              ${u.active?"text-slate-400 hover:text-amber-600 hover:bg-amber-50":"text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"}`}>
                            {u.active ? <PowerOff size={14}/> : <Power size={14}/>}
                          </button>
                          <button onClick={()=>setDeleteTarget(u)} disabled={u.uid===me?.uid} title="ລຶບ"
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                            <Trash2 size={14}/>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && users.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-400">
            ທັງໝົດ {users.length} users · Active {users.filter(u=>u.active).length}
          </div>
        )}
      </div>

      {/* ── Create / Edit Modal ── */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="h-1 bg-gradient-to-r from-blue-500 to-blue-600 rounded-t-2xl" />

            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl">
              <h3 className="font-semibold text-slate-800">
                {modal==="create" ? "ສ້າງ User ໃໝ່" : `ແກ້ໄຂ: ${editTarget?.displayName}`}
              </h3>
              <button onClick={closeModal} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
                <X size={16}/>
              </button>
            </div>

            <form onSubmit={modal==="create" ? handleCreate : handleEdit} className="p-6 space-y-5">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  <AlertCircle size={14}/>{error}
                </div>
              )}

              {/* Basic info */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">ຊື່ສະແດງ *</label>
                  <input value={form.displayName} onChange={(e)=>setForm({...form,displayName:e.target.value})}
                    required placeholder="ຊື່ຜູ້ໃຊ້"
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"/>
                </div>
                {modal==="create" && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Email *</label>
                      <input type="email" value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})}
                        required placeholder="user@example.com"
                        className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"/>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Password *</label>
                      <div className="relative">
                        <input type={showPwd?"text":"password"} value={form.password}
                          onChange={(e)=>setForm({...form,password:e.target.value})}
                          required placeholder="ຢ່າງໜ້ອຍ 6 ຕົວ"
                          className="w-full border border-slate-200 rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"/>
                        <button type="button" onClick={()=>setShowPwd(!showPwd)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                          {showPwd?<EyeOff size={15}/>:<Eye size={15}/>}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Admin toggle */}
              <div className={`rounded-xl border-2 p-4 transition-all cursor-pointer
                ${form.isAdmin ? "border-violet-400 bg-violet-50" : "border-slate-200 bg-slate-50"}`}
                onClick={()=>setAdmin(!form.isAdmin)}>
                <div className="flex items-center gap-3">
                  <input type="checkbox" checked={form.isAdmin} onChange={()=>setAdmin(!form.isAdmin)}
                    className="w-4 h-4 accent-violet-600 cursor-pointer" onClick={e=>e.stopPropagation()}/>
                  <Crown size={16} className={form.isAdmin?"text-violet-600":"text-slate-400"}/>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Admin (ທຸກສິດ)</p>
                    <p className="text-xs text-slate-500">ສາມາດເຂົ້າທຸກໜ້າ ແລະ ດໍາເນີນການທຸກຢ່າງ</p>
                  </div>
                </div>
              </div>

              {/* Permissions checkboxes */}
              {!form.isAdmin && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">ກໍານົດສິດ</label>
                    <div className="flex gap-2">
                      <button type="button" onClick={()=>selectAllPerms(true)}
                        className="text-xs text-blue-600 hover:underline">ເລືອກທັງໝົດ</button>
                      <span className="text-slate-300">·</span>
                      <button type="button" onClick={()=>selectAllPerms(false)}
                        className="text-xs text-slate-400 hover:underline">ລ້າງ</button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {Object.entries(PERM_GROUPS).map(([group, items]) => (
                      <div key={group} className="rounded-xl border border-slate-200 overflow-hidden">
                        <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                          <p className="text-xs font-semibold text-slate-600">{group}</p>
                        </div>
                        <div className="p-3 space-y-2">
                          {items.map(({ key, label }) => (
                            <label key={key}
                              className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-slate-50 transition-colors group">
                              <input type="checkbox"
                                checked={form.permissions[key as keyof Permissions]}
                                onChange={()=>togglePerm(key as keyof Permissions)}
                                className="w-4 h-4 accent-blue-600 cursor-pointer"/>
                              <span className={`text-sm transition-colors
                                ${form.permissions[key as keyof Permissions]
                                  ? "text-slate-800 font-medium"
                                  : "text-slate-500 group-hover:text-slate-700"}`}>
                                {label}
                              </span>
                              {form.permissions[key as keyof Permissions] && (
                                <CheckCircle2 size={13} className="ml-auto text-blue-500 shrink-0"/>
                              )}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Submit */}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal}
                  className="flex-1 border border-slate-200 rounded-xl py-2.5 text-sm hover:bg-slate-50 transition-colors">
                  ຍົກເລີກ
                </button>
                <button type="submit" disabled={submitting}
                  className="flex-1 bg-blue-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60">
                  {submitting ? "ກໍາລັງບັນທຶກ..." : modal==="create" ? "ສ້າງ User" : "ບັນທຶກ"}
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
            <h3 className="font-semibold text-slate-800 mb-1">ລຶບ User ນີ້?</h3>
            <p className="text-sm text-slate-600 mb-1 font-medium">{deleteTarget.displayName}</p>
            <p className="text-xs text-red-400 mb-5">ການກະທໍານີ້ບໍ່ສາມາດຍ້ອນຄືນໄດ້</p>
            <div className="flex gap-3">
              <button onClick={()=>setDeleteTarget(null)}
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
