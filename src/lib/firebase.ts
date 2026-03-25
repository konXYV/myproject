// src/lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// ตรวจสอบว่ามี API Key หรือไม่ก่อนที่จะเริ่มรัน
const isConfigValid = !!firebaseConfig.apiKey;

const app = (getApps().length === 0 && isConfigValid) 
  ? initializeApp(firebaseConfig) 
  : (getApps().length > 0 ? getApp() : null); // ถ้าไม่มี Key ให้คืนค่า null แทนที่จะสั่ง Error

// Export แบบป้องกัน Error ถ้า app เป็น null
export const db = app ? getFirestore(app) : ({} as any);
export const auth = app ? getAuth(app) : ({} as any);

export default app;