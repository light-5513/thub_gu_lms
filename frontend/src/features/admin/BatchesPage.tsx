import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { BarChart3, Layers, Plus, Trash2, Users, Upload, CheckCircle2, Eye, CalendarCheck, UserMinus } from "lucide-react";
import {
  useBatches,
  useCreateBatch,
  useDeleteBatch,
  useBatchStudents,
  useRemoveBatchStudent,
  useAssignBatchStudents,
  useUploadBatchStudents,
  useUpdateBatch,
  useClasses,
} from "@/api/hooks";
import { Badge, Card, CardHeader, EmptyState, ErrorState, TableSkeleton, Skeleton } from "@/components/ui/display";
import { Button, FormField, Input, Textarea } from "@/components/ui/forms";
import { ConfirmDialog, Modal, useToast } from "@/components/ui/overlays";
import { Pagination, Table, Tabs } from "@/components/ui/navigation";
import { errorMessage } from "@/api/client";

export function BatchesPage() {
  const [page, setPage] = useState(1);
  const navigate = useNavigate();
  const { data, isLoading, isError, error, refetch } = useBatches(page);
  
  const [createOpen, setCreateOpen] = useState(false);
  const [manageBatch, setManageBatch] = useState<any | null>(null);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Batches</h1>
          <p className="page-description">Add students, assign them to batches, then monitor each batch here.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => navigate("/admin/students")}>
            <Users size={16} className="mr-2" /> Add students
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={16} className="mr-2" /> Create batch
          </Button>
        </div>
      </div>

      <Card className="p-0">
        {isLoading ? (
          <TableSkeleton rows={5} cols={4} />
        ) : isError ? (
          <ErrorState message={errorMessage(error)} onRetry={() => { void refetch(); }} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            icon={<Layers size={24} />}
            title="No batches found"
            description="Create a batch to start organizing your students."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table headers={["Batch ID", "Name", "Students", "Created At", "Actions"]}>
                {data.items.map((b: any) => (
                  <tr key={b.id} className="transition-colors hover:bg-cream-200/50">
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-bold text-leather-300">
                      {b.batch_code}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-leather-200">
                      <div className="max-w-[250px]">
                        <p className="font-semibold text-leather-300 truncate">{b.name}</p>
                        {b.description && <p className="text-xs text-leather-50/70 truncate">{b.description}</p>}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Badge tone="gray" className="inline-flex items-center gap-1">
                        <Users size={12} /> {b.student_count}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-leather-50/80">
                      {b.created_at ? format(new Date(b.created_at), "MMM d, yyyy") : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="secondary" onClick={() => navigate(`/admin/batches/${encodeURIComponent(b.id)}/monitor`)}>
                          <BarChart3 size={14} className="mr-1" /> Monitor
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setManageBatch(b)}>
                          Manage
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </Table>
            </div>
            {data.total_pages > 1 && (
              <div className="border-t border-leather-50/10 p-4">
                <Pagination page={page} totalPages={data.total_pages} onChange={setPage} />
              </div>
            )}
          </>
        )}
      </Card>

      <CreateBatchModal open={createOpen} onClose={() => setCreateOpen(false)} />
      {manageBatch && (
        <ManageBatchModal batch={manageBatch} onClose={() => setManageBatch(null)} />
      )}
    </div>
  );
}

function CreateBatchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const create = useCreateBatch();
  const toast = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate(
      { batch_code: code, name, description: desc },
      {
        onSuccess: () => {
          toast.push('success', "Batch created successfully");
          setCode("");
          setName("");
          setDesc("");
          onClose();
        },
        onError: (err) => toast.push('error', errorMessage(err)),
      }
    );
  };

  return (
    <Modal open={open} onClose={onClose} title="Create New Batch">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Batch ID (Code) *">
          <Input
            placeholder="e.g. 2026-CSE"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
        </FormField>
        <FormField label="Batch Name *">
          <Input
            placeholder="e.g. Class of 2026 - Computer Science"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </FormField>
        <FormField label="Description (Optional)">
          <Textarea
            placeholder="Optional details about this batch..."
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={3}
          />
        </FormField>

        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={create.isPending}>
            Create Batch
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ManageBatchModal({ batch, onClose }: { batch: any; onClose: () => void }) {
  const [tab, setTab] = useState<"students" | "attendance" | "add" | "upload" | "edit">("students");
  const del = useDeleteBatch();
  const toast = useToast();
  const [showDel, setShowDel] = useState(false);
  const navigate = useNavigate();
  const { data: members } = useBatchStudents(batch.id, 1);

  return (
    <>
      <Modal open={true} onClose={onClose} title={`Manage Batch: ${batch.name}`} wide>
        <Tabs
          tabs={[
            { key: "students", label: `Students (${members?.total ?? batch.student_count})` },
            { key: "attendance", label: "Attendance" },
            { key: "add", label: "Add manually" },
            { key: "upload", label: "Upload Excel" },
            { key: "edit", label: "Edit details" },
          ]}
          active={tab}
          onChange={(key) => setTab(key as typeof tab)}
        />

        <div className="min-h-[300px] py-5">
          {tab === "students" && <BatchStudentsTab batchId={batch.id} />}
          {tab === "attendance" && (
            <BatchAttendanceTab
              batchId={batch.id}
              onOpenSession={(classId) => {
                onClose();
                navigate(`/admin/attendance?class=${encodeURIComponent(classId)}`);
              }}
            />
          )}
          {tab === "add" && <BatchAddTab batchId={batch.id} onSuccess={() => setTab("students")} />}
          {tab === "upload" && <BatchUploadTab batchId={batch.id} onSuccess={() => setTab("students")} />}
          {tab === "edit" && <BatchEditTab batch={batch} onSuccess={onClose} />}
        </div>
        
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-5">
          <Button variant="danger" onClick={() => setShowDel(true)}>
            <Trash2 size={16} className="mr-2" /> Delete Batch
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => navigate(`/admin/batches/${encodeURIComponent(batch.id)}/monitor`)}>
              <BarChart3 size={16} className="mr-2" /> Monitor batch
            </Button>
            <Button variant="primary" onClick={() => navigate(`/admin/attendance?batch=${encodeURIComponent(batch.id)}`)}>
              <CalendarCheck size={16} className="mr-2" /> Take Attendance
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
      
<ConfirmDialog
        open={showDel}
        title="Delete Batch?"
        message="Are you sure you want to delete this batch? The students will NOT be deleted, they will simply be unassigned from this batch."
        confirmLabel="Delete Batch"
        onConfirm={() => {
          del.mutate(batch.id, {
            onSuccess: () => {
              toast.push('success', "Batch deleted");
              onClose();
            },
            onError: (err) => toast.push('error', errorMessage(err)),
          });
        }}
        onCancel={() => setShowDel(false)}
        tone="danger"
        loading={del.isPending}
      />
    </>
  );
}

