import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { useSettings, useUpdateSettings } from "@/api/hooks";
import type { AppSettings } from "@/types";
import { Card, CardHeader, Skeleton } from "@/components/ui/display";
import { Button, FormField, Input, Select } from "@/components/ui/forms";
import { useToast } from "@/components/ui/overlays";
import { errorMessage } from "@/api/client";

export function SettingsPage() {
  const { data, isLoading } = useSettings();
  const update = useUpdateSettings();
  const toast = useToast();
  const [form, setForm] = useState<Partial<AppSettings>>({});

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  if (isLoading || form.institution_name === undefined) return <Skeleton className="h-96 w-full rounded-xl" />;
  if (!data) return null;

  const setWeight = (key: string, value: string) =>
    setForm((f) => ({ ...f, leaderboard_weights: { ...(f.leaderboard_weights ?? {}), [key]: Number(value) } }));

  const save = async () => {
    try {
      await update.mutateAsync(form);
      toast.push("success", "Settings saved");
    } catch (err) {
      toast.push("error", errorMessage(err));
    }
  };

  const weights = form.leaderboard_weights ?? { attendance: 0.3, coding: 0.5, streak: 0.2 };
  const weightSum = Object.values(weights).reduce((a, b) => a + Number(b), 0);

  return (
    <div className="max-w-4xl space-y-5 animate-fade-in">
      <div>
        <h1 className="text-lg font-bold text-leather-300">Settings</h1>
        <p className="text-xs text-leather-50/80">Database-backed configuration — changes apply instantly and are audit logged.</p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Card>
          <CardHeader title="Institution" />
          <div className="space-y-3">
            <FormField label="Institution name">
              <Input value={form.institution_name ?? ""} onChange={(e) => setForm({ ...form, institution_name: e.target.value })} />
            </FormField>
            <FormField label="Current academic year">
              <Input value={form.academic_year ?? ""} onChange={(e) => setForm({ ...form, academic_year: e.target.value })} placeholder="2025-26" />
            </FormField>
            <FormField label="Timezone">
              <Select value={form.timezone ?? "Asia/Kolkata"} onChange={(e) => setForm({ ...form, timezone: e.target.value })}>
                {["Asia/Kolkata", "UTC", "America/New_York", "Europe/London", "Asia/Singapore"].map((tz) => (
                  <option key={tz}>{tz}</option>
                ))}
              </Select>
            </FormField>
          </div>
        </Card>

        <Card>
          <CardHeader title="Attendance" subtitle="Thresholds drive highlighting & low-attendance alerts" />
          <FormField label={`Minimum attendance threshold — ${form.attendance_threshold ?? 75}%`}>
            <input
              type="range"
              min={40}
              max={95}
              step={1}
              value={form.attendance_threshold ?? 75}
              onChange={(e) => setForm({ ...form, attendance_threshold: Number(e.target.value) })}
              className="w-full accent-primary-600"
            />
          </FormField>
          <div className="mt-4 space-y-2.5 text-xs text-leather-200">
            <label className="flex items-center justify-between rounded-[20px] bg-cream-100 px-3 py-2">
              Late counts as present (streak)
              <input
                type="checkbox"
                checked={Boolean(form.streak_rules?.late_counts_as_present)}
                onChange={(e) => setForm({ ...form, streak_rules: { ...(form.streak_rules ?? {}), late_counts_as_present: e.target.checked } })}
                className="accent-primary-600"
              />
            </label>
            <label className="flex items-center justify-between rounded-[20px] bg-cream-100 px-3 py-2">
              Leave breaks streak
              <input
                type="checkbox"
                checked={Boolean(form.streak_rules?.leave_breaks_streak)}
                onChange={(e) => setForm({ ...form, streak_rules: { ...(form.streak_rules ?? {}), leave_breaks_streak: e.target.checked } })}
                className="accent-primary-600"
              />
            </label>
            <label className="flex items-center justify-between rounded-[20px] bg-cream-100 px-3 py-2">
              Absent breaks streak
              <input
                type="checkbox"
                checked={Boolean(form.streak_rules?.absent_breaks_streak)}
                onChange={(e) => setForm({ ...form, streak_rules: { ...(form.streak_rules ?? {}), absent_breaks_streak: e.target.checked } })}
                className="accent-primary-600"
              />
            </label>
          </div>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader
            title="Leaderboard weighting"
            subtitle={`Weights are normalized automatically. Current sum: ${(weightSum * 100).toFixed(0)}%`}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {["attendance", "coding", "streak"].map((key) => (
              <FormField key={key} label={`${key} weight (${Math.round(Number(weights[key] ?? 0) * 100)}%)`}>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={Math.round(Number(weights[key] ?? 0) * 100)}
                  onChange={(e) => setWeight(key, String(Number(e.target.value) / 100))}
                  className="w-full accent-primary-600"
                />
              </FormField>
            ))}
          </div>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader title="Coding sync performance" subtitle="Applied to every platform adapter during synchronization jobs" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              ["timeout_seconds", "Timeout (s)"],
              ["max_retries", "Max retries"],
              ["retry_delay_seconds", "Retry delay (s)"],
              ["request_delay_ms", "Request delay (ms)"],
              ["concurrency", "Concurrency"],
            ].map(([key, label]) => (
              <FormField key={key} label={label}>
                <Input
                  type="number"
                  value={String((form.coding_sync_settings as Record<string, number>)?.[key] ?? "")}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      coding_sync_settings: { ...((form.coding_sync_settings as Record<string, number>) ?? {}), [key]: Number(e.target.value) },
                    })
                  }
                />
              </FormField>
            ))}
          </div>
        </Card>
      </div>

      <div className="sticky bottom-4 flex justify-end">
        <Button loading={update.isPending} onClick={save} size="lg" className="shadow-card-card-lg">
          <Save size={15} /> Save settings
        </Button>
      </div>
    </div>
  );
}
