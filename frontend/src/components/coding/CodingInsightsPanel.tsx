import { useEffect, useMemo, useState } from "react";
import { Activity, ExternalLink, RefreshCw } from "lucide-react";
import { addDays, format, parseISO } from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useCodingActivity } from "@/api/hooks";
import { errorMessage } from "@/api/client";
import { PLATFORM_META } from "@/constants/codingPlatforms";
import { Badge, Card, CardHeader, EmptyState, Skeleton } from "@/components/ui/display";
import { Button, Input, Select } from "@/components/ui/forms";
import type { CodingActivityPlatform } from "@/types";

const TOOLTIP_STYLE = {
  fontSize: 12,
  borderRadius: 12,
  backgroundColor: "var(--panel)",
  border: "1px solid var(--border)",
  color: "var(--text)",
  boxShadow: "var(--neo-out-sm)",
};

const LABELS: Record<string, Record<string, string>> = {
  leetcode: {
    problems_solved: "Problems solved",
    easy_solved: "Easy solved",
    medium_solved: "Medium solved",
    hard_solved: "Hard solved",
    submissions: "All submissions",
    rating: "Contest rating",
    rank: "Global rank",
    contest_global_rank: "Contest global rank",
    contests: "Contests attended",
    reputation: "Reputation",
    total_active_days: "Active days",
    current_streak: "Current streak",
    active_years: "Active years",
  },
  codeforces: {
    problems_solved: "Unique problems solved",
    submissions: "Submissions fetched",
    accepted_submissions: "Accepted submissions",
    acceptance_rate: "Acceptance rate (%)",
    rating: "Current rating",
    max_rating: "Peak rating",
    rank_name: "Rank title",
    contribution: "Contribution",
    friend_count: "Friends",
    contests: "Rated contests",
    max_contest_rank: "Best contest rank",
    registration_year: "Joined year",
  },
  codechef: {
    problems_solved: "Problems solved",
    problems_solved_delta: "New problems detected",
    rating: "Current rating",
    max_rating: "Peak rating",
    stars: "Stars",
    rank: "Global rank",
    country_rank: "Country rank",
    contests: "Contests rated",
  },
  atcoder: {
    problems_solved: "Accepted problems",
    rating: "Current rating",
    max_rating: "Peak rating",
    rank: "Accepted rank",
    contests: "Contests rated",
    submissions: "Submissions (last year)",
    accepted_submissions: "Accepted submissions (last year)",
  },
  geeksforgeeks: {
    problems_solved: "Problems solved",
    problems_solved_delta: "New problems detected",
    score: "Score",
    monthly_score: "Monthly score",
    current_streak: "Current streak",
    longest_streak: "Longest streak",
    articles_published: "Articles published",
  },
  github: {
    public_repos: "Public repositories",
    followers: "Followers",
    following: "Following",
    public_gists: "Public gists",
    commits: "Public commits (recent feed)",
    pushes: "Public pushes (recent feed)",
    pull_requests: "Public pull requests (recent feed)",
    repository_creations: "Public repository creations",
    public_activity_events: "Public activity events",
    contributions: "Recent public contributions",
    repos_per_year: "Repositories per year",
  },
};

function localDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function initialRange() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 29);
  return { start: localDate(start), end: localDate(end) };
}

