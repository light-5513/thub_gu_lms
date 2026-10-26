import { CalendarCheck, Flame, Trophy, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAttendanceRecords, useHeatmap, useStudentDashboard } from "@/api/hooks";
import { Card, CardHeader, ProgressBar, StatCard, StatCardSkeleton, Skeleton, EmptyState, ErrorState, Row } from "@/components/ui/display";
import { Heatmap } from "@/components/ui/heatmap";
import { Badge } from "@/components/ui/display";
import { format, subDays } from "date-fns";

const TOOLTIP_STYLE = { fontSize: 12, borderRadius: 12, backgroundColor: "var(--panel)", border: "1px solid var(--border)", color: "var(--text)", boxShadow: "var(--neo-out-sm)" };

export function StudentDashboardPage() {
  const { data, isLoading, isError, refetch } = useStudentDashboard();
  const year = new Date().getFullYear();
  const heatmap = useHeatmap(year);
  const attendanceRecords = useAttendanceRecords();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (isError || !data) return <ErrorState message="Please check your connection and try again." onRetry={() => refetch()} />;

  const { student, attendance, streaks, coding, scores, overall_rank } = data;
  const attPct = attendance.percentage ?? 0;

  // Last 14 days activity for the mini chart
  const chartData = Array.from({ length: 14 }).flatMap((_, i) => {
    const day = format(subDays(new Date(), 13 - i), "yyyy-MM-dd");
    const entry = heatmap.data?.days.find((d) => d.date === day);
    return entry ? [{ date: format(new Date(day + "T00:00:00"), "dd MMM"), pct: (entry.breakdown.present ?? 0) / Math.max(entry.classes, 1) * 100 }] : [];
  });

  const recentRecords = (attendanceRecords.data?.records ?? []).slice(0, 8);

  return (
    <div className="space-y-5 animate-fade-in">
      <header>
        <h1 className="page-title">
          Welcome back, {student.first_name}!
        </h1>
        <p className="page-description">
          {student.course} · {student.branch} · Section {student.section}
        </p>
      </header>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label={`Attendance (min ${attendance.threshold}%)`}
          value={`${attendance.percentage !== null ? attendance.percentage : "—"}%`}
          icon={<CalendarCheck size={20} />}
          tone={attPct >= attendance.threshold ? "success" : "danger"}
          hint={`${attendance.total_classes} classes so far`}
        />
        <StatCard
          label="Current streak"
          value={`${streaks.current_streak} classes`}
          icon={<Flame size={20} />}
          tone="warning"
          hint={`Longest: ${streaks.longest_streak}`}
        />
        <StatCard
          label="Overall score"
          value={scores.overall_score.toFixed(1)}
          icon={<TrendingUp size={20} />}
          tone="info"
          hint={overall_rank ? `Batch rank #${overall_rank}` : "No batch rank yet"}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Attendance breakdown */}
        <Card>
          <CardHeader title="Attendance" subtitle="This academic period" />
          <p className="mb-1 text-3xl font-bold text-leather-300">{attPct}%</p>
          <ProgressBar value={attPct} />
          <dl className="mt-4 space-y-2 text-xs text-leather-200">
            <Row label="Present" value={attendance.present} dot="bg-success-500" />
            <Row label="Late" value={attendance.late} dot="bg-warning-500" />
            <Row label="Absent" value={attendance.absent} dot="bg-danger-500" />
            <Row label="Leave" value={attendance.leave} dot="bg-slate-500" />
            <Row label="Total classes" value={attendance.total_classes} dot="bg-slate-300" />
          </dl>
        </Card>

        {/* Coding performance */}
        <Card>
          <CardHeader title="Coding performance" action={<div className="flex gap-3"><Link to="/student/coding" className="text-xs font-semibold text-primary-700 hover:underline">View stats</Link><Link to="/student/profile" className="text-xs font-medium text-primary-600 hover:underline">Manage profiles</Link></div>} />
          {coding.platforms.length === 0 ? (
            <EmptyState title="No coding profiles connected yet." description="Add LeetCode, GitHub and more to start tracking." />
          ) : (
            <>
              <p className="text-xs text-leather-50/80">Coding score</p>
              <p className="text-3xl font-bold text-leather-300">{coding.score.toFixed(1)}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {coding.platforms.map((p) => (
                  <Badge key={p.platform} tone="blue" className="capitalize">{p.platform}</Badge>
                ))}
              </div>
            </>
          )}
        </Card>

        {/* Recent activity */}
        <Card>
          <CardHeader title="Recent classes" />
          {recentRecords.length === 0 ? (
            <EmptyState title="No attendance records available." description="Once your teacher marks a class, it will appear here." />
          ) : (
            <ul className="space-y-2">
              {recentRecords.map((r, i) => (
                <li key={i} className="neo-inset-surface flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-xs">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-leather-200">{r.subject || "Class"}</p>
                    <p className="text-[11px] text-leather-50/80">{format(new Date(r.date), "dd MMM yyyy")}</p>
                  </div>
                  <Badge tone={r.status === "present" ? "green" : r.status === "absent" ? "red" : r.status === "late" ? "amber" : "purple"}>
                    {r.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Heatmap */}
      <Card>
        <CardHeader title="Attendance heatmap" subtitle={`${year} — days without scheduled classes are not counted as absences`} />
        {heatmap.isLoading ? <Skeleton className="h-28 w-full" /> : <Heatmap days={heatmap.data?.days ?? []} year={year} />}
      </Card>

      {/* Mini trend */}
      <Card>
        <CardHeader title="Daily class attendance" subtitle="Last 14 days" />
        <div className="h-48">
          {heatmap.isLoading ? <Skeleton className="h-full w-full" /> : chartData.length === 0 ? (
            <EmptyState title="No scheduled classes in this period." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} interval={2} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} unit="%" />
                <ChartTooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="pct" name="Present %" fill="#15803d" radius={[4, 4, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>
    </div>
  );
}

