import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { CheckCircle2, Download, FileSpreadsheet, ListChecks, Mail, MessageCircle, QrCode, Trash2, Upload, UserPlus, XCircle } from "lucide-react";
import {
  useCreateInvitation,
  useInviteBulk,
  useParseInvitationUpload,
  usePendingInvitations,
  useRevokeInvitation,
  useWhatsAppConnectionStatus,
  type BulkInviteResult,
  type InvitationChannel,
} from "@/api/hooks";
import { Badge, Card, CardHeader, EmptyState, ErrorState, Skeleton } from "@/components/ui/display";
import { Button, FormField, Input, Textarea } from "@/components/ui/forms";
import { ConfirmDialog, useToast } from "@/components/ui/overlays";
import { errorMessage } from "@/api/client";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type InviteRecipient = { email: string; phone?: string };

function deliveryTone(status?: string | null): "green" | "red" | "blue" | "amber" {
  if (status === "sent") return "green";
  if (status === "failed") return "red";
  if (status === "queued" || status === "sending") return "blue";
  return "amber";
}

/** Parse email[,phone] rows; commas, semicolons and tabs delimit fields. */
function parseRecipients(text: string, requirePhone: boolean): { valid: InviteRecipient[]; invalidCount: number; duplicateCount: number } {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const valid: InviteRecipient[] = [];
  const seen = new Set<string>();
  let invalidCount = 0;
  let duplicateCount = 0;

  for (const line of lines) {
    const [rawEmail = "", rawPhone = "", ...extra] = line.split(/[,;\t]/).map((part) => part.trim());
    if (rawEmail.toLowerCase() === "email" && rawPhone.toLowerCase().startsWith("phone")) continue;
    const email = rawEmail.toLowerCase();
    const digits = rawPhone.replace(/\D/g, "");
    const phoneValid = digits.length >= 8 && digits.length <= 15;
    if (extra.length || !EMAIL_RE.test(email) || (requirePhone && !phoneValid) || (rawPhone && !phoneValid)) {
      invalidCount += 1;
      continue;
    }
    if (seen.has(email)) {
      duplicateCount += 1;
      continue;
    }
    seen.add(email);
    valid.push({ email, ...(phoneValid ? { phone: rawPhone } : {}) });
  }
  return { valid, invalidCount, duplicateCount };
}

