import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ClipboardCheck, Search, Users, Plus } from "lucide-react";
import { clsx } from "clsx";
import { useClassSession, useClasses, useSaveAttendance, useBatches, useCreateClass } from "@/api/hooks";
import { Badge, Card, EmptyState, Skeleton } from "@/components/ui/display";
import { Button, Input, Select, FormField, DatePicker } from "@/components/ui/forms";
import { Modal } from "@/components/ui/overlays";
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

  const { data: batches } = useBatches(1, 100);
  const createClass = useCreateClass();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({
    batch_id: "",
    subject: "",
    date: new Date().toISOString().slice(0, 10),
    start_time: "09:00",
    end_time: "10:00",
    session_mode: "Light Mode",
  });

  const submitCreate = async () => {
    try {
      if (!form.batch_id || !form.subject) return toast.push("error", "Batch and Subject are required");
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
      setSelected(res.id);
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



  const classDoc = classes?.items.find((c) => c.id === selected);

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
        <div className="flex flex-wrap items-center gap-2 sm:w-auto">
          <Button onClick={() => setModalOpen(true)} variant="secondary" size="sm">
            <Plus size={15} /> New batch session
          </Button>
          <div className="w-full sm:w-64">
            <Select value={selected ?? ""} onChange={(e) => { setSelected(e.target.value || null); setRecords({}); }}>
              <option value="">Choose a class...</option>
              {(classes?.items || []).map((c) => (
                <option key={c.id} value={c.id}>
                  {new Date(c.date + "T00:00:00").toLocaleDateString()} - {c.subject} {c.batch_id ? "(Batch)" : `(${c.branch}-${c.section})`}
                </option>
              ))}
            </Select>
          </div>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Batch Session" wide>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 min-h-[16rem]">
          <FormField label="Batch">
            <Select value={form.batch_id} onChange={(e) => setForm({ ...form, batch_id: e.target.value })}>
              <option value="">Select a batch...</option>
              {(batches?.items || []).map((b: any) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Subject">
            <Select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}>
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
            <Select value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })}>
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
            <Select value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })}>
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
            <Select value={form.session_mode} onChange={(e) => setForm({ ...form, session_mode: e.target.value })}>
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

