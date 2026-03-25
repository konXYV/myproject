// src/lib/menuService.ts
// Dynamic menu management stored in Firestore
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, getDocs, query, orderBy, onSnapshot, serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";

// Available lucide icon names (subset used in this app)
export const ICON_OPTIONS = [
  "LayoutDashboard", "ClipboardList", "Users", "FileText", "BarChart3",
  "Settings", "Bell", "Star", "Bookmark", "Globe", "Database",
  "ShieldCheck", "Folder", "Tag", "Package", "Layers",
] as const;

export type IconName = typeof ICON_OPTIONS[number];

export interface AppMenu {
  id?:       string;
  label:     string;         // display name in Lao/EN
  href:      string;         // e.g. "/reports/topup"
  icon:      IconName;
  permKey:   string;         // e.g. "page_reports_topup"
  order:     number;
  active:    boolean;
  createdAt?: unknown;
}

const COLLECTION = "menus";

export const subscribeToMenus = (cb: (menus: AppMenu[]) => void) => {
  const q = query(collection(db, COLLECTION), orderBy("order", "asc"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppMenu)));
  });
};

export const getAllMenus = async (): Promise<AppMenu[]> => {
  const q = query(collection(db, COLLECTION), orderBy("order", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppMenu));
};

export const createMenu = async (data: Omit<AppMenu, "id" | "createdAt">): Promise<string> => {
  const ref = await addDoc(collection(db, COLLECTION), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
};

export const updateMenu = async (id: string, data: Partial<Omit<AppMenu, "id">>): Promise<void> => {
  await updateDoc(doc(db, COLLECTION, id), data);
};

export const deleteMenu = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, COLLECTION, id));
};
