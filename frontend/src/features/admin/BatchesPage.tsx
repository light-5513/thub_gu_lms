import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Layers, Plus, Trash2, Users, Upload, CheckCircle2, Eye, CalendarCheck } from "lucide-react";
import {
  useBatches,
  useCreateBatch,
  useDeleteBatch,
  useBatchStudents,
  useAssignBatchStudents,
  useUploadBatchStudents,
  useUpdateBatch,
} from "@/api/hooks";
import { Badge, Card, CardHeader, EmptyState, TableSkeleton, Skeleton } from "@/components/ui/display";
import { Button, FormField, Input, Textarea } from "@/components/ui/forms";
import { ConfirmDialog, Modal, useToast } from "@/components/ui/overlays";
import { Pagination, Table } from "@/components/ui/navigation";
import { errorMessage } from "@/api/client";

export function BatchesPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useBatches(page);
  
  const [createOpen, setCreateOpen] = useState(false);
  const [manageBatch, setManageBatch] = useState<any | null>(null);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-leather-300">Batches</h1>
          <p className="text-sm text-leather-50/80">Organize students into groups for tracking</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="w-full sm:w-auto">
          <Plus size={16} className="mr-2" />
          Create Batch
        </Button>
      </div>

      <Card className="p-0">
        {isLoading ? (
          <TableSkeleton rows={5} cols={4} />
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
                      <div>
                        <p className="font-semibold text-leather-300">{b.name}</p>
                        {b.description && <p className="text-xs text-leather-50/70">{b.description}</p>}
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
                      <Button size="sm" variant="secondary" onClick={() => setManageBatch(b)}>
                        Manage
                      </Button>
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
      <form onSubmit={handleSubmit} className="space-y-4 p-5">
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
  const [tab, setTab] = useState<"students" | "add" | "upload" | "edit">("students");
  const del = useDeleteBatch();
  const toast = useToast();
  const [showDel, setShowDel] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <Modal open={true} onClose={onClose} title={`Manage Batch: ${batch.name}`} wide>
        <div className="flex items-center gap-4 border-b border-leather-50/10 px-5 py-3 text-sm font-semibold text-leather-200 overflow-x-auto">
          <button
            className={`whitespace-nowrap pb-3 ${tab === "students" ? "border-b-2 border-primary-500 text-primary-500" : "hover:text-leather-300"}`}
            onClick={() => setTab("students")}
          >
            Students ({batch.student_count})
          </button>
          <button
            className={`whitespace-nowrap pb-3 ${tab === "add" ? "border-b-2 border-primary-500 text-primary-500" : "hover:text-leather-300"}`}
            onClick={() => setTab("add")}
          >
            Add Manually
          </button>
          <button
            className={`whitespace-nowrap pb-3 ${tab === "upload" ? "border-b-2 border-primary-500 text-primary-500" : "hover:text-leather-300"}`}
            onClick={() => setTab("upload")}
          >
            Upload Excel
          </button>
          <button
            className={`whitespace-nowrap pb-3 ${tab === "edit" ? "border-b-2 border-primary-500 text-primary-500" : "hover:text-leather-300"}`}
            onClick={() => setTab("edit")}
          >
            Edit Details
          </button>
        </div>

        <div className="p-5 min-h-[300px]">
          {tab === "students" && <BatchStudentsTab batchId={batch.id} />}
          {tab === "add" && <BatchAddTab batchId={batch.id} onSuccess={() => setTab("students")} />}
          {tab === "upload" && <BatchUploadTab batchId={batch.id} onSuccess={() => setTab("students")} />}
          {tab === "edit" && <BatchEditTab batch={batch} onSuccess={onClose} />}
        </div>
        
        <div className="border-t border-leather-50/10 bg-cream-100/50 p-4 flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => setShowDel(true)}>
            <Trash2 size={16} className="mr-2" /> Delete Batch
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="primary" onClick={() => navigate("/admin/attendance")}>
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

function BatchStudentsTab({ batchId }: { batchId: string }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useBatchStudents(batchId, page);
  const navigate = useNavigate();

  if (isLoading) return <Skeleton className="h-48 w-full rounded-3xl" />;
  if (!data || data.items.length === 0) return <p className="text-sm text-leather-200 py-10 text-center">No students are assigned to this batch yet.</p>;

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl ring-1 ring-black/5">
        <Table headers={["Roll Number", "Name", "Branch", ""]}>
          {data.items.map((s: any) => (
            <tr key={s.id} className="hover:bg-cream-200/30">
              <td className="px-4 py-2 text-xs font-bold text-leather-300">{s.roll_number}</td>
              <td className="px-4 py-2 text-xs text-leather-200">{s.first_name} {s.last_name}</td>
              <td className="px-4 py-2 text-xs text-leather-50/80">{s.branch} - {s.section}</td>
              <td className="px-4 py-2 text-right">
                <Button variant="ghost" size="sm" onClick={() => navigate(`/admin/students/${s.id}/report`)}>
                  <Eye size={14} className="mr-1" /> View
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
          className="file:mr-4 file:py-1.5 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-[var(--bg)] file:text-[var(--text-muted)] file:shadow-[var(--neo-out-sm)] hover:file:shadow-[var(--neo-in)] active:file:shadow-[var(--neo-in)] file:transition-all file:cursor-pointer text-leather-200"
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
