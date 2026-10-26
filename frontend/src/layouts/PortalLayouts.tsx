import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { clsx } from "clsx";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  Layers,
  LogOut,
  Menu,
  MonitorPlay,
  RefreshCcw,
  ScrollText,
  Settings,
  Trophy,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLogout } from "@/api/hooks";
import { Dropdown, DropdownItem, dropdownItemClasses } from "@/components/ui/navigation";

const NAV = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/students", label: "Students", icon: Users },
  { to: "/admin/batches", label: "Batches", icon: Layers },
  { to: "/admin/invitations", label: "Invitations", icon: UserPlus },
  { to: "/admin/classes", label: "Classes", icon: CalendarDays },
  { to: "/admin/attendance", label: "Attendance", icon: ClipboardCheck },
  { to: "/admin/coding-profiles", label: "Coding Profiles", icon: RefreshCcw },
  { to: "/admin/leaderboards", label: "Leaderboards", icon: Trophy },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/admin/reports", label: "Reports", icon: FileText },
  { to: "/admin/sandbox", label: "Sandbox", icon: MonitorPlay },
  { to: "/admin/settings", label: "Settings", icon: Settings },
  { to: "/admin/audit-logs", label: "Audit Logs", icon: ScrollText },
];

export function AdminLayout() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const logout = useLogout();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const handleLogout = () => logout.mutate(undefined, { onSuccess: () => navigate("/login") });

  return (
    <div className="flex min-h-screen bg-cream-100 lg:h-screen lg:overflow-hidden">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-slate-950/35 backdrop-blur-[2px] lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={clsx(
          "fixed inset-y-3 left-3 z-40 flex w-[min(18rem,86vw)] flex-col rounded-3xl bg-[var(--bg)] shadow-card transition-transform duration-200 lg:static lg:my-4 lg:ml-4 lg:mr-0 lg:z-auto lg:w-72 lg:shrink-0 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-[calc(100%+3rem)]"
        )}
        aria-label="Admin navigation"
      >
        <div className="relative flex shrink-0 flex-col items-center gap-4 px-7 pb-6 pt-12 text-center lg:pt-14">
          <img src="/logo.png" alt="Technical Hub" className="h-auto w-full max-w-60 object-contain" />
          <p className="text-base font-bold text-[var(--text)]">Admin Console</p>
          <button className="btn-ghost absolute right-3 top-3 rounded-full p-2 text-[var(--text-muted)] lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-5" aria-label="Main navigation">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => clsx(
                "sk-nav-hover group flex min-h-10 items-center gap-3 rounded-full px-3 py-2 text-[13px] font-semibold transition-colors",
                isActive ? "sk-nav-active" : "text-[var(--text)]"
              )}
            >
              <Icon size={17} className="shrink-0" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="card-inset m-4 shrink-0 p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="sk-icon-disc flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
              {(session?.full_name || session?.email || "?").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-[var(--text)]">{session?.full_name || session?.email}</p>
              <p className="text-xs text-[var(--text-muted)]">{(session?.role || "ADMIN").replace(/_/g, " ")}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <NavLink to="/admin/settings" className="btn-secondary inline-flex items-center justify-center gap-1.5 rounded-full px-2 py-2 text-xs" title="Edit profile">
              <Settings size={14} /> Profile
            </NavLink>
            <button onClick={handleLogout} disabled={logout.isPending} className="btn-danger inline-flex items-center justify-center gap-1.5 rounded-full px-2 py-2 text-xs" title="Log out">
              <LogOut size={14} /> Logout
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:h-screen">
        <div className="sk-header sticky top-0 z-20 flex h-14 shrink-0 items-center px-4 lg:hidden">
          <button className="btn-ghost rounded-full p-2 text-[var(--text-muted)]" onClick={() => setSidebarOpen(true)} aria-label="Open menu" aria-expanded={sidebarOpen}>
            <Menu size={20} />
          </button>
          <span className="ml-2 text-sm font-semibold">Admin portal</span>
        </div>
        <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:px-10 lg:py-7">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function StudentLayout() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const logout = useLogout();
  const [menuOpen, setMenuOpen] = useState(false);
  const links = [
    { to: "/student/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/student/coding", label: "Coding stats", icon: BarChart3 },
    { to: "/student/leaderboard", label: "Leaderboard", icon: Trophy },
  ];
  const handleLogout = () => logout.mutate(undefined, { onSuccess: () => navigate("/login") });

  return (
    <div className="min-h-screen bg-cream-100 pt-3 sm:pt-4">
      <header className="sticky top-3 z-20 mx-3 rounded-3xl bg-[var(--bg)] shadow-card sm:top-4 sm:mx-4">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
          <NavLink to="/student/dashboard" className="flex shrink-0 items-center gap-2.5">
            <img src="/logo.png" alt="Technical Hub" className="h-auto w-36 object-contain sm:w-44" />
          </NavLink>
          <nav className="ml-2 hidden items-center gap-1 sm:flex" aria-label="Student navigation">
            {links.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} className={({ isActive }) => clsx(
                "sk-nav-hover flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                isActive ? "sk-nav-active" : "text-[var(--text)]"
              )}>
                <Icon size={16} aria-hidden="true" /> {label}
              </NavLink>
            ))}
          </nav>
          <div className="relative ml-auto flex items-center gap-1.5">
            <Dropdown
              menuWidth={256}
              label="My account"
              trigger={
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-full p-1 pr-2 text-[var(--text)] hover:text-primary-600 hover:shadow-card-recess focus-visible:shadow-card-recess"
                  aria-label="Open profile menu"
                >
                  <span className="sk-icon-disc flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold">
                    {(session?.full_name || session?.email || "?").slice(0, 1).toUpperCase()}
                  </span>
                  <span className="hidden max-w-36 truncate text-sm font-medium md:inline">{session?.full_name || "My account"}</span>
                  <ChevronDown size={14} className="text-[var(--text-muted)]" aria-hidden="true" />
                </button>
              }
            >
              {(close) => (
                <>
                  <div className="mb-1 border-b border-[var(--border)] px-3.5 py-2.5" role="presentation">
                    <p className="truncate text-sm font-semibold text-[var(--text)]">{session?.roll_number || session?.full_name || "Student"}</p>
                    <p className="truncate text-xs text-[var(--text-muted)]">{session?.email}</p>
                  </div>
                  <NavLink to="/student/profile" role="menuitem" tabIndex={-1} onClick={() => close()} className={`${dropdownItemClasses} text-leather-200 hover:text-primary-600 focus-visible:text-primary-600`}>
                    <BookOpen size={16} /> Profile
                  </NavLink>
                  <DropdownItem danger onClick={() => { close(); handleLogout(); }} disabled={logout.isPending}>
                    <LogOut size={16} /> Logout
                  </DropdownItem>
                </>
              )}
            </Dropdown>
            <button className="btn-ghost rounded-full p-2 text-[var(--text-muted)] sm:hidden" onClick={() => setMenuOpen((open) => !open)} aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen}>
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav className="space-y-1 px-4 pb-4 pt-2 sm:hidden" aria-label="Student navigation">
            {links.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} onClick={() => setMenuOpen(false)} className={({ isActive }) => clsx(
                "sk-nav-hover flex items-center gap-2 rounded-full px-3 py-2.5 text-sm font-semibold",
                isActive ? "sk-nav-active" : "text-[var(--text)]"
              )}>
                <Icon size={16} aria-hidden="true" /> {label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>
      <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
}
