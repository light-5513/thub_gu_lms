import { useMemo, useState } from "react";
import { CheckCircle2, ListChecks, Mail, Trash2, UserPlus, XCircle } from "lucide-react";
import {
  useInviteByEmail,
  useInviteBulk,
  usePendingInvitations,
  useRevokeInvitation,
  type BulkInviteResult,
} from "@/api/hooks";
import { Badge, Card, CardHeader, EmptyState, Skeleton } from "@/components/ui/display";
import { Button, FormField, Input, Textarea } from "@/components/ui/forms";
import { ConfirmDialog, useToast } from "@/components/ui/overlays";
import { errorMessage } from "@/api/client";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Split pasted text on newlines, commas, semicolons or spaces. */
function parseEmails(text: string): string[] {
  return text
    .split(/[\n,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function InvitationsPage() {
  const toast = useToast();
  const invite = useInviteByEmail();
  const bulk = useInviteBulk();
  const pending = usePendingInvitations();
  const revoke = useRevokeInvitation();

  // single mode
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("STUDENT");
  const [phone, setPhone] = useState("");
  const [singleError, setSingleError] = useState("");
  

  // bulk mode
  const [bulkText, setBulkText] = useState("");
  const [bulkResults, setBulkResults] = useState<BulkInviteResult[] | null>(null);
  const [mode, setMode] = useState<"single" | "bulk">("single");

  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);

  const parsed = useMemo(() => parseEmails(bulkText), [bulkText]);
  const validEmails = useMemo(() => parsed.filter((e) => EMAIL_RE.test(e)), [parsed]);
  const invalidCount = parsed.length - validEmails.length;
  const uniqueValid = useMemo(() => Array.from(new Set(validEmails)), [validEmails]);

  const submitSingle = async () => {
    const clean = email.trim().toLowerCase();
    if (!EMAIL_RE.test(clean)) {
      setSingleError("Enter a valid email address");
      return;
    }
    setSingleError("");
    try {
      const res = await invite.mutateAsync({ email: clean, phone: phone.trim() || undefined });
      toast.push("success", res.message);
      
      setEmail("");
      setPhone("");
    } catch (err) {
      toast.push("error", errorMessage(err));
    }
  };

  const submitBulk = async () => {
    if (uniqueValid.length === 0) {
      toast.push("error", "Paste at least one valid email address");
      return;
    }
    try {
      const res = await bulk.mutateAsync(uniqueValid.slice(0, 500));
      setBulkResults(res.results);
      toast.push("success", `${res.sent} invitation(s) sent, ${res.failed} skipped/failed`);
      setBulkText("");
    } catch (err) {
      toast.push("error", errorMessage(err));
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5 animate-fade-in">
      <div>
        <h1 className="text-lg font-bold text-leather-300">Invitations</h1>
        <p className="text-xs leading-relaxed text-leather-50/80">
          Invite students by email — one at a time or paste a whole list. Each student receives a secure link to complete their own profile and choose their password.
        </p>
      </div>

      {/* Mode switch */}
      <div className="flex gap-1 rounded-[20px] bg-cream-300/60 p-1">
        {(
          [
            { key: "single", label: "Single email", icon: UserPlus },
            { key: "bulk", label: "Bulk paste", icon: ListChecks },
          ] as const
        ).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setMode(key)}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-2xl px-3 py-1.5 text-xs font-medium transition ${
              mode === key ? "bg-transparent text-leather-300 shadow-card-pill" : "text-leather-50/80 hover:text-leather-200"
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {mode === "single" ? (
          <Card>
            <CardHeader title="Invite by email" subtitle="The link expires in 7 days and can be used once" />
            <div className="space-y-3">
              <FormField label="Student email" error={singleError}>
                <Input
                  type="email"
                  placeholder="student@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitSingle()}
                  autoFocus
                />
              </FormField>
              <FormField label="Phone Number (Optional - for WhatsApp fallback)">
                <Input
                  type="text"
                  placeholder="+1234567890"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitSingle()}
                />
              </FormField>
            </div>
            <Button className="mt-4 w-full sm:w-auto" loading={invite.isPending} onClick={submitSingle}>
              <Mail size={15} /> Send invitation
            </Button>

        </Card>
      ) : (
        <Card>
          <CardHeader
            title="Invite many students"
            subtitle="Paste emails separated by new lines, commas or spaces (max 500)"
          />
          <Textarea
            rows={8}
            placeholder={"student1@example.com\nstudent2@example.com\nstudent3@example.com"}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
          />
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-leather-50/80">
            <span>{uniqueValid.length} valid</span>
            {invalidCount > 0 && <span className="text-black">{invalidCount} invalid will be ignored</span>}
            {parsed.length !== uniqueValid.length && <span>duplicates removed automatically</span>}
          </div>
          <Button className="mt-4 w-full sm:w-auto" loading={bulk.isPending} disabled={uniqueValid.length === 0} onClick={submitBulk}>
            <Mail size={15} /> Send {uniqueValid.length > 0 ? `${uniqueValid.length} ` : ""}invitations
          </Button>

          {bulk.isPending && <Skeleton className="mt-4 h-16 w-full" />}

          {bulkResults && (
            <div className="mt-4 max-h-64 space-y-1 overflow-y-auto rounded-[20px] bg-cream-100 p-3 ring-1 ring-transparent animate-fade-in">
              {bulkResults.map((r) => (
                <div key={r.email} className="flex items-center justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate text-leather-200">{r.email}</span>
                  {r.ok ? (
                    <Badge tone="green">
                      <CheckCircle2 size={11} /> sent
                    </Badge>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-black">
                      <XCircle size={12} /> {r.message}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <Card className="p-0">
        <div className="border-b border-transparent px-5 py-3.5">
          <h3 className="text-sm font-semibold text-leather-300">Pending invitations</h3>
          <p className="text-[11px] text-leather-50/80">Students who haven't completed registration yet</p>
        </div>
        {pending.isLoading ? (
          <Skeleton className="m-4 h-20" />
        ) : !pending.data || pending.data.length === 0 ? (
          <EmptyState title="No pending invitations." description="Sent invitations appear here until they're accepted." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {pending.data.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm text-leather-200">{inv.email}</p>
                  <p className="text-[11px] text-leather-50/80">
                    Sent {inv.created_at ? new Date(inv.created_at).toLocaleDateString() : "—"} · expires{" "}
                    {inv.expires_at ? new Date(inv.expires_at).toLocaleDateString() : "—"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="amber">pending</Badge>
                  <button
                    onClick={() => setRevokeTarget(inv.id)}
                    className="rounded-2xl p-1.5 text-leather-50/80 hover:bg-neutral-100 hover:text-black"
                    title="Revoke invitation"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={!!revokeTarget}
        title="Revoke this invitation?"
        message="The invitation link will stop working immediately."
        confirmLabel="Revoke"
        loading={revoke.isPending}
        onConfirm={() =>
          revokeTarget &&
          revoke.mutate(revokeTarget, {
            onSuccess: () => {
              toast.push("success", "Invitation revoked");
              setRevokeTarget(null);
            },
            onError: (e) => toast.push("error", errorMessage(e)),
          })
        }
        onCancel={() => setRevokeTarget(null)}
      />
    </div>
  );
}
