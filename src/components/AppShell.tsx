"use client";
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/authContext";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import { RefreshCw } from "lucide-react";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, loading, perm } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user && pathname !== "/login") {
      router.replace("/login");
      return;
    }
    // If user just logged in and landed on root "/" or dashboard without permission
    if (user && pathname === "/dashboard" && !perm("page_dashboard")) {
      // Redirect to first permitted page
      if (perm("page_issues"))    { router.replace("/issues");       return; }
      if (perm("page_users"))     { router.replace("/admin/users");  return; }
      // No pages accessible — stay and show "no permission" in dashboard
    }
  }, [user, loading, pathname, perm, router]);

  if (pathname === "/login") return <>{children}</>;

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-slate-400">
        <RefreshCw size={28} className="animate-spin text-blue-500" />
        <p className="text-sm">ກໍາລັງກວດສອບການເຂົ້າສູ່ລະບົບ...</p>
      </div>
    </div>
  );

  if (!user) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
