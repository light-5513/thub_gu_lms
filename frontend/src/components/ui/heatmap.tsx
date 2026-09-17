import { useMemo } from "react";
import { clsx } from "clsx";
import type { HeatmapDay } from "@/types";

const STATUS_COLORS: Record<string, string> = {
  present: "bg-primary-500",
  late: "bg-leather-300",
  absent: "bg-primary-800",
  leave: "bg-violet-400",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function Heatmap({ days, year }: { days: HeatmapDay[]; year: number }) {
  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);

  const weeks = useMemo(() => {
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);
    const grid: (HeatmapDay | null)[][] = [];
    let week: (HeatmapDay | null)[] = Array.from({ length: start.getDay() }, () => null);
    for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
      const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
      week.push(byDate.get(iso) ?? null);
      if (week.length === 7) {
        grid.push(week);
        week = [];
      }
    }
    if (week.length) {
      while (week.length < 7) week.push(null);
      grid.push(week);
    }
    return grid;
  }, [byDate, year]);

  const monthLabels = useMemo(() => {
    const labels: (string | null)[] = [];
    let lastMonth = -1;
    weeks.forEach((week, col) => {
      let labeled = false;
      for (const day of week) {
        if (!day) continue;
        const m = new Date(day.date + "T00:00:00").getMonth();
        if (m !== lastMonth) {
          while (labels.length < col) labels.push(null);
          labels.push(MONTHS[m]);
          lastMonth = m;
          labeled = true;
        }
        break;
      }
      if (!labeled && labels.length <= col) labels.push(null);
    });
    return labels;
  }, [weeks]);

  return (
    <div className="overflow-x-auto pb-1">
      <div className="inline-flex flex-col gap-1">
        <div className="flex gap-[3px] pl-[26px]">
          {monthLabels.map((name, i) => (
            <span key={i} className="w-[12px] text-left text-[10px] leading-none text-leather-50/80">
              {name}
            </span>
          ))}
        </div>
        <div className="flex gap-1">
          <div className="flex w-5 flex-col justify-between py-[1px] text-right text-[9px] leading-none text-leather-50/80">
            <span>Mon</span>
            <span>Wed</span>
            <span>Fri</span>
          </div>
          <div className="flex gap-[3px]">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {week.map((day, di) =>
                  day ? (
                    <HeatCell key={di} day={day} />
                  ) : (
                    <div key={di} className="h-[12px] w-[12px] rounded-[2px] bg-transparent" />
                  )
                )}
              </div>
            ))}
          </div>
        </div>
        <Legend />
      </div>
    </div>
  );
}

function HeatCell({ day }: { day: HeatmapDay }) {
  const color = STATUS_COLORS[day.status] ?? "bg-cream-300";
  const label = `${new Date(day.date + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  })} — ${day.status} (${day.classes} class${day.classes > 1 ? "es" : ""})`;
  return (
    <div
      className={clsx("h-[12px] w-[12px] cursor-default rounded-[2px] transition-transform hover:scale-125 hover:ring-2 hover:ring-transparent", color)}
      title={label}
    />
  );
}

function Legend() {
  return (
    <div className="mt-2 flex items-center gap-2.5 pl-[26px] text-[10px] text-leather-50/80">
      {Object.entries(STATUS_COLORS).map(([status, color]) => (
        <span key={status} className="inline-flex items-center gap-1 capitalize">
          <span className={clsx("h-[10px] w-[10px] rounded-[2px]", color)} />
          {status}
        </span>
      ))}
    </div>
  );
}
