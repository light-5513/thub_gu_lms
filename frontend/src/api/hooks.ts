import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, getBatches, createBatch, updateBatch, deleteBatch, assignBatchStudents, uploadBatchStudents, getBatchStudents, removeBatchStudent } from "./client";
import type {
  AdminDashboard,
  AppSettings,
  AttendanceEntry,
  AuditLog,
  BatchMonitor,
  BatchSummary,
  ClassItem,
  CodingActivityResponse,
  CodingProfile,
  HeatmapDay,
  LeaderboardData,
  LoginResponse,
  Paginated,
  SessionView,
  Student,
  SyncJob,
} from "@/types";

export const qk = {
  studentDashboard: ["student", "dashboard"] as const,
  studentProfile: ["student", "profile"] as const,
  attendance: (year?: number) => ["student", "attendance", year ?? "all"] as const,
  heatmap: (year: number) => ["student", "heatmap", year] as const,
  streak: ["student", "streak"] as const,
  codingProfiles: ["student", "coding-profiles"] as const,
  leaderboard: (scope: string, tab: string) => ["leaderboard", scope, tab] as const,
  adminDashboard: ["admin", "dashboard"] as const,
  students: (params: URLSearchParams) => ["admin", "students", params.toString()] as const,
  student: (id: string) => ["admin", "student", id] as const,
  classes: (params: URLSearchParams) => ["admin", "classes", params.toString()] as const,
  session: (classId: string) => ["admin", "session", classId] as const,
  syncJobs: ["admin", "sync-jobs"] as const,
  syncJob: (id: string) => ["admin", "sync-job", id] as const,
  settings: ["admin", "settings"] as const,
  auditLogs: (page: number) => ["admin", "audit-logs", page] as const,
};

// ------------------------------------------------------------------ auth
export function useLogin() {
  return useMutation({
    mutationFn: async (payload: { email: string; password: string }) =>
      (await api.post<LoginResponse>("/auth/login", payload)).data,
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => api.post("/auth/logout"),
    onSettled: () => qc.clear(),
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: async (email: string) => (await api.post("/auth/forgot-password", { email })).data,
  });
}

export function useSandboxToken() {
  return useMutation({
    mutationFn: async (rollNumber: string) => 
      (await api.get<{ access_token: string }>(`/auth/sandbox-token`, { params: { roll_number: rollNumber } })).data,
  });
}

// ------------------------------------------------------------------ Email and WhatsApp invitations
export type InvitationChannel = "email" | "whatsapp";

export function useCreateInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { email: string; phone?: string; channels: InvitationChannel[] }) =>
      (await api.post<{
        message: string;
        channels: { email: string | null; whatsapp: string | null };
        partial: boolean;
      }>("/admin/invitations", data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "invitations"] }),
  });
}

export interface BulkInviteResult {
  email: string;
  ok: boolean;
  message: string;
  channels?: { email: string | null; whatsapp: string | null };
  partial?: boolean;
}

export interface WhatsAppConnectionStatus {
  configured: boolean;
  state: string;
  qr_data_url?: string | null;
  session_saved?: boolean;
  session_error?: string | null;
  error?: string | null;
}

export function useWhatsAppConnectionStatus(enabled: boolean) {
  return useQuery({
    queryKey: ["admin", "invitations", "whatsapp-status"],
    queryFn: async () => (await api.get<WhatsAppConnectionStatus>("/admin/invitations/whatsapp/status")).data,
    enabled,
    refetchInterval: enabled ? 5000 : false,
  });
}

export function useInviteBulk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      recipients: Array<{ email: string; phone?: string }>;
      channels: InvitationChannel[];
    }) =>
      (
        await api.post<{ total: number; accepted: number; partial: number; failed: number; results: BulkInviteResult[] }>(
          "/admin/invitations/bulk",
          data
        )
      ).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "invitations"] }),
  });
}

export interface ParsedInvitationUpload {
  items: Array<{ email: string; phone: string | null }>;
  invalid_rows: Array<{ row: number; message: string }>;
}

