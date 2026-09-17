import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import type { Role } from "@/types";

export function RequireAuth({ roles }: { roles?: Role[] }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream-200">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-transparent border-t-primary-600" />
      </div>
    );
  }
  if (!session) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (session.must_change_password && !location.pathname.startsWith("/force-change-password")) {
    return <Navigate to="/force-change-password" replace />;
  }
  if (roles && !roles.includes(session.role)) {
    const home = session.role === "STUDENT" ? "/student/dashboard" : "/admin/dashboard";
    return <Navigate to={home} replace />;
  }
  return <Outlet />;
}
