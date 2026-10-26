import { cloneElement, isValidElement, type ButtonHTMLAttributes, type KeyboardEvent, type ReactNode, useCallback, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { clsx } from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useAnchoredPopover } from "./useAnchoredPopover";

// ---------------------------------------------------------------- Tabs
export function Tabs({ tabs, active, onChange }: { tabs: { key: string; label: string }[]; active: string; onChange: (key: string) => void }) {
  return (
    <div
      className="neo-inset-surface flex min-w-0 max-w-full gap-1 overflow-x-auto rounded-full p-1"
      role="tablist"
    >
      {tabs.map((tab) => (
        <button
          key={tab.key}
          role="tab"
          aria-selected={active === tab.key}
          onClick={() => onChange(tab.key)}
          className={clsx(
            "whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition-colors",
            active === tab.key
              ? "neo-active"
              : "text-leather-50 hover:bg-[var(--bg)] hover:shadow-card-recess hover:text-leather-200"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- Pagination
export function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  const pages: number[] = [];
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  for (let i = start; i <= Math.min(totalPages, start + 4); i++) pages.push(i);

  return (
    <nav className="flex items-center justify-end gap-1.5" aria-label="Pagination">
      <button
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="btn-secondary flex h-9 w-9 items-center justify-center rounded-full disabled:opacity-40"
        aria-label="Previous page"
      >
        <ChevronLeft size={16} />
      </button>
      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          aria-current={p === page ? "page" : undefined}
          className={clsx(
            "h-9 min-w-9 rounded-full px-2 text-xs font-semibold transition-colors",
            p === page ? "neo-active" : "btn-secondary"
          )}
        >
          {p}
        </button>
      ))}
      <button
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        className="btn-secondary flex h-9 w-9 items-center justify-center rounded-full disabled:opacity-40"
        aria-label="Next page"
      >
        <ChevronRight size={16} />
      </button>
    </nav>
  );
}

// ---------------------------------------------------------------- Table
export function Table({ headers, children, className }: { headers: ReactNode[]; children: ReactNode; className?: string }) {
  return (
    <div className={clsx("overflow-x-auto rounded-[inherit]", className)}>
      <table className="w-full min-w-[600px] text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--panel)]">
            {headers.map((h, i) => (
              <th key={i} scope="col" className="whitespace-nowrap px-4 py-3 text-[11px] font-semibold tracking-wide text-leather-50">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">{children}</tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------- Tooltip (CSS-only)
export function Tooltip({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        className="neo-popover pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-xl px-2.5 py-1.5 text-xs font-medium text-leather-200 group-hover:block group-focus-within:block"
      >
        {label}
      </span>
    </span>
  );
}

// ---------------------------------------------------------------- Dropdown
export function Dropdown({ trigger, children, align = "right", menuWidth = 208, label }: {
  trigger: ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "left" | "right";
  menuWidth?: number;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const { popoverRef: menuRef, style } = useAnchoredPopover(open, triggerRef, { minWidth: menuWidth, maxHeight: 360, align: align === "right" ? "end" : "start" });
  const initialFocus = useRef<"first" | "last">("first");
  const hasFocused = useRef(false);
  const searchRef = useRef({ value: "", time: 0 });
  const menuId = useId();
  const triggerId = `${menuId}-trigger`;
  const focusTrigger = useCallback(() => {
    triggerRef.current?.querySelector<HTMLElement>("button, a, [tabindex]")?.focus();
  }, []);
  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    hasFocused.current = false;
    if (restoreFocus) focusTrigger();
  }, [focusTrigger]);
  const menuItems = () => Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled]):not([aria-disabled="true"])') ?? []);

  useLayoutEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) close(false);
    };
    const onFocus = (event: FocusEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) close(false);
    };
    const onEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("keydown", onEscape, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("keydown", onEscape, true);
    };
  }, [open, close]);

  useLayoutEffect(() => {
    if (!open || style.visibility !== "visible" || hasFocused.current) return;
    const frame = requestAnimationFrame(() => {
      const items = menuItems();
      const item = initialFocus.current === "last" ? items[items.length - 1] : items[0];
      item?.focus({ preventScroll: true });
      hasFocused.current = Boolean(item && document.activeElement === item);
    });
    return () => cancelAnimationFrame(frame);
  }, [open, style.visibility]);

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = menuItems();
    const current = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (event.key === "Tab") {
      close();
      return;
    }
    if (event.key === " " && document.activeElement?.tagName === "A") {
      event.preventDefault();
      (document.activeElement as HTMLElement).click();
      return;
    }
    let next: number | undefined;
    if (event.key === "ArrowDown") next = (current + 1) % items.length;
    if (event.key === "ArrowUp") next = (current - 1 + items.length) % items.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = items.length - 1;
    if (next !== undefined) {
      event.preventDefault();
      items[next]?.focus();
    } else if (event.key.length === 1 && event.key !== " " && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      const now = Date.now();
      const previous = now - searchRef.current.time < 600 ? searchRef.current.value : "";
      const value = previous === event.key.toLowerCase() ? previous : previous + event.key.toLowerCase();
      searchRef.current = { value, time: now };
      const ordered = [...items.slice(current + 1), ...items.slice(0, current + 1)];
      ordered.find((item) => item.textContent?.trim().toLowerCase().startsWith(value))?.focus();
    }
  };

  const accessibleTrigger = isValidElement<ButtonHTMLAttributes<HTMLButtonElement>>(trigger)
    ? cloneElement(trigger, {
      id: trigger.props.id || triggerId,
      "aria-haspopup": "menu",
      "aria-expanded": open,
      "aria-controls": open ? menuId : undefined,
    })
    : trigger;

  return (
    <>
      <div
        ref={triggerRef}
        className="relative inline-flex"
        onClick={() => {
          initialFocus.current = "first";
          if (open) close();
          else setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            initialFocus.current = event.key === "ArrowUp" ? "last" : "first";
            setOpen(true);
          }
        }}
      >
        {accessibleTrigger}
      </div>
      {open && createPortal(
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          aria-labelledby={label ? undefined : (isValidElement<ButtonHTMLAttributes<HTMLButtonElement>>(trigger) && trigger.props.id) || triggerId}
          className="neo-popover fixed z-[1000] overflow-y-auto overscroll-contain rounded-2xl p-2 transition-none"
          style={style}
          onKeyDown={onMenuKeyDown}
        >
          {children(close)}
        </div>,
        document.body
      )}
    </>
  );
}

export const dropdownItemClasses = "flex w-full items-center gap-2.5 rounded-full px-3.5 py-2.5 text-left text-sm font-medium transition-colors hover:shadow-card-recess focus-visible:shadow-card-recess focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

export function DropdownItem({ children, onClick, danger, disabled }: { children: ReactNode; onClick?: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        dropdownItemClasses,
        danger
          ? "text-danger-700 hover:text-danger-700 focus-visible:text-danger-700"
          : "text-leather-200 hover:text-primary-600 focus-visible:text-primary-600"
      )}
    >
      {children}
    </button>
  );
}