export function useParseInvitationUpload() {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return (
        await api.post<ParsedInvitationUpload>("/admin/invitations/bulk/parse", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        })
      ).data;
    },
  });
}

export interface PendingInvitation {
  id: string;
  email: string;
  created_at?: string | null;
  expires_at?: string | null;
  email_status?: "queued" | "sending" | "sent" | "failed" | null;
  email_error?: string | null;
  whatsapp_status?: "queued" | "sending" | "sent" | "failed" | null;
  whatsapp_error?: string | null;
}

export function usePendingInvitations() {
  return useQuery({
    queryKey: ["admin", "invitations", "pending"],
    queryFn: async () => (await api.get<{ items: PendingInvitation[] }>("/admin/invitations/pending")).data.items,
    refetchInterval: 5000,
  });
}

export function useRevokeInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => api.delete(`/admin/invitations/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "invitations"] }),
  });
}

export function useAcceptInvitation() {
  return useMutation({
    mutationFn: async (payload: { token: string; first_name: string; last_name: string; roll_number: string; course: string; branch: string; section: string; phone?: string; password: string }) =>
      (await api.post<{ message: string; email: string }>("/auth/accept-invitation", payload)).data,
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: async (p: { token: string; new_password: string }) =>
      (await api.post("/auth/reset-password", p)).data,
  });
}

export function useForceChangePassword() {
  return useMutation({
    mutationFn: async (new_password: string) =>
      (await api.post("/auth/force-change-password", { new_password })).data,
  });
}

// ------------------------------------------------------------------ student
export interface StudentDashboardData {
  student: { id: string; first_name: string; last_name: string; course: string; branch: string; section: string; roll_number: string };
  attendance: { percentage: number | null; present: number; late: number; absent: number; leave: number; total_classes: number; threshold: number };
  streaks: { current_streak: number; longest_streak: number };
  coding: { score: number; platforms: { platform: string; statistics: Record<string, number> }[] };
  scores: { overall_score: number; attendance_score: number; coding_score: number; streak_score: number };
  overall_rank: number | null;
}

const useGet = <T>(key: readonly unknown[], url: string, enabled = true) =>
  useQuery({ queryKey: key, queryFn: async () => (await api.get<T>(url)).data, enabled });

export const useStudentDashboard = () => useGet<StudentDashboardData>(qk.studentDashboard, "/student/dashboard");
export const useStudentProfile = () => useGet<{ id: string; first_name: string; last_name: string; email: string; roll_number: string; course: string; branch: string; section: string; phone?: string | null; permissions: Record<string, boolean> }>(qk.studentProfile, "/student/profile");
export const useAttendanceRecords = (year?: number) =>
  useGet<{ records: { date: string; status: string; subject?: string | null; topic?: string | null }[] }>(qk.attendance(year), `/student/attendance${year ? `?year=${year}` : ""}`);
export const useHeatmap = (year: number) => useGet<{ year: number; days: HeatmapDay[] }>(qk.heatmap(year), `/student/heatmap?year=${year}`);
export const useStreak = () => useGet<{ current_streak: number; longest_streak: number; total_present_sessions: number; total_sessions: number; attendance_percentage: number | null }>(qk.streak, "/student/streak");
export const useLeaderboard = (
  scope: "student" | "admin",
  tab: string,
  filters: { course?: string; branch?: string; section?: string; batch_id?: string } = {},
  startDate?: string,
  endDate?: string,
) => {
  const params = new URLSearchParams({ tab });
  Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
  if (startDate && endDate) {
    params.set("start_date", startDate);
    params.set("end_date", endDate);
  }
  const query = params.toString();
  return useGet<LeaderboardData>(
    qk.leaderboard(scope, query),
    `${scope === "admin" ? "/admin/leaderboards" : "/student/leaderboard"}?${query}`,
    scope === "student" || Boolean(filters.batch_id),
  );
};

export const useStudentLeaderboard = (tab: string, startDate?: string, endDate?: string) =>
  useLeaderboard("student", tab, {}, startDate, endDate);

export const useCodingProfiles = () => useGet<{ profiles: Record<string, CodingProfile>; supported_platforms: string[] }>(qk.codingProfiles, "/student/coding-profiles");

export const useCodingActivity = (startDate: string, endDate: string, studentId?: string) =>
  useQuery({
    queryKey: ["coding-activity", studentId ?? "me", startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
      const path = studentId
        ? `/admin/analytics/student/${studentId}/coding-activity?${params}`
        : `/student/coding-activity?${params}`;
      return (await api.get<CodingActivityResponse>(path)).data;
    },
    enabled: !!startDate && !!endDate && (!studentId || !!studentId),
  });

export function useSaveCodingProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { platform: string; username: string }) => api.post("/student/coding-profiles", p),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["student"] }),
  });
}

export function useDeleteCodingProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (platform: string) => api.delete(`/student/coding-profiles/${platform}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["student"] }),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Student>) => (await api.put("/student/profile", payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["student"] }),
  });
}

