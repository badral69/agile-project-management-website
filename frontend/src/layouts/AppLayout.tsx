import { Activity, Building2, Gauge, Languages, LayoutDashboard, LogOut, Moon, ShieldCheck, SquareKanban, Sun, Users, Workflow } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { AiSearchPanel } from "../components/search/AiSearchPanel";
import { MeshCanvas } from "../components/ui/MeshCanvas";
import { UserAvatar } from "../components/ui/UserAvatar";
import { useAuth } from "../features/auth/AuthContext";
import { useI18n, type SupportedLocale, type TranslationKey } from "../features/i18n/I18nContext";

type SidebarItem = {
  id: string;
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
};

const buildNavigation = (t: (key: TranslationKey) => string, role?: string): SidebarItem[] => [
  { id: "dashboard", to: "/workspace/dashboard", label: t("sidebar.dashboard"), icon: LayoutDashboard },
  { id: "projects",  to: "/workspace/projects",  label: t("sidebar.projects"),  icon: Workflow },
  { id: "tasks",     to: "/workspace/tasks",     label: t("sidebar.tasks"),     icon: SquareKanban },
  { id: "inbox",     to: "/workspace/inbox",     label: t("sidebar.activity"),  icon: Activity },
  ...(role === "ADMIN"
    ? [
        { id: "team", to: "/workspace/team", label: t("sidebar.team"), icon: Users },
        { id: "performance", to: "/workspace/performance", label: t("sidebar.performance"), icon: Gauge },
      ]
    : []),
];

export function AppLayout() {
  const { user, logout } = useAuth();
  const { t, locale, setLocale } = useI18n();
  const navigate = useNavigate();
  const navigation = useMemo(() => buildNavigation(t, user?.role), [t, user?.role]);

  const activityQuery = useQuery({
    queryKey: ["activity-badge"],
    queryFn: async () => {
      const res = await api.get<{ items: Array<{ id: string; createdAt: string }> }>("/activity?limit=5");
      return res.data.items;
    },
    refetchInterval: 60_000,
  });

  const hasNewActivity = (() => {
    const items = activityQuery.data;
    if (!items?.length) return false;
    try {
      const lastRead = localStorage.getItem("sprintflow-activity-last-read");
      if (!lastRead) return true;
      return new Date(items[0].createdAt) > new Date(lastRead);
    } catch { return false; }
  })();

  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try {
      const stored = localStorage.getItem("sprintflow-theme");
      if (stored === "dark" || stored === "light") return stored;
    } catch (_) {}
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("sprintflow-theme", theme); } catch (_) {}
  }, [theme]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="app-shell app-shell-simplified">
      <MeshCanvas className="workspace-hex-canvas" />
      <header className="topbar-workspace">
        <Link className="topbar-brand" to="/">
          <img className="brand-logo-image small hex-logo" src="/sprintflow-logo.svg" alt="SprintFlow logo" style={{ width: 28, height: 28 }} />
          <strong>SprintFlow</strong>
        </Link>

        <nav className="topbar-nav">
          {navigation.map((item) => {
            const Icon = item.icon;
            const showBadge = item.id === "inbox" && hasNewActivity;
            return (
              <NavLink
                key={item.id}
                to={item.to}
                className={({ isActive }) => isActive ? "topbar-nav-link active" : "topbar-nav-link"}
                onClick={() => {
                  if (item.id === "inbox") {
                    try { localStorage.setItem("sprintflow-activity-last-read", new Date().toISOString()); } catch { /* */ }
                  }
                }}
              >
                <span className="topbar-nav-icon-wrap">
                  <Icon size={15} />
                  {showBadge ? <span className="nav-badge-dot" /> : null}
                </span>
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="topbar-actions">
          <button
            type="button"
            className="topbar-icon-btn"
            onClick={() => setTheme((v) => (v === "dark" ? "light" : "dark"))}
            aria-label="Toggle theme"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          <label className="topbar-icon-btn topbar-lang-select" title="Language">
            <Languages size={17} />
            <select value={locale} onChange={(e) => setLocale(e.target.value as SupportedLocale)}>
              <option value="en">EN</option>
              <option value="mn">MN</option>
              <option value="ja">JA</option>
            </select>
          </label>

          {user?.role === "ADMIN" ? (
            <>
              <NavLink to="/workspace/admin/companies" title="Companies" className={({ isActive }) => isActive ? "topbar-icon-btn active" : "topbar-icon-btn"}>
                <Building2 size={17} />
              </NavLink>
              <NavLink to="/workspace/admin/users" title="Admin users" className={({ isActive }) => isActive ? "topbar-icon-btn active" : "topbar-icon-btn"}>
                <ShieldCheck size={17} />
              </NavLink>
            </>
          ) : null}

          <NavLink to="/workspace/settings" className="topbar-avatar-link" title={user?.fullName}>
            <UserAvatar fullName={user?.fullName} avatarColor={user?.avatarColor} avatarUrl={user?.avatarUrl} />
          </NavLink>

          <button type="button" className="topbar-icon-btn" onClick={handleLogout} title="Log out">
            <LogOut size={17} />
          </button>
        </div>
      </header>

      <main className="content-shell content-shell-simplified">
        <AiSearchPanel variant="workspace" />
        <Outlet />
      </main>
    </div>
  );
}
