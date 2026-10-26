import type { ReactNode } from "react";

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-cream-100 px-4 py-10 sm:px-6">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <img src="/logo.png" alt="Technical Hub" className="mx-auto mb-4 h-12 w-auto object-contain" />
          <p className="text-sm font-semibold text-[var(--text-muted)]">Learning Management System</p>
        </div>
        <section className="card-lg p-6 sm:p-8">
          <header className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">{title}</h1>
            {subtitle && <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">{subtitle}</p>}
          </header>
          {children}
        </section>
      </div>
    </main>
  );
}
