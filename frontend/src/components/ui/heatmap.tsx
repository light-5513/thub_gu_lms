import { useMemo } from "react";
import { clsx } from "clsx";
import type { HeatmapDay } from "@/types";

const STATUS_COLORS: Record<string, string> = {
  present: "bg-leather-500 shadow-[0_1px_2px_rgba(0,0,0,0.1)]", 
  absent: "bg-leather-50/20", 
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function Heatmap({ days, year }: { days: HeatmapDay[]; year: number }) {
  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);

  const monthsData = useMemo(() => {
    const months = [];
    for (let m = 0; m < 12; m++) {
      const mStart = new Date(year, m, 1);
      const mEnd = new Date(year, m + 1, 0);
      const grid: (HeatmapDay | null)[][] = [];
      let week: (HeatmapDay | null)[] = Array.from({ length: mStart.getDay() }, () => null);
      
      for (let dt = new Date(mStart); dt <= mEnd; dt.setDate(dt.getDate() + 1)) {
        const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
        const record = byDate.get(iso);
        // If there's no record, we still want to render a dot (absent) since it's a valid day in the month
        const dayObject = record ?? { date: iso, status: "absent", classes: 0, breakdown: {} };
        week.push(dayObject as HeatmapDay);
        
        if (week.length === 7) {
          grid.push(week);
          week = [];
        }
      }
      if (week.length > 0) {
        while (week.length < 7) week.push(null);
        grid.push(week);
      }
      months.push({ monthIndex: m, weeks: grid });
    }
    return months;
  }, [byDate, year]);

  return (
    <div className="w-full overflow-hidden pb-1 flex justify-center">
      <div className="inline-flex flex-col gap-3">
        <div className="flex gap-3">
          {monthsData.map((m) => (
            <div key={m.monthIndex} className="flex flex-col gap-1.5">
              <div className="flex gap-[3px]">
                {m.weeks.map((week, wi) => (
                  <div key={wi} className="flex flex-col gap-[3px]">
                    {week.map((day, di) =>
                      day ? (
                        <HeatCell key={di} day={day} />
                      ) : (
                        <div key={di} className="h-[12px] w-[12px] bg-transparent" />
                      )
                    )}
                  </div>
                ))}
              </div>
              <span className="w-full text-center text-[11px] font-medium leading-none text-leather-50">
                {MONTHS[m.monthIndex]}
              </span>
            </div>
          ))}
        </div>
        <Legend />
      </div>
    </div>
  );
}

function HeatCell({ day }: { day: HeatmapDay }) {
  // Visually group 'late' into 'present', and 'leave' into 'absent' for the binary streak visualization.
  const isPresent = day.status === "present" || day.status === "late";
  const colorKey = isPresent ? "present" : "absent";
  const color = STATUS_COLORS[colorKey];
  
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
    <div className="mt-1 flex items-center gap-2.5 text-[12px] text-leather-50/80">
      {Object.entries(STATUS_COLORS).map(([status, color]) => (
        <span key={status} className="inline-flex items-center gap-1 capitalize">
          <span className={clsx("h-[12px] w-[12px] rounded-[2px]", color)} />
          {status}
        </span>
      ))}
    </div>
  );
}
