import { useState } from "react";
import { Crown, RefreshCcw, Trophy } from "lucide-react";
import { clsx } from "clsx";
import { useLeaderboard, useRecalcLeaderboard } from "@/api/hooks";
import { Badge, Card, EmptyState, Skeleton, TableSkeleton } from "@/components/ui/display";
import { Button, Select } from "@/components/ui/forms";
import { Tabs, Table } from "@/components/ui/navigation";
import { useToast } from "@/components/ui/overlays";
import { errorMessage } from "@/api/client";

const TABS = [
  { key: "overall", label: "Overall" },
  { key: "leetcode", label: "LeetCode" },
  { key: "codechef", label: "CodeChef" },
  { key: "codeforces", label: "Codeforces" },
  { key: "atcoder", label: "AtCoder" },
  { key: "github", label: "GitHub" },
];

export function AdminLeaderboardsPage() {
  const [tab, setTab] = useState("overall");
  const [course, setCourse] = useState("");
  const [branch, setBranch] = useState("");
  const [section, setSection] = useState("");
  const query = useLeaderboard("admin", `${tab}${course ? `&course=${encodeURIComponent(course)}` : ""}${branch ? `&branch=${encodeURIComponent(branch)}` : ""}${section ? `&section=${encodeURIComponent(section)}` : ""}`);
  const recalc = useRecalcLeaderboard();
  const toast = useToast();

  const data = query.data;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-lg font-bold text-leather-300">Leaderboards</h1>
          <p className="text-xs text-leather-50/80">{data?.generated_at ? `Snapshot: ${new Date(data.generated_at).toLocaleString()}` : "No snapshot yet — recalculate to generate"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={course} onChange={(e) => setCourse(e.target.value)} className="w-auto" aria-label="Course filter">
            <option value="">All courses</option><option>B.Tech</option><option>M.Tech</option>
          </Select>
          <Select value={branch} onChange={(e) => setBranch(e.target.value)} className="w-auto" aria-label="Branch filter">
            <option value="">All branches</option><option>CSE</option><option>IT</option><option>ECE</option><option>EEE</option><option>AIML</option><option>CS</option><option>DS</option>
          </Select>
          <Button
            variant="secondary"
            size="sm"
            loading={recalc.isPending}
            onClick={() =>
              recalc.mutate(undefined, {
                onSuccess: (r) => {
                  toast.push("success", `Leaderboard recalculated for ${r.recalculated} students`);
                  query.refetch();
                },
                onError: (e) => toast.push("error", errorMessage(e)),
              })
            }
          >
            <RefreshCcw size={14} /> Recalculate
          </Button>
        </div>
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      <Card className="p-0">
        {query.isLoading ? (
          <TableSkeleton rows={10} cols={7} />
        ) : !data || data.entries.length === 0 ? (
          <EmptyState icon={<Trophy size={20} />} title="No leaderboard data available." description="Run a coding sync, then recalculate the leaderboard." />
        ) : (
          <Table headers={["Rank", "Student", "Roll number", "Attendance", "Streak", tab === "overall" ? "Overall score" : "Score", "Details"]}>
            {data.entries.map((e) => (
              <tr key={e.student_id} className={clsx("hover:bg-cream-100/70", e.rank <= 3 && "bg-neutral-100/30")}>
                <td className="px-4 py-2.5">
                  {e.rank === 1 ? (
                    <span className="inline-flex items-center gap-1 font-bold text-primary-500"><Crown size={14} /> 1</span>
                  ) : (
                    <span className="font-semibold text-leather-50/80">#{e.rank}</span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <p className="font-medium text-leather-300">{e.student_name}</p>
                  <p className="text-[11px] text-leather-50/80">{e.course} · {e.branch}</p>
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-leather-50/80">{e.roll_number}</td>
                <td className="px-4 py-2.5 text-xs">{e.attendance_percentage != null ? <Badge tone={(e.attendance_percentage ?? 0) >= 75 ? "green" : "red"}>{e.attendance_percentage}%</Badge> : "—"}</td>
                <td className="px-4 py-2.5 text-xs font-semibold text-primary-500">{e.current_streak ?? 0}</td>
                <td className="px-4 py-2.5 font-bold text-primary-700">{e.score.toFixed(1)}</td>
                <td className="px-4 py-2.5 text-[11px] text-leather-50/80">
                  {tab === "overall"
                    ? `Coding ${e.metrics.coding_score?.toFixed(0) ?? 0} · Att ${e.metrics.attendance_score?.toFixed(0) ?? 0} · Streak ${e.metrics.streak_score?.toFixed(0) ?? 0}`
                    : platformDetails(tab, e.metrics)}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}

function platformDetails(tab: string, m: Record<string, number>): string {
  switch (tab) {
    case "github":
      return `${m.contributions ?? 0} contributions · ${m.public_repos ?? 0} repos · ${m.followers ?? 0} followers`;
    case "leetcode":
      return `${m.problems_solved ?? 0} solved · rating ${Math.round(m.rating ?? 0)} · ${m.contests ?? 0} contests`;
    case "codeforces":
      return `${m.problems_solved ?? 0} solved · rating ${Math.round(m.rating ?? 0)} · max ${Math.round(m.max_rating ?? 0)}`;
    case "codechef":
      return `${m.problems_solved ?? 0} solved · rating ${Math.round(m.rating ?? 0)}${m.stars ? ` · ${m.stars}★` : ""}`;
    case "atcoder":
      return `${m.problems_solved ?? 0} solved · rating ${Math.round(m.rating ?? 0)}`;
    default:
      return "";
  }
}
