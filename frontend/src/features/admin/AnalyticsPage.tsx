import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { useAnalytics } from "@/api/hooks";
import { Badge, Card, CardHeader, EmptyState, Skeleton } from "@/components/ui/display";

const COLORS = ["var(--text)", "#64748b", "#94a3b8", "#cbd5e1", "#525252", "#1a1a1a"];
const STATUS_COLORS: Record<string, string> = { present: "var(--text)", late: "#64748b", absent: "#94a3b8", leave: "#cbd5e1" };

export function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const { data, isLoading } = useAnalytics(days);

  if (isLoading || !data) return <div className="space-y-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-56 w-full rounded-xl" />)}</div>;

  const hasAttendance = data.attendance_trend.length > 0;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-leather-300">Analytics</h1>
          <p className="text-xs text-leather-50/80">Attendance and performance insights across the institution</p>
        </div>
        <div className="flex gap-1.5">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-[20px] px-3 py-1.5 text-xs font-medium ${days === d ? "bg-primary-600 text-leather-200" : "bg-transparent text-leather-50/80 ring-1 ring-transparent hover:bg-cream-100"}`}
            >
              {d} days
            </button>
          ))}
        </div>
      </div>

      {/* Attendance vs Coding */}
      <Card>
        <CardHeader title="Attendance vs coding score" subtitle="Each dot is a student — is showing up correlated with coding?" />
        {data.attendance_vs_coding.length === 0 ? (
          <EmptyState title="Not enough data yet." description="Sync coding profiles and recalculate leaderboards first." />
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#a3a3a3" />
                <XAxis dataKey="attendance" name="Attendance %" unit="%" tick={{ fontSize: 11 }} />
                <YAxis dataKey="coding" name="Coding score" tick={{ fontSize: 11 }} domain={[0, 100]} />
                <ZAxis range={[40, 41]} />
                <ChartTooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} cursor={{ strokeDasharray: "3 3" }} />
                <Scatter data={data.attendance_vs_coding} fill="var(--text)" fillOpacity={0.6} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {/* Attendance by group */}
        <Card>
          <CardHeader title="Average attendance by branch" />
          {data.by_branch.length === 0 ? (
            <EmptyState title="No attendance records available." />
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.by_branch}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#a3a3a3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <ChartTooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="percentage" name="Attendance %" radius={[5, 5, 0, 0]}>
                    {data.by_branch.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Status distribution donut */}
        <Card>
          <CardHeader title="Attendance status distribution" subtitle="All marked sessions" />
          {data.distribution.length === 0 ? (
            <EmptyState title="No attendance records available." />
          ) : (
            <div className="flex h-56 items-center gap-6">
              <ResponsiveContainer width="55%" height="100%">
                <PieChart>
                  <Pie data={data.distribution} dataKey="count" nameKey="status" innerRadius={45} outerRadius={72} paddingAngle={3}>
                    {data.distribution.map((entry) => (
                      <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? COLORS[0]} />
                    ))}
                  </Pie>
                  <ChartTooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
              <ul className="space-y-2 text-xs">
                {data.distribution.map((d, i) => (
                  <li key={d.status} className="flex items-center gap-2 capitalize">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLORS[d.status] ?? COLORS[i] }} />
                    {d.status}: <strong>{d.count}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        {/* Daily trend */}
        <Card>
          <CardHeader title="Daily attendance trend" subtitle={`Last ${days} days`} />
          {!hasAttendance ? (
            <EmptyState title="No attendance in this period." />
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.attendance_trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#a3a3a3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} interval={Math.ceil(data.attendance_trend.length / 8)} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <ChartTooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Line type="monotone" dataKey="percentage" stroke="var(--text)" strokeWidth={2} dot={false} name="Attendance %" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Low attendance watchlist */}
        <Card>
          <CardHeader
            title="Low attendance students"
            subtitle="Below configured threshold — highlighted for intervention"
            action={<Badge tone="red">{data.low_attendance.length}</Badge>}
          />
          {data.low_attendance.length === 0 ? (
            <EmptyState title="No students below threshold." description="Everyone is above the minimum attendance requirement." />
          ) : (
            <ul className="max-h-52 space-y-2 overflow-y-auto pr-1">
              {data.low_attendance.map((s) => (
                <li key={s.student_id} className="flex items-center justify-between rounded-[20px] bg-neutral-100/60 px-3 py-2 ring-1 ring-black/70">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-leather-200">{s.name}</p>
                    <p className="text-[11px] text-leather-50/80">{s.roll_number}</p>
                  </div>
                  <span className="text-xs font-bold text-black">{s.attendance}%</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Perfect attendance */}
      <Card>
        <CardHeader title="Perfect attendance" subtitle={`${days}-day window with 100% presence`} action={<Badge tone="green">{data.perfect_attendance.length}</Badge>} />
        {data.perfect_attendance.length === 0 ? (
          <EmptyState title="No perfect attendance records in this window." />
        ) : (
          <div className="flex flex-wrap gap-2">
            {data.perfect_attendance.slice(0, 24).map((s) => (
              <span key={s.student_id} className="rounded-full bg-neutral-100 px-3 py-1 text-[11px] font-medium text-black ring-1 ring-primary-200">
                {s.name}
              </span>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
