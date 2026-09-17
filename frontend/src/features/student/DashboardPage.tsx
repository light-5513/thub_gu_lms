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
import { Card, CardHeader, ProgressBar, StatCard, StatCardSkeleton, Skeleton, EmptyState } from "@/components/ui/display";
import { Heatmap } from "@/components/ui/heatmap";
import { Badge } from "@/components/ui/display";
import { format, subDays } from "date-fns";

export function StudentDashboardPage() {
  const { data, isLoading, isError } = useStudentDashboard();
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

  if (isError || !data) return <EmptyState title="We couldn't load your dashboard." description="Please try again shortly." />;

  const { student, attendance, streaks, coding, scores, overall_rank } = data;
  const attPct = attendance.percentage ?? 0;

  // Last 14 days activity for the mini chart
  const chartData = Array.from({ length: 14 }).map((_, i) => {
    const day = format(subDays(new Date(), 13 - i), "yyyy-MM-dd");
    const entry = heatmap.data?.days.find((d) => d.date === day);
    return { date: format(new Date(day + "T00:00:00"), "dd MMM"), pct: entry ? (entry.breakdown.present ?? 0) / Math.max(entry.classes, 1) * 100 : 0 };
  });

  const recentRecords = (attendanceRecords.data?.records ?? []).slice(0, 8);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Welcome card */}
      <div className="card overflow-hidden p-0">
        <div
          className="px-6 py-6"
          style={{
            background: "linear-gradient(180deg, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0.06) 100%)",
            borderBottom: "1px solid rgba(255, 255, 255, 0.30)",
          }}
        >
          <div className="flex items-center gap-2">
            <div className="led led-pulse-bg" />
            <span className="tech-label tech-label-hi">CH · 01 · DASHBOARD</span>
          </div>
          <h1 className="mt-2 text-lg font-extrabold" style={{ color: "var(--text)" }}>
            Welcome back, {student.first_name}!
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text)" }}>
            {student.course} · {student.branch} · Section {student.section}
          </p>
        </div>
      </div>

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
          hint={overall_rank ? `Rank #${overall_rank}` : "Unranked"}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Attendance breakdown */}
        <Card>
          <CardHeader title="Attendance" subtitle="This academic period" />
          <p className="mb-1 text-3xl font-bold text-leather-300">{attPct}%</p>
          <ProgressBar value={attPct} />
          <dl className="mt-4 space-y-2 text-xs text-leather-200">
            <Row label="Present" value={attendance.present} dot="bg-neutral-100" />
            <Row label="Late" value={attendance.late} dot="bg-neutral-100" />
            <Row label="Absent" value={attendance.absent} dot="bg-neutral-100" />
            <Row label="Leave" value={attendance.leave} dot="bg-neutral-100" />
            <Row label="Total classes" value={attendance.total_classes} dot="bg-slate-300" />
          </dl>
        </Card>

        {/* Coding performance */}
        <Card>
          <CardHeader title="Coding performance" action={<Link to="/student/profile" className="text-xs font-medium text-primary-600 hover:underline">Manage profiles</Link>} />
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
                <li key={i} className="flex items-center justify-between rounded-[20px] bg-cream-100 px-3 py-2 text-xs">
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
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#a3a3a3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={2} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} unit="%" />
              <ChartTooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="pct" name="Present %" fill="var(--text)" radius={[4, 4, 0, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </div>
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
      <dd className="font-semibold text-leather-300">{value}</dd>
    </div>
  );
}
