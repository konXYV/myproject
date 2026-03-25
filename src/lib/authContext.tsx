"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getUserProfile, ADMIN_PERMISSIONS, type AppUser, type PermKey } from "@/lib/authService";
import { subscribeToMenus, type AppMenu } from "@/lib/menuService";

interface AuthCtx {
  user:    AppUser | null;
  loading: boolean;
  menus:   AppMenu[];           // dynamic menus from Firestore
  perm:    (key: string) => boolean;  // supports both static PermKey + dynamic permKey
}

const AuthContext = createContext<AuthCtx>({
  user: null, loading: true, menus: [], perm: () => false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,    setUser]    = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [menus,   setMenus]   = useState<AppMenu[]>([]);

  // Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        const profile = await getUserProfile(fbUser.uid);
        setUser(profile && profile.active ? profile : null);
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Subscribe to dynamic menus (realtime)
  useEffect(() => {
    const unsub = subscribeToMenus((m) => setMenus(m));
    return () => unsub();
  }, []);

  // Permission check — works for static keys AND dynamic permKeys from Firestore
  const perm = (key: string): boolean => {
    if (!user) return false;
    if (user.isAdmin) return true;
    // Check static permissions object
    if (key in user.permissions) return user.permissions[key as PermKey];
    // Check dynamic menu permissions stored as extra keys in user.permissions
    return (user.permissions as Record<string, boolean>)[key] ?? false;
  };

  return (
    <AuthContext.Provider value={{ user, loading, menus, perm }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
