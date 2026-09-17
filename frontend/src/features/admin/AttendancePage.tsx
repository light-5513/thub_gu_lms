import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ClipboardCheck, Search, Users } from "lucide-react";
import { clsx } from "clsx";
import { useClassSession, useClasses, useSaveAttendance } from "@/api/hooks";
import { Badge, Card, EmptyState, Skeleton } from "@/components/ui/display";
import { Button, Input, Select } from "@/components/ui/forms";
import { useToast } from "@/components/ui/overlays";
import { errorMessage } from "@/api/client";

const STATUSES = ["present", "absent", "late", "leave"] as const;
type Status = (typeof STATUSES)[number] | "unmarked";

export function AttendancePage() {
  const [params] = useSearchParams();
  const classId = params.get("class");
  const { data: classes } = useClasses({ page: 1, page_size: 50 });
  const [selected, setSelected] = useState<string | null>(classId);
  const session = useClassSession(selected ?? "");
  const save = useSaveAttendance();
  const toast = useToast();
  const [records, setRecords] = useState<Record<string, Status>>({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");

  // Load roster statuses into local edit state when a class loads
  useEffect(() => {
    if (!session.data) return;
    const next: Record<string, Status> = {};
    for (const r of session.data.records) next[r.student_id] = r.status;
    setRecords(next);
  }, [session.data]);

  if (!classes || classes.items.length === 0) {
    return (
      <Card>
        <EmptyState icon={<ClipboardCheck size={20} />} title="No classes available." description="Create a class first — attendance is taken per class." />
      </Card>
    );
  }

  const classDoc = classes.items.find((c) => c.id === selected);

  const roster = (session.data?.records ?? []).filter((r) => {
    if (search && !`${r.name} ${r.roll_number}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    return true;
  });

  const counts = STATUSES.map((s) => [s, Object.values(records).filter((v) => v === s).length] as const);

  const setAll = (s: Status) => {
    const next: Record<string, Status> = {};
    for (const r of session.data?.records ?? []) next[r.student_id] = s;
    setRecords(next);
  };

  const doSave = async () => {
    if (!selected) return;
    try {
      await save.mutateAsync({
        classId: selected,
        records: (session.data?.records ?? []).map((r) => ({ student_id: r.student_id, status: records[r.student_id] ?? "absent" })),
      });
      toast.push("success", "Attendance saved");
    } catch (err) {
      toast.push("error", errorMessage(err));
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-leather-300">Daily attendance</h1>
          <p className="text-xs text-leather-50/80">Select a class, mark each student, then save. Edits are audited.</p>
        </div>
        <div className="sm:w-80">
          <Select value={selected ?? ""} onChange={(e) => { setSelected(e.target.value || null); setRecords({}); }}>
            <option value="">Choose a class…</option>
            {(classes?.items ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {new Date(c.date + "T00:00:00").toLocaleDateString()} · {c.subject} ({c.branch}-{c.section})
              </option>
            ))}
          </Select>
        </div>
      </div>

      {!selected ? (
        <Card><EmptyState icon={<Users size={20} />} title="Pick a class to begin." description="Only students matching the class course/branch/section appear in the roster." /></Card>
      ) : (
        <>
          {/* Summary bar */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {counts.map(([status, count]) => (
              <button key={status} onClick={() => setStatusFilter(statusFilter === status ? "all" : (status as Status))} className={clsx("card p-3 text-left capitalize transition hover:shadow-card-card", statusFilter === status && "ring-2 ring-black")}>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-leather-50/80">{status}</p>
                <p className="text-lg font-bold text-leather-300">{count}</p>
              </button>
            ))}
          </div>

          <Card className="p-0">
            <div className="flex flex-col gap-3 border-b border-transparent p-4 md:flex-row md:items-center md:justify-between">
              <div className="relative flex-1 md:max-w-xs">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-leather-50/80" />
                <Input placeholder="Find student…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setAll("present")}>All present</Button>
                <Button size="sm" variant="outline" onClick={() => setAll("absent")}>All absent</Button>
                <Button size="sm" loading={save.isPending} disabled={!classDoc && false} onClick={doSave}>
                  Save attendance
                </Button>
              </div>
            </div>

            {session.isLoading ? (
              <Skeleton className="m-4 h-64 w-full" />
            ) : !roster.length ? (
              <EmptyState title="No students match." description="No active students belong to this class group." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {roster.map((r) => (
                  <li key={r.student_id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 hover:bg-cream-100/60">
                    <span className="w-24 font-mono text-[11px] font-semibold text-leather-50/80">{r.roll_number}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-leather-300">{r.name}</span>
                    {records[r.student_id] && records[r.student_id] !== "unmarked" && (
                      <Badge tone={records[r.student_id] === "present" ? "green" : records[r.student_id] === "absent" ? "red" : records[r.student_id] === "late" ? "amber" : "purple"}>
                        {records[r.student_id]}
                      </Badge>
                    )}
                    <div className="flex gap-1">
                      {STATUSES.map((s) => (
                        <button
                          key={s}
                          onClick={() => setRecords((rec) => ({ ...rec, [r.student_id]: s }))}
                          aria-label={`Mark ${r.name} as ${s}`}
                          aria-pressed={records[r.student_id] === s}
                          className={clsx(
                            "rounded-2xl px-2.5 py-1 text-[11px] font-medium capitalize transition",
                            records[r.student_id] === s
                              ? s === "present"
                                ? "bg-neutral-100 text-leather-200"
                                : s === "absent"
                                  ? "bg-neutral-100 text-leather-200"
                                  : s === "late"
                                    ? "bg-neutral-100 text-leather-200"
                                    : "bg-neutral-100 text-leather-200"
                              : "bg-cream-200 text-leather-50/80 hover:bg-cream-300"
                          )}
                        >
                          {s[0].toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
