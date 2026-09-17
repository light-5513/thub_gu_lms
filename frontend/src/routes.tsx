import { createBrowserRouter, Navigate } from "react-router-dom";
import { RequireAuth } from "@/layouts/RequireAuth";
import { AdminLayout, StudentLayout } from "@/layouts/PortalLayouts";
import { LoginPage } from "@/features/auth/LoginPage";
import { ForgotPasswordPage } from "@/features/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "@/features/auth/ResetPasswordPage";
import { ForceChangePasswordPage } from "@/features/auth/ForceChangePasswordPage";
import { AcceptInvitationPage } from "@/features/auth/AcceptInvitationPage";
import { ContactPage } from "@/features/public/ContactPage";
import { StudentDashboardPage } from "@/features/student/DashboardPage";
import { LeaderboardPage } from "@/features/student/LeaderboardPage";
import { ProfilePage } from "@/features/student/ProfilePage";
import { AdminDashboardPage } from "@/features/admin/DashboardPage";
import { StudentsPage } from "@/features/admin/StudentsPage";
import { StudentReportPage } from "@/features/admin/StudentReportPage";
import { InvitationsPage } from "@/features/admin/InvitationsPage";
import { ClassesPage } from "@/features/admin/ClassesPage";
import { AttendancePage } from "@/features/admin/AttendancePage";
import { CodingProfilesAdminPage } from "@/features/admin/CodingProfilesPage";
import { AdminLeaderboardsPage } from "@/features/admin/LeaderboardsPage";
import { AnalyticsPage } from "@/features/admin/AnalyticsPage";
import { ReportsPage } from "@/features/admin/ReportsPage";
import { SettingsPage } from "@/features/admin/SettingsPage";
import { AuditLogsPage } from "@/features/admin/AuditLogsPage";
import { BatchesPage } from "@/features/admin/BatchesPage";

const STAFF = ["SUPER_ADMIN", "ADMIN", "TEACHER"] as const;

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/login" replace /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/forgot-password", element: <ForgotPasswordPage /> },
  { path: "/reset-password", element: <ResetPasswordPage /> },
  { path: "/accept-invitation", element: <AcceptInvitationPage /> },
  { path: "/contact", element: <ContactPage /> },

  {
    element: <RequireAuth />,
    children: [
      { path: "/force-change-password", element: <ForceChangePasswordPage /> },
    ],
  },

  {
    element: <RequireAuth roles={["STUDENT"]} />,
    children: [
      {
        element: <StudentLayout />,
        children: [
          { path: "/student", element: <Navigate to="/student/dashboard" replace /> },
          { path: "/student/dashboard", element: <StudentDashboardPage /> },
          { path: "/student/leaderboard", element: <LeaderboardPage /> },
          { path: "/student/profile", element: <ProfilePage /> },
        ],
      },
    ],
  },

  {
    element: <RequireAuth roles={[...STAFF]} />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          { path: "/admin", element: <Navigate to="/admin/dashboard" replace /> },
          { path: "/admin/dashboard", element: <AdminDashboardPage /> },
          { path: "/admin/students", element: <StudentsPage /> },
          { path: "/admin/students/:id/report", element: <StudentReportPage /> },
          { path: "/admin/invitations", element: <InvitationsPage /> },
          { path: "/admin/classes", element: <ClassesPage /> },
          { path: "/admin/attendance", element: <AttendancePage /> },
          { path: "/admin/coding-profiles", element: <CodingProfilesAdminPage /> },
          { path: "/admin/leaderboards", element: <AdminLeaderboardsPage /> },
          { path: "/admin/analytics", element: <AnalyticsPage /> },
          { path: "/admin/reports", element: <ReportsPage /> },
          { path: "/admin/batches", element: <BatchesPage /> },
          { path: "/admin/settings", element: <SettingsPage /> },
          { path: "/admin/audit-logs", element: <AuditLogsPage /> },
        ],
      },
    ],
  },

  { path: "*", element: <Navigate to="/login" replace /> },
]);
