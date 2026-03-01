import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { client } from "@/api/client";
import {
  Code2, Home, BookOpen, Play, LayoutDashboard, Users,
  Menu, X, LogOut, Star, Flame
} from "lucide-react";

interface LayoutProps { children: React.ReactNode; currentPageName: string; }

const NAV = [
  { label: "Home", page: "Home", icon: Home, public: true },
  { label: "Curriculum", page: "Curriculum", icon: BookOpen, public: true },
  { label: "Visualizer", page: "Visualizer", icon: Play, public: true },
  { label: "Dashboard", page: "Dashboard", icon: LayoutDashboard, auth: true },
  { label: "Teacher", page: "TeacherDashboard", icon: Users, auth: true, role: "teacher" },
];

const HIDDEN_NAV_PAGES = ["Auth", "Visualizer"];

export default function Layout({ children, currentPageName }: LayoutProps) {
  const [user, setUser] = useState<Record<string, unknown> | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    client.auth.me().then(u => setUser(u)).catch(() => {});
  }, []);

  const hideNav = HIDDEN_NAV_PAGES.includes(currentPageName);

  if (hideNav) return <>{children}</>;

  const visibleNav = NAV.filter(n => {
    if (n.auth && !user) return false;
    if (n.role && user?.role !== n.role && user?.role !== "admin") return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <style>{`
        :root { --font-sans: 'Inter', sans-serif; }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
      `}</style>

      {/* Top nav */}
      <nav className="sticky top-0 z-40 border-b border-white/8 bg-[#0a0a0f]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-6">
          {/* Logo */}
          <Link to={createPageUrl("Home")} className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center">
              <Code2 className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-sm hidden sm:block">CodeSpark</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1 flex-1">
            {visibleNav.map(n => (
              <Link key={n.page} to={createPageUrl(n.page)}>
                <button className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${currentPageName === n.page ? "bg-white/10 text-white" : "text-slate-400 hover:text-white hover:bg-white/5"}`}>
                  <n.icon className="w-3.5 h-3.5" />
                  {n.label}
                </button>
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2 text-xs">
                  <span className="flex items-center gap-1 text-amber-400"><Star className="w-3 h-3" />{((user?.xp as number) ?? 0).toLocaleString()}</span>
                  <span className="flex items-center gap-1 text-rose-400"><Flame className="w-3 h-3" />{(user?.streak as number) ?? 0}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-xs font-bold">
                    {(user?.full_name as string)?.[0] ?? "U"}
                  </div>
                  <button
                    onClick={() => client.auth.logout()}
                    className="p-1.5 text-slate-500 hover:text-white transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <Link to={createPageUrl("Auth")}>
                <button className="px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-semibold transition-colors">
                  Sign In
                </button>
              </Link>
            )}

            {/* Mobile menu toggle */}
            <button
              className="md:hidden p-1.5 text-slate-400 hover:text-white"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <div className="md:hidden border-t border-white/8 bg-[#0d0d14] px-4 py-3 space-y-1">
            {visibleNav.map(n => (
              <Link key={n.page} to={createPageUrl(n.page)} onClick={() => setMobileOpen(false)}>
                <button className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-colors ${currentPageName === n.page ? "bg-white/10 text-white" : "text-slate-400 hover:text-white hover:bg-white/5"}`}>
                  <n.icon className="w-4 h-4" />
                  {n.label}
                </button>
              </Link>
            ))}
          </div>
        )}
      </nav>

      <main>{children}</main>
    </div>
  );
}