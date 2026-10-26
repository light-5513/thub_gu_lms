import { useState } from "react";
import { ChevronLeft, ChevronRight, Crown, Layers, RefreshCcw, Trophy, Users } from "lucide-react";
import { clsx } from "clsx";
import { useBatches, useLeaderboard, useRecalcLeaderboard } from "@/api/hooks";
import { Badge, Card, EmptyState, ErrorState, Skeleton, TableSkeleton } from "@/components/ui/display";
import { Button, DatePicker, Input, Select } from "@/components/ui/forms";
import { Pagination, Tabs, Table } from "@/components/ui/navigation";
import { useToast } from "@/components/ui/overlays";
import { errorMessage } from "@/api/client";
import type { BatchSummary } from "@/types";

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

export function AdminLeaderboardsPage() {
  const [selectedBatch, setSelectedBatch] = useState<BatchSummary | null>(null);

  return selectedBatch
    ? <BatchLeaderboard batch={selectedBatch} onBack={() => setSelectedBatch(null)} />
    : <BatchClusters onSelect={setSelectedBatch} />;
}

function BatchClusters({ onSelect }: { onSelect: (batch: BatchSummary) => void }) {
  const [page, setPage] = useState(1);
  const batches = useBatches(page, 12);

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="page-title">Leaderboards</h1>
        <p className="page-description">Choose a batch to see its rankings.</p>
      </div>

      {batches.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-36 rounded-3xl" />)}
        </div>
      ) : batches.isError ? (
        <Card><ErrorState message={errorMessage(batches.error)} onRetry={() => { void batches.refetch(); }} /></Card>
      ) : !batches.data?.items.length ? (
        <Card><EmptyState icon={<Layers size={22} />} title="No batches yet" description="Create a batch and assign students before viewing rankings." /></Card>
      ) : (
        <>
          <p className="text-sm text-leather-200">{batches.data.total} {batches.data.total === 1 ? "batch" : "batches"}</p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {batches.data.items.map((batch) => (
              <button
                key={batch.id}
                type="button"
                onClick={() => onSelect(batch)}
                className="card group flex min-h-40 w-full flex-col justify-between gap-5 p-5 text-left transition-colors hover:bg-primary-500/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                aria-label={`Open ${batch.name} leaderboard`}
              >
                <span className="flex w-full items-start justify-between gap-3">
                  <span className="sk-icon-disc flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-primary-700"><Layers size={20} aria-hidden="true" /></span>
                  <ChevronRight size={18} className="mt-2 shrink-0 text-leather-50 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </span>
                <span className="block min-w-0">
                  <span className="block break-words text-base font-semibold text-leather-300">{batch.name}</span>
                  <span className="mt-1 block break-all text-xs text-leather-50">{batch.batch_code}</span>
                  <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-leather-200"><Users size={14} aria-hidden="true" /> {batch.student_count} {batch.student_count === 1 ? "member" : "members"}</span>
                </span>
              </button>
            ))}
          </div>
          <Pagination page={page} totalPages={batches.data.total_pages} onChange={setPage} />
        </>
      )}
    </div>
  );
}

