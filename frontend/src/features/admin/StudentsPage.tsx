import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { BarChart3, KeyRound, MoreVertical, Plus, Search, Send, Trash2, Users, Download, Upload } from "lucide-react";
import { useDeleteStudent, useImportConfirm, useImportPreview, useResetAccount, useResendInvitation, useStudents, type ImportPreviewData, type StudentListParams } from "@/api/hooks";
import { Badge, Card, EmptyState, TableSkeleton } from "@/components/ui/display";
import { Button, Input, Select } from "@/components/ui/forms";
import { Dropdown, DropdownItem, Pagination, Table } from "@/components/ui/navigation";
import { ConfirmDialog, Modal, useToast } from "@/components/ui/overlays";
import { errorMessage, api } from "@/api/client";

export function StudentsPage() {
  const [params, setParams] = useState<StudentListParams>({ page: 1, page_size: 15 });
  const { data, isLoading, isError, error, refetch } = useStudents(params);
  const toast = useToast();
  const navigate = useNavigate();
  const resend = useResendInvitation();
  const resetAccount = useResetAccount();
  const deleteStudent = useDeleteStudent();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const set = (patch: Partial<StudentListParams>) => setParams((p) => ({ ...p, page: 1, ...patch }));

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const res = await api.get('/admin/students/export', {
        params: {
          search: params.search,
          course: params.course,
          branch: params.branch,
          section: params.section,
          batch_id: params.batch_id,
          academic_year_id: params.academic_year_id,
          status: params.status,
        },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'students_export.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      toast.push('error', 'Failed to export students');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Students</h1>
          {data && <p className="page-description">{data.total} students found</p>}
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExport} variant="secondary" disabled={isExporting}>
            <Download size={15} /> {isExporting ? "Exporting..." : "Export Excel"}
          </Button>
          <Button onClick={() => setImportOpen(true)} variant="secondary">
            <Upload size={15} /> Import students
          </Button>
          <Button onClick={() => navigate("/admin/invitations")}>
            <Plus size={15} /> Invite student
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-leather-50/80" />
          <input
            placeholder="Search name, roll number or email…"
            value={(params.search as string) ?? ""}
            onChange={(e) => set({ search: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && refetch()}
            className="w-full rounded-full border border-white/30 bg-[var(--bg)] py-2.5 pl-9 pr-3 text-sm text-[var(--text)] shadow-card-recess placeholder:text-[var(--text-dim)] focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 md:w-auto md:gap-2">
          <Select value={params.course ?? ""} onChange={(e) => set({ course: e.target.value })} aria-label="Course">
            <option value="">All courses</option>
            <option>B.Tech</option>
            <option>M.Tech</option>
            <option>BCA</option>
            <option>MCA</option>
          </Select>
          <Select value={params.branch ?? ""} onChange={(e) => set({ branch: e.target.value })} aria-label="Branch">
            <option value="">All branches</option>
            <option>CSE</option>
            <option>IT</option>
            <option>ECE</option>
            <option>EEE</option>
            <option>AIML</option>
            <option>CS</option>
            <option>DS</option>
          </Select>
          <Select value={params.status ?? ""} onChange={(e) => set({ status: e.target.value })} aria-label="Status">
            <option value="">Any status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </div>
      </Card>

      {/* Table */}
      <Card className="p-0">
        {isLoading ? (
          <TableSkeleton rows={8} cols={6} />
        ) : isError || !data ? (
          <EmptyState title="We couldn't load students." description={errorMessage(error)} action={<Button size="sm" variant="outline" onClick={() => refetch()}>Retry</Button>} />
        ) : data.items.length === 0 ? (
          <EmptyState icon={<Users size={20} />} title="No students match your filters." description="Try adjusting your search or invite a new student." />
        ) : (
          <>
            <Table headers={["Roll number", "Name", "Email", "Course / Branch", "Status", "Actions"]}>
              {data.items.map((s) => (
                <tr key={s.id} className="hover:bg-cream-100/70">
                  <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs font-semibold text-leather-200">{s.roll_number}</td>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-leather-300 truncate max-w-[200px]">{s.first_name} {s.last_name}</p>
                    <p className="text-[11px] text-leather-50/80 truncate max-w-[200px]">Section {s.section}</p>
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-2.5 text-xs text-leather-50/80">{s.email}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-leather-200">{s.course} · {s.branch}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={s.status === "active" ? "green" : "gray"}>{s.status}</Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    <Dropdown
                      trigger={
                        <button className="btn-ghost rounded-full p-2 text-leather-50/80" aria-label={`Actions for ${s.first_name}`}>
                          <MoreVertical size={16} />
                        </button>
                      }
                    >
                      {(close) => (
                        <>
                          <DropdownItem
                            onClick={() => {
                              close();
                              navigate(`/admin/students/${s.id}/report`);
                            }}
                          >
                            <BarChart3 size={13} /> View report & progress
                          </DropdownItem>
                          <DropdownItem
                            onClick={() => {
                              close();
                              resend.mutate(s.id, { onSuccess: () => toast.push("success", "Invitation email sent"), onError: (e) => toast.push("error", errorMessage(e)) });
                            }}
                          >
                            <Send size={13} /> Resend invitation
                          </DropdownItem>
                          <DropdownItem
                            onClick={() => {
                              close();
                              resetAccount.mutate(s.id, { onSuccess: () => toast.push("success", "Account reset — a new temporary password was emailed"), onError: (e) => toast.push("error", errorMessage(e)) });
                            }}
                          >
                            <KeyRound size={13} /> Reset account
                          </DropdownItem>
                          <DropdownItem
                            danger
                            onClick={() => {
                              close();
                              setConfirmDelete(s.id);
                            }}
                          >
                            <Trash2 size={13} /> Deactivate
                          </DropdownItem>
                        </>
                      )}
                    </Dropdown>
                  </td>
                </tr>
              ))}
            </Table>
            <div className="flex items-center justify-between border-t border-transparent px-4 py-3">
              <p className="text-[11px] text-leather-50/80">
                Page {data.page} of {data.total_pages}
              </p>
              <Pagination page={data.page} totalPages={data.total_pages} onChange={(p) => setParams((x) => ({ ...x, page: p }))} />
            </div>
          </>
        )}
      </Card>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Deactivate this student?"
        message="The student account will be deactivated and they will no longer be able to log in."
        confirmLabel="Deactivate"
        loading={deleteStudent.isPending}
        onConfirm={() => confirmDelete && deleteStudent.mutate(confirmDelete, { onSuccess: () => { toast.push("success", "Student deactivated"); setConfirmDelete(null); }, onError: (e) => toast.push("error", errorMessage(e)) })}
        onCancel={() => setConfirmDelete(null)}
      />
      <StudentImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => setParams({ page: 1, page_size: 15 })}
      />
    </div>
  );
}

function StudentImportModal({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<ImportPreviewData | null>(null);
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);
  const [message, setMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const preview = useImportPreview();
  const confirm = useImportConfirm();
  const qc = useQueryClient();

  const close = () => {
    if (preview.isPending || confirm.isPending) return;
    setFile(null);
    setPreviewData(null);
    setResult(null);
    setMessage("");
    if (fileRef.current) fileRef.current.value = "";
    onClose();
  };

  const previewFile = async () => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setMessage("Choose an Excel .xlsx file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setMessage("The file must be smaller than 10 MB.");
      return;
    }
    setMessage("");
    setPreviewData(null);
    try {
      setPreviewData(await preview.mutateAsync(file));
    } catch (error) {
      setMessage(errorMessage(error));
    }
  };

  const importValidRows = async () => {
    if (!previewData?.valid_records || result) return;
    setMessage("");
    try {
      const response = await confirm.mutateAsync(previewData.import_token);
      setResult({ created: Number(response.created ?? 0), skipped: Number(response.skipped ?? 0) });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin", "students"] }),
        qc.invalidateQueries({ queryKey: ["batches"] }),
        qc.invalidateQueries({ queryKey: ["admin", "dashboard"] }),
        qc.invalidateQueries({ queryKey: ["leaderboard"] }),
      ]);
      onImported();
    } catch (error) {
      setMessage(errorMessage(error));
    }
  };

  return (
    <Modal open={open} onClose={close} title="Import students from Excel" wide>
      <div className="space-y-5">
        <div className="neo-inset-surface rounded-2xl p-4 text-sm text-leather-200">
          <p>Import students first, then create batches and assign them by roll number.</p>
          <p className="mt-2 text-xs text-leather-50">The workbook needs first_name, last_name, email, roll_number, course, branch, and section. Confirming valid rows creates accounts and sends invitation emails.</p>
          <a href="/student_import_template.xlsx" download className="btn-secondary mt-3 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold">
            <Download size={14} aria-hidden="true" /> Download Excel template
          </a>
        </div>

        {!result && (
          <div className="space-y-3">
            <Input
              ref={fileRef}
              type="file"
              accept=".xlsx"
              aria-label="Student roster Excel file"
              disabled={preview.isPending || confirm.isPending}
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setPreviewData(null);
                setMessage("");
              }}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={() => { void previewFile(); }} loading={preview.isPending} disabled={!file || confirm.isPending}>
                Preview file
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={close} disabled={preview.isPending || confirm.isPending}>Cancel</Button>
            </div>
          </div>
        )}

        {message && <p role="alert" className="neo-alert neo-alert-error px-4 py-3 text-sm">{message}</p>}

        {previewData && !result && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="neo-inset-surface rounded-2xl p-3"><p className="text-xs text-leather-50">Rows found</p><p className="text-xl font-semibold text-leather-300">{previewData.total_records}</p></div>
              <div className="neo-inset-surface rounded-2xl p-3"><p className="text-xs text-leather-50">Valid students</p><p className="text-xl font-semibold text-success-700">{previewData.valid_records}</p></div>
              <div className="neo-inset-surface rounded-2xl p-3"><p className="text-xs text-leather-50">Validation issues</p><p className="text-xl font-semibold text-danger-700">{previewData.invalid_records}</p></div>
            </div>
            {previewData.sample_valid.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-semibold text-leather-300">First valid rows</h4>
                <div className="neo-inset-surface overflow-x-auto rounded-2xl">
                  <Table headers={["Row", "Name", "Email", "Roll number"]}>
                    {previewData.sample_valid.map((row, index) => (
                      <tr key={`${row._row ?? index}-${row.roll_number ?? index}`}>
                        <td className="px-3 py-2 text-xs text-leather-50">{row._row}</td>
                        <td className="px-3 py-2 text-xs text-leather-200">{row.first_name} {row.last_name}</td>
                        <td className="px-3 py-2 text-xs text-leather-200">{row.email}</td>
                        <td className="px-3 py-2 font-mono text-xs text-leather-200">{row.roll_number}</td>
                      </tr>
                    ))}
                  </Table>
                </div>
              </div>
            )}
            {previewData.errors.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-semibold text-leather-300">Rows needing correction</h4>
                <div className="neo-inset-surface max-h-56 overflow-auto rounded-2xl">
                  <Table headers={["Row", "Column", "Issue"]}>
                    {previewData.errors.slice(0, 100).map((issue, index) => (
                      <tr key={`${issue.row}-${issue.field}-${index}`}>
                        <td className="px-3 py-2 text-xs text-leather-50">{issue.row}</td>
                        <td className="px-3 py-2 font-mono text-xs text-leather-200">{issue.field ?? "—"}</td>
                        <td className="px-3 py-2 text-xs text-danger-700">{issue.error}</td>
                      </tr>
                    ))}
                  </Table>
                </div>
                {previewData.errors.length > 100 && <p className="mt-2 text-xs text-leather-50">Showing the first 100 of {previewData.errors.length} issues.</p>}
              </div>
            )}
            <p className="text-xs text-leather-50">Only valid students will be created. Correct the listed rows in your workbook and preview again to include them.</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => { void importValidRows(); }} loading={confirm.isPending} disabled={previewData.valid_records === 0 || preview.isPending}>
                Create {previewData.valid_records} {previewData.valid_records === 1 ? "student" : "students"} and send invitations
              </Button>
              <Button type="button" variant="ghost" onClick={close} disabled={confirm.isPending}>Cancel</Button>
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div className="neo-alert neo-alert-info px-4 py-3 text-sm">
              <p className="font-semibold text-leather-300">Import complete</p>
              <p className="mt-1">{result.created} students created. {result.skipped} skipped.</p>
            </div>
            {result.skipped > 0 && <p className="text-sm text-leather-200">Review the student list and correct skipped records before importing them again.</p>}
            <Button type="button" onClick={close}>Done</Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
