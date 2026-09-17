import { useState } from "react";
import { ScrollText } from "lucide-react";
import { useAuditLogs } from "@/api/hooks";
import { Badge, Card, EmptyState, TableSkeleton } from "@/components/ui/display";
import { Pagination, Table } from "@/components/ui/navigation";
import type { AuditLog } from "@/types";

const ACTION_TONES: Record<string, string> = {
  LOGIN: "green",
  LOGOUT: "gray",
  LOGIN_FAILED: "red",
  STUDENT_CREATED: "blue",
  STUDENT_UPDATED: "blue",
  STUDENT_DEACTIVATED: "red",
  INVITATION_SENT: "blue",
  INVITATION_RESENT: "blue",
  BULK_IMPORT: "purple",
  PASSWORD_RESET: "amber",
  PASSWORD_RESET_REQUESTED: "gray",
  PASSWORD_CHANGED: "amber",
  CLASS_CREATED: "blue",
  CLASS_UPDATED: "blue",
  CLASS_DELETED: "red",
  ATTENDANCE_CREATED: "green",
  ATTENDANCE_UPDATED: "amber",
  ATTENDANCE_DELETED: "red",
  CODING_SYNC_STARTED: "blue",
  CODING_SYNC_COMPLETED: "green",
  LEADERBOARD_RECALCULATED: "purple",
  SETTINGS_CHANGED: "amber",
};

export function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAuditLogs(page);

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-lg font-bold text-leather-300">Audit logs</h1>
        <p className="text-xs text-leather-50/80">Every important administrative action is traceable — who did what, when, and from where.</p>
      </div>

      <Card className="p-0">
        {isLoading ? (
          <TableSkeleton rows={10} cols={5} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState icon={<ScrollText size={20} />} title="No audit entries yet." description="Actions like logins, invitations and attendance edits will appear here." />
        ) : (
          <>
            <Table headers={["Action", "Actor", "Entity", "Details", "When"]}>
              {(data.items as AuditLog[]).map((log) => {
                const detail =
                  log.new_data && Object.keys(log.new_data).length > 0
                    ? Object.entries(log.new_data)
                        .slice(0, 3)
                        .map(([k, v]) => `${k}: ${typeof v === "object" ? "…" : String(v)}`)
                        .join(" · ")
                    : log.old_data && Object.keys(log.old_data).length
                      ? `from ${Object.entries(log.old_data).slice(0, 2).map(([k, v]) => `${k}: ${String(v)}`).join(", ")}`
                      : "—";
                return (
                  <tr key={log.id} className="hover:bg-cream-100/70">
                    <td className="px-4 py-2.5">
                      <Badge tone={(ACTION_TONES[log.action ?? ""] ?? "gray") as never}>{(log.action ?? "").replace(/_/g, " ")}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-leather-200">
                      {log.user_email ?? "system"}
                      {log.role && <span className="ml-1.5 text-[10px] uppercase text-leather-50/80">{log.role}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-leather-50/80">{log.entity ?? "—"}</td>
                    <td className="max-w-[260px] truncate px-4 py-2.5 text-[11px] text-leather-50/80" title={detail}>{detail}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-[11px] text-leather-50/80">
                      {log.created_at ? new Date(log.created_at).toLocaleString() : "—"}
                      {log.ip_address && <span className="ml-1 text-leather-50/80">· {log.ip_address}</span>}
                    </td>
                  </tr>
                );
              })}
            </Table>
            <div className="flex items-center justify-between border-t border-transparent px-4 py-3">
              <p className="text-[11px] text-leather-50/80">{data.total} entries</p>
              <Pagination page={data.page} totalPages={data.total_pages} onChange={setPage} />
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