// ------------------------------------------------------------------ admin
export const useAdminDashboard = () => useGet<AdminDashboard>(qk.adminDashboard, "/admin/dashboard");

export interface StudentListParams extends Record<string, unknown> {
  page?: number;
  page_size?: number;
  search?: string;
  course?: string;
  branch?: string;
  section?: string;
  status?: string;
  sort_by?: string;
  sort_dir?: number;
}

export function studentsQueryString(params: StudentListParams): string {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  });
  return sp.toString();
}

export const useStudents = (params: StudentListParams) =>
  useGet<Paginated<Student>>(qk.students(new URLSearchParams(studentsQueryString(params))), `/admin/students?${studentsQueryString(params)}`);

export const useStudent = (id: string, enabled = true) => useGet<Student & { coding_profiles: { platform: string; username?: string }[] }>(qk.student(id), `/admin/students/${id}`, enabled);

export function useCreateStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Student>) => (await api.post("/admin/students", payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "students"] });
      qc.invalidateQueries({ queryKey: ["batches"] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
}

export function useUpdateStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & Partial<Student>) =>
      (await api.put(`/admin/students/${id}`, payload)).data,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["admin", "students"] });
      qc.invalidateQueries({ queryKey: ["admin", "student", vars.id] });
      qc.invalidateQueries({ queryKey: ["batches"] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
}

export function useDeleteStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => api.delete(`/admin/students/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "students"] });
      qc.invalidateQueries({ queryKey: ["batches"] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
}

export function useResendInvitation() {
  return useMutation({
    mutationFn: async (id: string) => (await api.post(`/admin/students/${id}/resend-invitation`)).data,
  });
}

export function useResetAccount() {
  return useMutation({
    mutationFn: async (id: string) => (await api.post(`/admin/students/${id}/reset-account`)).data,
  });
}

export interface ClassListParams extends Record<string, unknown> {
  page?: number;
  page_size?: number;
  batch_id?: string;
  course?: string;
  branch?: string;
  section?: string;
}

export const useClasses = (params: ClassListParams, enabled = true) => {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  });
  return useGet<Paginated<ClassItem>>(qk.classes(sp), `/admin/classes?${sp.toString()}`, enabled);
};

export const useClassDetail = (classId: string) =>
  useGet<ClassItem>(["admin", "class", classId], `/admin/classes/${classId}`, !!classId);

export function useCreateClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => (await api.post("/admin/classes", payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "classes"] }),
  });
}

export function useDeleteClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => api.delete(`/admin/classes/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "classes"] }),
  });
}

export function useDuplicateClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.post(`/admin/classes/${id}/duplicate`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "classes"] }),
  });
}

export function useUpdateClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      (await api.put(`/admin/classes/${id}`, payload)).data,
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["admin", "classes"] });
      qc.invalidateQueries({ queryKey: ["admin", "class", vars.id] });
    },
  });
}

export const useClassSession = (classId: string, enabled = true) =>
  useGet<SessionView>(qk.session(classId), `/admin/classes/${classId}/attendance`, !!classId && enabled);

