import { useState } from "react";
import { useForm } from "react-hook-form";
import { Github, Link2, Trash2 } from "lucide-react";
import { useCodingProfiles, useDeleteCodingProfile, useSaveCodingProfile, useStudentProfile, useUpdateProfile } from "@/api/hooks";
import { Badge, Card, CardHeader, EmptyState, Skeleton } from "@/components/ui/display";
import { Button, FormField, Input, Select } from "@/components/ui/forms";
import type { Student } from "@/types";
import { ConfirmDialog, Modal, useToast } from "@/components/ui/overlays";
import { errorMessage } from "@/api/client";

import { SiLeetcode, SiCodechef, SiCodeforces, SiHackerrank, SiHackerearth, SiGeeksforgeeks, SiGithub } from "react-icons/si";

const PLATFORM_META: Record<string, { label: string; icon?: React.ElementType }> = {
  github: { label: "GitHub", icon: SiGithub },
  leetcode: { label: "LeetCode", icon: SiLeetcode },
  codechef: { label: "CodeChef", icon: SiCodechef },
  codeforces: { label: "Codeforces", icon: SiCodeforces },
  atcoder: { label: "AtCoder" },
  hackerrank: { label: "HackerRank", icon: SiHackerrank },
  hackerearth: { label: "HackerEarth", icon: SiHackerearth },
  geeksforgeeks: { label: "GeeksForGeeks", icon: SiGeeksforgeeks },
};

function extractUsername(platform: string, url: string) {
  try {
    const obj = new URL(url);
    const parts = obj.pathname.split('/').filter(Boolean);
    if (platform === 'leetcode') return parts[0] === 'u' ? parts[1] : parts[0];
    if (platform === 'github') return parts[0];
    if (platform === 'codeforces') return parts[1] || parts[0];
    if (platform === 'codechef') return parts[1] || parts[0];
    if (platform === 'atcoder') return parts[1] || parts[0];
    if (platform === 'geeksforgeeks') return parts[1] || parts[0];
    if (platform === 'hackerrank') return parts[1] || parts[0];
    if (platform === 'hackerearth') return (parts[0] || '').replace('@', '');
    return parts.pop() || url;
  } catch {
    return url.replace(/^@/, '');
  }
}

function getPlatformUrl(platform: string, username: string) {
  if (!username) return "";
  const urls: Record<string, string> = {
    github: `https://github.com/${username}`,
    leetcode: `https://leetcode.com/u/${username}/`,
    codechef: `https://www.codechef.com/users/${username}`,
    codeforces: `https://codeforces.com/profile/${username}`,
    atcoder: `https://atcoder.jp/users/${username}`,
    hackerrank: `https://www.hackerrank.com/profile/${username}`,
    hackerearth: `https://www.hackerearth.com/@${username}`,
    geeksforgeeks: `https://auth.geeksforgeeks.org/user/${username}/`,
  };
  return urls[platform] || username;
}

export function ProfilePage() {
  const profile = useStudentProfile();
  const updateProfile = useUpdateProfile();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Student> & { phone?: string }>({});

  if (profile.isLoading) return <Skeleton className="h-96 w-full rounded-xl" />;
  const p = profile.data;
  if (!p) return <EmptyState title="Profile not found." />;

  const save = async () => {
    try {
      await updateProfile.mutateAsync(form);
      toast.push("success", "Profile updated");
      setEditing(false);
      setForm({});
    } catch (err) {
      toast.push("error", errorMessage(err));
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-leather-300">My profile</h1>
        {!editing ? (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            Edit profile
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setForm({}); }}>Cancel</Button>
            <Button size="sm" loading={updateProfile.isPending} onClick={save}>Save</Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Personal information" subtitle="Everything is editable except your email" />
          <dl className="space-y-4">
            <InfoRow 
              label="First name" 
              isEditing={editing} 
              value={<Input value={form.first_name ?? p.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} />} 
              readOnlyText={p.first_name} 
            />
            <InfoRow 
              label="Last name" 
              isEditing={editing} 
              value={<Input value={form.last_name ?? p.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} />} 
              readOnlyText={p.last_name} 
            />
            <InfoRow
              label="Email"
              isEditing={false}
              value={null}
              readOnlyText={
                <>
                  {p.email} <Badge tone="gray">read-only</Badge>
                </>
              }
            />
            <InfoRow 
              label="Roll number" 
              isEditing={editing} 
              value={<Input value={form.roll_number ?? p.roll_number} onChange={(e) => setForm((f) => ({ ...f, roll_number: e.target.value }))} />} 
              readOnlyText={p.roll_number} 
            />
            <InfoRow
              label="Course"
              isEditing={editing}
              value={
                <Select value={form.course ?? p.course} onChange={(e) => setForm((f) => ({ ...f, course: e.target.value }))}>
                  <option>B.Tech</option><option>M.Tech</option><option>BCA</option><option>MCA</option>
                </Select>
              }
              readOnlyText={p.course}
            />
            <InfoRow
              label="Branch"
              isEditing={editing}
              value={
                <Select value={form.branch ?? p.branch} onChange={(e) => setForm((f) => ({ ...f, branch: e.target.value }))}>
                  <option>CSE</option><option>IT</option><option>ECE</option><option>EEE</option><option>AIML</option><option>CS</option><option>DS</option>
                </Select>
              }
              readOnlyText={p.branch}
            />
            <InfoRow 
              label="Section" 
              isEditing={editing} 
              value={<Input value={form.section ?? p.section} onChange={(e) => setForm((f) => ({ ...f, section: e.target.value }))} />} 
              readOnlyText={p.section} 
            />
            <InfoRow 
              label="Phone" 
              isEditing={editing} 
              value={<Input value={form.phone ?? p.phone ?? ""} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />} 
              readOnlyText={p.phone} 
            />
          </dl>
        </Card>
        <CodingProfilesCard />
      </div>
    </div>
  );
}

function InfoRow({ label, value, isEditing, readOnlyText }: { label: string; value: React.ReactNode; isEditing?: boolean; readOnlyText?: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_1fr] items-center gap-3 mb-2">
      <dt className="text-[11px] font-extrabold uppercase tracking-widest text-leather-300">{label}</dt>
      <dd className="min-w-0 w-full">
        {isEditing ? (
          value
        ) : (
          <div className="flex items-center gap-2 px-4 py-2.5 card-inset border-0 rounded-3xl text-[13px] font-bold text-leather-300">
            {readOnlyText || value || "—"}
          </div>
        )}
      </dd>
    </div>
  );
}

