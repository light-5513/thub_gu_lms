import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarCheck,
  Download,
  FileSpreadsheet,
  FileText,
  Flame,
  Hash,
  Mail,
  Phone,
  Target,
  TrendingUp,
  Trophy,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, formatDistanceToNow } from "date-fns";
import {
  downloadStudentReport,
  useStudentReport,
  type StudentReport,
} from "@/api/hooks";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  ProgressBar,
  Skeleton,
  StatCard,
  StatCardSkeleton,
} from "@/components/ui/display";
import { Button, Select } from "@/components/ui/forms";
import { Dropdown, DropdownItem } from "@/components/ui/navigation";
import { errorMessage } from "@/api/client";

const STATUS_COLORS: Record<string, string> = {
  present: "#10b981",
  late: "#f59e0b",
  absent: "#ef4444",
  leave: "#8b5cf6",
};

const PLATFORM_COLORS: Record<string, string> = {
  github: "#0f172a",
  leetcode: "#f59e0b",
  codechef: "#a16207",
  codeforces: "var(--text)",
  atcoder: "#7c3aed",
  hackerrank: "#10b981",
  hackerearth: "#0ea5e9",
};

export function StudentReportPage() {
  const { id } = useParams<{ id: string }>();
  const [days, setDays] = useState(90);
  const { data, isLoading, isError, error, refetch } = useStudentReport(id, days);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-4">
        <Link to="/admin/students" className="inline-flex items-center gap-1.5 text-xs font-bold text-leather-200 hover:text-leather-300">
          <ArrowLeft size={14} /> Back to students
        </Link>
        <ErrorState message={errorMessage(error)} onRetry={refetch} />
      </div>
    );
  }

  return <ReportView data={data} days={days} setDays={setDays} />;
}

