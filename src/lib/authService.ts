// src/lib/authService.ts
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc,
  collection, serverTimestamp, query, orderBy,
} from "firebase/firestore";
import { auth, db } from "./firebase";

// ── Permission Keys ───────────────────────────────────────────────────────────

export const ALL_PERMISSIONS = [
  // Pages
  { key: "page_dashboard", label: "ເຂົ້າຫນ້າ Dashboard",      group: "ໜ້າທີ່ເຂົ້າໄດ້" },
  { key: "page_issues",    label: "ເຂົ້າຫນ້າ ລາຍງານບັນຫາ",   group: "ໜ້າທີ່ເຂົ້າໄດ້" },
  { key: "page_users",     label: "ເຂົ້າຫນ້າ ຈັດການ Users",   group: "ໜ້າທີ່ເຂົ້າໄດ້" },
  // Issue actions
  { key: "issue_add",      label: "ເພີ່ມ Issue ໃໝ່",           group: "ການຈັດການ Issue" },
  { key: "issue_edit",     label: "ແກ້ໄຂ Issue",               group: "ການຈັດການ Issue" },
  { key: "issue_delete",   label: "ລຶບ Issue",                  group: "ການຈັດການ Issue" },
  { key: "issue_import",   label: "Import Excel",               group: "ການຈັດການ Issue" },
  { key: "issue_export",   label: "Export Excel",               group: "ການຈັດການ Issue" },
  // User management
  { key: "user_manage",    label: "ສ້າງ/ແກ້ໄຂ/ລຶບ User",       group: "ການຈັດການ User" },
] as const;

export type PermKey = typeof ALL_PERMISSIONS[number]["key"];

export interface Permissions {
  page_dashboard: boolean;
  page_issues:    boolean;
  page_users:     boolean;
  issue_add:      boolean;
  issue_edit:     boolean;
  issue_delete:   boolean;
  issue_import:   boolean;
  issue_export:   boolean;
  user_manage:    boolean;
}

export const DEFAULT_PERMISSIONS: Permissions = {
  page_dashboard: false, page_issues: false, page_users: false,
  issue_add: false, issue_edit: false, issue_delete: false,
  issue_import: false, issue_export: false, user_manage: false,
};

export const ADMIN_PERMISSIONS: Permissions = {
  page_dashboard: true, page_issues: true, page_users: true,
  issue_add: true, issue_edit: true, issue_delete: true,
  issue_import: true, issue_export: true, user_manage: true,
};

// ── User type ─────────────────────────────────────────────────────────────────

export interface AppUser {
  uid:         string;
  email:       string;
  displayName: string;
  isAdmin:     boolean;    // admin = always full access, can manage others
  active:      boolean;
  permissions: Permissions;
  createdAt?:  unknown;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function loginUser(email: string, password: string): Promise<AppUser> {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const profile = await getUserProfile(cred.user.uid);
  if (!profile) throw new Error("User profile not found");
  if (!profile.active) throw new Error("ບັນຊີນີ້ຖືກປິດໃຊ້ງານ");
  return profile;
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

// ── Profile CRUD ──────────────────────────────────────────────────────────────

export async function getUserProfile(uid: string): Promise<AppUser | null> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  const data = snap.data();
  // backward-compatible: old docs used role:"admin"|"editor"|"viewer"
  const isAdmin = data.isAdmin === true || data.role === "admin";
  return {
    uid,
    email:       data.email       ?? "",
    displayName: data.displayName ?? "",
    isAdmin,
    active:      data.active      ?? true,
    // admin always gets full perms regardless of stored permissions
    permissions: isAdmin
      ? { ...ADMIN_PERMISSIONS }
      : { ...DEFAULT_PERMISSIONS, ...(data.permissions ?? {}) },
    createdAt:   data.createdAt,
  } as AppUser;
}

export async function getAllUsers(): Promise<AppUser[]> {
  const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    const isAdmin = data.isAdmin === true || data.role === "admin";
    return {
      uid:         d.id,
      email:       data.email       ?? "",
      displayName: data.displayName ?? "",
      isAdmin,
      active:      data.active      ?? true,
      permissions: isAdmin
        ? { ...ADMIN_PERMISSIONS }
        : { ...DEFAULT_PERMISSIONS, ...(data.permissions ?? {}) },
      createdAt:   data.createdAt,
    } as AppUser;
  });
}

export async function createUser(data: {
  email:       string;
  password:    string;
  displayName: string;
  isAdmin:     boolean;
  permissions: Permissions;
}): Promise<AppUser> {
  const cred = await createUserWithEmailAndPassword(auth, data.email, data.password);
  const profile = {
    email:       data.email,
    displayName: data.displayName,
    isAdmin:     data.isAdmin,
    active:      true,
    permissions: data.isAdmin ? ADMIN_PERMISSIONS : data.permissions,
    createdAt:   serverTimestamp(),
  };
  await setDoc(doc(db, "users", cred.user.uid), profile);
  return { uid: cred.user.uid, ...profile };
}

export async function updateUserProfile(
  uid: string,
  data: { displayName?: string; isAdmin?: boolean; active?: boolean; permissions?: Permissions }
): Promise<void> {
  const update: Record<string, unknown> = { ...data };
  // if promoted to admin → grant all perms automatically
  if (data.isAdmin) update.permissions = ADMIN_PERMISSIONS;
  await updateDoc(doc(db, "users", uid), update);
}

export async function toggleUserActive(uid: string, active: boolean): Promise<void> {
  await updateDoc(doc(db, "users", uid), { active });
}

export async function deleteUserProfile(uid: string): Promise<void> {
  await deleteDoc(doc(db, "users", uid));
}