function BatchAttendanceTab({
  batchId,
  onOpenSession,
}: {
  batchId: string;
  onOpenSession: (classId: string) => void;
}) {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error, refetch } = useClasses({ page, page_size: 100, batch_id: batchId });

  if (isLoading) return <Skeleton className="h-48 w-full rounded-3xl" />;
  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-sm text-leather-200">{errorMessage(error)}</p>
        <Button size="sm" variant="secondary" onClick={() => { void refetch(); }}>Retry</Button>
      </div>
    );
  }
  if (!data || data.items.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-leather-200">
        No class attendance sessions are linked to this batch yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-leather-50/80">{data.total} class sessions in this batch</p>
      <div className="neo-inset-surface overflow-hidden rounded-2xl">
        <Table headers={["Date", "Session", "Attendance", ""]}>
          {data.items.map((session) => (
            <tr key={session.id} className="hover:bg-cream-200/30">
              <td className="whitespace-nowrap px-4 py-2.5 text-xs font-medium text-leather-300">
                {format(new Date(`${session.date.slice(0, 10)}T00:00:00`), "EEE, MMM d, yyyy")}
              </td>
              <td className="px-4 py-2.5 text-xs text-leather-200">{session.subject}</td>
              <td className="px-4 py-2.5">
                {session.attendance_marked ? <Badge tone="green">marked</Badge> : <Badge tone="amber">pending</Badge>}
              </td>
              <td className="px-4 py-2.5 text-right">
                <Button size="sm" variant="secondary" onClick={() => onOpenSession(session.id)}>
                  {session.attendance_marked ? "View attendance" : "Open session"}
                </Button>
              </td>
            </tr>
          ))}
        </Table>
      </div>
      {data.total_pages > 1 && <Pagination page={page} totalPages={data.total_pages} onChange={setPage} />}
    </div>
  );
}