function ReportView({
  data,
  days,
  setDays,
}: {
  data: StudentReport;
  days: number;
  setDays: (n: number) => void;
}) {
  const { profile, attendance, attendance_trend, by_subject, recent_records, coding, leaderboard } = data;
  const attPct = attendance.percentage;
  const studentId = profile.id;

  // Distribution data for the status pie
  const distributionData = [
    { name: "Present", value: attendance.present, color: STATUS_COLORS.present },
    { name: "Late", value: attendance.late, color: STATUS_COLORS.late },
    { name: "Absent", value: attendance.absent, color: STATUS_COLORS.absent },
    { name: "Leave", value: attendance.leave, color: STATUS_COLORS.leave },
  ].filter((d) => d.value > 0);

  // Attendance vs coding radar
  const radarData = [
    { metric: "Attendance", value: attPct ?? 0, full: 100 },
    { metric: "Coding", value: leaderboard.overall_score ?? 0, full: 100 },
    { metric: "Streak", value: Math.min((leaderboard.current_streak ?? 0) * 10, 100), full: 100 },
    { metric: "Score", value: Math.min(leaderboard.rank ? (1 - leaderboard.rank / Math.max(leaderboard.total_students, 1)) * 100 : 0, 100), full: 100 },
    { metric: "Engagement", value: coding.platforms.length * 25, full: 100 },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Top bar: back link + days filter + download */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/admin/students" className="inline-flex items-center gap-1.5 text-xs font-bold text-leather-200 hover:text-leather-300">
          <ArrowLeft size={14} /> Back to students
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={String(days)} onChange={(e) => setDays(Number(e.target.value))} className="!py-1.5 !text-xs">
            <option value="30">Last 30 days</option>
            <option value="60">Last 60 days</option>
            <option value="90">Last 90 days</option>
            <option value="180">Last 6 months</option>
            <option value="365">Last year</option>
          </Select>
          <Dropdown
            trigger={
              <Button variant="secondary" size="sm">
                <Download size={14} /> Download <span className="hidden sm:inline">report</span>
              </Button>
            }
          >
            {(close) => (
              <>
                <DropdownItem onClick={() => { close(); downloadStudentReport(studentId, "pdf", days); }}>
                  <FileText size={13} /> Download as PDF
                </DropdownItem>
                <DropdownItem onClick={() => { close(); downloadStudentReport(studentId, "csv", days); }}>
                  <FileSpreadsheet size={13} /> Download as CSV
                </DropdownItem>
                <DropdownItem onClick={() => { close(); downloadStudentReport(studentId, "xlsx", days); }}>
                  <FileSpreadsheet size={13} /> Download as Excel
                </DropdownItem>
              </>
            )}
          </Dropdown>
        </div>
      </div>

      {/* Profile header */}
      <div className="card overflow-hidden p-0">
        <div
          className="flex flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center sm:gap-6"
          style={{
            
            color: "var(--text)",
          }}
        >
          <div
            className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl text-2xl font-bold"
          >
            {profile.name ? profile.name.slice(0, 1).toUpperCase() : "?"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">{profile.name || "—"}</h1>
              {profile.status === "active" ? (
                <Badge tone="green">Active</Badge>
              ) : (
                <Badge tone="gray">Inactive</Badge>
              )}
              {attendance.is_low && <Badge tone="red">Low attendance</Badge>}
              {leaderboard.rank === 1 && <Badge tone="blue">Top performer</Badge>}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-primary-500/90">
              {profile.roll_number && (
                <span className="inline-flex items-center gap-1">
                  <Hash size={12} /> {profile.roll_number}
                </span>
              )}
              {profile.email && (
                <span className="inline-flex items-center gap-1">
                  <Mail size={12} /> {profile.email}
                </span>
              )}
              {profile.phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone size={12} /> {profile.phone}
                </span>
              )}
            </div>
            <div className="mt-2 text-xs text-primary-500/80">
              {[profile.course, profile.branch, profile.section ? `Section ${profile.section}` : null]
                .filter(Boolean)
                .join(" · ") || "—"}
            </div>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Attendance"
          value={attPct !== null ? `${attPct}%` : "—"}
          icon={<CalendarCheck size={20} />}
          tone={attPct !== null && attPct >= attendance.threshold ? "success" : "danger"}
          hint={`${attendance.total_classes} classes · ${attendance.present + attendance.late} attended`}
        />
        <StatCard
          label="Current streak"
          value={`${leaderboard.current_streak ?? 0}`}
          icon={<Flame size={20} />}
          tone="warning"
          hint={`Longest ${leaderboard.longest_streak ?? 0}`}
        />
        <StatCard
          label="Overall score"
          value={leaderboard.overall_score.toFixed(1)}
          icon={<TrendingUp size={20} />}
          tone="info"
          hint={leaderboard.rank ? `Rank #${leaderboard.rank} of ${leaderboard.total_students}` : "Unranked"}
        />
        <StatCard
          label="Coding platforms"
          value={coding.platforms.length}
          icon={<Target size={20} />}
          tone={coding.platforms.length >= 2 ? "success" : "default"}
          hint={coding.platforms.map((p) => p.platform).join(" · ") || "None connected"}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Attendance trend (area chart) */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Attendance trend"
            subtitle={`Daily attendance — last ${days} days`}
            action={
              <span className="text-[10px] font-bold uppercase tracking-wider text-leather-50/80">
                {attendance_trend.length} day{attendance_trend.length === 1 ? "" : "s"}
              </span>
            }
          />
          <div className="h-64">
            {attendance_trend.length === 0 ? (
              <EmptyState title="No attendance yet." description="Trend will appear once classes are marked." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={attendance_trend}>
                  <defs>
                    <linearGradient id="att-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#000000" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#000000" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#a3a3a3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "#a3a3a3" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(d) => (d ? format(new Date(d), "d MMM") : "")}
                    interval={Math.max(0, Math.floor(attendance_trend.length / 8))}
                  />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#a3a3a3" }} tickLine={false} axisLine={false} unit="%" />
                  <ChartTooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, backgroundColor: "#272d36", border: "1px solid rgba(255, 255, 255, 0.30)" }}
                    formatter={(v: number) => [`${v}%`, "Present"]}
                    labelFormatter={(l) => format(new Date(l), "EEE d MMM yyyy")}
                  />
                  <Area type="monotone" dataKey="percentage" name="Present %" stroke="var(--text)" strokeWidth={2} fill="url(#att-fill)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* Status pie */}
        <Card>
          <CardHeader title="Status breakdown" subtitle="All time" />
          {distributionData.length === 0 ? (
            <EmptyState title="No data yet" description="Status breakdown will appear here." />
          ) : (
            <>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={distributionData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={68}
                      paddingAngle={2}
                    >
                      {distributionData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} stroke="var(--text)" strokeWidth={2} />
                      ))}
                    </Pie>
                    <ChartTooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, backgroundColor: "#272d36", border: "1px solid rgba(255, 255, 255, 0.30)" }}
                      formatter={(v: number, n: string) => [`${v}`, n]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-3 space-y-1.5 text-xs">
                {distributionData.map((d) => (
                  <li key={d.name} className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-leather-200">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d.color }} />
                      {d.name}
                    </span>
                    <span className="font-bold text-leather-300">{d.value}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>

      {/* Attendance progress + by subject + radar */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader title="Attendance" subtitle={`Threshold ${attendance.threshold}%`} />
          <p className="mb-1 text-3xl font-bold text-leather-300">{attPct ?? "—"}%</p>
          <ProgressBar value={attPct ?? 0} />
          <dl className="mt-4 space-y-2 text-xs text-leather-200">
            <Row label="Present" value={attendance.present} dot="bg-neutral-100" />
            <Row label="Late" value={attendance.late} dot="bg-neutral-100" />
            <Row label="Absent" value={attendance.absent} dot="bg-neutral-100" />
            <Row label="Leave" value={attendance.leave} dot="bg-neutral-100" />
            <Row label="Total classes" value={attendance.total_classes} dot="bg-leather-300" />
          </dl>
        </Card>

        <Card>
          <CardHeader title="By subject" subtitle={`Top ${by_subject.length} — last ${days} days`} />
          {by_subject.length === 0 ? (
            <EmptyState title="No subject breakdown" />
          ) : (
            <ul className="space-y-3">
              {by_subject.slice(0, 6).map((s) => (
                <li key={s.subject}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-bold text-leather-300">{s.subject}</span>
                    <span className="text-leather-50/80">
                      {s.present}/{s.total} · <span className="font-bold text-leather-300">{s.percentage}%</span>
                    </span>
                  </div>
                  <ProgressBar
                    value={s.percentage}
                    tone={s.percentage >= attendance.threshold ? "auto" : "auto"}
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Performance radar" subtitle="5-axis snapshot" />
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="var(--text)" />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: "var(--text)" }} />
                <Radar name="Score" dataKey="value" stroke="var(--text)" fill="var(--text)" fillOpacity={0.4} />
                <ChartTooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, backgroundColor: "#272d36", border: "1px solid rgba(255, 255, 255, 0.30)" }}
                  formatter={(v: number) => [`${v.toFixed(1)}`, "Score"]}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Coding profiles + leaderboard */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Coding profiles"
            subtitle={`${coding.platforms.length} platform${coding.platforms.length === 1 ? "" : "s"} connected`}
          />
          {coding.platforms.length === 0 ? (
            <EmptyState
              icon={<Trophy size={20} />}
              title="No coding profiles connected"
              description="The student hasn't added any coding platform handles yet."
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {coding.platforms.map((p) => {
                const color = PLATFORM_COLORS[p.platform] ?? "#525252";
                return (
                  <div
                    key={p.platform}
                    className="rounded-[20px] border border-leather-50/15 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="flex h-9 w-9 items-center justify-center rounded-2xl text-[10px] font-bold uppercase text-leather-200"
                          style={{
                            backgroundColor: color,
                            boxShadow: "0 1px 0 rgba(255,255,255,0.4) inset, 0 2px 4px rgba(0,0,0,0.15)",
                          }}
                        >
                          {p.platform.slice(0, 3)}
                        </div>
                        <div>
                          <p className="text-sm font-bold capitalize text-leather-300">{p.platform}</p>
                          <p className="text-[11px] text-leather-50/80">@{p.username || "—"}</p>
                        </div>
                      </div>
                      {p.sync_status && (
                        <Badge tone={p.sync_status === "success" ? "green" : p.sync_status === "failed" ? "red" : "amber"}>
                          {p.sync_status}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-leather-50/70">Rating</p>
                        <p className="text-base font-bold text-leather-300">{p.rating ?? "—"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-leather-50/70">Solved</p>
                        <p className="text-base font-bold text-leather-300">{p.problems_solved}</p>
                      </div>
                    </div>
                    {(p.last_synced || p.fetched_at) && (
                      <p className="mt-2 text-[10px] text-leather-50/70">
                        Last synced{" "}
                        {p.last_synced
                          ? formatDistanceToNow(new Date(p.last_synced), { addSuffix: true })
                          : p.fetched_at
                            ? formatDistanceToNow(new Date(p.fetched_at), { addSuffix: true })
                            : "—"}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Leaderboard" subtitle="Overall ranking" />
          <div className="space-y-3">
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-leather-50/80">Score</p>
              <p className="text-3xl font-bold text-leather-300">{leaderboard.overall_score.toFixed(1)}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="rounded-2xl border border-leather-50/15 bg-cream-200 p-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-leather-50/80">Rank</p>
                <p className="text-lg font-bold text-leather-300">
                  {leaderboard.rank ? `#${leaderboard.rank}` : "—"}
                </p>
              </div>
              <div className="rounded-2xl border border-leather-50/15 bg-cream-200 p-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-leather-50/80">Of</p>
                <p className="text-lg font-bold text-leather-300">{leaderboard.total_students}</p>
              </div>
            </div>
            <div className="rounded-2xl border border-leather-50/15 bg-cream-200 p-2.5 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-leather-50/80">Streak</p>
              <p className="text-lg font-bold text-leather-300">
                {leaderboard.current_streak ?? 0} <span className="text-xs font-medium text-leather-50/80">current</span>
              </p>
              <p className="text-[11px] text-leather-50/70">
                Longest {leaderboard.longest_streak ?? 0}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Coding performance bar chart (problems solved per platform) */}
      {coding.platforms.length > 0 && (
        <Card>
          <CardHeader title="Problems solved by platform" subtitle="From the most recent sync" />
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={coding.platforms.map((p) => ({ platform: p.platform, value: p.problems_solved, rating: p.rating ?? 0 }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#a3a3a3" vertical={false} />
                <XAxis dataKey="platform" tick={{ fontSize: 11, fill: "var(--text)" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "var(--text)" }} tickLine={false} axisLine={false} />
                <ChartTooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, backgroundColor: "#272d36", border: "1px solid rgba(255, 255, 255, 0.30)" }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="value" name="Problems solved" radius={[6, 6, 0, 0]}>
                  {coding.platforms.map((p, i) => (
                    <Cell key={i} fill={PLATFORM_COLORS[p.platform] ?? "var(--text)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Recent attendance records */}
      <Card className="p-0">
        <div className="px-5 pt-4">
          <CardHeader title="Recent attendance" subtitle="Last 15 records" />
        </div>
        {recent_records.length === 0 ? (
          <EmptyState title="No attendance records" description="Once classes are marked for this student, they will appear here." />
        ) : (
          <div className="overflow-x-auto px-5 pb-5">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr
                  className="border-b border-leather-50/20"
                >
                  {["Date", "Subject", "Status", "Time", "Room"].map((h) => (
                    <th key={h} className="whitespace-nowrap px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-leather-300">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-leather-50/10">
                {recent_records.map((r) => (
                  <tr key={r.record_id} className="hover:bg-cream-100/40">
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs font-mono text-leather-200">
                      {r.date ? format(new Date(r.date), "dd MMM yyyy") : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-leather-200">{r.subject || "—"}</td>
                    <td className="px-3 py-2.5">
                      <Badge
                        tone={
                          r.status === "present"
                            ? "green"
                            : r.status === "absent"
                              ? "red"
                              : r.status === "late"
                                ? "amber"
                                : "purple"
                        }
                      >
                        {r.status}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-leather-50/80">
                      {[r.start_time, r.end_time].filter(Boolean).join(" – ") || "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-leather-50/80">{r.room || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Row({ label, value, dot }: { label: string; value: number; dot: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="inline-flex items-center gap-1.5 capitalize">
        <span className={`h-2 w-2 rounded-full ${dot}`} /> {label}
      </dt>
      <dd className="font-bold text-leather-300">{value}</dd>
    </div>
  );
}
