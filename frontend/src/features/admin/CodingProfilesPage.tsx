import { useState } from "react";
import { Github, PlayCircle, RefreshCcw } from "lucide-react";
import { useSyncJob, useSyncJobs, useTriggerSync } from "@/api/hooks";
import { Badge, Card, CardHeader, EmptyState, ProgressBar, Skeleton, TableSkeleton } from "@/components/ui/display";
import { Button } from "@/components/ui/forms";
import { Table } from "@/components/ui/navigation";
import { useToast } from "@/components/ui/overlays";
import { errorMessage } from "@/api/client";

const PLATFORMS = ["leetcode", "codechef", "codeforces", "atcoder", "github", "geeksforgeeks"] as const;
const LABELS: Record<string, string> = { leetcode: "LeetCode", codechef: "CodeChef", codeforces: "Codeforces", atcoder: "AtCoder", github: "GitHub", geeksforgeeks: "GeeksForGeeks", all: "All platforms" };

export function CodingProfilesAdminPage() {
  const trigger = useTriggerSync();
  const toast = useToast();
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const activeJob = useSyncJob(activeJobId);
  const jobs = useSyncJobs(activeJobId ? 2000 : undefined);

  const start = (platform: string) => {
    trigger.mutate(platform, {
      onSuccess: (job) => {
        setActiveJobId(job.job_id);
        toast.push("success", `${LABELS[platform]} synchronization started`);
      },
      onError: (e) => toast.push("error", errorMessage(e)),
    });
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-lg font-bold text-leather-300">Coding synchronization</h1>
        <p className="text-xs text-leather-50/80">Fetch fresh statistics from each platform for every connected student. Jobs run in the background.</p>
      </div>

      {/* Trigger buttons */}
      <Card>
        <CardHeader title="Fetch data" subtitle="Each button queues a background job that processes all students with a username on that platform" />
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((p) => (
            <Button key={p} variant={p === "github" ? "secondary" : "outline"} size="sm" loading={trigger.isPending && trigger.variables === p} onClick={() => start(p)}>
              {p === "github" ? <Github size={14} /> : <RefreshCcw size={13} />} Get {LABELS[p]} data
            </Button>
          ))}
          <Button loading={trigger.isPending && trigger.variables === "all"} onClick={() => start("all")}>
            <PlayCircle size={15} /> Get all data
          </Button>
        </div>
      </Card>

      {/* Active job progress */}
      {activeJobId && (
        <Card className="animate-fade-in ring-1 ring-black">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <div className="mb-2 flex items-center gap-2">
                <p className="text-sm font-semibold text-leather-300">
                  Synchronizing {LABELS[activeJob.data?.platform ?? ""] ?? "platform"}
                </p>
                <Badge tone={activeJob.data?.status === "running" || activeJob.data?.status === "queued" ? "blue" : activeJob.data?.status === "completed" ? "green" : activeJob.data?.status === "partial" ? "amber" : "red"}>
                  {activeJob.data?.status ?? "queued"}
                </Badge>
              </div>
              <ProgressBar value={activeJob.data?.processed ?? 0} max={Math.max(activeJob.data?.total ?? 1, 1)} tone="blue" />
              <p className="mt-2 text-[11px] text-leather-50/80">
                {(activeJob.data?.processed ?? 0).toLocaleString()} / {(activeJob.data?.total ?? 0).toLocaleString()} processed ·{" "}
                <span className="font-medium text-primary-500">{activeJob.data?.successful ?? 0} successful</span> ·{" "}
                <span className="font-medium text-primary-500">{activeJob.data?.failed ?? 0} failed</span> · {(activeJob.data?.remaining ?? 0).toLocaleString()} remaining
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setActiveJobId(null)}>Dismiss</Button>
          </div>
          {activeJob.data && activeJob.data.error_summary && activeJob.data.error_summary.length > 0 && (
            <details className="mt-3 card-inset p-3 text-[11px] text-primary-700">
              <summary className="cursor-pointer font-bold">{activeJob.data.error_summary.length} recent errors</summary>
              <ul className="mt-2 space-y-1">
                {activeJob.data.error_summary.slice(-8).map((e, i) => (
                  <li key={i} className="truncate">{e}</li>
                ))}
              </ul>
            </details>
          )}
        </Card>
      )}

      {/* Job history */}
      <Card className="p-0">
        <div className="border-b border-transparent px-5 py-3.5">
          <h3 className="text-sm font-semibold text-leather-300">Recent jobs</h3>
        </div>
        {jobs.isLoading ? (
          <TableSkeleton rows={5} cols={6} />
        ) : !jobs.data || jobs.data.length === 0 ? (
          <EmptyState title="No sync jobs yet." description="Trigger your first synchronization above." />
        ) : (
          <Table headers={["Platform", "Status", "Progress", "Success", "Failed", "Started"]}>
            {jobs.data.map((job) => (
              <tr key={job.job_id} className="cursor-pointer hover:bg-cream-100/70" onClick={() => setActiveJobId(job.job_id)}>
                <td className="px-4 py-2.5 text-xs font-medium capitalize text-leather-200">{LABELS[job.platform] ?? job.platform}</td>
                <td className="px-4 py-2.5">
                  <Badge tone={job.status === "completed" ? "green" : job.status === "partial" ? "amber" : job.status === "failed" ? "red" : "blue"}>{job.status}</Badge>
                </td>
                <td className="px-4 py-2.5 text-xs text-leather-200">{job.processed}/{job.total}</td>
                <td className="px-4 py-2.5 text-xs font-medium text-primary-500">{job.successful}</td>
                <td className="px-4 py-2.5 text-xs font-medium text-primary-500">{job.failed}</td>
                <td className="px-4 py-2.5 text-[11px] text-leather-50/80">{job.started_at ? new Date(job.started_at).toLocaleString() : "—"}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
