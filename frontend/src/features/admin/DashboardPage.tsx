import {
  Activity,
  CalendarDays,
  Flame,
  RefreshCcw,
  TrendingDown,
  Trophy,
  UserCheck,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link } from "react-router-dom";
import { useAdminDashboard } from "@/api/hooks";
import { Badge, Card, CardHeader, EmptyState, ProgressBar, StatCard, StatCardSkeleton, Skeleton } from "@/components/ui/display";
import { errorMessage } from "@/api/client";

const PIE_COLORS = ["#000000", "#3a3a3a", "#5a5a5a", "#7a7a7a", "#9a9a9a", "#bcbcbc"];

export function AdminDashboardPage() {
  const { data, isLoading, isError, error, refetch } = useAdminDashboard();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <EmptyState title="We couldn't load the dashboard." description={errorMessage(error)} action={<button onClick={() => refetch()} className="rounded-[20px] border border-transparent px-3 py-1.5 text-xs font-medium text-leather-200 hover:bg-cream-100">Try again</button>} />
      </Card>
    );
  }

  const attPct = data.average_attendance ?? 0;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-leather-300">Dashboard</h1>
          <p className="text-xs text-leather-50/80">Institution overview at a glance</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Total students" value={data.total_students} icon={<Users size={20} />} hint={`${data.active_students} active`} tone="info" />
        <StatCard
          label="Avg attendance"
          value={`${attPct}%`}
          icon={<UserCheck size={20} />}
          tone={attPct >= data.attendance_threshold ? "success" : "danger"}
          hint={`Threshold ${data.attendance_threshold}%`}
        />
        <StatCard label="Low attendance" value={data.low_attendance_students} icon={<TrendingDown size={20} />} tone={data.low_attendance_students > 0 ? "warning" : "default"} hint="Below threshold" />
        <StatCard label="Classes today" value={data.classes_today} icon={<CalendarDays size={20} />} tone="default" />
        <StatCard label="Avg coding score" value={data.average_coding_score != null ? data.average_coding_score.toFixed(1) : "—"} icon={<Activity size={20} />} tone="info" />
        <StatCard label="Top streak" value={`${data.highest_current_streak}`} icon={<Flame size={20} />} tone="warning" hint="consecutive classes" />
        <StatCard label="Profiles synced" value={`${data.profiles_synced}/${data.profiles_total}`} icon={<RefreshCcw size={20} />} tone="success" />
        <StatCard label="Leaderboard leader" value={data.top_performers[0]?.score?.toFixed(1) ?? "—"} icon={<Trophy size={20} />} tone="default" hint={data.top_performers[0]?.name ?? "No data"} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Attendance trend */}
        <Card className="xl:col-span-2">
          <CardHeader title="Attendance trend" subtitle="Daily attendance percentage (last 30 days)" />
          <div className="h-56">
            {data.attendance_trend.length === 0 ? (
              <EmptyState title="No attendance records available." description="Mark attendance for classes to see trends here." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.attendance_trend}>
                  <defs>
                    <linearGradient id="attGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#000000" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#000000" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#a3a3a3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={4} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} unit="%" />
                  <ChartTooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Area type="monotone" dataKey="percentage" stroke="var(--text)" strokeWidth={2} fill="url(#attGrad)" name="Attendance %" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* Platform distribution */}
        <Card>
          <CardHeader title="Platform distribution" subtitle="Connected coding profiles" />
          {data.platform_distribution.length === 0 ? (
            <EmptyState title="No coding profiles connected." />
          ) : (
            <div className="flex h-56 flex-col items-center">
              <ResponsiveContainer width="100%" height="80%">
                <PieChart>
                  <Pie data={data.platform_distribution} dataKey="count" nameKey="platform" innerRadius={45} outerRadius={70} paddingAngle={3}>
                    {data.platform_distribution.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-1 flex flex-wrap justify-center gap-2">
                {data.platform_distribution.slice(0, 6).map((p, i) => (
                  <Badge key={p.platform} className="capitalize" tone="gray">
                    <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    {p.platform}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Top performers */}
      <Card>
        <CardHeader title="Top performers" subtitle="Highest overall scores" action={<Link to="/admin/leaderboards" className="text-xs font-medium text-primary-600 hover:underline">View leaderboard</Link>} />
        {data.top_performers.length === 0 ? (
          <EmptyState title="No leaderboard data available." description="Recalculate the leaderboard after syncing coding profiles." />
        ) : (
          <ol className="space-y-2.5">
            {data.top_performers.map((t, i) => (
              <li key={t.student_id} className="flex items-center gap-3 rounded-[20px] bg-cream-100 px-3.5 py-2.5">
                <span className={`text-xs font-bold ${i === 0 ? "text-primary-500" : i === 1 ? "text-neutral-600" : i === 2 ? "text-neutral-500" : "text-neutral-500"}`}>#{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-leather-200">{t.name}</p>
                  {t.attendance != null && <ProgressBar value={t.attendance} />}
                </div>
                <span className="text-sm font-bold text-primary-700">{t.score.toFixed(1)}</span>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
