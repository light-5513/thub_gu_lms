import { useState } from "react";
import { CalendarDays, CalendarPlus, ClipboardCheck, Copy, MoreVertical, Trash2 } from "lucide-react";
import { useClasses, useCreateClass, useDeleteClass, useDuplicateClass } from "@/api/hooks";
import { Badge, Card, EmptyState, TableSkeleton } from "@/components/ui/display";
import { Button, FormField, Input, Select, DatePicker } from "@/components/ui/forms";
import { Dropdown, DropdownItem, Pagination, Table } from "@/components/ui/navigation";
import { ConfirmDialog, Modal, useToast } from "@/components/ui/overlays";
import { errorMessage } from "@/api/client";

export function ClassesPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useClasses({ page, page_size: 15 });
  const create = useCreateClass();
  const remove = useDeleteClass();
  const duplicate = useDuplicateClass();
  const toast = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({
    date: new Date().toISOString().slice(0, 10),
    start_time: "09:00",
    end_time: "10:00",
    course: "B.Tech",
    branch: "CSE",
    section: "A",
    subject: "",
    faculty: "",
    topic: "",
  });

  const submit = async () => {
    if (!form.subject.trim() || !form.date) {
      toast.push("error", "Date and subject are required");
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-leather-300">Classes</h1>
          {data && <p className="text-xs text-leather-50/80">{data.total} classes scheduled</p>}
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <CalendarPlus size={15} /> New class
        </Button>
      </div>

      <Card className="p-0">
        {isLoading ? (
          <TableSkeleton rows={8} cols={6} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState icon={<CalendarDays size={20} />} title="No classes found." description="Create your first class to start taking attendance." action={<Button size="sm" onClick={() => setModalOpen(true)}>Create class</Button>} />
        ) : (
          <>
            <Table headers={["Date", "Time", "Subject", "Course / Branch / Sec", "Faculty", "Attendance", ""]}>
              {data.items.map((c) => (
                <tr key={c.id} className="hover:bg-cream-100/70">
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs font-medium text-leather-200">{new Date(c.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-leather-50/80">{c.start_time.slice(0, 5)}–{c.end_time.slice(0, 5)}</td>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-leather-300">{c.subject}</p>
                    {c.topic && <p className="max-w-[220px] truncate text-[11px] text-leather-50/80">{c.topic}</p>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-leather-200">{c.course} · {c.branch} · {c.section}</td>
                  <td className="px-4 py-2.5 text-xs text-leather-50/80">{c.faculty ?? "—"}</td>
                  <td className="px-4 py-2.5">{c.attendance_marked ? <Badge tone="green">marked</Badge> : <Badge tone="amber">pending</Badge>}</td>
                  <td className="px-2 py-2.5">
                    <div className="flex items-center gap-1">
                      <a href={`/admin/attendance?class=${c.id}`} className="inline-flex items-center gap-1 rounded-[20px] bg-primary-50 px-2.5 py-1.5 text-[11px] font-semibold text-primary-700 hover:bg-primary-100" title="Open attendance">
                        <ClipboardCheck size={13} /> Attendance
                      </a>
                      <Dropdown
                        trigger={
                          <button className="rounded-2xl p-1.5 text-leather-50/80 hover:bg-cream-200" aria-label="More actions"><MoreVertical size={15} /></button>
                        }
                      >
                        {(close) => (
                          <>
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
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Schedule a class">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label="Date"><DatePicker value={form.date} onChange={(val: string) => setForm({ ...form, date: val })} /></FormField>
          <FormField label="Subject"><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Data Structures" /></FormField>
          <FormField label="Start time"><Select value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })}><option value="00:00">12:00 AM</option><option value="00:15">12:15 AM</option><option value="00:30">12:30 AM</option><option value="00:45">12:45 AM</option><option value="01:00">01:00 AM</option><option value="01:15">01:15 AM</option><option value="01:30">01:30 AM</option><option value="01:45">01:45 AM</option><option value="02:00">02:00 AM</option><option value="02:15">02:15 AM</option><option value="02:30">02:30 AM</option><option value="02:45">02:45 AM</option><option value="03:00">03:00 AM</option><option value="03:15">03:15 AM</option><option value="03:30">03:30 AM</option><option value="03:45">03:45 AM</option><option value="04:00">04:00 AM</option><option value="04:15">04:15 AM</option><option value="04:30">04:30 AM</option><option value="04:45">04:45 AM</option><option value="05:00">05:00 AM</option><option value="05:15">05:15 AM</option><option value="05:30">05:30 AM</option><option value="05:45">05:45 AM</option><option value="06:00">06:00 AM</option><option value="06:15">06:15 AM</option><option value="06:30">06:30 AM</option><option value="06:45">06:45 AM</option><option value="07:00">07:00 AM</option><option value="07:15">07:15 AM</option><option value="07:30">07:30 AM</option><option value="07:45">07:45 AM</option><option value="08:00">08:00 AM</option><option value="08:15">08:15 AM</option><option value="08:30">08:30 AM</option><option value="08:45">08:45 AM</option><option value="09:00">09:00 AM</option><option value="09:15">09:15 AM</option><option value="09:30">09:30 AM</option><option value="09:45">09:45 AM</option><option value="10:00">10:00 AM</option><option value="10:15">10:15 AM</option><option value="10:30">10:30 AM</option><option value="10:45">10:45 AM</option><option value="11:00">11:00 AM</option><option value="11:15">11:15 AM</option><option value="11:30">11:30 AM</option><option value="11:45">11:45 AM</option><option value="12:00">12:00 PM</option><option value="12:15">12:15 PM</option><option value="12:30">12:30 PM</option><option value="12:45">12:45 PM</option><option value="13:00">01:00 PM</option><option value="13:15">01:15 PM</option><option value="13:30">01:30 PM</option><option value="13:45">01:45 PM</option><option value="14:00">02:00 PM</option><option value="14:15">02:15 PM</option><option value="14:30">02:30 PM</option><option value="14:45">02:45 PM</option><option value="15:00">03:00 PM</option><option value="15:15">03:15 PM</option><option value="15:30">03:30 PM</option><option value="15:45">03:45 PM</option><option value="16:00">04:00 PM</option><option value="16:15">04:15 PM</option><option value="16:30">04:30 PM</option><option value="16:45">04:45 PM</option><option value="17:00">05:00 PM</option><option value="17:15">05:15 PM</option><option value="17:30">05:30 PM</option><option value="17:45">05:45 PM</option><option value="18:00">06:00 PM</option><option value="18:15">06:15 PM</option><option value="18:30">06:30 PM</option><option value="18:45">06:45 PM</option><option value="19:00">07:00 PM</option><option value="19:15">07:15 PM</option><option value="19:30">07:30 PM</option><option value="19:45">07:45 PM</option><option value="20:00">08:00 PM</option><option value="20:15">08:15 PM</option><option value="20:30">08:30 PM</option><option value="20:45">08:45 PM</option><option value="21:00">09:00 PM</option><option value="21:15">09:15 PM</option><option value="21:30">09:30 PM</option><option value="21:45">09:45 PM</option><option value="22:00">10:00 PM</option><option value="22:15">10:15 PM</option><option value="22:30">10:30 PM</option><option value="22:45">10:45 PM</option><option value="23:00">11:00 PM</option><option value="23:15">11:15 PM</option><option value="23:30">11:30 PM</option><option value="23:45">11:45 PM</option></Select></FormField>
          <FormField label="End time"><Select value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })}><option value="00:00">12:00 AM</option><option value="00:15">12:15 AM</option><option value="00:30">12:30 AM</option><option value="00:45">12:45 AM</option><option value="01:00">01:00 AM</option><option value="01:15">01:15 AM</option><option value="01:30">01:30 AM</option><option value="01:45">01:45 AM</option><option value="02:00">02:00 AM</option><option value="02:15">02:15 AM</option><option value="02:30">02:30 AM</option><option value="02:45">02:45 AM</option><option value="03:00">03:00 AM</option><option value="03:15">03:15 AM</option><option value="03:30">03:30 AM</option><option value="03:45">03:45 AM</option><option value="04:00">04:00 AM</option><option value="04:15">04:15 AM</option><option value="04:30">04:30 AM</option><option value="04:45">04:45 AM</option><option value="05:00">05:00 AM</option><option value="05:15">05:15 AM</option><option value="05:30">05:30 AM</option><option value="05:45">05:45 AM</option><option value="06:00">06:00 AM</option><option value="06:15">06:15 AM</option><option value="06:30">06:30 AM</option><option value="06:45">06:45 AM</option><option value="07:00">07:00 AM</option><option value="07:15">07:15 AM</option><option value="07:30">07:30 AM</option><option value="07:45">07:45 AM</option><option value="08:00">08:00 AM</option><option value="08:15">08:15 AM</option><option value="08:30">08:30 AM</option><option value="08:45">08:45 AM</option><option value="09:00">09:00 AM</option><option value="09:15">09:15 AM</option><option value="09:30">09:30 AM</option><option value="09:45">09:45 AM</option><option value="10:00">10:00 AM</option><option value="10:15">10:15 AM</option><option value="10:30">10:30 AM</option><option value="10:45">10:45 AM</option><option value="11:00">11:00 AM</option><option value="11:15">11:15 AM</option><option value="11:30">11:30 AM</option><option value="11:45">11:45 AM</option><option value="12:00">12:00 PM</option><option value="12:15">12:15 PM</option><option value="12:30">12:30 PM</option><option value="12:45">12:45 PM</option><option value="13:00">01:00 PM</option><option value="13:15">01:15 PM</option><option value="13:30">01:30 PM</option><option value="13:45">01:45 PM</option><option value="14:00">02:00 PM</option><option value="14:15">02:15 PM</option><option value="14:30">02:30 PM</option><option value="14:45">02:45 PM</option><option value="15:00">03:00 PM</option><option value="15:15">03:15 PM</option><option value="15:30">03:30 PM</option><option value="15:45">03:45 PM</option><option value="16:00">04:00 PM</option><option value="16:15">04:15 PM</option><option value="16:30">04:30 PM</option><option value="16:45">04:45 PM</option><option value="17:00">05:00 PM</option><option value="17:15">05:15 PM</option><option value="17:30">05:30 PM</option><option value="17:45">05:45 PM</option><option value="18:00">06:00 PM</option><option value="18:15">06:15 PM</option><option value="18:30">06:30 PM</option><option value="18:45">06:45 PM</option><option value="19:00">07:00 PM</option><option value="19:15">07:15 PM</option><option value="19:30">07:30 PM</option><option value="19:45">07:45 PM</option><option value="20:00">08:00 PM</option><option value="20:15">08:15 PM</option><option value="20:30">08:30 PM</option><option value="20:45">08:45 PM</option><option value="21:00">09:00 PM</option><option value="21:15">09:15 PM</option><option value="21:30">09:30 PM</option><option value="21:45">09:45 PM</option><option value="22:00">10:00 PM</option><option value="22:15">10:15 PM</option><option value="22:30">10:30 PM</option><option value="22:45">10:45 PM</option><option value="23:00">11:00 PM</option><option value="23:15">11:15 PM</option><option value="23:30">11:30 PM</option><option value="23:45">11:45 PM</option></Select></FormField>
          <FormField label="Course"><Select value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })}><option>B.Tech</option><option>M.Tech</option></Select></FormField>
          <FormField label="Branch"><Select value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })}><option>CSE</option><option>IT</option><option>ECE</option><option>EEE</option><option>AIML</option><option>CS</option><option>DS</option></Select></FormField>
          <FormField label="Section"><Input value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} /></FormField>
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
