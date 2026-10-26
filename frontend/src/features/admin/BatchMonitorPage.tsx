import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Activity, ArrowLeft, BarChart3, CalendarCheck, Code2, Search, Users } from "lucide-react";
import { useBatchMonitor } from "@/api/hooks";
import { errorMessage } from "@/api/client";
import { Badge, Card, EmptyState, ErrorState, ProgressBar, Skeleton, TableSkeleton } from "@/components/ui/display";
import { Button, DatePicker, Input } from "@/components/ui/forms";
import { Pagination, Table } from "@/components/ui/navigation";
import type { BatchMonitor, BatchMonitorAttendance } from "@/types";

const PAGE_SIZE = 20;

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function rangeForDays(days: number) {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - days + 1);
  return { start: dateKey(start), end: dateKey(end) };
}

function count(value: number): string {
  return value.toLocaleString();
}

function attendanceValue(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 10) / 10}%`;
}

function Breakdown({ attendance }: { attendance: BatchMonitorAttendance }) {
  const items = [
    { label: "Present", value: attendance.present, tone: "text-success-700" },
    { label: "Late", value: attendance.late, tone: "text-warning-700" },
    { label: "Absent", value: attendance.absent, tone: "text-danger-700" },
    { label: "Leave", value: attendance.leave, tone: "text-leather-100" },
    { label: "Unmarked", value: attendance.unmarked, tone: "text-leather-100" },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" aria-label="Attendance status totals">
      {items.map((item) => (
        <div key={item.label} className="neo-inset-surface rounded-2xl px-3 py-3">
          <p className="text-[11px] text-leather-50">{item.label}</p>
          <p className={`mt-1 text-lg font-semibold ${item.tone}`}>{count(item.value)}</p>
        </div>
      ))}
    </div>
  );
}

function Overview({ data, batchId }: { data: BatchMonitor; batchId: string }) {
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden p-0">
        <div className="grid lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
          <div className="border-b border-[var(--border)] p-5 sm:p-6 lg:border-b-0 lg:border-r">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-leather-300">Attendance in this period</h2>
                <p className="mt-1 text-sm text-leather-50">Only current batch members and this batch’s classes are counted.</p>
              </div>
              <CalendarCheck size={20} className="shrink-0 text-primary-700" aria-hidden="true" />
            </div>
            <div className="mt-5 flex items-end gap-3">
              <strong className="text-5xl font-semibold tracking-tight text-primary-700">{attendanceValue(data.attendance.percentage)}</strong>
              <span className="pb-1 text-xs text-leather-50">attendance rate</span>
            </div>
            {data.attendance.percentage !== null && <div className="mt-4 max-w-xl"><ProgressBar value={data.attendance.percentage} /></div>}
            <div className="mt-5"><Breakdown attendance={data.attendance} /></div>
          </div>
          <div className="flex flex-col justify-between gap-6 p-5 sm:p-6">
            <div>
              <h2 className="text-base font-semibold text-leather-300">Class coverage</h2>
              <p className="mt-1 text-sm text-leather-50">Sessions scheduled for this batch in the selected dates.</p>
              <div className="mt-4 flex items-baseline gap-2">
                <strong className="text-4xl font-semibold text-leather-300">{count(data.classes.total)}</strong>
                <span className="text-sm text-leather-50">classes</span>
              </div>
              <p className="mt-2 text-xs text-leather-200">{count(data.classes.marked)} marked · {count(data.classes.pending)} pending attendance</p>
            </div>
            <Link to={`/admin/attendance?batch=${encodeURIComponent(batchId)}`} className="btn-secondary inline-flex w-fit items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold">
              <CalendarCheck size={15} aria-hidden="true" /> Open batch attendance
            </Link>
          </div>
        </div>
      </Card>

      <Card className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4 sm:p-6">
        <SummaryItem label="Members" value={data.students.total} detail={`${data.students.active} active · ${data.students.inactive} inactive`} icon={<Users size={17} />} />
        <SummaryItem label="Coding profiles" value={data.coding.profiles} detail={`${data.students.with_profiles} members connected`} icon={<Code2 size={17} />} />
        <SummaryItem label="Active coders" value={data.students.active_coders} detail="Members with dated coding activity" icon={<Activity size={17} />} />
        <SummaryItem label="Coding days" value={data.coding.activity_days} detail="Distinct activity dates in this period" icon={<BarChart3 size={17} />} />
      </Card>
    </div>
  );
}

function SummaryItem({ label, value, detail, icon }: { label: string; value: number; detail: string; icon: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-3 border-b border-[var(--border)] pb-4 last:border-b-0 last:pb-0 sm:odd:border-r sm:odd:pr-4 lg:border-b-0 lg:not(:last-child):border-r lg:not(:last-child):pr-4 lg:pb-0">
      <span className="sk-icon-disc flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-primary-700" aria-hidden="true">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-leather-50">{label}</p>
        <p className="mt-0.5 text-2xl font-semibold text-leather-300">{count(value)}</p>
        <p className="mt-1 text-xs leading-snug text-leather-50">{detail}</p>
      </div>
    </div>
  );
}

export function BatchMonitorPage() {
  const { batchId = "" } = useParams<{ batchId: string }>();
  const [range, setRange] = useState(() => rangeForDays(30));
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const query = useBatchMonitor(batchId, range.start, range.end);
  const data = query.data;
  const members = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data?.members ?? []).filter((member) =>
      !term || member.name.toLowerCase().includes(term) || member.roll_number.toLowerCase().includes(term)
    );
  }, [data?.members, search]);
  const totalPages = Math.max(1, Math.ceil(members.length / PAGE_SIZE));
  const visibleMembers = members.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-5 animate-fade-in">
      <Link to="/admin/batches" className="btn-ghost inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-leather-200">
        <ArrowLeft size={15} aria-hidden="true" /> All batches
      </Link>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <h1 className="page-title">{data?.batch.name ?? "Batch monitoring"}</h1>
          <p className="page-description">{data?.batch.batch_code ? `${data.batch.batch_code} · ` : ""}Attendance, classes, and coding for this batch.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-40 text-xs font-semibold text-leather-200">From<DatePicker className="mt-1.5" ariaLabel="Monitor start date" value={range.start} maxDate={range.end} onChange={(start) => setRange((current) => ({ ...current, start }))} /></div>
          <div className="w-40 text-xs font-semibold text-leather-200">To<DatePicker className="mt-1.5" ariaLabel="Monitor end date" value={range.end} minDate={range.start} onChange={(end) => setRange((current) => ({ ...current, end }))} /></div>
          <div className="neo-inset-surface flex gap-1 rounded-full p-1" aria-label="Date range shortcuts">
            {[7, 30, 90].map((days) => (
              <button key={days} type="button" onClick={() => setRange(rangeForDays(days))} className="rounded-full px-3 py-2 text-xs font-semibold text-leather-200 hover:bg-[var(--bg)] hover:shadow-card-recess focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">{days}d</button>
            ))}
          </div>
        </div>
      </div>

      {data && <p className="text-xs text-leather-50">{data.period.start_date} to {data.period.end_date} · {data.period.timezone}. Members reflect the batch’s current roster.</p>}

      {query.isLoading ? (
        <div className="space-y-4"><Skeleton className="h-64 rounded-3xl" /><Skeleton className="h-28 rounded-3xl" /><TableSkeleton rows={7} cols={5} /></div>
      ) : query.isError || !data ? (
        <Card><ErrorState message={errorMessage(query.error)} onRetry={() => { void query.refetch(); }} /></Card>
      ) : (
        <>
          <Overview data={data} batchId={batchId} />

          {data.students.total === 0 && (
            <Card><EmptyState icon={<Users size={20} />} title="No students in this batch yet" description="Add students to the application, then assign their roll numbers to this batch." action={<Link to="/admin/batches" className="btn-secondary inline-flex rounded-full px-4 py-2 text-xs font-semibold">Manage batches</Link>} /></Card>
          )}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
            <Card>
              <h2 className="text-base font-semibold text-leather-300">Coding platforms</h2>
              <p className="mt-1 text-sm text-leather-50">Connected profiles from current batch members.</p>
              {data.coding.platforms.length ? (
                <div className="mt-4 space-y-2">
                  {data.coding.platforms.map((platform) => (
                    <div key={platform.platform} className="neo-inset-surface flex items-center justify-between gap-3 rounded-2xl px-4 py-3">
                      <span className="min-w-0 truncate text-sm font-medium capitalize text-leather-300">{platform.platform.replace("geeksforgeeks", "GeeksforGeeks")}</span>
                      <span className="shrink-0 text-xs text-leather-200">{platform.profiles} profiles · {platform.active_students} active</span>
                    </div>
                  ))}
                </div>
              ) : <p className="mt-5 text-sm text-leather-50">No coding profiles are connected in this batch.</p>}
            </Card>
            <Card className="flex flex-col justify-between gap-5">
              <div>
                <h2 className="text-base font-semibold text-leather-300">Continue monitoring</h2>
                <p className="mt-1 text-sm text-leather-50">Open the focused tools for this batch.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link to="/admin/students" className="btn-secondary inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold"><Users size={15} aria-hidden="true" /> Students</Link>
                <Link to={`/admin/attendance?batch=${encodeURIComponent(batchId)}`} className="btn-secondary inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold"><CalendarCheck size={15} aria-hidden="true" /> Attendance</Link>
                <Link to="/admin/leaderboards" className="btn-secondary inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold"><BarChart3 size={15} aria-hidden="true" /> Leaderboards</Link>
              </div>
            </Card>
          </div>

          <Card className="p-0">
            <div className="flex flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <h2 className="text-base font-semibold text-leather-300">Member progress</h2>
                <p className="mt-1 text-xs text-leather-50">{members.length} of {data.members.length} current batch members</p>
              </div>
              <div className="relative w-full sm:w-72">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-leather-50" aria-hidden="true" />
                <Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Find a member" aria-label="Find a batch member" className="pl-9" />
              </div>
            </div>
            {members.length ? (
              <>
                <Table headers={["Student", "Status", "Attendance", "Present / Late / Absent", "Coding", "Last activity", ""]}>
                  {visibleMembers.map((member) => (
                    <tr key={member.id} className="transition-colors hover:bg-primary-500/10 focus-within:bg-primary-500/10">
                      <td className="px-4 py-3"><p className="max-w-56 truncate text-sm font-semibold text-leather-300" title={member.name}>{member.name}</p><p className="text-xs text-leather-50">{member.roll_number}</p></td>
                      <td className="px-4 py-3"><Badge tone={member.status === "active" ? "green" : "gray"}>{member.status}</Badge></td>
                      <td className="px-4 py-3 text-sm font-semibold text-leather-300">{attendanceValue(member.attendance.percentage)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-leather-200">{member.attendance.present} / {member.attendance.late} / {member.attendance.absent}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-leather-200">{member.coding.profiles} profiles · {member.coding.activity_days} days</td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-leather-200">{member.coding.last_activity_date ?? "—"}</td>
                      <td className="px-4 py-3"><Link to={`/admin/students/${encodeURIComponent(member.id)}/report`} className="text-xs font-semibold text-primary-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">Report</Link></td>
                    </tr>
                  ))}
                </Table>
                {totalPages > 1 && <div className="border-t border-[var(--border)] p-4"><Pagination page={page} totalPages={totalPages} onChange={setPage} /></div>}
              </>
            ) : <EmptyState title={data.members.length ? "No matching members" : "No members to show"} description={data.members.length ? "Try a different name or roll number." : "Assign students to this batch to see their progress."} />}
          </Card>
        </>
      )}
    </div>
  );
}