function humanize(metric: string) {
  return metric.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatMetric(value: string | number | null | undefined) {
  if (value == null || value === "") return "—";
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? value.toLocaleString()
      : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return value;
}

function profileMetrics(platform: CodingActivityPlatform) {
  return Object.entries(platform.statistics || {}).filter(
    ([key, value]) => !key.startsWith("_") && value !== null && value !== undefined && value !== "",
  );
}

function activityChart(platform: CodingActivityPlatform | undefined, start: string, end: string, metric: string) {
  if (!platform?.activity_metadata.available || !metric) return [];
  const startCoverage = platform.activity_metadata.coverage_start
    || platform.daily_activity[0]?.date;
  const endCoverage = platform.activity_metadata.coverage_end
    || platform.daily_activity[platform.daily_activity.length - 1]?.date;
  if (!startCoverage || !endCoverage) return [];
  const first = start > startCoverage ? start : startCoverage;
  const last = end < endCoverage ? end : endCoverage;
  if (first > last) return [];

  const values = new Map<string, number>();
  for (const day of platform.daily_activity) {
    if (platform.activity_metadata.fill_gaps === false) {
      const intervalStart = day.interval_start_date;
      const intervalEnd = day.interval_end_date;
      if (!day.estimated || !intervalStart || !intervalEnd || intervalStart < start || intervalEnd > end) {
        continue;
      }
    }
    values.set(day.date, day.metrics[metric] ?? 0);
  }
  const result: { date: string; value: number | null }[] = [];
  let cursor = parseISO(first);
  const finish = parseISO(last);
  while (cursor <= finish) {
    const date = format(cursor, "yyyy-MM-dd");
    const captured = values.get(date);
    result.push({
      date,
      value: captured ?? (platform.activity_metadata.fill_gaps === false ? null : 0),
    });
    cursor = addDays(cursor, 1);
  }
  return result;
}

export function CodingInsightsPanel({
  studentId,
  heading = "Platform statistics",
}: {
  studentId?: string;
  heading?: string;
}) {
  const [range, setRange] = useState(initialRange);
  const [selectedPlatform, setSelectedPlatform] = useState("");
  const [selectedMetric, setSelectedMetric] = useState("");
  const query = useCodingActivity(range.start, range.end, studentId);
  const platforms = query.data?.platforms ?? [];
  const activePlatforms = useMemo(
    () => platforms.filter((platform) => platform.connected),
    [platforms],
  );

  useEffect(() => {
    if (!selectedPlatform || !platforms.some((platform) => platform.platform === selectedPlatform)) {
      const firstWithActivity = activePlatforms.find((platform) => platform.activity_metadata.available);
      setSelectedPlatform(firstWithActivity?.platform ?? activePlatforms[0]?.platform ?? "");
      setSelectedMetric("");
    }
  }, [activePlatforms, platforms, selectedPlatform]);

  const chartPlatform = platforms.find((platform) => platform.platform === selectedPlatform);
  const metricKeys = useMemo(() => {
    if (!chartPlatform) return [];
    const keys = new Set<string>();
    chartPlatform.daily_activity.forEach((day) => {
      Object.keys(day.metrics).forEach((key) => keys.add(key));
    });
    const configured = chartPlatform.activity_metadata.metric_key;
    if (configured) keys.add(configured);
    return [...keys];
  }, [chartPlatform]);

  useEffect(() => {
    if (!chartPlatform) return;
    const preferred = chartPlatform.activity_metadata.metric_key;
    if (!metricKeys.includes(selectedMetric)) setSelectedMetric(preferred || metricKeys[0] || "");
  }, [chartPlatform, metricKeys, selectedMetric]);

  const chartData = useMemo(
    () => activityChart(chartPlatform, range.start, range.end, selectedMetric),
    [chartPlatform, range.start, range.end, selectedMetric],
  );
  const excludedSnapshotIntervals = chartPlatform?.activity_metadata.fill_gaps === false
    ? chartPlatform.daily_activity.filter((day) => {
        const intervalStart = day.interval_start_date;
        const intervalEnd = day.interval_end_date;
        return day.estimated && day.date >= range.start && day.date <= range.end
          && (!intervalStart || !intervalEnd || intervalStart < range.start || intervalEnd > range.end);
      }).length
    : 0;
  const chartTotal = chartData.reduce((total, day) => total + (day.value ?? 0), 0);
  const observationDays = chartData.filter((day) => day.value !== null).length;
  const activeDays = chartData.filter((day) => day.value !== null && day.value > 0).length;
  const sparseSnapshots = chartPlatform?.activity_metadata.fill_gaps === false;
  const selectedMetricLabel = LABELS[chartPlatform?.platform ?? ""]?.[selectedMetric]
    ?? humanize(selectedMetric);

  return (
    <section className="space-y-5">
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-leather-300">{heading}</h2>
            <p className="mt-1 text-sm text-leather-50">Each platform has its own metrics and daily activity measure.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:min-w-[22rem]">
            <label className="text-xs font-semibold text-leather-200">
              From
              <Input
                className="mt-1.5"
                type="date"
                value={range.start}
                max={range.end}
                onChange={(event) => setRange((current) => ({ ...current, start: event.target.value }))}
              />
            </label>
            <label className="text-xs font-semibold text-leather-200">
              To
              <Input
                className="mt-1.5"
                type="date"
                value={range.end}
                min={range.start}
                onChange={(event) => setRange((current) => ({ ...current, end: event.target.value }))}
              />
            </label>
          </div>
        </div>
      </Card>

      {query.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((index) => <Skeleton key={index} className="h-52 rounded-3xl" />)}
        </div>
      ) : query.isError ? (
        <Card><EmptyState title="Coding activity could not be loaded" description={errorMessage(query.error)} /></Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {platforms.map((platform) => {
              const meta = PLATFORM_META[platform.platform] ?? { label: platform.platform };
              const Icon = meta.icon;
              const metrics = profileMetrics(platform);
              return (
                <Card key={platform.platform} className="min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="sk-icon-disc flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-leather-200">
                        {Icon ? <Icon size={18} /> : <Activity size={17} />}
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-bold text-leather-300">{meta.label}</h3>
                        <p className="truncate text-xs text-leather-50">{platform.connected ? `@${platform.username || "profile"}` : "No profile connected"}</p>
                      </div>
                    </div>
                    <Badge tone={platform.sync_status === "success" ? "green" : platform.sync_status === "failed" ? "red" : "gray"}>
                      {platform.sync_status.replace(/_/g, " ")}
                    </Badge>
                  </div>

                  {platform.connected && metrics.length > 0 ? (
                    <dl className="mt-4 grid grid-cols-2 gap-2">
                      {metrics.map(([key, value]) => (
                        <div key={key} className="neo-inset-surface min-w-0 rounded-2xl px-3 py-2.5">
                          <dt className="truncate text-[10px] font-semibold uppercase tracking-wide text-leather-50">
                            {LABELS[platform.platform]?.[key] ?? humanize(key)}
                          </dt>
                          <dd className="mt-1 truncate text-base font-bold text-leather-300" title={String(value)}>
                            {formatMetric(value)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : platform.connected ? (
                    <div className="neo-inset-surface mt-4 rounded-2xl p-3 text-xs text-leather-50">
                      {platform.sync_error || platform.activity_metadata.note || "No statistics have been returned yet. Run a profile sync to load them."}
                    </div>
                  ) : (
                    <div className="neo-inset-surface mt-4 rounded-2xl p-3 text-xs text-leather-50">
                      {studentId ? "This student has not connected this platform." : "Connect this profile from your profile page."}
                    </div>
                  )}

                  {platform.activity_metadata.note && (
                    <p className="mt-3 text-[11px] leading-relaxed text-leather-50">{platform.activity_metadata.note}</p>
                  )}
                  {platform.profile_url && (
                    <a href={platform.profile_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary-700 hover:underline">
                      Open profile <ExternalLink size={12} />
                    </a>
                  )}
                </Card>
              );
            })}
          </div>

          <Card>
            <CardHeader
              title="Day by day activity"
              subtitle="The selected line uses the metric supplied by that platform."
              action={query.isFetching ? <RefreshCw size={15} className="animate-spin text-leather-50" /> : undefined}
            />
            {!activePlatforms.some((platform) => platform.activity_metadata.available) ? (
              <EmptyState icon={<Activity size={20} />} title="No daily activity source is available yet" description="Connect and sync a platform with public dated activity to see a chart." />
            ) : (
              <>
                <div className="mb-4 grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-leather-200">
                    Platform
                    <Select className="mt-1.5" value={selectedPlatform} onChange={(event) => { setSelectedPlatform(event.target.value); setSelectedMetric(""); }}>
                      {activePlatforms.filter((platform) => platform.activity_metadata.available).map((platform) => (
                        <option key={platform.platform} value={platform.platform}>{PLATFORM_META[platform.platform]?.label ?? platform.platform}</option>
                      ))}
                    </Select>
                  </label>
                  {metricKeys.length > 1 && (
                    <label className="text-xs font-semibold text-leather-200">
                      Daily measure
                      <Select className="mt-1.5" value={selectedMetric} onChange={(event) => setSelectedMetric(event.target.value)}>
                        {metricKeys.map((key) => <option key={key} value={key}>{LABELS[chartPlatform?.platform ?? ""]?.[key] ?? humanize(key)}</option>)}
                      </Select>
                    </label>
                  )}
                </div>
                {chartData.length === 0 ? (
                  <div className="neo-inset-surface rounded-2xl p-5 text-sm text-leather-50">
                    No captured activity falls within {range.start} to {range.end}. Expand the date range or sync the profile.
                  </div>
                ) : (
                  <>
                    <dl className="mb-4 grid gap-3 sm:grid-cols-3">
                      {[
                        { label: `Total ${selectedMetricLabel.toLowerCase()}`, value: chartTotal.toLocaleString() },
                        { label: sparseSnapshots ? "Sync observations" : "Active days", value: (sparseSnapshots ? observationDays : activeDays).toLocaleString() },
                        { label: sparseSnapshots ? "Average per sync observation" : "Average per covered day", value: (chartTotal / Math.max(observationDays, 1)).toLocaleString(undefined, { maximumFractionDigits: 2 }) },
                      ].map((summary) => (
                        <div key={summary.label} className="neo-inset-surface rounded-2xl px-4 py-3">
                          <dt className="text-[10px] font-bold uppercase tracking-wider text-leather-50">{summary.label}</dt>
                          <dd className="mt-1 text-lg font-bold text-leather-300">{summary.value}</dd>
                        </div>
                      ))}
                    </dl>
                    <p className="mb-2 text-xs text-leather-50">
                      {sparseSnapshots ? "Sync date span" : "Covered dates"}: {format(parseISO(chartData[0].date), "MMM d, yyyy")} – {format(parseISO(chartData[chartData.length - 1].date), "MMM d, yyyy")} ({sparseSnapshots ? observationDays : chartData.length} {(sparseSnapshots ? "sync observations" : "days")})
                    </p>
                    <div className="neo-inset-surface h-72 rounded-3xl p-3 sm:p-5">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                          <XAxis dataKey="date" tickFormatter={(value: string) => format(parseISO(value), "MMM d")} interval="preserveStartEnd" minTickGap={24} tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} />
                          <Tooltip
                            contentStyle={TOOLTIP_STYLE}
                            labelFormatter={(value) => format(parseISO(String(value)), "EEE, MMM d, yyyy")}
                            formatter={(value: number) => [value, selectedMetricLabel]}
                          />
                          <Bar dataKey="value" name="Daily activity" fill="#15803d" radius={[5, 5, 0, 0]} maxBarSize={24} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                )}
                {chartPlatform?.activity_metadata.note && (
                  <p className="mt-3 text-xs leading-relaxed text-leather-50">{chartPlatform.activity_metadata.note}</p>
                )}
                {chartPlatform && chartPlatform.activity_metadata.available && !chartPlatform.activity_range?.complete && (
                  <div className="neo-alert neo-alert-danger mt-3 px-4 py-3 text-xs">
                    The selected range is only partly covered by this source. The chart and totals include captured dates from {chartPlatform.activity_range?.coverage_start || "the start of available history"} to {chartPlatform.activity_range?.coverage_end || "the latest sync"}; they do not represent the full selected interval.
                  </div>
                )}
                {excludedSnapshotIntervals > 0 && (
                  <div className="neo-alert neo-alert-danger mt-3 px-4 py-3 text-xs">
                    {excludedSnapshotIntervals} sync interval(s) cross the selected date boundary and are excluded from the period total. The source only provides changes between syncs, so exact daily solve dates cannot be recovered.
                  </div>
                )}
                {chartPlatform?.activity_metadata.possibly_truncated && (
                  <p className="mt-2 text-xs font-semibold text-warning-700">The platform returned a capped history, so earlier activity may be missing.</p>
                )}
              </>
            )}
          </Card>
        </>
      )}

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => query.refetch()} loading={query.isFetching}>
          <RefreshCw size={14} /> Refresh activity
        </Button>
      </div>
    </section>
  );
}
