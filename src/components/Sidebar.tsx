"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, ClipboardList, Users, X, ChevronRight,
  FileText, BarChart3, Settings, Bell, Star, Bookmark, Globe,
  Database, ShieldCheck, Folder, Tag, Package, Layers, LayoutList,
} from "lucide-react";
import { useAuth } from "@/lib/authContext";
import type { IconName } from "@/lib/menuService";

// Static menus (always exist, permission-gated)
const STATIC_NAV = [
  { href: "/dashboard",   label: "Dashboard",    icon: "LayoutDashboard" as IconName, permKey: "page_dashboard" },
  { href: "/issues",      label: "ລາຍງານບັນຫາ", icon: "ClipboardList"   as IconName, permKey: "page_issues"    },
];

// Map icon name string → component
const ICON_MAP: Record<IconName, React.ElementType> = {
  LayoutDashboard, ClipboardList, Users, FileText, BarChart3,
  Settings, Bell, Star, Bookmark, Globe, Database,
  ShieldCheck, Folder, Tag, Package, Layers,
};


// Admin nav (always shown to admins, uses permKey user_manage)
const ADMIN_NAV = [
  { href: "/admin/users", label: "ຈັດການ Users",  icon: "Users"       as IconName, permKey: "page_users"   },
  { href: "/admin/menus", label: "ຈັດການ Menus",  icon: "LayoutList"  as IconName, permKey: "user_manage" },
];

function NavIcon({ name, size = 16, className }: { name: IconName; size?: number; className?: string }) {
  const Icon = ICON_MAP[name] ?? Folder;
  return <Icon size={size} className={className}/>;
}

interface Props { open: boolean; onClose: () => void; }

export default function Sidebar({ open, onClose }: Props) {
  const pathname = usePathname();
  const { user, perm, menus } = useAuth();

  const staticNav = STATIC_NAV.filter((n) => perm(n.permKey));
  const dynamicNav = menus.filter((m) => m.active && perm(m.permKey));
  const adminNav   = ADMIN_NAV.filter((n) => perm(n.permKey));

  const NavItem = ({ href, label, icon }: { href: string; label: string; icon: IconName }) => {
    const active = pathname === href || pathname.startsWith(href + "/");
    return (
      <Link href={href} onClick={onClose}
        className={`group flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all
          ${active ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}>
        <NavIcon name={icon} size={16}
          className={active ? "text-white" : "text-slate-400 group-hover:text-slate-600"}/>
        <span className="flex-1 font-medium truncate">{label}</span>
        {active && <ChevronRight size={14} className="opacity-70 shrink-0"/>}
      </Link>
    );
  };

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={onClose}/>}

      <aside className={`
        fixed top-0 left-0 h-full z-40 flex flex-col w-56
        bg-white border-r border-slate-200 shadow-lg
        transition-transform duration-300 ease-in-out
        ${open ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0 lg:static lg:z-auto lg:h-screen lg:shrink-0
      `}>

        {/* Logo */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0 overflow-hidden">
              <img src="/sokxay.png" alt="logo" className="w-8 h-8 object-contain"
                onError={(e) => {
                  const el = e.currentTarget as HTMLImageElement;
                  el.style.display = "none";
                  const p = el.parentElement;
                  if (p) p.innerHTML = `<span class="text-white text-xs font-bold">S+</span>`;
                }}/>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 leading-tight">Sokxay One Plus</p>
              <p className="text-[10px] text-slate-400 leading-tight">Issue Tracker</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden p-1 text-slate-400 hover:text-slate-600 rounded">
            <X size={16}/>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">

          {/* Static menus */}
          {staticNav.length > 0 && (
            <div>
              <p className="px-3 mb-1.5 text-[10px] font-semibold text-slate-400 tracking-widest uppercase">MAIN</p>
              <div className="space-y-0.5">
                {staticNav.map((n) => <NavItem key={n.href} href={n.href} label={n.label} icon={n.icon}/>)}
              </div>
            </div>
          )}

          {/* Dynamic menus */}
          {dynamicNav.length > 0 && (
            <div>
              <p className="px-3 mb-1.5 text-[10px] font-semibold text-slate-400 tracking-widest uppercase">MENUS</p>
              <div className="space-y-0.5">
                {dynamicNav.map((m) => <NavItem key={m.id} href={m.href} label={m.label} icon={m.icon}/>)}
              </div>
            </div>
          )}

          {/* Admin section */}
          {adminNav.length > 0 && (
            <div>
              <p className="px-3 mb-1.5 text-[10px] font-semibold text-slate-400 tracking-widest uppercase">ADMIN</p>
              <div className="space-y-0.5">
                {adminNav.map((n) => <NavItem key={n.href} href={n.href} label={n.label} icon={n.icon}/>)}
              </div>
            </div>
          )}
        </nav>

        {/* Footer */}
        {user && (
          <div className="px-4 py-3 border-t border-slate-100 shrink-0">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                ${user.isAdmin ? "bg-violet-100 text-violet-700" : "bg-blue-100 text-blue-700"}`}>
                {user.displayName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-700 truncate">{user.displayName}</p>
                <p className={`text-[10px] ${user.isAdmin ? "text-violet-500" : "text-blue-500"}`}>
                  {user.isAdmin ? "Admin" : "Custom"}
                </p>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
