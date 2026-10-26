import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { clsx } from "clsx";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { inputClasses } from "./forms";
import { useAnchoredPopover } from "./useAnchoredPopover";

type DatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  ariaLabel?: string;
  minDate?: string;
  maxDate?: string;
  align?: "start" | "end";
};

function parseDateLocal(value: string): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function DatePicker({
  value,
  onChange,
  className,
  ariaLabel = "Choose date",
  minDate,
  maxDate,
  align = "start",
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => parseDateLocal(value) ?? new Date());
  const [cursorDate, setCursorDate] = useState(() => parseDateLocal(value) ?? new Date());
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { popoverRef, style: popoverStyle } = useAnchoredPopover(open, triggerRef, {
    minWidth: 256,
    maxHeight: 348,
    align,
  });
  const calendarId = useId();
  const selectedDate = parseDateLocal(value);

  useEffect(() => {
    if (selectedDate) {
      setViewDate(selectedDate);
      setCursorDate(selectedDate);
    }
  }, [value]);

  useEffect(() => {
    if (!open) return;

    const handleOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !popoverRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", handleOutside);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", handleOutside);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [open, popoverRef]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const days: Array<number | null> = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  const isSelected = (day: number) =>
    selectedDate?.getFullYear() === year &&
    selectedDate.getMonth() === month &&
    selectedDate.getDate() === day;
  const isToday = (day: number) => {
    const today = new Date();
    return today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
  };
  const isDisabled = (day: number) => {
    const key = dateKey(year, month, day);
    return Boolean((minDate && key < minDate) || (maxDate && key > maxDate));
  };

  const isAllowed = (date: Date) => {
    const key = dateKey(date.getFullYear(), date.getMonth(), date.getDate());
    return (!minDate || key >= minDate) && (!maxDate || key <= maxDate);
  };
  const moveCursor = (date: Date) => {
    if (!isAllowed(date)) return;
    setCursorDate(date);
    setViewDate(date);
  };
  const showCalendar = () => {
    const initial = selectedDate ?? new Date();
    const minimum = minDate ? parseDateLocal(minDate) : null;
    const maximum = maxDate ? parseDateLocal(maxDate) : null;
    const bounded = minimum && initial < minimum ? minimum : maximum && initial > maximum ? maximum : initial;
    setCursorDate(bounded);
    setViewDate(bounded);
    setOpen(true);
  };
  const selectDate = (date: Date) => {
    onChange(dateKey(date.getFullYear(), date.getMonth(), date.getDate()));
    setOpen(false);
    triggerRef.current?.focus();
  };
  const handleTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (!open) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        showCalendar();
      }
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectDate(cursorDate);
      return;
    }
    const dayOffsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (event.key in dayOffsets) {
      event.preventDefault();
      moveCursor(new Date(cursorDate.getFullYear(), cursorDate.getMonth(), cursorDate.getDate() + dayOffsets[event.key]));
    } else if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      const targetMonth = new Date(cursorDate.getFullYear(), cursorDate.getMonth() + (event.key === "PageUp" ? -1 : 1), 1);
      const day = Math.min(cursorDate.getDate(), new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate());
      moveCursor(new Date(targetMonth.getFullYear(), targetMonth.getMonth(), day));
    }
  };

  const displayValue = selectedDate
    ? selectedDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "Select date";

  return (
    <div className={clsx("relative inline-block w-full", className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => open ? setOpen(false) : showCalendar()}
        onKeyDown={handleTriggerKeyDown}
        aria-label={`${ariaLabel}${selectedDate ? `, ${displayValue}` : ""}`}
        aria-describedby={`${calendarId}-instructions`}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? calendarId : undefined}
        className={clsx(
          inputClasses,
          "flex w-full items-center justify-between text-left focus-visible:outline-none",
          !selectedDate && "text-leather-50/70"
        )}
      >
        <span className="truncate">{displayValue}</span>
        <CalendarIcon size={15} aria-hidden="true" className="ml-3 shrink-0 text-leather-50/70" />
      </button>
      <span id={`${calendarId}-instructions`} className="sr-only">Use arrow keys to choose a day, Page Up or Page Down to change month, and Enter to select.</span>
      <span className="sr-only" role="status" aria-live="polite">
        {open ? cursorDate.toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric", year: "numeric" }) : ""}
      </span>

      {open && createPortal(
        <div
          ref={popoverRef}
          id={calendarId}
          className="neo-popover fixed z-[1100] overflow-y-auto rounded-2xl p-4"
          style={popoverStyle}
          role="dialog"
          aria-label={`${ariaLabel} calendar`}
        >
          <div className="mb-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewDate(new Date(year, month - 1, 1))}
              tabIndex={-1}
              aria-label="Previous month"
              className="btn-ghost rounded-full p-2 text-leather-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <span className="text-sm font-semibold text-leather-300" aria-live="polite">
              {viewDate.toLocaleString("en", { month: "long", year: "numeric" })}
            </span>
            <button
              type="button"
              onClick={() => setViewDate(new Date(year, month + 1, 1))}
              tabIndex={-1}
              aria-label="Next month"
              className="btn-ghost rounded-full p-2 text-leather-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
            >
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>

          <div className="mb-2 grid grid-cols-7 gap-1 text-center" aria-hidden="true">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
              <span key={day} className="text-[10px] font-bold text-leather-50/70">{day}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((day, index) => day === null ? (
              <span key={`empty-${index}`} aria-hidden="true" />
            ) : (
              <button
                key={day}
                type="button"
                onClick={() => selectDate(new Date(year, month, day))}
                tabIndex={-1}
                disabled={isDisabled(day)}
                aria-label={new Date(year, month, day).toLocaleDateString("en", {
                  weekday: "long", month: "long", day: "numeric", year: "numeric",
                })}
                aria-pressed={Boolean(isSelected(day))}
                aria-current={isToday(day) ? "date" : undefined}
                className={clsx(
                  "flex h-8 w-full items-center justify-center rounded-full text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300",
                  isSelected(day)
                    ? "neo-active font-semibold"
                    : isToday(day)
                      ? "font-semibold text-primary-700 shadow-card-recess"
                      : "text-leather-200 hover:bg-[var(--bg)] hover:shadow-card-recess",
                  isDisabled(day) && "cursor-not-allowed opacity-35 hover:bg-transparent hover:shadow-none",
                  open && cursorDate.getFullYear() === year && cursorDate.getMonth() === month && cursorDate.getDate() === day && "ring-2 ring-primary-300"
                )}
              >
                {day}
              </button>
            ))}
          </div>
        </div>, document.body
      )}
    </div>
  );
}