function BatchLeaderboard({ batch, onBack }: { batch: BatchSummary; onBack: () => void }) {
  const [tab, setTab] = useState("activity");
  const [course, setCourse] = useState("");
  const [branch, setBranch] = useState("");
  const [section, setSection] = useState("");
  const [range, setRange] = useState(currentRange);
  const periodMode = tab !== "overall";
  const query = useLeaderboard("admin", tab, { batch_id: batch.id, course, branch, section }, periodMode ? range.start : undefined, periodMode ? range.end : undefined);
  const recalc = useRecalcLeaderboard();
  const toast = useToast();

  const data = query.data;
  const currentBatch = data?.batch ?? batch;

  return (
    <div className="space-y-4 animate-fade-in">
      <Button type="button" variant="ghost" size="sm" onClick={onBack} className="-ml-2">
        <ChevronLeft size={16} aria-hidden="true" /> All batches
      </Button>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="page-title">{currentBatch.name}</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-leather-200"><span className="font-semibold text-primary-700">{currentBatch.batch_code}</span><span aria-hidden="true">·</span>{currentBatch.student_count} {currentBatch.student_count === 1 ? "member" : "members"}</p>
          {data?.period_mode && <p className="mt-1 text-xs font-semibold text-primary-700">{data.period_metric_label} · {data.start_date} to {data.end_date} ({data.activity_timezone})</p>}
          <p className="page-description">{data?.period_mode ? "Ranking current batch members using activity captured during the selected interval" : data?.generated_at ? `Current batch snapshot: ${new Date(data.generated_at).toLocaleString()}` : "No snapshot yet — recalculate to generate"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={course} onChange={(e) => setCourse(e.target.value)} className="w-auto" aria-label="Course filter">
            <option value="">All courses</option><option>B.Tech</option><option>M.Tech</option>
          </Select>
          <Select value={branch} onChange={(e) => setBranch(e.target.value)} className="w-auto" aria-label="Branch filter">
            <option value="">All branches</option><option>CSE</option><option>IT</option><option>ECE</option><option>EEE</option><option>AIML</option><option>CS</option><option>DS</option>
          </Select>
          <Input
            value={section}
            onChange={(e) => setSection(e.target.value)}
            className="w-32"
            placeholder="Section"
            aria-label="Section filter"
          />
          {periodMode && (
            <>
              <DatePicker
                ariaLabel="Start date"
                value={range.start}
                maxDate={range.end}
                align="start"
                className="w-44"
                onChange={(start) => setRange((value) => ({ ...value, start }))}
              />
              <DatePicker
                ariaLabel="End date"
                value={range.end}
                minDate={range.start}
                align="end"
                className="w-44"
                onChange={(end) => setRange((value) => ({ ...value, end }))}
              />
            </>
          )}
          {!periodMode && <Button
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
          </Button>}
        </div>
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {data?.period_mode && (
        <div className="neo-alert neo-alert-info px-4 py-3 text-xs">
          Comparing {data.covered_profiles} profiles with full interval coverage. {data.excluded_profiles ? `${data.excluded_profiles} profile(s) without full coverage were left out. ` : ""}
          {data.estimated_profiles ? `${data.estimated_profiles} profile(s) use sync estimates${tab === "activity" ? " and were excluded because exact active dates are unavailable" : " for period totals"}. ` : ""}
          {data.activity_available_from && data.activity_available_through
            ? `Stored activity dates span ${data.activity_available_from} to ${data.activity_available_through}; each profile must cover the full selected interval. `
            : "No dated activity is currently available for this tab. "}
          {data.quality_note}
        </div>
      )}

      <Card className="p-0">
        {query.isLoading ? (
          <TableSkeleton rows={10} cols={7} />
        ) : query.isError ? (
          <ErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} />
        ) : !data || data.entries.length === 0 ? (
          <EmptyState
            icon={<Trophy size={20} />}
            title={currentBatch.student_count === 0 ? "No students in this batch" : "No leaderboard data available."}
            description={currentBatch.student_count === 0
              ? "Assign students to this batch to start its leaderboard."
              : data?.period_mode
              ? data.activity_available_from && data.activity_available_through
                ? `Stored activity dates span ${data.activity_available_from} to ${data.activity_available_through}. Choose a range fully covered by the connected profiles.`
                : "No dated activity is available for this tab yet. Sync a valid profile and choose a range covered by its activity history."
              : "Run a coding sync, then recalculate the leaderboard."}
          />
        ) : (
          <Table headers={data.period_mode
            ? ["Rank", "Student", "Roll number", tab === "activity" ? "Platforms" : "Active days", data.period_metric_label || "Period total", "Details"]
            : ["Rank", "Student", "Roll number", "Attendance", "Streak", tab === "overall" ? "Overall score" : "Score", "Details"]}>
            {data.entries.map((e) => (
              <tr key={e.student_id} className={clsx("hover:bg-cream-300/50", e.rank <= 3 && "bg-primary-500/5")}>
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
                {data.period_mode ? (
                  <>
                    <td className="px-4 py-2.5 text-xs text-leather-200">{tab === "activity" ? formatCount(e.metrics.platforms_active ?? 0) : formatCount(e.metrics.activity_days ?? 0)}</td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-2.5 text-xs">{e.attendance_percentage != null ? <Badge tone={(e.attendance_percentage ?? 0) >= 75 ? "green" : "red"}>{e.attendance_percentage}%</Badge> : "—"}</td>
                    <td className="px-4 py-2.5 text-xs font-semibold text-primary-500">{e.current_streak ?? 0}</td>
                  </>
                )}
                <td className="px-4 py-2.5 font-bold text-primary-700">{data.period_mode ? formatCount(e.score) : e.score.toFixed(1)}</td>
                <td className="px-4 py-2.5 text-[11px] text-leather-50/80">
                  {data.period_mode
                    ? tab === "activity"
                      ? `${formatCount(e.metrics.platform_days ?? 0)} platform-days`
                      : data.period_metric_label
                    : tab === "overall"
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
      return `${formatCount(m.contributions)} contributions · ${formatCount(m.public_repos)} repos · ${formatCount(m.followers)} followers`;
    case "leetcode":
      return `${formatCount(m.problems_solved)} solved · rating ${Math.round(m.rating ?? 0)} · ${formatCount(m.contests)} contests`;
    case "codeforces":
      return `${formatCount(m.problems_solved)} solved · rating ${Math.round(m.rating ?? 0)} · max ${Math.round(m.max_rating ?? 0)}`;
    case "codechef":
      return `${formatCount(m.problems_solved)} solved · rating ${Math.round(m.rating ?? 0)}${m.stars ? ` · ${formatCount(m.stars)}★` : ""}`;
    case "atcoder":
      return `${formatCount(m.problems_solved)} solved · rating ${Math.round(m.rating ?? 0)}`;
    case "geeksforgeeks":
      return `${formatCount(m.problems_solved)} solved · score ${formatCount(m.score)}`;
    default:
      return "";
  }
}

function formatCount(value?: number): string {
  return Math.trunc(value ?? 0).toLocaleString();
}
