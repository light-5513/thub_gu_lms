import { useMemo } from "react";
import { clsx } from "clsx";
import type { HeatmapDay } from "@/types";

const STATUS_COLORS = {
  present: "bg-success-500",
  absent: "bg-danger-500",
  none: "border border-white/35 bg-[var(--bg)] shadow-card-recess",
};
type HeatmapCellDay = Omit<HeatmapDay, "status"> & { status: HeatmapDay["status"] | "none" };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function Heatmap({ days, year }: { days: HeatmapDay[]; year: number }) {
  const byDate = useMemo(() => new Map(days.map((day) => [day.date, day])), [days]);
  const monthsData = useMemo(() => {
    const months = [];
    for (let month = 0; month < 12; month++) {
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0);
      const weeks: (HeatmapCellDay | null)[][] = [];
      let week: (HeatmapCellDay | null)[] = Array.from({ length: start.getDay() }, () => null);

      for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
        const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        const record = byDate.get(iso);
        // The API returns scheduled class dates only; other calendar days are not absences.
        week.push(record ?? { date: iso, status: "none", classes: 0, breakdown: {} });
        if (week.length === 7) {
          weeks.push(week);
          week = [];
        }
      }
      if (week.length) {
        while (week.length < 7) week.push(null);
        weeks.push(week);
      }
      months.push({ monthIndex: month, weeks });
    }
    return months;
  }, [byDate, year]);

  return (
    <div className="w-full overflow-x-auto pb-2">
      <div className="inline-flex min-w-max flex-col gap-3">
        <div className="flex gap-3">
          {monthsData.map(({ monthIndex, weeks }) => (
            <div key={monthIndex} className="flex flex-col gap-1.5">
              <div className="flex gap-[3px]">
                {weeks.map((week, weekIndex) => (
                  <div key={weekIndex} className="flex flex-col gap-[3px]">
                    {week.map((day, dayIndex) => day
                      ? <HeatCell key={dayIndex} day={day} />
                      : <div key={dayIndex} className="h-3 w-3" />)}
                  </div>
                ))}
              </div>
              <span className="w-full text-center text-[11px] font-medium leading-none text-[var(--text-muted)]">{MONTHS[monthIndex]}</span>
            </div>
          ))}
        </div>
        <Legend />
      </div>
    </div>
  );
}

function HeatCell({ day }: { day: HeatmapCellDay }) {
  const status = day.status === "none" ? "none" : day.status === "late" ? "present" : day.status === "leave" ? "absent" : day.status;
  const color = STATUS_COLORS[status === "present" || status === "absent" ? status : "none"];
  const dateLabel = new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
  const label = status === "none"
    ? `${dateLabel} — no scheduled class`
    : `${dateLabel} — ${day.status} (${day.classes} class${day.classes === 1 ? "" : "es"})`;

  return <div className={clsx("h-3 w-3 cursor-default rounded-[3px] transition-transform hover:scale-125", color)} title={label} aria-label={label} />;
}

function Legend() {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)]" aria-label="Attendance legend">
      {([
        ["present", "Present"],
        ["absent", "Absent"],
        ["none", "No class"],
      ] as const).map(([status, label]) => (
        <span key={status} className="inline-flex items-center gap-1.5">
          <span className={clsx("h-3 w-3 rounded-[3px]", STATUS_COLORS[status])} aria-hidden="true" />
          {label}
        </span>
      ))}
    </div>
  );
}
