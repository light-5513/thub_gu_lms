import { useState } from "react";
import { MonitorPlay, Search } from "lucide-react";
import { useSandboxToken } from "@/api/hooks";
import { errorMessage } from "@/api/client";
import { useToast } from "@/components/ui/overlays";

export function SandboxPage() {
  const [rollNumber, setRollNumber] = useState("");
  const [sandboxToken, setSandboxToken] = useState<string | null>(null);
  const getSandboxToken = useSandboxToken();
  const toast = useToast();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rollNumber.trim()) return;

    getSandboxToken.mutate(rollNumber.trim(), {
      onSuccess: (data) => {
        setSandboxToken(data.access_token);
        toast.push("success", `Now impersonating ${rollNumber.trim().toUpperCase()}`);
      },
      onError: (err) => {
        toast.push("error", errorMessage(err));
        setSandboxToken(null);
      },
    });
  };

  return (
    <div className="flex h-full flex-col gap-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <MonitorPlay className="text-leather-300" size={24} />
        <h1 className="page-title">Student Sandbox</h1>
      </div>

      <div className="card p-4">
        <form onSubmit={handleSearch} className="flex gap-2 max-w-md relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-leather-50/80" />
          <input
            placeholder="Enter Roll Number to impersonate..."
            value={rollNumber}
            onChange={(e) => setRollNumber(e.target.value)}
            className="w-full rounded-full border border-white/30 bg-[var(--bg)] py-2.5 pl-9 pr-3 text-sm text-[var(--text)] shadow-card-recess placeholder:text-[var(--text-dim)] focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
          <button
            type="submit"
            disabled={getSandboxToken.isPending}
            className="btn-primary rounded-full px-5 py-2 text-sm disabled:opacity-50"
          >
            {getSandboxToken.isPending ? "Starting..." : "Impersonate"}
          </button>
        </form>
      </div>

      {sandboxToken ? (
        <div className="card min-h-[700px] flex-1 overflow-hidden">
          <iframe
            src={`/student/dashboard?sandbox_token=${sandboxToken}`}
            className="w-full h-full border-0"
            title="Student Sandbox"
          />
        </div>
      ) : (
        <div className="neo-inset-surface flex min-h-[500px] flex-1 flex-col items-center justify-center rounded-3xl px-6 text-center">
          <div className="sk-icon-disc mb-5 flex h-16 w-16 items-center justify-center rounded-full"><MonitorPlay size={28} /></div>
          <p className="font-semibold text-[var(--text)]">Enter a Roll Number to launch the sandbox</p>
          <p className="mt-2 max-w-sm text-sm text-[var(--text-muted)]">
            This will open the student's dashboard in a secure, isolated view without logging you out of your admin session.
          </p>
        </div>
      )}
    </div>
  );
}
