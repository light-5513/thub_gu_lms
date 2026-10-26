import { type ReactNode } from "react";
import { clsx } from "clsx";

// ---------------------------------------------------------------- Card
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx("card card-content", className)}>{children}</div>;
}

export function CardHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-base font-semibold text-leather-300">{title}</h3>
        {subtitle && <p className="mt-0.5 text-sm text-leather-50">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------- StatCard
export function StatCard({
  label,
  value,
  icon,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  hint?: string;
  tone?: "default" | "success" | "warning" | "danger" | "info";
}) {
  const iconTones: Record<string, string> = {
    default: "text-leather-100",
    success: "text-success-700",
    warning: "text-warning-700",
    danger: "text-danger-700",
    info: "text-info-700",
  };
  return (
    <div className="card flex min-h-28 items-center gap-4 p-5">
      {icon && (
        <div className={clsx(
          "sk-icon-disc flex h-12 w-12 shrink-0 items-center justify-center rounded-full 2xl:h-[3.75rem] 2xl:w-[3.75rem]",
          iconTones[tone]
        )}>
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase text-leather-50">{label}</p>
        <p className="mt-1 text-2xl font-semibold leading-tight text-leather-300">{value}</p>
        {hint && <p className="mt-1 text-xs leading-relaxed text-leather-50">{hint}</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Badge
const badgeTones: Record<string, string> = {
  gray: "text-leather-100",
  green: "text-success-700",
  red: "text-danger-700",
  amber: "text-warning-700",
  blue: "text-info-700",
  purple: "text-violet-700",
};

export function Badge({ children, tone = "gray", className }: { children: ReactNode; tone?: keyof typeof badgeTones; className?: string }) {
  return (
    <span className={clsx(
      "sk-pill inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium leading-none",
      badgeTones[tone], className
    )}>
      {children}
    </span>
  );
}

// ---------------------------------------------------------------- ProgressBar
export function ProgressBar({ value, max = 100, tone }: { value: number; max?: number; tone?: "auto" | "blue" }) {
  const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  const color = tone === "blue"
    ? "bg-gradient-to-b from-info-100 to-info-700"
    : pct >= 75
      ? "bg-gradient-to-b from-success-100 to-success-700"
      : pct >= 50
        ? "bg-gradient-to-b from-warning-100 to-warning-700"
        : "bg-gradient-to-b from-danger-100 to-danger-700";
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg)] shadow-card-recess"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
    >
      <div className={clsx("h-full rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] transition-[width] duration-200 ease-out", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ---------------------------------------------------------------- Skeletons
export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-xl bg-gradient-to-br from-white/55 to-slate-300/35 shadow-card-recess", className)} />;
}

export function StatCardSkeleton() {
  return (
    <div className="card flex min-h-28 items-center gap-4 p-5">
      <Skeleton className="h-12 w-12 shrink-0 rounded-full 2xl:h-[3.75rem] 2xl:w-[3.75rem]" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-5 w-16" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
          {Array.from({ length: cols }).map((__, c) => (
            <Skeleton key={c} className="h-4 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- Empty & Error states
export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && (
        <div className="sk-icon-disc mb-4 flex h-12 w-12 items-center justify-center rounded-full text-leather-50">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-semibold text-leather-300">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-leather-50">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <EmptyState
      title="We couldn't load this right now."
      description={message}
      action={
        onRetry ? (
          <button onClick={onRetry} className="btn-secondary rounded-full px-4 py-2 text-xs font-semibold">
            Try again
          </button>
        ) : undefined
      }
    />
  );
}

// ---------------------------------------------------------------- Data Row
export function Row({ label, value, dot }: { label: string; value: number | string; dot: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="inline-flex items-center gap-1.5 capitalize text-leather-200 text-xs">
        <span className={`h-2 w-2 rounded-full ${dot}`} /> {label}
      </dt>
      <dd className="font-semibold text-leather-300 text-xs">{value}</dd>
    </div>
  );
}