export function useSaveAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ classId, records }: { classId: string; records: Pick<AttendanceEntry, "student_id" | "status">[] }) =>
      (await api.post(`/admin/classes/${classId}/attendance`, { records, override: true })).data,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: qk.session(vars.classId) });
      qc.invalidateQueries({ queryKey: ["admin", "classes"] });
      qc.invalidateQueries({ queryKey: ["admin", "class", vars.classId] });
    },
  });
}

export interface ImportPreviewData {
  import_token: string;
  total_records: number;
  valid_records: number;
  invalid_records: number;
  duplicate_records: number;
  errors: { row: number; field?: string; error: string }[];
  sample_valid: Record<string, string>[];
}

export function useImportPreview() {
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return (await api.post<ImportPreviewData>("/admin/imports/preview", form)).data;
    },
  });
}

export function useImportConfirm() {
  return useMutation({
    mutationFn: async (import_token: string) => (await api.post("/admin/imports/confirm", { import_token })).data,
  });
}

// ------------------------------------------------------------------ coding sync
export function useTriggerSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (platform: string) => (await api.post<{ job: SyncJob }>(`/admin/coding-sync/${platform}`)).data.job,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "sync-jobs"] });
      qc.invalidateQueries({ queryKey: ["admin", "sync-job"] });
    },
  });
}

export function useSyncJobs(pollMs?: number) {
  return useQuery({
    queryKey: qk.syncJobs,
    queryFn: async () => (await api.get<{ items: SyncJob[] }>("/admin/coding-sync/jobs")).data.items,
    refetchInterval: pollMs,
  });
}

export function useSyncJob(jobId: string | null) {
  return useQuery({
    queryKey: qk.syncJob(jobId ?? ""),
    enabled: !!jobId,
    queryFn: async () => (await api.get<SyncJob>(`/admin/coding-sync/jobs/${jobId}`)).data,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "running" || status === "queued" ? 2000 : false;
    },
  });
}

export function useRecalcLeaderboard() {
  return useMutation({
    mutationFn: async () => (await api.post<{ recalculated: number }>("/admin/leaderboards/recalculate")).data,
  });
}

// ------------------------------------------------------------------ analytics
export interface AnalyticsData {
  attendance_trend: { date: string; percentage: number }[];
  by_course: { name: string; percentage: number }[];
  by_branch: { name: string; percentage: number }[];
  by_section: { name: string; percentage: number }[];
  distribution: { status: string; count: number }[];
  coding_trend: { date: string; value: number }[];
  attendance_vs_coding: { attendance: number; coding: number; name: string }[];
  perfect_attendance: { student_id: string; name: string; attendance: number }[];
  low_attendance: { student_id: string; name: string; roll_number?: string; attendance: number }[];
  platform_distribution: { platform: string; count: number }[];
}

export const useAnalytics = (days = 30) =>
  useGet<AnalyticsData>(["admin", "analytics", days], `/admin/analytics?days=${days}`);

// ------------------------------------------------------------------ reports
export function downloadReport(type: string, format: string) {
  window.open(`/api/admin/reports?type=${type}&format=${format}`, "_blank");
}

// ------------------------------------------------------------------ individual student report
export interface StudentReportProfile {
  id: string;
  roll_number?: string;
  first_name: string;
  last_name: string;
  name: string;
  email?: string;
  course?: string;
  branch?: string;
  section?: string;
  status: string;
  phone?: string | null;
  is_active: boolean;
}

export interface StudentReportAttendance {
  present: number;
  absent: number;
  late: number;
  leave: number;
  total_classes: number;
  percentage: number | null;
  threshold: number;
  is_low: boolean;
}

export interface StudentReportTrendPoint {
  date: string;
  present: number;
  absent: number;
  total: number;
  percentage: number;
}

export interface StudentReportSubject {
  subject: string;
  present: number;
  total: number;
  percentage: number;
}

export interface StudentReportRecord {
  record_id: string;
  date: string;
  status: string;
  subject?: string;
  start_time?: string;
  end_time?: string;
  room?: string;
}

