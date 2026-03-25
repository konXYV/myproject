"use client";
import { useState } from "react";
import { Menu, Bell, ChevronRight, Home, LogOut, ChevronDown, Crown, Shield } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/authContext";
import { logoutUser } from "@/lib/authService";

const PAGE_META: Record<string, { title: string; breadcrumb: string[] }> = {
  "/dashboard":   { title: "Dashboard",    breadcrumb: ["Home", "Dashboard"]      },
  "/issues":      { title: "ລາຍງານບັນຫາ", breadcrumb: ["Home", "ລາຍງານ", "ບັນຫາ"] },
  "/admin/users": { title: "ຈັດການ Users", breadcrumb: ["Home", "Admin", "Users"]  },
  "/admin/menus": { title: "ຈັດການ Menus", breadcrumb: ["Home", "Admin", "Menus"]  },
};

interface Props { onMenuClick: () => void; }

export default function Navbar({ onMenuClick }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [userMenu, setUserMenu] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const meta = PAGE_META[pathname] ?? { title: "Sokxay Issue Tracker", breadcrumb: ["Home"] };

  const handleLogout = async () => {
    setLoggingOut(true);
    try { await logoutUser(); router.replace("/login"); }
    catch { setLoggingOut(false); }
  };

  const avatarColor = user?.isAdmin
    ? "bg-violet-100 text-violet-700"
    : "bg-blue-100 text-blue-700";

  const roleLabel = user?.isAdmin ? "Admin" : "Custom";
  const roleBadge = user?.isAdmin
    ? "bg-violet-100 text-violet-700"
    : "bg-blue-100 text-blue-700";

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center px-3 sm:px-5 gap-3 shrink-0 sticky top-0 z-20">

      <button onClick={onMenuClick} className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors">
        <Menu size={18}/>
      </button>

      {/* Breadcrumb */}
      <div className="hidden sm:flex items-center gap-1 text-xs text-slate-500">
        <Home size={12} className="text-slate-400"/>
        {meta.breadcrumb.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1">
            <ChevronRight size={11} className="text-slate-300"/>
            <span className={i === meta.breadcrumb.length - 1 ? "text-blue-600 font-medium" : ""}>{crumb}</span>
          </span>
        ))}
      </div>

      <span className="sm:hidden text-sm font-semibold text-slate-800">{meta.title}</span>

      <div className="ml-auto flex items-center gap-2">
        <span className="hidden lg:inline text-xs text-slate-400 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
          {new Date().toLocaleDateString("lo-LA", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}
        </span>

        <button className="relative p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
          <Bell size={16}/>
          <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full border border-white"/>
        </button>

        {user && (
          <div className="relative">
            <button onClick={() => setUserMenu(!userMenu)}
              className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl hover:bg-slate-100 transition-colors">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${avatarColor}`}>
                {user.displayName.charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-semibold text-slate-700 leading-tight">{user.displayName}</p>
                <p className={`text-[10px] leading-tight ${user.isAdmin ? "text-violet-500" : "text-blue-500"}`}>
                  {roleLabel}
                </p>
              </div>
              <ChevronDown size={13} className="text-slate-400 hidden sm:block"/>
            </button>

            {userMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setUserMenu(false)}/>
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl border border-slate-200 shadow-xl z-20 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                    <p className="text-sm font-semibold text-slate-800">{user.displayName}</p>
                    <p className="text-xs text-slate-400 truncate">{user.email}</p>
                    <span className={`inline-flex items-center gap-1 mt-1.5 text-[10px] px-2 py-0.5 rounded-full font-medium ${roleBadge}`}>
                      {user.isAdmin ? <Crown size={9}/> : <Shield size={9}/>}
                      {roleLabel}
                    </span>
                  </div>
                  <div className="p-1">
                    <button onClick={handleLogout} disabled={loggingOut}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50">
                      <LogOut size={15}/>
                      {loggingOut ? "ກໍາລັງອອກ..." : "ອອກຈາກລະບົບ"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