export function InvitationsPage() {
  const toast = useToast();
  const invite = useCreateInvitation();
  const bulk = useInviteBulk();
  const parseUpload = useParseInvitationUpload();
  const pending = usePendingInvitations();
  const revoke = useRevokeInvitation();

  // single mode
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [singleError, setSingleError] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [sendWhatsApp, setSendWhatsApp] = useState(true);
  const [connectWhatsApp, setConnectWhatsApp] = useState(false);
  const whatsapp = useWhatsAppConnectionStatus(sendWhatsApp && connectWhatsApp);

  // bulk mode
  const [bulkText, setBulkText] = useState("");
  const [bulkResults, setBulkResults] = useState<BulkInviteResult[] | null>(null);
  const [uploadSummary, setUploadSummary] = useState("");
  const [uploadIssues, setUploadIssues] = useState<Array<{ row: number; message: string }>>([]);
  const uploadInput = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"single" | "bulk">("single");

  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);

  const parsed = useMemo(() => parseRecipients(bulkText, sendWhatsApp), [bulkText, sendWhatsApp]);
  const channels: InvitationChannel[] = [
    ...(sendEmail ? ["email" as const] : []),
    ...(sendWhatsApp ? ["whatsapp" as const] : []),
  ];

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const fileInput = event.currentTarget;
    const file = fileInput.files?.[0];
    if (!file) return;
    setUploadSummary("");
    setUploadIssues([]);
    try {
      const result = await parseUpload.mutateAsync(file);
      const rows = result.items.map(({ email: address, phone: number }) =>
        number ? `${address},${number}` : address,
      );
      setBulkText((current) => [current.trim(), rows.join("\n")].filter(Boolean).join("\n"));
      setUploadIssues(result.invalid_rows);
      setUploadSummary(
        rows.length
          ? `Added ${rows.length} row${rows.length === 1 ? "" : "s"} for review${result.invalid_rows.length ? `; ${result.invalid_rows.length} row${result.invalid_rows.length === 1 ? " was" : "s were"} skipped` : ""}.`
          : "No usable recipients found in this file.",
      );
    } catch (error) {
      toast.push("error", errorMessage(error));
    } finally {
      fileInput.value = "";
    }
  };

  const submitSingle = async () => {
    const clean = email.trim().toLowerCase();
    if (!EMAIL_RE.test(clean)) {
      setSingleError("Enter a valid email address");
      return;
    }
    if (channels.length === 0) {
      toast.push("warning", "Select email, WhatsApp, or both delivery channels");
      return;
    }
    const phoneDigits = phone.replace(/\D/g, "");
    if (sendWhatsApp && (phoneDigits.length < 8 || phoneDigits.length > 15)) {
      toast.push("error", "Enter a WhatsApp number with country code, such as +919876543210");
      return;
    }
    setSingleError("");
    if (sendWhatsApp) setConnectWhatsApp(true);
    try {
      const res = await invite.mutateAsync({
        email: clean,
        phone: sendWhatsApp ? phone.trim() : undefined,
        channels,
      });
      toast.push(res.partial ? "warning" : "success", res.message);
      
      setEmail("");
      setPhone("");
    } catch (err) {
      toast.push("error", errorMessage(err));
    }
  };

  const submitBulk = async () => {
    if (channels.length === 0) {
      toast.push("warning", "Select email, WhatsApp, or both delivery channels");
      return;
    }
    if (parsed.valid.length === 0) {
      toast.push("error", sendWhatsApp ? "Paste at least one valid email and WhatsApp number" : "Paste at least one valid email address");
      return;
    }
    if (parsed.valid.length > 500) {
      toast.push("error", "Reduce the list to 500 recipients or fewer before sending");
      return;
    }
    if (sendWhatsApp) setConnectWhatsApp(true);
    try {
      const res = await bulk.mutateAsync({ recipients: parsed.valid.slice(0, 500), channels });
      setBulkResults(res.results);
      toast.push(
        res.failed > 0 || res.partial > 0 ? "warning" : "success",
        `${res.accepted} invitation(s) sent or queued; ${res.partial} partial; ${res.failed} failed.`,
      );
      setBulkText("");
    } catch (err) {
      toast.push("error", errorMessage(err));
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5 animate-fade-in">
      <div>
        <h1 className="page-title">Invitations</h1>
        <p className="page-description max-w-3xl">
          Send each student a secure setup link by email, WhatsApp, or both. They complete their profile and choose their own password.
        </p>
      </div>

      <Card>
        <CardHeader title="Delivery channels" subtitle="Choose how students receive their setup link. Both are selected by default." />
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-leather-200">
            <input
              type="checkbox"
              className="h-4 w-4 accent-teal-700"
              checked={sendEmail}
              onChange={(event) => setSendEmail(event.target.checked)}
            />
            <Mail size={15} /> Email invitation
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-leather-200">
            <input
              type="checkbox"
              className="h-4 w-4 accent-teal-700"
              checked={sendWhatsApp}
              onChange={(event) => setSendWhatsApp(event.target.checked)}
            />
            <MessageCircle size={15} /> WhatsApp invitation
          </label>
        </div>
      </Card>

      {sendWhatsApp && <Card>
        <CardHeader title="WhatsApp connection" subtitle="Connect the sender account, then scan the QR code once." />
        {!connectWhatsApp ? (
          <div className="space-y-3">
            <p className="text-sm text-leather-100">Connect WhatsApp when you are ready to send invitations.</p>
            <Button type="button" size="sm" variant="secondary" onClick={() => setConnectWhatsApp(true)}>Connect WhatsApp</Button>
          </div>
        ) : whatsapp.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : whatsapp.isError ? (
          <p className="text-sm text-warning-700">Could not load WhatsApp connection status. Refresh the page and try again.</p>
        ) : whatsapp.data?.state === "ready" ? (
          <div className="flex items-center gap-2 text-sm text-success-700">
            <CheckCircle2 size={17} /> WhatsApp is connected and ready to send invitations.
            {whatsapp.data.session_saved === false && <span className="text-xs text-leather-50">Saving session…</span>}
          </div>
        ) : whatsapp.data?.qr_data_url ? (
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <img src={whatsapp.data.qr_data_url} alt="WhatsApp link-device QR code" className="h-[180px] w-[180px] rounded-xl bg-white p-2" />
            <div className="space-y-1 text-sm text-leather-100">
              <p className="inline-flex items-center gap-2 font-medium text-leather-300"><QrCode size={16} /> Scan with the WhatsApp account that will send invitations.</p>
              <p>On the phone, open WhatsApp → Linked devices → Link a device.</p>
              <p className="text-xs">This panel refreshes automatically while the QR code is active.</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-warning-700">
            {whatsapp.data?.state === "unconfigured"
              ? "WhatsApp service is not configured. Set WHATSAPP_API_URL and WHATSAPP_API_TOKEN in the app environment."
              : whatsapp.data?.state === "unavailable"
                ? "WhatsApp service is unavailable or waking up. Wait a moment and try again."
                : whatsapp.data?.state === "error"
                  ? "WhatsApp could not connect. The service will retry shortly."
                : `WhatsApp status: ${whatsapp.data?.state || "connecting"}. Keep this page open; the QR code will appear when ready.`}
            {whatsapp.data?.error && <span className="mt-1 block text-xs">{whatsapp.data.error}</span>}
          </p>
        )}
        {connectWhatsApp && whatsapp.data?.state === "ready" && whatsapp.data.session_error && (
          <p className="mt-2 text-xs text-warning-700">WhatsApp is connected, but session backup needs attention: {whatsapp.data.session_error}</p>
        )}
      </Card>}

      {/* Mode switch */}
      <div className="neo-inset-surface flex gap-1 rounded-full p-1">
        {(
          [
            { key: "single", label: "Single invite", icon: UserPlus },
            { key: "bulk", label: "Bulk invite", icon: ListChecks },
          ] as const
        ).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setMode(key)}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-2xl px-3 py-1.5 text-xs font-medium transition ${
              mode === key ? "neo-active rounded-full" : "rounded-full text-[var(--text-muted)] hover:bg-[var(--bg)] hover:shadow-card-recess hover:text-[var(--text)]"
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {mode === "single" ? (
          <Card>
            <CardHeader title="Send an invitation" subtitle="The link expires in 7 days and can be used once" />
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
              {sendWhatsApp && (
                <FormField label="WhatsApp number (include country code)">
                  <Input
                    type="tel"
                    placeholder="+919876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitSingle()}
                    required
                  />
                </FormField>
              )}
            </div>
            <Button className="mt-4 w-full sm:w-auto" loading={invite.isPending} disabled={channels.length === 0} onClick={submitSingle}>
              {sendWhatsApp && !sendEmail ? <MessageCircle size={15} /> : sendEmail && !sendWhatsApp ? <Mail size={15} /> : <UserPlus size={15} />}
              Send invitation
            </Button>

        </Card>
      ) : (
        <Card>
          <CardHeader
            title="Invite many students"
            subtitle={sendWhatsApp
              ? "One recipient per line: email, international phone number (max 500)"
              : "One student email per line (max 500)"}
          />
          <div className="mb-3 rounded-2xl border border-dashed border-teal-700/30 bg-[var(--bg)] px-4 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-700/10 text-teal-800">
                  <FileSpreadsheet size={18} />
                </span>
                <div>
                  <p className="text-sm font-medium text-leather-300">Upload a recipient file</p>
                  <p className="text-xs text-leather-50/80">CSV or Excel (.xlsx), up to 500 rows and 2 MB</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={uploadInput}
                  type="file"
                  accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="sr-only"
                  onChange={handleUpload}
                  aria-label="Choose CSV or Excel invitation file"
                />
                <Button type="button" size="sm" variant="secondary" loading={parseUpload.isPending} onClick={() => uploadInput.current?.click()}>
                  <Upload size={14} /> Choose file
                </Button>
                <a className="inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-xs font-medium text-teal-800 hover:bg-teal-700/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700" href="/templates/invitations-template.csv" download>
                  <Download size={13} /> CSV sample
                </a>
                <a className="inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-xs font-medium text-teal-800 hover:bg-teal-700/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700" href="/templates/invitations-template.xlsx" download>
                  <Download size={13} /> Excel sample
                </a>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-leather-50/80">Use <strong>email</strong> and optional <strong>phone</strong> columns. WhatsApp requires a phone number for every recipient. Uploaded rows are added below so you can review them before sending.</p>
            {uploadSummary && <p role="status" className="mt-2 text-xs font-medium text-teal-800">{uploadSummary}</p>}
            {uploadIssues.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-[11px] text-warning-700" aria-label="Skipped upload rows">
                {uploadIssues.slice(0, 3).map((issue) => <li key={`${issue.row}-${issue.message}`}>Row {issue.row}: {issue.message}</li>)}
                {uploadIssues.length > 3 && <li>And {uploadIssues.length - 3} more skipped rows.</li>}
              </ul>
            )}
          </div>
          <Textarea
            rows={8}
            placeholder={sendWhatsApp
              ? "student1@example.com,+919876543210\nstudent2@example.com,+919876543211"
              : "student1@example.com\nstudent2@example.com"}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
          />
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-leather-50/80">
            <span>{parsed.valid.length} valid</span>
            {parsed.valid.length > 500 && <span className="font-medium text-warning-700">Remove {parsed.valid.length - 500} row(s) to stay within the 500 recipient limit</span>}
            {parsed.invalidCount > 0 && <span className="font-medium text-warning-700">{parsed.invalidCount} invalid rows will be ignored</span>}
            {parsed.duplicateCount > 0 && <span>{parsed.duplicateCount} duplicate email(s) removed</span>}
          </div>
          <Button className="mt-4 w-full sm:w-auto" loading={bulk.isPending} disabled={channels.length === 0 || parsed.valid.length === 0 || parsed.valid.length > 500 || parseUpload.isPending} onClick={submitBulk}>
            {sendWhatsApp && !sendEmail ? <MessageCircle size={15} /> : sendEmail && !sendWhatsApp ? <Mail size={15} /> : <UserPlus size={15} />}
            Send {parsed.valid.length > 0 ? `${parsed.valid.length} ` : ""}invitations
          </Button>

          {bulk.isPending && <Skeleton className="mt-4 h-16 w-full" />}

          {bulkResults && (
            <div className="neo-inset-surface mt-4 max-h-64 space-y-1 overflow-y-auto rounded-2xl p-4 animate-fade-in">
              {bulkResults.map((r) => (
                <div key={r.email} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate text-leather-200">{r.email}</span>
                  {r.ok ? (
                    <div className="flex flex-wrap items-center gap-1">
                      {r.channels?.email && <Badge tone={deliveryTone(r.channels.email)}><Mail size={11} /> Email {r.channels.email}</Badge>}
                      {r.channels?.whatsapp && <Badge tone={deliveryTone(r.channels.whatsapp)}><MessageCircle size={11} /> WhatsApp {r.channels.whatsapp}</Badge>}
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-danger-700">
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
        ) : pending.isError ? (
          <ErrorState message={errorMessage(pending.error)} onRetry={() => { void pending.refetch(); }} />
        ) : !pending.data || pending.data.length === 0 ? (
          <EmptyState title="No pending invitations." description="Queued invitations stay here until students accept or the links expire." />
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {pending.data.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm text-leather-200">{inv.email}</p>
                  <p className="text-[11px] text-leather-50/80">
                    Created {inv.created_at ? new Date(inv.created_at).toLocaleDateString() : "—"} · expires{" "}
                    {inv.expires_at ? new Date(inv.expires_at).toLocaleDateString() : "—"}
                  </p>
                  {inv.email_status === "failed" && inv.email_error && (
                    <p className="mt-1 text-[11px] text-danger-700">Email delivery failed: {inv.email_error}</p>
                  )}
                  {inv.whatsapp_status === "failed" && inv.whatsapp_error && (
                    <p className="mt-1 text-[11px] text-danger-700">WhatsApp delivery failed: {inv.whatsapp_error}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {inv.email_status && <Badge tone={deliveryTone(inv.email_status)}><Mail size={11} /> Email {inv.email_status}</Badge>}
                  {inv.whatsapp_status && <Badge tone={deliveryTone(inv.whatsapp_status)}><MessageCircle size={11} /> WhatsApp {inv.whatsapp_status}</Badge>}
                  {!inv.email_status && !inv.whatsapp_status && <Badge tone="amber">pending</Badge>}
                  <button
                    onClick={() => setRevokeTarget(inv.id)}
                    className="rounded-full p-2 text-[var(--text-muted)] hover:shadow-card-recess hover:text-danger-700"
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
