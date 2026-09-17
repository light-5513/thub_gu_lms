import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { clsx } from "clsx";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  Layers,
  LogOut,
  Menu,
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
    <div className="flex h-screen overflow-hidden bg-cream-100">
      {/* Sidebar: dark panel chassis */}
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-40 flex w-72 flex-col transition-transform lg:static lg:translate-x-0 lg:m-4 card !rounded-3xl border-0",
          sidebarOpen ? "translate-x-0 shadow-2xl lg:shadow-none" : "-translate-x-full"
        )}
      >
        {/* Brand strip header */}
        <div className="brand-strip flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-2">
            <div className="led led-pulse-bg" />
          </div>
          <div className="screw" />
        </div>

        {/* Logo section */}
        <div className="flex flex-col items-center gap-2 px-5 py-8 text-center relative">
          <img src="/logo.png" alt="Technical Hub" className="h-12 w-auto object-contain drop-shadow-card-pill" />
          <div className="min-w-0">
            <p className="text-sm font-extrabold tracking-wide text-leather-300">Admin Console</p>
          </div>
          <button
            className="absolute top-4 right-4 rounded-2xl p-1.5 lg:hidden text-leather-300"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                clsx(
                  "sk-nav-hover group flex items-center gap-3 rounded-2xl px-3 py-2 text-[13px] font-bold tracking-tight transition",
                  isActive ? "sk-nav-active" : "text-leather-300"
                )
              }
            >
              <Icon size={15} className="shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Status footer */}
        <div className="m-4 rounded-3xl p-4 card-inset border-0 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold sk-icon-disc text-leather-300">
              {(session?.full_name || session?.email || "?").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-leather-300">
                {session?.full_name || session?.email}
              </p>
              <p className="text-xs font-semibold text-leather-500/70">
                {(session?.role || "ADMIN").replace("_", " ")}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <NavLink to="/admin/settings" className="btn-secondary flex-1 flex justify-center items-center gap-1.5 rounded-2xl py-2 text-xs font-bold text-leather-300 transition-all hover:bg-cream-200" title="Edit Profile">
              <Settings size={14} /> Profile
            </NavLink>
            <button onClick={handleLogout} className="btn-secondary flex-1 flex justify-center items-center gap-1.5 rounded-2xl py-2 text-xs font-bold text-red-600 transition-all hover:bg-cream-200" title="Log out">
              <LogOut size={14} /> Logout
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          style={{ backgroundColor: "rgba(0, 0, 0, 0.60)" }}
        />
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile menu toggle (floating) */}
        <button
          className="fixed top-4 right-4 z-50 rounded-2xl p-2 lg:hidden text-leather-300 card"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>

        <main className="min-w-0 flex-1 p-4 lg:p-6 overflow-y-auto">
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
    { to: "/student/leaderboard", label: "Leaderboard", icon: Trophy },
    { to: "/student/profile", label: "Profile", icon: BookOpen },
  ];

  const handleLogout = () => logout.mutate(undefined, { onSuccess: () => navigate("/login") });

  return (
    <div className="min-h-screen bg-cream-100">
      <header className="sk-header sticky top-0 z-20">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          <NavLink to="/student/dashboard" className="flex flex-col items-center gap-1.5 mt-2 mb-2">
            <img src="/logo.png" alt="Technical Hub" className="h-10 w-auto object-contain drop-shadow-card-pill" />
            <div className="hidden sm:block">
              <p className="text-xs font-extrabold leading-none text-leather-300">Student Portal</p>
            </div>
          </NavLink>
          <nav className="ml-4 hidden items-center gap-1 sm:flex">
            {links.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  clsx(
                    "flex items-center gap-1.5 rounded-2xl px-3 py-1.5 text-[13px] font-bold transition",
                    isActive ? "sk-nav-active" : "text-leather-300 hover:bg-cream-200/50"
                  )
                }
              >
                <Icon size={14} />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <div
              className="hidden h-9 w-9 items-center justify-center rounded-full text-xs font-bold sm:flex sk-icon-disc text-leather-300"
            >
              {(session?.full_name || session?.email || "?").slice(0, 1).toUpperCase()}
            </div>
            <button onClick={handleLogout} className="btn-secondary inline-flex items-center gap-1.5 rounded-2xl px-2.5 py-1.5 text-xs font-bold">
              <LogOut size={13} /> <span className="hidden sm:inline">Logout</span>
            </button>
            <button
              className="rounded-2xl p-2 sm:hidden text-leather-300"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Menu"
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav className="px-4 py-2 sm:hidden">
            {links.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  clsx(
                    "block rounded-2xl px-3 py-2 text-sm font-bold transition",
                    isActive ? "sk-nav-active" : "text-leather-300"
                  )
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>
      <main className="mx-auto max-w-6xl p-4 lg:p-6">
        <Outlet />
      </main>
    </div>
  );
}