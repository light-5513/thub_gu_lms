import { useState } from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { downloadReport } from "@/api/hooks";
import { Card, CardHeader, EmptyState } from "@/components/ui/display";

const REPORTS = [
  { type: "students", title: "Student Report", description: "All students with course, branch, section and status." },
  { type: "attendance", title: "Attendance Report", description: "Attendance percentage per student, lowest first." },
  { type: "leaderboard", title: "Leaderboard Report", description: "Ranked overall scores with attendance." },
  { type: "coding", title: "Coding Performance Report", description: "Connected platforms with ratings and solved counts." },
];

const FORMATS = [
  { key: "csv", label: "CSV", icon: <FileText size={14} /> },
  { key: "xlsx", label: "Excel", icon: <FileSpreadsheet size={14} /> },
  { key: "pdf", label: "PDF", icon: <FileText size={14} /> },
];

export function ReportsPage() {
  const [format, setFormat] = useState("csv");

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-description">Export institutional data for offline analysis</p>
        </div>
        <div className="neo-inset-surface flex shrink-0 gap-1 rounded-full p-1" role="radiogroup" aria-label="Export format">
          {FORMATS.map((f) => (
            <button
              key={f.key}
              role="radio"
              aria-checked={format === f.key}
              onClick={() => setFormat(f.key)}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-colors ${format === f.key ? "neo-active" : "text-[var(--text-muted)] hover:bg-[var(--bg)] hover:shadow-card-recess hover:text-[var(--text)]"}`}
            >
              {f.icon} {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {REPORTS.map((r) => (
          <Card key={r.type} className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-leather-300">{r.title}</h3>
              <p className="mt-0.5 text-xs leading-relaxed text-leather-50/80">{r.description}</p>
            </div>
            <button
              onClick={() => downloadReport(r.type, format)}
              className="btn-primary inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs"
              title={`Download as ${format.toUpperCase()}`}
            >
              <Download size={14} /> Export
            </button>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader title="Note on large exports" />
        <p className="text-xs leading-relaxed text-leather-50/80">
          Exports are generated on demand from the latest leaderboard snapshot and student records. For very large datasets,
          schedule exports during off-peak hours — the worker queue keeps the API responsive.
        </p>
      </Card>

      {REPORTS.length === 0 && <EmptyState title="No reports configured." />}
    </div>
  );
}
