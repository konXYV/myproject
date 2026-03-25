// src/lib/issueService.ts
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, query, orderBy, Timestamp, onSnapshot,
} from "firebase/firestore";
import { db } from "./firebase";

export type IssueStatus = "pending" | "in_progress" | "done";

export interface Issue {
  id?:          string;
  category:     string;
  no:           number;
  description:  string;
  reportedDate: Timestamp | null;
  resolvedDate: Timestamp | null;
  note:         string;
  status:       IssueStatus;
  images?:      string[];
  deleted?:     boolean;
  deletedAt?:   Timestamp;
  createdAt?:   Timestamp;
  updatedAt?:   Timestamp;
}

export interface IssueFormData {
  category:     string;
  no:           number;
  description:  string;
  reportedDate: string;
  resolvedDate: string;
  note:         string;
  status:       IssueStatus;
  images?:      string[];
}

const COLLECTION = "issues";

export const subscribeToIssues = (callback: (issues: Issue[]) => void) => {
  const q = query(collection(db, COLLECTION), orderBy("no", "asc"));
  return onSnapshot(q, (snapshot) => {
    const all = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Issue));
    callback(all.filter((i) => !i.deleted));
  });
};

export const subscribeToDeletedIssues = (callback: (issues: Issue[]) => void) => {
  const q = query(collection(db, COLLECTION), orderBy("no", "asc"));
  return onSnapshot(q, (snapshot) => {
    const all = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Issue));
    callback(all.filter((i) => i.deleted === true));
  });
};

export const addIssue = async (data: IssueFormData): Promise<string> => {
  const ref = await addDoc(collection(db, COLLECTION), {
    ...data,
    images: data.images ?? [],
    deleted: false,
    reportedDate: data.reportedDate ? Timestamp.fromDate(new Date(data.reportedDate)) : null,
    resolvedDate: data.resolvedDate ? Timestamp.fromDate(new Date(data.resolvedDate)) : null,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return ref.id;
};

export const updateIssue = async (id: string, data: Partial<IssueFormData>): Promise<void> => {
  const upd: Record<string, unknown> = { ...data, updatedAt: Timestamp.now() };
  if (data.reportedDate !== undefined)
    upd.reportedDate = data.reportedDate ? Timestamp.fromDate(new Date(data.reportedDate)) : null;
  if (data.resolvedDate !== undefined)
    upd.resolvedDate = data.resolvedDate ? Timestamp.fromDate(new Date(data.resolvedDate)) : null;
  await updateDoc(doc(db, COLLECTION, id), upd);
};

export const softDeleteIssue = async (id: string): Promise<void> => {
  await updateDoc(doc(db, COLLECTION, id), {
    deleted: true,
    deletedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
};

export const restoreIssue = async (id: string): Promise<void> => {
  await updateDoc(doc(db, COLLECTION, id), {
    deleted: false,
    deletedAt: null,
    updatedAt: Timestamp.now(),
  });
};

export const permanentDeleteIssue = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, COLLECTION, id));
};

export const seedInitialData = async (issues: IssueFormData[]): Promise<void> => {
  for (const issue of issues) {
    await addDoc(collection(db, COLLECTION), {
      ...issue,
      images: [],
      deleted: false,
      reportedDate: issue.reportedDate ? Timestamp.fromDate(new Date(issue.reportedDate)) : null,
      resolvedDate: issue.resolvedDate ? Timestamp.fromDate(new Date(issue.resolvedDate)) : null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  }
};
