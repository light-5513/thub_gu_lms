import { type ReactNode } from "react";
import { clsx } from "clsx";

// ---------------------------------------------------------------- Card
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx("card p-5", className)}>{children}</div>;
}

export function CardHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h3 className="text-sm font-bold text-leather-300">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-leather-50/80">{subtitle}</p>}
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
    default: "text-leather-200",
    success: "text-primary-500",
    warning: "text-leather-300",
    danger:  "text-leather-200",
    info:    "text-primary-500",
  };
  return (
    <div className="card flex items-center gap-4 p-4 transition-shadow-card hover:shadow-card-lg">
      {icon && (
        <div className={clsx(
          "sk-icon-disc flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--bg)]",
          iconTones[tone]
        )}>
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-[10px] font-bold uppercase tracking-wider text-leather-50/80">{label}</p>
        <p className="text-xl font-bold text-leather-300">{value}</p>
        {hint && <p className="text-[11px] text-leather-50/70">{hint}</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Badge
const badgeTones: Record<string, string> = {
  gray:   "text-leather-300",
  green:  "text-primary-500",
  red:    "text-primary-800",
  amber:  "text-leather-300",
  blue:   "text-primary-500",
  purple: "text-purple-500",
};

export function Badge({ children, tone = "gray", className }: { children: ReactNode; tone?: keyof typeof badgeTones; className?: string }) {
  return (
    <span className={clsx(
      "sk-pill inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold",
      badgeTones[tone], className
    )}>
      {children}
    </span>
  );
}

// ---------------------------------------------------------------- ProgressBar
export function ProgressBar({ value, max = 100, tone }: { value: number; max?: number; tone?: "auto" | "blue" }) {
  const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  const color =
    tone === "blue"
      ? "bg-gradient-to-b from-blue-400 to-blue-700"
      : pct >= 75
        ? "bg-gradient-to-b from-emerald-400 to-emerald-700"
        : pct >= 50
          ? "bg-gradient-to-b from-amber-400 to-amber-700"
          : "bg-gradient-to-b from-red-400 to-red-700";
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-gradient-to-b from-cream-200 to-cream-300 shadow-card-recess"
      role="progressbar"
      aria-valuenow={pct}
    >
      <div className={clsx("h-full rounded-full transition-all duration-500 shadow-card-[inset_0_1px_0_rgba(255,255,255,0.4)]", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ---------------------------------------------------------------- Skeletons
export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-2xl bg-gradient-to-b from-cream-200 to-cream-300", className)} />;
}

export function StatCardSkeleton() {
  return (
    <div className="card flex items-center gap-4 p-4">
      <Skeleton className="h-12 w-12 rounded-full" />
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
        <div className="sk-icon-disc mb-4 flex h-14 w-14 items-center justify-center rounded-full text-leather-50/70">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-bold text-leather-300">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-xs text-leather-50/80">{description}</p>}
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
          <button onClick={onRetry} className="btn-secondary rounded-2xl px-3 py-1.5 text-xs font-bold">
            Try again
          </button>
        ) : undefined
      }
    />
  );
}
