import { type ReactNode, useState } from "react";
import { clsx } from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";

// ---------------------------------------------------------------- Tabs
export function Tabs({ tabs, active, onChange }: { tabs: { key: string; label: string }[]; active: string; onChange: (key: string) => void }) {
  return (
    <div
      className="flex gap-1 overflow-x-auto rounded-2xl p-1 shadow-card-recess"
      role="tablist"
    >
      {tabs.map((tab) => (
        <button
          key={tab.key}
          role="tab"
          aria-selected={active === tab.key}
          onClick={() => onChange(tab.key)}
          className={clsx(
            "whitespace-nowrap rounded px-3.5 py-1.5 text-xs font-bold transition",
            active === tab.key
              ? "sk-pill text-leather-300"
              : "text-leather-50/80 hover:text-leather-200"
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
    <nav className="flex items-center justify-end gap-1" aria-label="Pagination">
      <button
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="btn-secondary rounded-2xl p-1.5 disabled:opacity-40"
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
            "h-8 min-w-8 rounded-2xl px-2 text-xs font-bold transition",
            p === page ? "btn-primary" : "btn-secondary"
          )}
        >
          {p}
        </button>
      ))}
      <button
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        className="btn-secondary rounded-2xl p-1.5 disabled:opacity-40"
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
    <div className={clsx("overflow-x-auto", className)}>
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-leather-50/20">
            {headers.map((h, i) => (
              <th key={i} scope="col" className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-leather-300">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-leather-50/10">{children}</tbody>
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
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-2xl border border-leather-500/50 px-2 py-1 text-[11px] font-bold text-white group-hover:block"
        style={{
          backgroundImage: "linear-gradient(180deg, #0e1116 0%, #0a0c10 100%)",
          boxShadow: "0 4px 12px rgba(0,0,0,0.30)",
        }}
      >
        {label}
      </span>
    </span>
  );
}

// ---------------------------------------------------------------- Dropdown
export function Dropdown({ trigger, children, align = "right" }: { trigger: ReactNode; children: (close: () => void) => ReactNode; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <div onClick={() => setOpen((o) => !o)}>{trigger}</div>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div
            className={clsx(
              "absolute z-30 top-0 w-52 animate-fade-in overflow-hidden rounded-2xl border border-leather-50/15 py-1 shadow-card-pop",
              align === "right" ? "right-full mr-2" : "left-full ml-2"
            )}
            style={{ backgroundColor: "var(--bg)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {children(() => setOpen(false))}
          </div>
        </>
      )}
    </div>
  );
}

export function DropdownItem({ children, onClick, danger }: { children: ReactNode; onClick?: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs font-semibold transition-colors",
        danger
          ? "text-leather-200 hover:bg-neutral-100"
          : "text-leather-200 hover:bg-cream-200"
      )}
    >
      {children}
    </button>
  );
}