function CodingProfilesCard() {
  const profiles = useCodingProfiles();
  const saveProfile = useSaveCodingProfile();
  const deleteProfile = useDeleteCodingProfile();
  const toast = useToast();
  const [modalPlatform, setModalPlatform] = useState<string | null>(null);
  const [profileLink, setProfileLink] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const data = profiles.data;
  const supported = data?.supported_platforms ?? [];
  const connected = data?.profiles ?? {};

  const openModal = (platform: string) => {
    setModalPlatform(platform);
    const conn = connected[platform];
    setProfileLink(conn?.profile_url ?? (conn?.username ? getPlatformUrl(platform, conn.username) : ""));
  };

  const submit = async () => {
    if (!modalPlatform) return;
    try {
      const extracted = extractUsername(modalPlatform, profileLink.trim());
      await saveProfile.mutateAsync({ platform: modalPlatform, username: extracted });
      toast.push("success", `${PLATFORM_META[modalPlatform]?.label ?? modalPlatform} saved. Stats update on next sync.`);
      setModalPlatform(null);
    } catch (err) {
      toast.push("error", errorMessage(err));
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteProfile.mutateAsync(deleteTarget);
      toast.push("success", "Profile removed");
    } catch (err) {
      toast.push("error", errorMessage(err));
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <Card>
      <CardHeader title="Coding profiles" subtitle="Connect your accounts to appear in coding leaderboards" />
      {profiles.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : supported.length === 0 ? (
        <EmptyState title="No coding profiles connected." />
      ) : (
        <ul className="space-y-2.5">
          {supported.map((platform) => {
            const meta = PLATFORM_META[platform] ?? { label: platform };
            const conn = connected[platform];
            const IconComponent = meta.icon;
            
            return (
              <li key={platform} className="flex items-center gap-3 rounded-xl p-3">
                <div className="sk-icon-disc flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-leather-200">
                  {IconComponent ? <IconComponent size={18} /> : <span className="text-xs font-bold">{meta.label.slice(0, 2).toUpperCase()}</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-leather-200">{meta.label}</p>
                  {conn ? (
                    <p className="truncate text-[11px] text-leather-50/80">
                      {conn.username} · {conn.statistics?.problems_solved != null ? `${conn.statistics.problems_solved} solved` : ""}
                      {conn.statistics?.rating ? ` · rating ${Math.round(conn.statistics.rating)}` : ""}
                    </p>
                  ) : (
                    <p className="text-[11px] italic text-leather-50/80">Not connected</p>
                  )}
                  {conn?.sync_status === "failed" && <p className="text-[11px] text-black">{conn.sync_error}</p>}
                </div>
                {conn && (
                  <Badge tone={conn.sync_status === "success" ? "green" : conn.sync_status === "failed" ? "red" : "gray"}>{(conn.sync_status ?? "unknown").replace("_", " ")}</Badge>
                )}
                <div className="flex items-center gap-1">
                  {conn?.profile_url && (
                    <a href={conn.profile_url} target="_blank" rel="noreferrer" className="rounded-2xl p-1.5 text-leather-50/80 hover:bg-cream-300/70" title="Open profile">
                      <Link2 size={14} />
                    </a>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => openModal(platform)}>
                    {conn ? "Edit" : "Connect"}
                  </Button>
                  {conn && (
                    <button onClick={() => setDeleteTarget(platform)} className="rounded-2xl p-1.5 text-leather-50/80 hover:bg-neutral-100 hover:text-black" title="Remove">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={!!modalPlatform} onClose={() => setModalPlatform(null)} title={`Connect ${modalPlatform ? PLATFORM_META[modalPlatform]?.label : ""}`}>
        <FormField label="Profile Link">
          <Input type="url" value={profileLink} onChange={(e) => setProfileLink(e.target.value)} placeholder="https://..." autoFocus />
        </FormField>
        <p className="mt-2 text-[11px] leading-relaxed text-leather-50/80">
          Statistics (solved counts, ratings) are fetched automatically during synchronization — you never enter them manually.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setModalPlatform(null)}>Cancel</Button>
          <Button size="sm" loading={saveProfile.isPending} onClick={submit} disabled={!profileLink.trim()}>Save</Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove profile?"
        message={`This disconnects ${deleteTarget ? PLATFORM_META[deleteTarget]?.label : ""} and clears its statistics.`}
        confirmLabel="Remove"
        loading={deleteProfile.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </Card>
  );
}
