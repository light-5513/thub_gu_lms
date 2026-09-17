import { useState } from "react";
import { Trophy, Crown } from "lucide-react";
import { clsx } from "clsx";
import { Tabs } from "@/components/ui/navigation";
import { Badge, Card, EmptyState, Skeleton, TableSkeleton } from "@/components/ui/display";
import { Table } from "@/components/ui/navigation";
import { useStudentLeaderboard } from "@/api/hooks";
import type { LeaderboardEntry } from "@/types";

const TABS = [
  { key: "overall", label: "Overall" },
  { key: "leetcode", label: "LeetCode" },
  { key: "codechef", label: "CodeChef" },
  { key: "codeforces", label: "Codeforces" },
  { key: "atcoder", label: "AtCoder" },
  { key: "github", label: "GitHub" },
];

export function LeaderboardPage() {
  const [tab, setTab] = useState("overall");
  const { data, isLoading } = useStudentLeaderboard(tab);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-leather-300">Leaderboard</h1>
          <p className="text-xs text-leather-50/80">
            {data?.generated_at ? `Last updated ${new Date(data.generated_at).toLocaleString()}` : "Rankings update after each sync"}
          </p>
        </div>
        <Tabs tabs={TABS} active={tab} onChange={setTab} />
      </div>

      <Card className="p-0">
        {isLoading ? (
          <TableSkeleton rows={8} cols={5} />
        ) : !data || data.entries.length === 0 ? (
          <EmptyState icon={<Trophy size={20} />} title="No leaderboard data available." description="Scores appear once coding profiles are synced." />
        ) : (
          <>
            {/* Podium */}
            <div className="grid grid-cols-3 gap-3 border-b border-transparent p-5">
              {[data.entries[1], data.entries[0], data.entries[2]].filter(Boolean).map((entry) => {
                const first = entry.rank === 1;
                return (
                  <div
                    key={entry.student_id}
                    className={clsx(
                      "flex flex-col items-center rounded-xl px-3 py-3.5 text-center",
                      first ? "card ring-1 ring-primary-500/20" : "card-inset"
                    )}
                  >
                    {first && <Crown size={16} className="mb-1 text-primary-500" />}
                    <p className="truncate text-[11px] font-bold text-leather-300">{entry.student_name}</p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <Badge tone={first ? "gray" : "gray"}>#{entry.rank}</Badge>
                      <span className="text-xs font-bold text-primary-500">{entry.score.toFixed(1)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <Table headers={tab === "overall" ? ["Rank", "Student", "Course / Branch", "Score", "Attendance"] : platformHeaders(tab)}>
              {data.entries.map((e) => (
                <tr key={e.student_id} className={clsx("transition-colors hover:bg-cream-200/50", data.me && e.rank === data.me.rank && "bg-[rgba(21,128,61,0.05)]")}>
                  <td className="px-4 py-2.5 font-semibold text-leather-50/80">#{e.rank}</td>
                  <td className="px-4 py-2.5">
                    <span className="font-medium text-leather-300">{e.student_name}</span>
                    {e.roll_number && <span className="ml-2 text-[11px] text-leather-50/80">{e.roll_number}</span>}
                  </td>
                  {tab === "overall" ? (
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
    case "github":
      return ["Rank", "Student", "Contributions", "Public Repos", "Followers"];
    case "atcoder":
      return ["Rank", "Student", "Rating", "Problems Solved"];
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
  return (
    <>
      <td className="px-4 py-2.5 font-semibold text-leather-200">{solved}</td>
      <td className="px-4 py-2.5 font-bold text-primary-700">{rating ? Math.round(rating) : "—"}</td>
    </>
  );
}
