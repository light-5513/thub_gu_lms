import { useState, useRef, useEffect } from "react";
import { clsx } from "clsx";
import { ChevronLeft, ChevronRight, Calendar as CalIcon } from "lucide-react";
import { inputClasses } from "./forms";

export function DatePicker({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(value ? new Date(value) : new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();
  
  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  // When value is "YYYY-MM-DD", parsing it directly with new Date("YYYY-MM-DD") uses UTC and might offset by a day.
  // We parse it manually to local timezone correctly:
  const parseDateLocal = (str: string) => {
    if (!str) return null;
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const selectedDate = parseDateLocal(value);

  const isSelected = (d: number) => selectedDate && selectedDate.getDate() === d && selectedDate.getMonth() === viewDate.getMonth() && selectedDate.getFullYear() === viewDate.getFullYear();
  const isToday = (d: number) => {
    const today = new Date();
    return today.getDate() === d && today.getMonth() === viewDate.getMonth() && today.getFullYear() === viewDate.getFullYear();
  };

  const handleSelect = (d: number) => {
    const y = viewDate.getFullYear();
    const m = viewDate.getMonth() + 1;
    const paddedM = m < 10 ? `0${m}` : `${m}`;
    const paddedD = d < 10 ? `0${d}` : `${d}`;
    onChange(`${y}-${paddedM}-${paddedD}`);
    setOpen(false);
  };

  const nextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  const prevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));

  const displayFormat = selectedDate ? selectedDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : "Select date";

  return (
    <div ref={containerRef} className={clsx("relative inline-block w-full", className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={clsx(
          inputClasses,
          "flex w-full items-center justify-between text-left",
          !value && "text-leather-50/70"
        )}
      >
        <span className="truncate">{displayFormat}</span>
        <CalIcon size={14} className="ml-3 opacity-50 shrink-0" />
      </button>

      {open && (
        <div
          className="absolute z-[999] mt-1.5 w-64 rounded-2xl p-4"
          style={{
            backgroundColor: "var(--bg)",
            boxShadow: "var(--neo-out-lg)",
            border: "1px solid rgba(255, 255, 255, 0.5)"
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <button type="button" onClick={prevMonth} className="p-1 hover:bg-cream-200 rounded-full text-leather-200 transition"><ChevronLeft size={16} /></button>
            <span className="text-sm font-bold text-leather-300">
              {viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </span>
            <button type="button" onClick={nextMonth} className="p-1 hover:bg-cream-200 rounded-full text-leather-200 transition"><ChevronRight size={16} /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
              <div key={day} className="text-[10px] font-bold text-leather-50/70">{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((d, i) => d === null ? (
              <div key={`empty-${i}`} />
            ) : (
              <button
                key={d}
                type="button"
                onClick={() => handleSelect(d)}
                className={clsx(
                  "h-7 w-7 rounded-full text-xs flex items-center justify-center transition-all",
                  isSelected(d) ? "bg-primary-500 text-white font-bold" : 
                  isToday(d) ? "text-primary-600 font-bold bg-cream-200/50 hover:bg-cream-200" : 
                  "text-leather-300 hover:bg-cream-200"
                )}
                style={isSelected(d) ? { boxShadow: "inset 2px 2px 5px rgba(0,0,0,0.2)" } : {}}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
