import { useState } from "react";
import axios from "axios";
import { Trophy, Crown } from "lucide-react";
import { clsx } from "clsx";
import { Tabs } from "@/components/ui/navigation";
import { Badge, Card, EmptyState, ErrorState, TableSkeleton } from "@/components/ui/display";
import { Table } from "@/components/ui/navigation";
import { DatePicker } from "@/components/ui/forms";
import { useStudentLeaderboard } from "@/api/hooks";
import { errorMessage } from "@/api/client";
import type { LeaderboardEntry } from "@/types";

const TABS = [
  { key: "overall", label: "Lifetime snapshot" },
  { key: "activity", label: "Activity days" },
  { key: "leetcode", label: "LeetCode" },
  { key: "codechef", label: "CodeChef" },
  { key: "codeforces", label: "Codeforces" },
  { key: "atcoder", label: "AtCoder" },
  { key: "github", label: "GitHub" },
  { key: "geeksforgeeks", label: "GeeksforGeeks" },
];

function currentRange() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 29);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { start: iso(start), end: iso(end) };
}

export function LeaderboardPage() {
  const [tab, setTab] = useState("activity");
  const [range, setRange] = useState(currentRange);
  const periodMode = tab !== "overall";
  const { data, isLoading, isError, error, refetch } = useStudentLeaderboard(
    tab,
    periodMode ? range.start : undefined,
    periodMode ? range.end : undefined,
  );
  const unassigned = axios.isAxiosError(error) && error.response?.status === 409;

  if (unassigned) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div>
          <h1 className="page-title">Your batch leaderboard</h1>
          <p className="page-description">Rankings appear after you join a batch.</p>
        </div>
        <Card><EmptyState icon={<Trophy size={20} />} title="No batch assigned" description="Ask your administrator to add you to a batch to see its leaderboard." /></Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="page-title">{data?.batch?.name ?? "Your batch leaderboard"}</h1>
          {data?.batch && <p className="mt-1 text-sm font-semibold text-primary-700">{data.batch.batch_code} · {data.batch.student_count} {data.batch.student_count === 1 ? "member" : "members"}</p>}
          <p className="page-description">
            {data?.period_mode
              ? `${data.period_metric_label} from ${data.start_date} to ${data.end_date} (${data.activity_timezone})`
              : data?.generated_at
                ? `Current overall snapshot · ${new Date(data.generated_at).toLocaleString()}`
                : "Overall rankings update after each sync"}
          </p>
        </div>
        <Tabs tabs={TABS} active={tab} onChange={setTab} />
      </div>

      {periodMode && (
        <div className="card flex flex-wrap items-end gap-3 p-4">
          <p className="mr-auto text-xs text-leather-50">Rank current batch members for this interval. Platform tabs use that platform's daily measure.</p>
          <div className="w-full text-xs font-semibold text-leather-200 sm:w-44">From<DatePicker className="mt-1.5" ariaLabel="Start date" value={range.start} maxDate={range.end} onChange={(start) => setRange((value) => ({ ...value, start }))} /></div>
          <div className="w-full text-xs font-semibold text-leather-200 sm:w-44">To<DatePicker className="mt-1.5" ariaLabel="End date" value={range.end} minDate={range.start} onChange={(end) => setRange((value) => ({ ...value, end }))} /></div>
        </div>
      )}

      {data?.period_mode && (
        <div className="neo-alert neo-alert-info px-4 py-3 text-xs">
          Comparing {data.covered_profiles} profiles with full interval coverage. {data.excluded_profiles ? `${data.excluded_profiles} profile(s) without full coverage were left out. ` : ""}
          {data.estimated_profiles ? `${data.estimated_profiles} profile(s) use sync estimates${tab === "activity" ? " and were excluded because exact active dates are unavailable" : " for period totals"}. ` : ""}
          {data.quality_note}
        </div>
      )}

      {data?.me?.rank && data.me.student_id && !data.entries.some((entry) => entry.student_id === data.me?.student_id) && (
        <div className="neo-alert neo-alert-info px-4 py-3 text-sm">
          Your batch rank is <strong className="text-primary-700">#{data.me.rank}</strong>. Showing the top {data.entries.length} of {data.total} ranked members.
        </div>
      )}

      <Card className="p-0">
        {isLoading ? (
          <TableSkeleton rows={8} cols={5} />
        ) : isError ? (
          <ErrorState message={errorMessage(error)} onRetry={() => refetch()} />
        ) : !data || data.entries.length === 0 ? (
          <EmptyState icon={<Trophy size={20} />} title="No rankings for this batch yet" description="Scores appear after batch members connect and sync coding profiles." />
        ) : (
          <>
            {/* Podium */}
            <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3 sm:p-6">
              {[data.entries[1], data.entries[0], data.entries[2]].filter(Boolean).map((entry) => {
                const first = entry.rank === 1;
                return (
                  <div
                    key={entry.student_id}
                    className={clsx(
                      "flex min-w-0 flex-col items-center rounded-3xl px-4 py-5 text-center",
                      first ? "card shadow-card ring-1 ring-primary-500/20" : "card-inset"
                    )}
                  >
                    {first && <Crown size={16} className="mb-1 text-primary-500" />}
                    <p className="max-w-full truncate text-sm font-semibold text-leather-300" title={entry.student_name}>{entry.student_name}</p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <Badge tone={first ? "gray" : "gray"}>#{entry.rank}</Badge>
                      <span className="text-xs font-bold text-primary-500">{data.period_mode ? formatCount(entry.score) : entry.score.toFixed(1)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <Table headers={data.period_mode ? ["Rank", "Student", data.period_metric_label || "Period total", tab === "activity" ? "Platforms" : "Active days", "Period details"] : tab === "overall" ? ["Rank", "Student", "Course / Branch", "Score", "Attendance"] : platformHeaders(tab)}>
              {data.entries.map((e) => (
                <tr key={e.student_id} className={clsx("transition-colors hover:bg-cream-200/50", data.me?.student_id === e.student_id && "bg-[rgba(21,128,61,0.05)]")}>
                  <td className="px-4 py-2.5 font-semibold text-leather-50/80">#{e.rank}</td>
                  <td className="px-4 py-2.5">
                    <span className="font-medium text-leather-300">{e.student_name}</span>
                    {e.roll_number && <span className="ml-2 text-[11px] text-leather-50/80">{e.roll_number}</span>}
                  </td>
                  {data.period_mode ? (
                    <>
                      <td className="px-4 py-2.5 font-bold text-primary-700">{formatCount(e.score)}</td>
                      <td className="px-4 py-2.5 text-xs text-leather-200">{tab === "activity" ? formatCount(e.metrics.platforms_active ?? 0) : formatCount(e.metrics.activity_days ?? 0)}</td>
                      <td className="px-4 py-2.5 text-xs text-leather-50/80">
                        {tab === "activity" ? `${formatCount(e.metrics.platform_days ?? 0)} platform-days` : data.period_metric_label}
                      </td>
                    </>
                  ) : tab === "overall" ? (
                    <>
                      <td className="px-4 py-2.5 text-xs text-leather-50/80">
                        {e.course ?? "—"} · {e.branch ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 font-bold text-primary-700">{e.score.toFixed(1)}</td>
                      <td className="px-4 py-2.5 text-xs">{e.attendance_percentage != null ? `${e.attendance_percentage}%` : "—"}</td>
                    </>
                  ) : (
                    <>
                      <PlatformMetricCell tab={tab} entry={e} />
                    </>
                  )}
                </tr>
              ))}
            </Table>
          </>
        )}
      </Card>
    </div>
  );
}

function platformHeaders(tab: string): string[] {
  switch (tab) {
    case "activity":
      return ["Rank", "Student", "Active days", "Platforms", "Activity"];
    case "github":
      return ["Rank", "Student", "Contributions", "Public Repos", "Followers"];
    case "leetcode":
      return ["Rank", "Student", "Problems Solved", "Rating", "Contests"];
    case "atcoder":
      return ["Rank", "Student", "Rating", "Problems Solved"];
    case "geeksforgeeks":
      return ["Rank", "Student", "Problems Solved", "Score"];
    default:
      return ["Rank", "Student", "Problems Solved", "Rating"];
  }
}

function PlatformMetricCell({ tab, entry }: { tab: string; entry: LeaderboardEntry }) {
  const m = entry.metrics;
  if (tab === "github") {
    return (
      <>
        <td className="px-4 py-2.5 font-semibold text-primary-500">{m.contributions ?? 0}</td>
        <td className="px-4 py-2.5 text-xs text-leather-200">{m.public_repos ?? 0}</td>
        <td className="px-4 py-2.5 text-xs text-leather-200">{m.followers ?? 0}</td>
      </>
    );
  }
  const rating = m.rating ?? 0;
  const solved = m.problems_solved ?? 0;
  if (tab === "geeksforgeeks") {
    return (
      <>
        <td className="px-4 py-2.5 font-semibold text-leather-200">{formatCount(solved)}</td>
        <td className="px-4 py-2.5 font-bold text-primary-700">{formatCount(m.score ?? 0)}</td>
      </>
    );
  }
  if (tab === "atcoder") {
    return (
      <>
        <td className="px-4 py-2.5 font-bold text-primary-700">{rating ? Math.round(rating) : "—"}</td>
        <td className="px-4 py-2.5 font-semibold text-leather-200">{formatCount(solved)}</td>
      </>
    );
  }
  const contests = m.contests ?? 0;
  return (
    <>
      <td className="px-4 py-2.5 font-semibold text-leather-200">{formatCount(solved)}</td>
      <td className="px-4 py-2.5 font-bold text-primary-700">{rating ? Math.round(rating) : "—"}</td>
      {tab === "leetcode" && <td className="px-4 py-2.5 text-xs text-leather-200">{formatCount(contests)}</td>}
    </>
  );
}

function formatCount(value: number): string {
  return Math.trunc(value).toLocaleString();
}
