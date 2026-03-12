import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { client, User } from "@/api/client";
import { useTheme } from "@/lib/ThemeContext";
import type { AgeProfile } from "@/types";
import {
  Code2, Home, BookOpen, Play, LayoutDashboard, Users,
  Menu, X, LogOut, Star, Flame, Sparkles, Monitor, Rocket
} from "lucide-react";

interface LayoutProps { children: React.ReactNode; currentPageName: string; }

const NAV = [
  { label: "Home", page: "Home", icon: Home, public: true },
  { label: "Curriculum", page: "Curriculum", icon: BookOpen, public: true },
  { label: "Visualizer", page: "Visualizer", icon: Play, public: true },
  { label: "Dashboard", page: "Dashboard", icon: LayoutDashboard, auth: true },
  { label: "Teacher", page: "TeacherDashboard", icon: Users, auth: true, role: "teacher" },
];

const HIDDEN_NAV_PAGES = ["Auth", "Onboarding", "Visualizer"];

// Theme switcher config
const THEME_OPTIONS: { mode: AgeProfile; icon: typeof Sparkles; label: string }[] = [
  { mode: "fun", icon: Sparkles, label: "Fun" },
  { mode: "balanced", icon: Monitor, label: "Balanced" },
  { mode: "pro", icon: Rocket, label: "Pro" },
];

export default function Layout({ children, currentPageName }: LayoutProps) {
  const [user, setUser] = useState<User | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const { mode, setMode, isFun, isPro } = useTheme();

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

  // App name changes per theme
  const appName = isFun ? "FireFly ✨" : "FireFly";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <style>{`
        :root { --font-sans: 'Inter', sans-serif; }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: hsl(var(--muted-foreground) / 0.2); border-radius: 3px; }
      `}</style>

      {/* Top nav */}
      <nav className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-6">
          {/* Logo */}
          <Link to={createPageUrl("Home")} className="flex items-center gap-2 shrink-0">
            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center ${isFun ? "rounded-xl" : ""}`}>
              <Code2 className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold ff-text-sm hidden sm:block">{appName}</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1 flex-1">
            {visibleNav.map(n => (
              <Link key={n.page} to={createPageUrl(n.page)}>
                <button className={`flex items-center gap-1.5 px-3 py-1.5 ff-rounded ff-text-sm transition-colors ${
                  currentPageName === n.page
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}>
                  <n.icon className="w-3.5 h-3.5" />
                  {n.label}
                </button>
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="ml-auto flex items-center gap-2">
            {/* Theme switcher */}
            <div className="relative">
              <button
                onClick={() => setThemeMenuOpen(!themeMenuOpen)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                title="Switch theme"
              >
                {mode === "fun" && <Sparkles className="w-4 h-4" />}
                {mode === "balanced" && <Monitor className="w-4 h-4" />}
                {mode === "pro" && <Rocket className="w-4 h-4" />}
              </button>
              {themeMenuOpen && (
                <>
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label="Close theme menu"
                    className="fixed inset-0 z-40"
                    onClick={() => setThemeMenuOpen(false)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setThemeMenuOpen(false); }}
                  />
                  <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[140px]">
                    {THEME_OPTIONS.map(opt => (
                      <button
                        key={opt.mode}
                        onClick={() => { setMode(opt.mode); setThemeMenuOpen(false); }}
                        className={`w-full flex items-center gap-2 px-3 py-2 ff-text-sm transition-colors ${
                          mode === opt.mode
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-muted-foreground hover:text-foreground hover:bg-accent"
                        }`}
                      >
                        <opt.icon className="w-4 h-4" />
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {user ? (
              <div className="flex items-center gap-3">
                {!isPro && (
                  <div className="hidden sm:flex items-center gap-2 text-xs">
                    <span className="flex items-center gap-1 text-amber-500"><Star className="w-3 h-3" />{(user?.xp ?? 0).toLocaleString()}</span>
                    <span className="flex items-center gap-1 text-rose-500"><Flame className="w-3 h-3" />{user?.streak ?? 0}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground">
                    {user?.full_name?.[0] ?? user?.displayName?.[0] ?? "U"}
                  </div>
                  <button
                    onClick={() => client.auth.logout()}
                    className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <Link to={createPageUrl("Auth")}>
                <button className="px-4 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground ff-text-sm font-semibold transition-colors">
                  Sign In
                </button>
              </Link>
            )}

            {/* Mobile menu toggle */}
            <button
              className="md:hidden p-1.5 text-muted-foreground hover:text-foreground"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <div className="md:hidden border-t border-border bg-card px-4 py-3 space-y-1">
            {visibleNav.map(n => (
              <Link key={n.page} to={createPageUrl(n.page)} onClick={() => setMobileOpen(false)}>
                <button className={`w-full flex items-center gap-2 px-3 py-2.5 ff-rounded ff-text-sm transition-colors ${
                  currentPageName === n.page
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}>
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
