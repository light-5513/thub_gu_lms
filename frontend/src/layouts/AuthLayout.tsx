import type { ReactNode } from "react";

/**
 * AuthLayout: dark industrial oscilloscope chassis.
 * Brand strip header, dark panel, LCD-style form area.
 */
export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10" style={{ backgroundColor: "var(--bg)" }}>
      <div className="w-full max-w-md">

        {/* Chassis */}
        <div
          className="rounded-b-2xl p-6"
          style={{
            backgroundColor: "var(--panel)",
            boxShadow: "var(--neo-out)",
            border: "1px solid rgba(255, 255, 255, 0.04)",
            borderTop: "none",
          }}
        >
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
              <img 
                src="/logo.png" 
                alt="Technical Hub" 
                className="h-16 w-auto object-contain mb-2 drop-shadow-card-pill" 
              />
            <div>
              <h1
                className="text-2xl font-extrabold tracking-tight"
                style={{ color: "var(--text)", fontFamily: "Outfit, sans-serif" }}
              >
                Learning Management System
              </h1>
            </div>
          </div>

          {/* LCD form area */}
          <div className="lcd p-5">
            <h2 className="text-base font-bold" style={{ color: "var(--text)" }}>{title}</h2>
            {subtitle && <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text)" }}>{subtitle}</p>}
            <div className="mt-5">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}