export interface StudentReportCodingProfile {
  platform: string;
  username?: string;
  profile_url?: string;
  rating?: number | null;
  problems_solved?: number | null;
  statistics?: Record<string, number | string | null>;
  activity_metadata?: {
    available?: boolean;
    metric_key?: string | null;
    metric_label?: string | null;
    note?: string;
    coverage_start?: string | null;
    coverage_end?: string | null;
    possibly_truncated?: boolean;
  };
  sync_status?: string;
  last_synced?: string | null;
  fetched_at?: string | null;
}

export interface StudentReportLeaderboard {
  overall_score: number;
  rank: number | null;
  total_students: number;
  current_streak: number | null;
  longest_streak: number | null;
  metrics: Record<string, unknown>;
}

export interface StudentReport {
  profile: StudentReportProfile;
  attendance: StudentReportAttendance;
  attendance_trend: StudentReportTrendPoint[];
  by_subject: StudentReportSubject[];
  recent_records: StudentReportRecord[];
  coding: { platforms: StudentReportCodingProfile[] };
  leaderboard: StudentReportLeaderboard;
  days: number;
}

export const useStudentReport = (studentId: string | undefined, days = 90) =>
  useGet<StudentReport>(
    ["admin", "student-report", studentId, days],
    studentId ? `/admin/analytics/student/${studentId}?days=${days}` : "/admin/analytics/student/_?days=0",
    !!studentId
  );

export function downloadStudentReport(studentId: string | undefined, format: "pdf" | "csv" | "xlsx", days = 90) {
  if (!studentId) return;
  window.open(`/api/admin/reports/student/${studentId}?format=${format}&days=${days}`, "_blank");
}

// ------------------------------------------------------------------ settings & audit
export const useSettings = () => useGet<AppSettings>(qk.settings, "/admin/settings");

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<AppSettings>) => (await api.put("/admin/settings", payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "settings"] }),
  });
}

export const useAuditLogs = (page = 1) =>
  useGet<Paginated<AuditLog>>(qk.auditLogs(page), `/admin/audit-logs?page=${page}&page_size=25`);

// Batches
export const useBatches = (page = 1, pageSize = 50) =>
  useQuery<Paginated<BatchSummary>>({
    queryKey: ["batches", page, pageSize],
    queryFn: () => getBatches(page, pageSize),
  });

export const useBatchMonitor = (batchId: string, startDate: string, endDate: string) =>
  useGet<BatchMonitor>(
    ["batch-monitor", batchId, startDate, endDate],
    `/admin/batches/${batchId}/monitor?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`,
    Boolean(batchId && startDate && endDate),
  );

export const useCreateBatch = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { batch_code: string; name: string; description?: string }) => createBatch(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["batches"] }),
  });
};


export const useUpdateBatch = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; description?: string } }) => updateBatch(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["batches"] }),
  });
};

export const useDeleteBatch = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteBatch(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["batches"] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
};

export const useAssignBatchStudents = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ batchId, rollNumbers }: { batchId: string; rollNumbers: string[] }) =>
      assignBatchStudents(batchId, rollNumbers),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["batches"] });
      qc.invalidateQueries({ queryKey: ["batch-students"] });
      qc.invalidateQueries({ queryKey: ["admin", "session"] });
      qc.invalidateQueries({ queryKey: ["admin", "students"] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
};

export const useUploadBatchStudents = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ batchId, file }: { batchId: string; file: File }) => uploadBatchStudents(batchId, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["batches"] });
      qc.invalidateQueries({ queryKey: ["batch-students"] });
      qc.invalidateQueries({ queryKey: ["admin", "session"] });
      qc.invalidateQueries({ queryKey: ["admin", "students"] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
};

export const useRemoveBatchStudent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ batchId, studentId }: { batchId: string; studentId: string }) =>
      removeBatchStudent(batchId, studentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["batches"] });
      qc.invalidateQueries({ queryKey: ["batch-students"] });
      qc.invalidateQueries({ queryKey: ["admin", "session"] });
      qc.invalidateQueries({ queryKey: ["admin", "students"] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
};

export const useBatchStudents = (batchId: string, page = 1) =>
  useQuery({
    queryKey: ["batch-students", batchId, page],
    queryFn: () => getBatchStudents(batchId, page),
    enabled: !!batchId,
  });
