import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, KeyRound, MoreVertical, Plus, Search, Send, Trash2, Users, Download } from "lucide-react";
import { useDeleteStudent, useResetAccount, useResendInvitation, useStudents, type StudentListParams } from "@/api/hooks";
import { Badge, Card, EmptyState, TableSkeleton } from "@/components/ui/display";
import { Button, Select } from "@/components/ui/forms";
import { Dropdown, DropdownItem, Pagination, Table } from "@/components/ui/navigation";
import { ConfirmDialog, useToast } from "@/components/ui/overlays";
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
          <h1 className="text-lg font-bold text-leather-300">Students</h1>
          {data && <p className="text-xs text-leather-50/80">{data.total} students found</p>}
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExport} variant="secondary" disabled={isExporting}>
            <Download size={15} /> {isExporting ? "Exporting..." : "Export Excel"}
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
            className="w-full rounded-[20px] border border-transparent bg-transparent py-2 pl-9 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-black"
          />
        </div>
        <div className="grid grid-cols-3 gap-2 md:w-auto">
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
                    <p className="font-medium text-leather-300">{s.first_name} {s.last_name}</p>
                    <p className="text-[11px] text-leather-50/80">Section {s.section}</p>
                  </td>
                  <td className="max-w-[220px] truncate px-4 py-2.5 text-xs text-leather-50/80">{s.email}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-leather-200">{s.course} · {s.branch}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={s.status === "active" ? "green" : "gray"}>{s.status}</Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    <Dropdown
                      trigger={
                        <button className="rounded-2xl p-1.5 text-leather-50/80 hover:bg-cream-200 hover:text-leather-200" aria-label={`Actions for ${s.first_name}`}>
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
    </div>
  );
}
