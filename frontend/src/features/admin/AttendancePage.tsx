import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ClipboardCheck, Search, Users, Plus } from "lucide-react";
import { clsx } from "clsx";
import { useClassDetail, useClassSession, useClasses, useSaveAttendance, useBatches, useCreateClass } from "@/api/hooks";
import { Badge, Card, EmptyState, ErrorState, Skeleton } from "@/components/ui/display";
import { Button, Input, Select, FormField, DatePicker } from "@/components/ui/forms";
import { Pagination } from "@/components/ui/navigation";
import { Modal } from "@/components/ui/overlays";
import { useToast } from "@/components/ui/overlays";
import { errorMessage } from "@/api/client";

const STATUSES = ["present", "absent", "late", "leave"] as const;
type Status = (typeof STATUSES)[number] | "unmarked";
const SUMMARY_STATUSES: readonly Status[] = [...STATUSES, "unmarked"];

function localDateKey() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

export function AttendancePage() {
  const [params, setParams] = useSearchParams();
  const classId = params.get("class");
  const [selectedBatch, setSelectedBatch] = useState(params.get("batch") ?? "");
  const [classPage, setClassPage] = useState(1);
  const { data: classes, isLoading: classesLoading, isError: classesError, error: classesLoadError, refetch: refetchClasses } = useClasses(
    { page: classPage, page_size: 100, batch_id: selectedBatch },
    !!selectedBatch
  );
  const [selected, setSelected] = useState<string | null>(classId);
  const classDetail = useClassDetail(selected ?? "");
  const session = useClassSession(
    selected ?? "",
    !!selectedBatch && classDetail.data?.batch_id === selectedBatch
  );
  const save = useSaveAttendance();
  const toast = useToast();
  const [records, setRecords] = useState<Record<string, Status>>({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");

  const { data: batches } = useBatches(1, 500);
  const createClass = useCreateClass();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({
    batch_id: "",
    subject: "",
    date: localDateKey(),
    start_time: "09:00",
    end_time: "10:00",
    session_mode: "Light Mode",
  });

  const clearRosterFilters = () => {
    setRecords({});
    setSearch("");
    setStatusFilter("all");
  };

  const selectBatch = (batchId: string) => {
    setSelectedBatch(batchId);
    setClassPage(1);
    setSelected(null);
    clearRosterFilters();
    setParams(batchId ? { batch: batchId } : {});
  };

  const selectClass = (nextClassId: string | null) => {
    if (nextClassId === selected) return;
    setSelected(nextClassId);
    clearRosterFilters();
    setParams(nextClassId
      ? { batch: selectedBatch, class: nextClassId }
      : selectedBatch ? { batch: selectedBatch } : {});
  };

  useEffect(() => {
    if (!selected || classDetail.data?.id !== selected) return;
    const classBatchId = classDetail.data.batch_id ?? "";
    if (classBatchId !== selectedBatch) setSelectedBatch(classBatchId);
  }, [selected, selectedBatch, classDetail.data]);

  const submitCreate = async () => {
    try {
      if (!form.batch_id || !form.subject.trim() || !form.date) return toast.push("error", "Batch, date, and subject are required");
      if (form.end_time <= form.start_time) return toast.push("error", "End time must be after start time");
      const res = await createClass.mutateAsync({
        date: form.date,
        start_time: form.start_time,
        end_time: form.end_time,
        subject: form.subject,
        batch_id: form.batch_id,
        session_mode: form.session_mode,
      });
      toast.push("success", "Batch session created");
      setModalOpen(false);
      setSelectedBatch(form.batch_id);
      setClassPage(1);
      setSelected(res.id);
      clearRosterFilters();
      setParams({ batch: form.batch_id, class: res.id });
    } catch (err) {
      toast.push("error", errorMessage(err));
    }
  };


  // Load roster statuses into local edit state when a class loads
  useEffect(() => {
    if (!session.data) return;
    const next: Record<string, Status> = {};
    for (const r of session.data.records) next[r.student_id] = r.status;
    setRecords(next);
  }, [session.data]);



  const selectedBatchName = batches?.items?.find((batch: { id: string }) => batch.id === selectedBatch)?.name;
  const selectedClass = classDetail.data?.id === selected ? classDetail.data : null;
  const selectedClassOnPage = Boolean(classes?.items.some((item) => item.id === selected));
  const activeRoster = session.data?.records ?? [];

  const roster = activeRoster.filter((r) => {
    if (search && !`${r.name} ${r.roll_number}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== "all" && (records[r.student_id] ?? r.status) !== statusFilter) return false;
    return true;
  });

  const counts = SUMMARY_STATUSES.map((status) => [
    status,
    activeRoster.filter((r) => (records[r.student_id] ?? r.status) === status).length,
  ] as const);
  const unmarkedExistingCount = session.data?.marked
    ? activeRoster.filter((r) => (records[r.student_id] ?? r.status) === "unmarked").length
    : 0;

  const setAll = (s: Status) => {
    const next: Record<string, Status> = {};
    for (const r of activeRoster) next[r.student_id] = s;
    setRecords(next);
  };

  const doSave = async () => {
    if (!selected || !selectedBatch || !activeRoster.length) return;
    if (unmarkedExistingCount > 0) {
      toast.push("error", `Mark the ${unmarkedExistingCount} unmarked students before updating this saved session`);
      return;
    }
    try {
      await save.mutateAsync({
        classId: selected,
        records: activeRoster.map((r) => ({
          student_id: r.student_id,
          status: records[r.student_id] && records[r.student_id] !== "unmarked"
            ? records[r.student_id]
            : "absent",
        })),
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
          <h1 className="page-title">Daily attendance</h1>
          <p className="page-description">Choose a batch and session. Only students assigned to that batch appear.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:w-auto">
          <Button onClick={() => { setForm((current) => ({ ...current, batch_id: selectedBatch })); setModalOpen(true); }} variant="secondary" size="sm">
            <Plus size={15} /> New batch session
          </Button>
          <div className="w-full sm:w-52">
            <Select aria-label="Batch" value={selectedBatch} onChange={(e) => selectBatch(e.target.value)}>
              <option value="">Choose a batch...</option>
              {(batches?.items || []).map((batch: { id: string; name: string; batch_code?: string; student_count?: number }) => (
                <option key={batch.id} value={batch.id}>
                  {batch.name}{batch.student_count != null ? ` · ${batch.student_count} students` : ""}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-full sm:w-72">
            <Select aria-label="Session" value={selected ?? ""} disabled={!selectedBatch || classesLoading} onChange={(e) => selectClass(e.target.value || null)}>
              <option value="">{!selectedBatch ? "Choose a batch first" : classesLoading ? "Loading sessions..." : "Choose a session..."}</option>
              {selected && selectedClass && !selectedClassOnPage && selectedClass.batch_id === selectedBatch && (
                <option value={selected}>{new Date(`${selectedClass.date.slice(0, 10)}T00:00:00`).toLocaleDateString()} - {selectedClass.subject}</option>
              )}
              {(classes?.items || []).map((c) => (
                <option key={c.id} value={c.id}>
                  {new Date(`${c.date.slice(0, 10)}T00:00:00`).toLocaleDateString()} - {c.subject}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {selectedBatch && classes && classes.total_pages > 1 && (
        <div className="flex items-center justify-end gap-3">
          <span className="text-xs text-leather-50/80">Sessions {classes.total} total</span>
          <Pagination page={classPage} totalPages={classes.total_pages} onChange={setClassPage} />
        </div>
      )}

      {selected && classDetail.isLoading ? (
        <Card><Skeleton className="h-28 w-full" /></Card>
      ) : selected && classDetail.isError ? (
        <Card><ErrorState message={errorMessage(classDetail.error)} onRetry={() => classDetail.refetch()} /></Card>
      ) : selected && selectedClass && !selectedClass.batch_id ? (
        <Card>
          <EmptyState
            icon={<Users size={20} />}
            title="This class has no batch."
            description="Assign this class to its batch in Classes, then return to take attendance. Existing records must belong to that batch."
            action={<Link to="/admin/classes" className="btn-secondary inline-flex rounded-full px-4 py-2 text-xs font-semibold">Open classes</Link>}
          />
        </Card>
      ) : !selectedBatch ? (
        <Card><EmptyState icon={<Users size={20} />} title="Choose a batch to begin." description="Attendance shows only students mapped to the selected batch." /></Card>
      ) : !selected && classesLoading ? (
        <Card><Skeleton className="h-28 w-full" /></Card>
      ) : !selected && classesError ? (
        <Card><ErrorState message={errorMessage(classesLoadError)} onRetry={() => refetchClasses()} /></Card>
      ) : !selected ? (
        <Card>
          <EmptyState
            icon={<Users size={20} />}
            title={classes?.total ? "Choose a session to begin." : "No sessions in this batch yet."}
            description={classes?.total ? `Sessions for ${selectedBatchName || "this batch"} are listed above.` : `Create a session for ${selectedBatchName || "this batch"} to take attendance.`}
            action={!classes?.total ? <Button size="sm" onClick={() => { setForm((current) => ({ ...current, batch_id: selectedBatch })); setModalOpen(true); }}>New batch session</Button> : undefined}
          />
        </Card>
      ) : selectedClass?.batch_id !== selectedBatch ? (
        <Card><Skeleton className="h-28 w-full" /></Card>
      ) : (
        <>
          <p className="text-sm font-semibold text-leather-300">{selectedBatchName || "Batch"} · {selectedClass.subject} · {new Date(`${selectedClass.date.slice(0, 10)}T00:00:00`).toLocaleDateString()}</p>
          {/* Summary bar */}
          {activeRoster.length > 0 && <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {counts.map(([status, count]) => (
              <button key={status} onClick={() => setStatusFilter(statusFilter === status ? "all" : (status as Status))} aria-pressed={statusFilter === status} className={clsx("card p-3 text-left capitalize transition hover:shadow-card-lg", statusFilter === status && "shadow-active ring-1 ring-primary-300")}>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-leather-50/80">{status}</p>
                <p className="text-lg font-bold text-leather-300">{count}</p>
              </button>
            ))}
          </div>}

          <Card className="p-0">
            <div className="flex flex-col gap-3 border-b border-transparent p-4 md:flex-row md:items-center md:justify-between">
              <div className="flex-1 space-y-2 md:max-w-xs">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-leather-50/80" />
                  <Input placeholder="Find student…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" disabled={!activeRoster.length} />
                </div>
                {session.data && (
                  <p className="text-xs text-[var(--text-muted)]" role="status">
                    Showing {roster.length} of {session.data.records.length} students mapped to {selectedBatchName || "this batch"}
                  </p>
                )}
                {unmarkedExistingCount > 0 && (
                  <p className="text-xs font-medium text-warning-700">
                    {unmarkedExistingCount} students have no saved status for this session. Mark them before saving changes.
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={!activeRoster.length} onClick={() => setAll("present")}>All present</Button>
                <Button size="sm" variant="outline" disabled={!activeRoster.length} onClick={() => setAll("absent")}>All absent</Button>
                <Button size="sm" loading={save.isPending} disabled={!activeRoster.length || unmarkedExistingCount > 0 || session.isLoading || session.isError} onClick={doSave}>
                  Save attendance
                </Button>
              </div>
            </div>

            {session.isLoading ? (
              <Skeleton className="m-4 h-64 w-full" />
            ) : session.isError ? (
              <ErrorState message={errorMessage(session.error)} onRetry={() => session.refetch()} />
            ) : !roster.length ? (
              <EmptyState
                title={activeRoster.length ? "No students match." : "No students are mapped to this batch."}
                description={activeRoster.length
                  ? "Clear the search or choose another status to see more students."
                  : `Assign students to ${selectedBatchName || "this batch"} before taking attendance.`}
                action={!activeRoster.length ? <Link to="/admin/batches" className="btn-secondary inline-flex rounded-full px-4 py-2 text-xs font-semibold">Manage batch students</Link> : undefined}
              />
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {roster.map((r) => (
                  <li key={r.student_id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 transition-colors duration-150 hover:bg-primary-200/80 focus-within:bg-primary-200/80 motion-reduce:transition-none">
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
                            "rounded-full px-3 py-1 text-[11px] font-semibold capitalize transition",
                            records[r.student_id] === s
                              ? "bg-[var(--bg)] shadow-card-recess"
                              : "bg-[var(--bg)] text-leather-50/80 shadow-pill hover:shadow-card-recess",
                            records[r.student_id] === s && s === "present" && "text-success-700",
                            records[r.student_id] === s && s === "late" && "text-warning-700",
                            records[r.student_id] === s && s === "absent" && "text-danger-700",
                            records[r.student_id] === s && s === "leave" && "text-info-700"
                          )}
                        >
                          {s}
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Batch Session" wide>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 min-h-[16rem]">
          <FormField label="Batch">
            <Select aria-label="Batch" value={form.batch_id} onChange={(e) => setForm({ ...form, batch_id: e.target.value })}>
              <option value="">Select a batch...</option>
              {(batches?.items || []).map((b: { id: string; name: string; batch_code?: string; student_count?: number }) => (
                <option key={b.id} value={b.id}>{b.name}{b.student_count != null ? ` · ${b.student_count} students` : ""}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Subject">
            <Select aria-label="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}>
              <option value="">Select a subject...</option>
              <option value="DSC">DSC</option>
              <option value="OS">OS</option>
              <option value="CN">CN</option>
            </Select>
          </FormField>
          <FormField label="Date">
            <DatePicker value={form.date} onChange={(val: string) => setForm({ ...form, date: val })} />
          </FormField>
          <FormField label="Start time">
            <Select aria-label="Start time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })}>
<option value="00:00">12:00 AM</option>
<option value="00:15">12:15 AM</option>
<option value="00:30">12:30 AM</option>
<option value="00:45">12:45 AM</option>
<option value="01:00">01:00 AM</option>
<option value="01:15">01:15 AM</option>
<option value="01:30">01:30 AM</option>
<option value="01:45">01:45 AM</option>
<option value="02:00">02:00 AM</option>
<option value="02:15">02:15 AM</option>
<option value="02:30">02:30 AM</option>
<option value="02:45">02:45 AM</option>
<option value="03:00">03:00 AM</option>
<option value="03:15">03:15 AM</option>
<option value="03:30">03:30 AM</option>
<option value="03:45">03:45 AM</option>
<option value="04:00">04:00 AM</option>
<option value="04:15">04:15 AM</option>
<option value="04:30">04:30 AM</option>
<option value="04:45">04:45 AM</option>
<option value="05:00">05:00 AM</option>
<option value="05:15">05:15 AM</option>
<option value="05:30">05:30 AM</option>
<option value="05:45">05:45 AM</option>
<option value="06:00">06:00 AM</option>
<option value="06:15">06:15 AM</option>
<option value="06:30">06:30 AM</option>
<option value="06:45">06:45 AM</option>
<option value="07:00">07:00 AM</option>
<option value="07:15">07:15 AM</option>
<option value="07:30">07:30 AM</option>
<option value="07:45">07:45 AM</option>
<option value="08:00">08:00 AM</option>
<option value="08:15">08:15 AM</option>
<option value="08:30">08:30 AM</option>
<option value="08:45">08:45 AM</option>
<option value="09:00">09:00 AM</option>
<option value="09:15">09:15 AM</option>
<option value="09:30">09:30 AM</option>
<option value="09:45">09:45 AM</option>
<option value="10:00">10:00 AM</option>
<option value="10:15">10:15 AM</option>
<option value="10:30">10:30 AM</option>
<option value="10:45">10:45 AM</option>
<option value="11:00">11:00 AM</option>
<option value="11:15">11:15 AM</option>
<option value="11:30">11:30 AM</option>
<option value="11:45">11:45 AM</option>
<option value="12:00">12:00 PM</option>
<option value="12:15">12:15 PM</option>
<option value="12:30">12:30 PM</option>
<option value="12:45">12:45 PM</option>
<option value="13:00">01:00 PM</option>
<option value="13:15">01:15 PM</option>
<option value="13:30">01:30 PM</option>
<option value="13:45">01:45 PM</option>
<option value="14:00">02:00 PM</option>
<option value="14:15">02:15 PM</option>
<option value="14:30">02:30 PM</option>
<option value="14:45">02:45 PM</option>
<option value="15:00">03:00 PM</option>
<option value="15:15">03:15 PM</option>
<option value="15:30">03:30 PM</option>
<option value="15:45">03:45 PM</option>
<option value="16:00">04:00 PM</option>
<option value="16:15">04:15 PM</option>
<option value="16:30">04:30 PM</option>
<option value="16:45">04:45 PM</option>
<option value="17:00">05:00 PM</option>
<option value="17:15">05:15 PM</option>
<option value="17:30">05:30 PM</option>
<option value="17:45">05:45 PM</option>
<option value="18:00">06:00 PM</option>
<option value="18:15">06:15 PM</option>
<option value="18:30">06:30 PM</option>
<option value="18:45">06:45 PM</option>
<option value="19:00">07:00 PM</option>
<option value="19:15">07:15 PM</option>
<option value="19:30">07:30 PM</option>
<option value="19:45">07:45 PM</option>
<option value="20:00">08:00 PM</option>
<option value="20:15">08:15 PM</option>
<option value="20:30">08:30 PM</option>
<option value="20:45">08:45 PM</option>
<option value="21:00">09:00 PM</option>
<option value="21:15">09:15 PM</option>
<option value="21:30">09:30 PM</option>
<option value="21:45">09:45 PM</option>
<option value="22:00">10:00 PM</option>
<option value="22:15">10:15 PM</option>
<option value="22:30">10:30 PM</option>
<option value="22:45">10:45 PM</option>
<option value="23:00">11:00 PM</option>
<option value="23:15">11:15 PM</option>
<option value="23:30">11:30 PM</option>
<option value="23:45">11:45 PM</option>
            </Select>
          </FormField>
          <FormField label="End time">
            <Select aria-label="End time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })}>
<option value="00:00">12:00 AM</option>
<option value="00:15">12:15 AM</option>
<option value="00:30">12:30 AM</option>
<option value="00:45">12:45 AM</option>
<option value="01:00">01:00 AM</option>
<option value="01:15">01:15 AM</option>
<option value="01:30">01:30 AM</option>
<option value="01:45">01:45 AM</option>
<option value="02:00">02:00 AM</option>
<option value="02:15">02:15 AM</option>
<option value="02:30">02:30 AM</option>
<option value="02:45">02:45 AM</option>
<option value="03:00">03:00 AM</option>
<option value="03:15">03:15 AM</option>
<option value="03:30">03:30 AM</option>
<option value="03:45">03:45 AM</option>
<option value="04:00">04:00 AM</option>
<option value="04:15">04:15 AM</option>
<option value="04:30">04:30 AM</option>
<option value="04:45">04:45 AM</option>
<option value="05:00">05:00 AM</option>
<option value="05:15">05:15 AM</option>
<option value="05:30">05:30 AM</option>
<option value="05:45">05:45 AM</option>
<option value="06:00">06:00 AM</option>
<option value="06:15">06:15 AM</option>
<option value="06:30">06:30 AM</option>
<option value="06:45">06:45 AM</option>
<option value="07:00">07:00 AM</option>
<option value="07:15">07:15 AM</option>
<option value="07:30">07:30 AM</option>
<option value="07:45">07:45 AM</option>
<option value="08:00">08:00 AM</option>
<option value="08:15">08:15 AM</option>
<option value="08:30">08:30 AM</option>
<option value="08:45">08:45 AM</option>
<option value="09:00">09:00 AM</option>
<option value="09:15">09:15 AM</option>
<option value="09:30">09:30 AM</option>
<option value="09:45">09:45 AM</option>
<option value="10:00">10:00 AM</option>
<option value="10:15">10:15 AM</option>
<option value="10:30">10:30 AM</option>
<option value="10:45">10:45 AM</option>
<option value="11:00">11:00 AM</option>
<option value="11:15">11:15 AM</option>
<option value="11:30">11:30 AM</option>
<option value="11:45">11:45 AM</option>
<option value="12:00">12:00 PM</option>
<option value="12:15">12:15 PM</option>
<option value="12:30">12:30 PM</option>
<option value="12:45">12:45 PM</option>
<option value="13:00">01:00 PM</option>
<option value="13:15">01:15 PM</option>
<option value="13:30">01:30 PM</option>
<option value="13:45">01:45 PM</option>
<option value="14:00">02:00 PM</option>
<option value="14:15">02:15 PM</option>
<option value="14:30">02:30 PM</option>
<option value="14:45">02:45 PM</option>
<option value="15:00">03:00 PM</option>
<option value="15:15">03:15 PM</option>
<option value="15:30">03:30 PM</option>
<option value="15:45">03:45 PM</option>
<option value="16:00">04:00 PM</option>
<option value="16:15">04:15 PM</option>
<option value="16:30">04:30 PM</option>
<option value="16:45">04:45 PM</option>
<option value="17:00">05:00 PM</option>
<option value="17:15">05:15 PM</option>
<option value="17:30">05:30 PM</option>
<option value="17:45">05:45 PM</option>
<option value="18:00">06:00 PM</option>
<option value="18:15">06:15 PM</option>
<option value="18:30">06:30 PM</option>
<option value="18:45">06:45 PM</option>
<option value="19:00">07:00 PM</option>
<option value="19:15">07:15 PM</option>
<option value="19:30">07:30 PM</option>
<option value="19:45">07:45 PM</option>
<option value="20:00">08:00 PM</option>
<option value="20:15">08:15 PM</option>
<option value="20:30">08:30 PM</option>
<option value="20:45">08:45 PM</option>
<option value="21:00">09:00 PM</option>
<option value="21:15">09:15 PM</option>
<option value="21:30">09:30 PM</option>
<option value="21:45">09:45 PM</option>
<option value="22:00">10:00 PM</option>
<option value="22:15">10:15 PM</option>
<option value="22:30">10:30 PM</option>
<option value="22:45">10:45 PM</option>
<option value="23:00">11:00 PM</option>
<option value="23:15">11:15 PM</option>
<option value="23:30">11:30 PM</option>
<option value="23:45">11:45 PM</option>
            </Select>
          </FormField>
          <FormField label="Session Mode">
            <Select aria-label="Session mode" value={form.session_mode} onChange={(e) => setForm({ ...form, session_mode: e.target.value })}>
              <option value="Light Mode">Light Mode</option>
              <option value="Bright Mode">Bright Mode</option>
              <option value="Shine Mode">Shine Mode</option>
              <option value="Dark Mode">Dark Mode</option>
            </Select>
          </FormField>
        </div>
        <div className="mt-8 flex justify-end gap-2 pb-2">
          <Button variant="ghost" size="sm" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button size="sm" loading={createClass.isPending} onClick={submitCreate}>Create session</Button>
        </div>
      </Modal>
    </div>
  );
}

