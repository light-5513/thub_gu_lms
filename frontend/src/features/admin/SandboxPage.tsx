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
        <h1 className="text-lg font-bold text-leather-300">Student Sandbox</h1>
      </div>

      <div className="rounded-3xl bg-white p-4 shadow-sm">
        <form onSubmit={handleSearch} className="flex gap-2 max-w-md relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-leather-50/80" />
          <input
            placeholder="Enter Roll Number to impersonate..."
            value={rollNumber}
            onChange={(e) => setRollNumber(e.target.value)}
            className="w-full rounded-[20px] border border-transparent bg-cream-100 py-2 pl-9 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-black"
          />
          <button
            type="submit"
            disabled={getSandboxToken.isPending}
            className="rounded-[20px] bg-leather-300 px-4 py-2 text-sm font-bold text-white hover:bg-leather-400 focus:outline-none disabled:opacity-50 transition"
          >
            {getSandboxToken.isPending ? "Starting..." : "Impersonate"}
          </button>
        </form>
      </div>

      {sandboxToken ? (
        <div className="flex-1 rounded-3xl overflow-hidden bg-white shadow-sm border border-leather-300/10 min-h-[700px]">
          <iframe
            src={`/student/dashboard?sandbox_token=${sandboxToken}`}
            className="w-full h-full border-0"
            title="Student Sandbox"
          />
        </div>
      ) : (
        <div className="flex-1 rounded-3xl bg-cream-100/50 border-2 border-dashed border-leather-300/20 flex flex-col items-center justify-center min-h-[500px]">
          <MonitorPlay className="text-leather-300/30 mb-4" size={48} />
          <p className="text-leather-300/60 font-bold">Enter a Roll Number to launch the sandbox</p>
          <p className="text-sm text-leather-300/40 mt-1 max-w-sm text-center">
            This will open the student's dashboard in a secure, isolated view without logging you out of your admin session.
          </p>
        </div>
      )}
    </div>
  );
}