function BatchStudentsTab({ batchId }: { batchId: string }) {
  const [page, setPage] = useState(1);
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string; rollNumber: string } | null>(null);
  const { data, isLoading, isError, error, refetch } = useBatchStudents(batchId, page);
  const remove = useRemoveBatchStudent();
  const toast = useToast();
  const navigate = useNavigate();

  if (isLoading) return <Skeleton className="h-48 w-full rounded-3xl" />;
  if (isError) return <ErrorState message={errorMessage(error)} onRetry={() => { void refetch(); }} />;
  if (!data || data.items.length === 0) return <p className="text-sm text-leather-200 py-10 text-center">No students are assigned to this batch yet.</p>;

  return (
    <div className="space-y-4">
      <div className="neo-inset-surface overflow-hidden rounded-2xl">
        <Table headers={["Roll Number", "Name", "Branch", ""]}>
          {data.items.map((s: any) => (
            <tr key={s.id} className="hover:bg-cream-200/30">
              <td className="px-4 py-2 text-xs font-bold text-leather-300">{s.roll_number}</td>
              <td className="px-4 py-2 text-xs text-leather-200">{s.first_name} {s.last_name}</td>
              <td className="px-4 py-2 text-xs text-leather-50/80">{s.branch} - {s.section}</td>
              <td className="px-4 py-2 text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/students/${s.id}/report`)}>
                    <Eye size={14} className="mr-1" /> View
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-danger-700"
                    onClick={() => setRemoveTarget({
                      id: s.id,
                      name: `${s.first_name} ${s.last_name}`.trim(),
                      rollNumber: s.roll_number,
                    })}
                  >
                    <UserMinus size={14} className="mr-1" /> Remove
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      </div>
      {data.total_pages > 1 && <Pagination page={page} totalPages={data.total_pages} onChange={setPage} />}
      <ConfirmDialog
        open={!!removeTarget}
        title="Remove student from batch?"
        message={<>
          Remove <strong>{removeTarget?.name}</strong> ({removeTarget?.rollNumber}) from this batch?
          Their student profile and saved attendance will remain. You can add them back using their roll number.
        </>}
        confirmLabel="Remove from batch"
        loading={remove.isPending}
        onConfirm={() => {
          if (!removeTarget) return;
          remove.mutate({ batchId, studentId: removeTarget.id }, {
            onSuccess: () => {
              toast.push("success", "Student removed from batch");
              setRemoveTarget(null);
              if (data.items.length === 1 && page > 1) setPage(page - 1);
            },
            onError: (err) => toast.push("error", errorMessage(err)),
          });
        }}
        onCancel={() => setRemoveTarget(null)}
      />
    </div>
  );
}

function BatchAddTab({ batchId, onSuccess }: { batchId: string; onSuccess: () => void }) {
  const [rolls, setRolls] = useState("");
  const assign = useAssignBatchStudents();
  const toast = useToast();

  const handleAssign = () => {
    const arr = rolls.split(/[\n,]+/).map(r => r.trim()).filter(Boolean);
    if (!arr.length) return;
    
    assign.mutate(
      { batchId, rollNumbers: arr },
      {
        onSuccess: (res) => {
          toast.push('success', `Successfully assigned ${res.success_count} students.`);
          if (res.failed_roll_numbers?.length > 0) {
            toast.push('error', `Failed to find ${res.failed_roll_numbers.length} roll numbers.`);
          }
          setRolls("");
          onSuccess();
        },
        onError: (err) => toast.push('error', errorMessage(err)),
      }
    );
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-leather-200">Enter roll numbers separated by commas or new lines.</p>
      <Textarea
        rows={6}
        placeholder="e.g. 21A91A0501, 21A91A0502..."
        value={rolls}
        onChange={(e) => setRolls(e.target.value)}
      />
      <Button onClick={handleAssign} loading={assign.isPending} disabled={!rolls.trim()}>
        Assign Students
      </Button>
    </div>
  );
}

function BatchUploadTab({ batchId, onSuccess }: { batchId: string; onSuccess: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const upload = useUploadBatchStudents();
  const toast = useToast();

  const handleUpload = () => {
    if (!file) return;
    upload.mutate(
      { batchId, file },
      {
        onSuccess: (res) => {
          toast.push('success', `Successfully assigned ${res.success_count} students from Excel.`);
          if (res.failed_roll_numbers?.length > 0) {
            toast.push('error', `Failed to find ${res.failed_roll_numbers.length} roll numbers from the file.`);
          }
          setFile(null);
          onSuccess();
        },
        onError: (err) => toast.push('error', errorMessage(err)),
      }
    );
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-leather-200">
        Upload an Excel (.xlsx) file containing a <strong>roll_number</strong> column.
      </p>
      <div className="flex items-center gap-4">
        <Input 
          type="file" 
          accept=".xlsx" 
          onChange={(e) => setFile(e.target.files?.[0] || null)} 
          className="file:mr-4 file:py-1.5 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-[var(--bg)] file:text-[var(--text-muted)] file:shadow-btn-secondary hover:file:shadow-card-recess active:file:shadow-card-recess file:transition-all file:cursor-pointer text-leather-200"
        />
        <Button onClick={handleUpload} loading={upload.isPending} disabled={!file}>
          <Upload size={16} className="mr-2" /> Upload
        </Button>
      </div>
    </div>
  );
}

function BatchEditTab({ batch, onSuccess }: { batch: any; onSuccess: () => void }) {
  const [name, setName] = useState(batch.name || "");
  const [desc, setDesc] = useState(batch.description || "");
  const update = useUpdateBatch();
  const toast = useToast();

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    update.mutate(
      { id: batch.id, data: { name, description: desc } },
      {
        onSuccess: () => {
          toast.push('success', "Batch updated successfully");
          onSuccess();
        },
        onError: (err) => toast.push('error', errorMessage(err)),
      }
    );
  };

  return (
    <form onSubmit={handleUpdate} className="space-y-4 max-w-md">
      <FormField label="Batch Name *">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </FormField>
      <FormField label="Description (Optional)">
        <Textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          rows={3}
        />
      </FormField>
      <Button loading={update.isPending} className="w-full">Save Changes</Button>
    </form>
  );
}
