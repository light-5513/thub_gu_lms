/** Shared API + domain types. */
export type Role = "SUPER_ADMIN" | "ADMIN" | "TEACHER" | "STUDENT";

export interface LoginResponse {
  must_change_password: boolean;
  role: Role;
  full_name?: string;
  redirect: string;
}

export interface Student {
  id: string;
  user_id?: string | null;
  first_name: string;
  last_name: string;
  email: string;
  roll_number: string;
  course: string;
  branch: string;
  section: string;
  phone?: string | null;
  batch_id?: string | null;
  academic_year_id?: string | null;
  status: string;
  attendance_percentage?: number | null;
  overall_score?: number | null;
  coding_profiles?: { platform: string; username?: string; sync_status?: string }[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ClassItem {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  course: string;
  branch: string;
  section: string;
  subject: string;
  faculty?: string | null;
  topic?: string | null;
  attendance_marked: boolean;
}

export interface AttendanceEntry {
  student_id: string;
  roll_number: string;
  name: string;
  status: "present" | "absent" | "late" | "leave" | "unmarked";
}

export interface SessionView {
  class_session_id: string | null;
  records: AttendanceEntry[];
  marked: boolean;
  updated_at?: string | null;
}

export interface PlatformStats {
  [metric: string]: number | undefined;
  problems_solved?: number;
  rating?: number;
  contributions?: number;
  public_repos?: number;
}

export interface CodingProfile {
  platform: string;
  username?: string | null;
  profile_url?: string | null;
  verified?: boolean;
  sync_status?: string;
  last_synced_at?: string | null;
  sync_error?: string | null;
  statistics: PlatformStats;
}

export interface SyncJob {
  job_id: string;
  platform: string;
  started_at?: string | null;
  completed_at?: string | null;
  total: number;
  processed: number;
  successful: number;
  failed: number;
  remaining: number;
  status: string;
  error_summary?: string[];
}

export interface LeaderboardEntry {
  rank: number;
  student_id: string;
  student_name: string;
  roll_number?: string | null;
  course?: string | null;
  branch?: string | null;
  score: number;
  attendance_percentage?: number | null;
  current_streak?: number | null;
  metrics: Record<string, number>;
  trend?: number | null;
}

export interface LeaderboardData {
  tab: string;
  entries: LeaderboardEntry[];
  total: number;
  generated_at?: string | null;
  me?: Pick<LeaderboardEntry, "rank"> | null;
}

export interface HeatmapDay {
  date: string;
  status: "present" | "absent" | "late" | "leave";
  classes: number;
  breakdown: Record<string, number>;
}

export interface AdminDashboard {
  total_students: number;
  active_students: number;
  average_attendance: number | null;
  attendance_threshold: number;
  low_attendance_students: number;
  average_coding_score: number | null;
  highest_current_streak: number;
  classes_today: number;
  profiles_synced: number;
  profiles_total: number;
  attendance_trend: { date: string; percentage: number }[];
  platform_distribution: { platform: string; count: number }[];
  top_performers: { student_id: string; name: string; score: number; attendance?: number }[];
}

export interface AppSettings {
  institution_name: string;
  logo_url?: string | null;
  academic_year: string;
  attendance_threshold: number;
  leaderboard_weights: Record<string, number>;
  streak_rules: Record<string, boolean>;
  late_rules: Record<string, unknown>;
  leave_rules: Record<string, unknown>;
  coding_sync_settings: Record<string, number>;
  timezone: string;
}

export interface AuditLog {
  id: string;
  action: string;
  user_email?: string | null;
  role?: string | null;
  entity?: string | null;
  entity_id?: string | null;
  old_data?: Record<string, unknown> | null;
  new_data?: Record<string, unknown> | null;
  ip_address?: string | null;
  created_at?: string | null;
}
