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

export interface BatchSummary {
  id: string;
  batch_code: string;
  name: string;
  description?: string | null;
  student_count: number;
  created_at?: string | null;
}

export interface BatchMonitorAttendance {
  present: number;
  late: number;
  absent: number;
  leave: number;
  unmarked: number;
  percentage: number | null;
}

export interface BatchMonitor {
  batch: BatchSummary;
  period: { start_date: string; end_date: string; timezone: string };
  students: {
    total: number;
    active: number;
    inactive: number;
    with_profiles: number;
    active_coders: number;
  };
  classes: { total: number; marked: number; pending: number };
  attendance: BatchMonitorAttendance;
  coding: {
    profiles: number;
    activity_days: number;
    platforms: { platform: string; profiles: number; active_students: number }[];
  };
  members: {
    id: string;
    name: string;
    roll_number: string;
    status: string;
    attendance: BatchMonitorAttendance;
    coding: { profiles: number; activity_days: number; last_activity_date: string | null };
  }[];
}

export interface ClassItem {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  course?: string | null;
  branch?: string | null;
  section?: string | null;
  subject: string;
  faculty?: string | null;
  topic?: string | null;
  session_mode?: string | null;
  batch_id?: string | null;
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
  [metric: string]: number | string | null | undefined;
  problems_solved?: number;
  rating?: number;
  contributions?: number;
  public_repos?: number;
}

export interface CodingActivityMetadata {
  available: boolean;
  metric_key?: string | null;
  metric_label?: string | null;
  note?: string;
  coverage_start?: string | null;
  coverage_end?: string | null;
  possibly_truncated?: boolean;
  fill_gaps?: boolean;
  records_returned?: number;
  record_limit?: number;
}

export interface CodingActivityDay {
  date: string;
  metrics: Record<string, number>;
  interval_start?: string | null;
  interval_end?: string | null;
  interval_start_date?: string | null;
  interval_end_date?: string | null;
  estimated?: boolean;
}

export interface CodingActivityPlatform {
  platform: string;
  connected: boolean;
  username?: string | null;
  profile_url?: string | null;
  sync_status: string;
  sync_error?: string | null;
  last_synced_at?: string | null;
  statistics: PlatformStats;
  activity_metadata: CodingActivityMetadata;
  activity_range?: {
    complete: boolean;
    coverage_start?: string | null;
    coverage_end?: string | null;
    daily_complete: boolean;
  };
  daily_activity: CodingActivityDay[];
}

export interface CodingActivityResponse {
  student_id: string;
  start_date: string;
  end_date: string;
  activity_timezone?: string;
  supported_platforms: string[];
  platforms: CodingActivityPlatform[];
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
  activity_metadata?: CodingActivityMetadata;
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
  batch?: BatchSummary;
  entries: LeaderboardEntry[];
  total: number;
  generated_at?: string | null;
  me?: Pick<LeaderboardEntry, "rank" | "student_id"> | null;
  period_mode?: boolean;
  start_date?: string;
  end_date?: string;
  activity_timezone?: string;
  activity_available_from?: string | null;
  activity_available_through?: string | null;
  period_metric_label?: string | null;
  period_metric_key?: string | null;
  covered_profiles?: number;
  excluded_profiles?: number;
  estimated_profiles?: number;
  quality_note?: string | null;
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
