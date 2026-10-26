import { useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, CalendarPlus, ClipboardCheck, Copy, Layers, MoreVertical, Trash2 } from "lucide-react";
import { useBatches, useClasses, useCreateClass, useDeleteClass, useDuplicateClass, useUpdateClass } from "@/api/hooks";
import { Badge, Card, EmptyState, ErrorState, TableSkeleton } from "@/components/ui/display";
import { Button, FormField, Input, Select, DatePicker } from "@/components/ui/forms";
import { Dropdown, DropdownItem, Pagination, Table } from "@/components/ui/navigation";
import { ConfirmDialog, Modal, useToast } from "@/components/ui/overlays";
import { errorMessage } from "@/api/client";

function localDateKey() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

export function ClassesPage() {
  const [page, setPage] = useState(1);
  const [batchFilter, setBatchFilter] = useState("");
  const { data, isLoading, isError, error, refetch } = useClasses({ page, page_size: 15, batch_id: batchFilter });
  const { data: batches } = useBatches(1, 500);
  const create = useCreateClass();
  const remove = useDeleteClass();
  const duplicate = useDuplicateClass();
  const update = useUpdateClass();
  const toast = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [assignClassId, setAssignClassId] = useState<string | null>(null);
  const [assignBatchId, setAssignBatchId] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({
    date: localDateKey(),
    start_time: "09:00",
    end_time: "10:00",
    batch_id: "",
    subject: "",
    faculty: "",
    topic: "",
  });

  const submit = async () => {
    if (!form.batch_id || !form.subject.trim() || !form.date) {
      toast.push("error", "Batch, date, and subject are required");
      return;
    }
    if (form.end_time <= form.start_time) {
      toast.push("error", "End time must be after start time");
      return;
    }
    try {
      await create.mutateAsync(form);
      toast.push("success", "Class created");
      setModalOpen(false);
    } catch (err) {
      toast.push("error", errorMessage(err));
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Classes</h1>
          {data && <p className="page-description">{data.total} classes scheduled</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select aria-label="Filter classes by batch" value={batchFilter} className="w-full sm:w-56" onChange={(e) => { setBatchFilter(e.target.value); setPage(1); }}>
            <option value="">All batches</option>
            {(batches?.items || []).map((batch: { id: string; name: string }) => (
              <option key={batch.id} value={batch.id}>{batch.name}</option>
            ))}
          </Select>
          <Button onClick={() => { setForm((current) => ({ ...current, batch_id: batchFilter })); setModalOpen(true); }}>
            <CalendarPlus size={15} /> New batch class
          </Button>
        </div>
      </div>

      <Card className="p-0">
        {isLoading ? (
          <TableSkeleton rows={8} cols={6} />
        ) : isError ? (
          <ErrorState message={errorMessage(error)} onRetry={() => { void refetch(); }} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState icon={<CalendarDays size={20} />} title="No classes found." description={batchFilter ? "Create a class for this batch to start taking attendance." : "Create a batch class to start taking attendance."} action={<Button size="sm" onClick={() => { setForm((current) => ({ ...current, batch_id: batchFilter })); setModalOpen(true); }}>Create class</Button>} />
        ) : (
          <>
            <Table headers={["Date", "Time", "Subject", "Batch", "Faculty", "Attendance", ""]}>
              {data.items.map((c) => (
                <tr key={c.id} className="hover:bg-cream-100/70">
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs font-medium text-leather-200">{new Date(`${c.date.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-leather-50/80">{c.start_time.slice(0, 5)}–{c.end_time.slice(0, 5)}</td>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-leather-300">{c.subject}</p>
                    {c.topic && <p className="max-w-[220px] truncate text-[11px] text-leather-50/80">{c.topic}</p>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-leather-200">
                    {c.batch_id
                      ? batches?.items?.find((batch: { id: string }) => batch.id === c.batch_id)?.name ?? "Batch unavailable"
                      : "No batch (legacy)"}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-leather-50/80">{c.faculty ?? "—"}</td>
                  <td className="px-4 py-2.5">{c.attendance_marked ? <Badge tone="green">marked</Badge> : <Badge tone="amber">pending</Badge>}</td>
                  <td className="px-2 py-2.5">
                    <div className="flex items-center gap-1">
                      <Link to={`/admin/attendance?class=${c.id}`} className="btn-primary inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px]" title="Open attendance">
                        <ClipboardCheck size={13} /> Attendance
                      </Link>
                      <Dropdown
                        trigger={
                          <button className="btn-ghost rounded-full p-2 text-leather-50/80" aria-label="More actions"><MoreVertical size={15} /></button>
                        }
                      >
                        {(close) => (
                          <>
                            {!c.batch_id && (
                              <DropdownItem onClick={() => { close(); setAssignClassId(c.id); setAssignBatchId(""); }}>
                                <Layers size={13} /> Assign batch
                              </DropdownItem>
                            )}
                            {c.batch_id && (
                              <DropdownItem
                                onClick={() => {
                                  close();
                                  duplicate.mutate(c.id, {
                                    onSuccess: () => toast.push("success", "Class duplicated"),
                                    onError: (e) => toast.push("error", errorMessage(e)),
                                  });
                                }}
                              >
                                <Copy size={13} /> Duplicate
                              </DropdownItem>
                            )}
                            <DropdownItem danger onClick={() => { close(); setConfirmDelete(c.id); }}>
                              <Trash2 size={13} /> Delete class
                            </DropdownItem>
                          </>
                        )}
                      </Dropdown>
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
            <div className="border-t border-transparent px-4 py-3">
              <Pagination page={data.page} totalPages={data.total_pages} onChange={setPage} />
            </div>
          </>
        )}
      </Card>

      {/* Create modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Schedule a batch class">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FormField label="Batch">
              <Select aria-label="Batch" value={form.batch_id} onChange={(e) => setForm({ ...form, batch_id: e.target.value })}>
                <option value="">Select a batch...</option>
                {(batches?.items || []).map((batch: { id: string; name: string; batch_code?: string; student_count?: number }) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.name}{batch.batch_code ? ` (${batch.batch_code})` : ""}{batch.student_count != null ? ` · ${batch.student_count} students` : ""}
                  </option>
                ))}
              </Select>
            </FormField>
            <p className="mt-1.5 text-xs text-leather-50/80">Attendance will list students assigned to this batch.</p>
          </div>
          <FormField label="Date"><DatePicker value={form.date} onChange={(val: string) => setForm({ ...form, date: val })} /></FormField>
          <FormField label="Subject"><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Data Structures" /></FormField>
          <FormField label="Start time"><Select aria-label="Start time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })}><option value="00:00">12:00 AM</option><option value="00:15">12:15 AM</option><option value="00:30">12:30 AM</option><option value="00:45">12:45 AM</option><option value="01:00">01:00 AM</option><option value="01:15">01:15 AM</option><option value="01:30">01:30 AM</option><option value="01:45">01:45 AM</option><option value="02:00">02:00 AM</option><option value="02:15">02:15 AM</option><option value="02:30">02:30 AM</option><option value="02:45">02:45 AM</option><option value="03:00">03:00 AM</option><option value="03:15">03:15 AM</option><option value="03:30">03:30 AM</option><option value="03:45">03:45 AM</option><option value="04:00">04:00 AM</option><option value="04:15">04:15 AM</option><option value="04:30">04:30 AM</option><option value="04:45">04:45 AM</option><option value="05:00">05:00 AM</option><option value="05:15">05:15 AM</option><option value="05:30">05:30 AM</option><option value="05:45">05:45 AM</option><option value="06:00">06:00 AM</option><option value="06:15">06:15 AM</option><option value="06:30">06:30 AM</option><option value="06:45">06:45 AM</option><option value="07:00">07:00 AM</option><option value="07:15">07:15 AM</option><option value="07:30">07:30 AM</option><option value="07:45">07:45 AM</option><option value="08:00">08:00 AM</option><option value="08:15">08:15 AM</option><option value="08:30">08:30 AM</option><option value="08:45">08:45 AM</option><option value="09:00">09:00 AM</option><option value="09:15">09:15 AM</option><option value="09:30">09:30 AM</option><option value="09:45">09:45 AM</option><option value="10:00">10:00 AM</option><option value="10:15">10:15 AM</option><option value="10:30">10:30 AM</option><option value="10:45">10:45 AM</option><option value="11:00">11:00 AM</option><option value="11:15">11:15 AM</option><option value="11:30">11:30 AM</option><option value="11:45">11:45 AM</option><option value="12:00">12:00 PM</option><option value="12:15">12:15 PM</option><option value="12:30">12:30 PM</option><option value="12:45">12:45 PM</option><option value="13:00">01:00 PM</option><option value="13:15">01:15 PM</option><option value="13:30">01:30 PM</option><option value="13:45">01:45 PM</option><option value="14:00">02:00 PM</option><option value="14:15">02:15 PM</option><option value="14:30">02:30 PM</option><option value="14:45">02:45 PM</option><option value="15:00">03:00 PM</option><option value="15:15">03:15 PM</option><option value="15:30">03:30 PM</option><option value="15:45">03:45 PM</option><option value="16:00">04:00 PM</option><option value="16:15">04:15 PM</option><option value="16:30">04:30 PM</option><option value="16:45">04:45 PM</option><option value="17:00">05:00 PM</option><option value="17:15">05:15 PM</option><option value="17:30">05:30 PM</option><option value="17:45">05:45 PM</option><option value="18:00">06:00 PM</option><option value="18:15">06:15 PM</option><option value="18:30">06:30 PM</option><option value="18:45">06:45 PM</option><option value="19:00">07:00 PM</option><option value="19:15">07:15 PM</option><option value="19:30">07:30 PM</option><option value="19:45">07:45 PM</option><option value="20:00">08:00 PM</option><option value="20:15">08:15 PM</option><option value="20:30">08:30 PM</option><option value="20:45">08:45 PM</option><option value="21:00">09:00 PM</option><option value="21:15">09:15 PM</option><option value="21:30">09:30 PM</option><option value="21:45">09:45 PM</option><option value="22:00">10:00 PM</option><option value="22:15">10:15 PM</option><option value="22:30">10:30 PM</option><option value="22:45">10:45 PM</option><option value="23:00">11:00 PM</option><option value="23:15">11:15 PM</option><option value="23:30">11:30 PM</option><option value="23:45">11:45 PM</option></Select></FormField>
          <FormField label="End time"><Select aria-label="End time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })}><option value="00:00">12:00 AM</option><option value="00:15">12:15 AM</option><option value="00:30">12:30 AM</option><option value="00:45">12:45 AM</option><option value="01:00">01:00 AM</option><option value="01:15">01:15 AM</option><option value="01:30">01:30 AM</option><option value="01:45">01:45 AM</option><option value="02:00">02:00 AM</option><option value="02:15">02:15 AM</option><option value="02:30">02:30 AM</option><option value="02:45">02:45 AM</option><option value="03:00">03:00 AM</option><option value="03:15">03:15 AM</option><option value="03:30">03:30 AM</option><option value="03:45">03:45 AM</option><option value="04:00">04:00 AM</option><option value="04:15">04:15 AM</option><option value="04:30">04:30 AM</option><option value="04:45">04:45 AM</option><option value="05:00">05:00 AM</option><option value="05:15">05:15 AM</option><option value="05:30">05:30 AM</option><option value="05:45">05:45 AM</option><option value="06:00">06:00 AM</option><option value="06:15">06:15 AM</option><option value="06:30">06:30 AM</option><option value="06:45">06:45 AM</option><option value="07:00">07:00 AM</option><option value="07:15">07:15 AM</option><option value="07:30">07:30 AM</option><option value="07:45">07:45 AM</option><option value="08:00">08:00 AM</option><option value="08:15">08:15 AM</option><option value="08:30">08:30 AM</option><option value="08:45">08:45 AM</option><option value="09:00">09:00 AM</option><option value="09:15">09:15 AM</option><option value="09:30">09:30 AM</option><option value="09:45">09:45 AM</option><option value="10:00">10:00 AM</option><option value="10:15">10:15 AM</option><option value="10:30">10:30 AM</option><option value="10:45">10:45 AM</option><option value="11:00">11:00 AM</option><option value="11:15">11:15 AM</option><option value="11:30">11:30 AM</option><option value="11:45">11:45 AM</option><option value="12:00">12:00 PM</option><option value="12:15">12:15 PM</option><option value="12:30">12:30 PM</option><option value="12:45">12:45 PM</option><option value="13:00">01:00 PM</option><option value="13:15">01:15 PM</option><option value="13:30">01:30 PM</option><option value="13:45">01:45 PM</option><option value="14:00">02:00 PM</option><option value="14:15">02:15 PM</option><option value="14:30">02:30 PM</option><option value="14:45">02:45 PM</option><option value="15:00">03:00 PM</option><option value="15:15">03:15 PM</option><option value="15:30">03:30 PM</option><option value="15:45">03:45 PM</option><option value="16:00">04:00 PM</option><option value="16:15">04:15 PM</option><option value="16:30">04:30 PM</option><option value="16:45">04:45 PM</option><option value="17:00">05:00 PM</option><option value="17:15">05:15 PM</option><option value="17:30">05:30 PM</option><option value="17:45">05:45 PM</option><option value="18:00">06:00 PM</option><option value="18:15">06:15 PM</option><option value="18:30">06:30 PM</option><option value="18:45">06:45 PM</option><option value="19:00">07:00 PM</option><option value="19:15">07:15 PM</option><option value="19:30">07:30 PM</option><option value="19:45">07:45 PM</option><option value="20:00">08:00 PM</option><option value="20:15">08:15 PM</option><option value="20:30">08:30 PM</option><option value="20:45">08:45 PM</option><option value="21:00">09:00 PM</option><option value="21:15">09:15 PM</option><option value="21:30">09:30 PM</option><option value="21:45">09:45 PM</option><option value="22:00">10:00 PM</option><option value="22:15">10:15 PM</option><option value="22:30">10:30 PM</option><option value="22:45">10:45 PM</option><option value="23:00">11:00 PM</option><option value="23:15">11:15 PM</option><option value="23:30">11:30 PM</option><option value="23:45">11:45 PM</option></Select></FormField>
          <FormField label="Faculty"><Input value={form.faculty} onChange={(e) => setForm({ ...form, faculty: e.target.value })} placeholder="Prof. Meena Iyer" /></FormField>
          <div className="sm:col-span-2">
            <FormField label="Topic (optional)"><Input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder="Unit 3 — Trees & Graphs" /></FormField>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button size="sm" loading={create.isPending} onClick={submit}>Create class</Button>
        </div>
      </Modal>

      <Modal open={!!assignClassId} onClose={() => setAssignClassId(null)} title="Assign class to batch">
        <p className="mb-4 text-sm text-leather-200">Choose the batch for this class. Existing attendance can be kept when every recorded student belongs to that batch.</p>
        <FormField label="Batch">
          <Select aria-label="Batch for existing class" value={assignBatchId} onChange={(e) => setAssignBatchId(e.target.value)}>
            <option value="">Select a batch...</option>
            {(batches?.items || []).map((batch: { id: string; name: string; student_count?: number }) => (
              <option key={batch.id} value={batch.id}>{batch.name}{batch.student_count != null ? ` · ${batch.student_count} students` : ""}</option>
            ))}
          </Select>
        </FormField>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setAssignClassId(null)}>Cancel</Button>
          <Button
            size="sm"
            disabled={!assignBatchId}
            loading={update.isPending}
            onClick={() => {
              if (!assignClassId || !assignBatchId) return;
              update.mutate({ id: assignClassId, payload: { batch_id: assignBatchId } }, {
                onSuccess: () => { toast.push("success", "Class assigned to batch"); setAssignClassId(null); },
                onError: (err) => toast.push("error", errorMessage(err)),
              });
            }}
          >Assign batch</Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete this class?"
        message="This will remove the class and all associated attendance records."
        confirmLabel="Delete"
        loading={remove.isPending}
        onConfirm={() =>
          confirmDelete &&
          remove.mutate(confirmDelete, {
            onSuccess: () => { toast.push("success", "Class deleted"); setConfirmDelete(null); },
            onError: (e) => toast.push("error", errorMessage(e)),
          })
        }
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
