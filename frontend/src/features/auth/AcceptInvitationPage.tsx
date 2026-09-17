import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AuthLayout } from "@/layouts/AuthLayout";
import { Button, FormField, Input, Select } from "@/components/ui/forms";
import { api } from "@/api/client";
import { useAcceptInvitation } from "@/api/hooks";

interface InvitationInfo {
  email: string;
  role: string;
}

function useInvitationInfo(token: string | null) {
  return useQuery({
    enabled: !!token,
    queryKey: ["invitation", token],
    queryFn: async () => (await api.get<InvitationInfo>(`/auth/invitation/${token}`)).data,
    retry: false,
  });
}

export function AcceptInvitationPage() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const info = useInvitationInfo(token);
  const accept = useAcceptInvitation();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    roll_number: "",
    course: "B.Tech",
    branch: "CSE",
    section: "",
    phone: "",
    password: "",
    confirm: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <AuthLayout title="Invalid link">
        <p className="text-center text-xs text-leather-50/80">This invitation link is missing its token.</p>
        <p className="mt-3 text-center">
          <Link to="/login" className="text-xs font-medium text-primary-600 hover:underline">Go to login</Link>
        </p>
      </AuthLayout>
    );
  }

  if (info.isLoading) {
    return (
      <AuthLayout title="Checking your invitation…">
        <div className="flex justify-center py-6">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-transparent border-t-primary-600" />
        </div>
      </AuthLayout>
    );
  }

  if (info.isError || !info.data) {
    return (
      <AuthLayout title="Invitation unavailable">
        <div className="rounded-[20px] bg-neutral-100 px-4 py-3 text-xs leading-relaxed text-black ring-1 ring-black">
          This invitation link is invalid, was already used, or has expired. Please ask your administrator for a fresh invitation.
        </div>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout title="Welcome aboard! 🎉">
        <div className="space-y-4 text-center">
          <div className="rounded-[20px] bg-neutral-100 px-4 py-3 text-xs leading-relaxed text-black ring-1 ring-primary-200">
            Your account has been created for <strong>{info.data.email}</strong>.
          </div>
          <Button
            className="w-full"
            size="lg"
            onClick={() => navigate("/login", { replace: true })}
          >
            Go to login
          </Button>
        </div>
      </AuthLayout>
    );
  }

  const submit = async () => {
    const errs: Record<string, string> = {};
    if (!form.first_name.trim()) errs.first_name = "Required";
    if (!form.last_name.trim()) errs.last_name = "Required";
    if (info.data?.role === "STUDENT") {
      if (!form.roll_number.trim()) errs.roll_number = "Required";
      if (!form.course.trim()) errs.course = "Required";
      if (!form.branch.trim()) errs.branch = "Required";
      if (!form.section.trim()) errs.section = "Required";
    }
    if (form.password.length < 8 || !/[0-9]/.test(form.password) || !/[a-zA-Z]/.test(form.password))
      errs.password = "At least 8 characters with letters and numbers";
    if (form.password !== form.confirm) errs.confirm = "Passwords do not match";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    try {
      await accept.mutateAsync({ token: token!, ...form });
      setDone(true);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setErrors({ root: typeof detail === "string" ? detail : "We couldn't complete your registration. Please try again." });
    }
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <AuthLayout
      title="Complete your registration"
      subtitle={`Invited: ${info.data.email} — fill in your details and choose a password.`}
    >
      <div className="mb-4 rounded-[20px] bg-cream-100 px-3 py-2 text-xs ring-1 ring-transparent">
        Email: <strong>{info.data.email}</strong> <span className="text-leather-50/80">(read-only)</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label="First name" error={errors.first_name}>
          <Input value={form.first_name} onChange={set("first_name")} placeholder="Rahul" />
        </FormField>
        <FormField label="Last name" error={errors.last_name}>
          <Input value={form.last_name} onChange={set("last_name")} placeholder="Sharma" />
        </FormField>
        {info.data?.role === "STUDENT" && (
          <>
            <FormField label="Roll number" error={errors.roll_number}>
              <Input value={form.roll_number} onChange={set("roll_number")} placeholder="2026CSE001" />
            </FormField>
            <FormField label="Phone (optional)">
              <Input value={form.phone} onChange={set("phone")} placeholder="9876543210" />
            </FormField>
            <FormField label="Course" error={errors.course}>
              <Select
                value={form.course}
                onChange={set("course")}
              >
                <option>B.Tech</option><option>M.Tech</option><option>BCA</option><option>MCA</option>
              </Select>
            </FormField>
            <FormField label="Branch" error={errors.branch}>
              <Select
                value={form.branch}
                onChange={set("branch")}
              >
                <option>CSE</option><option>IT</option><option>ECE</option><option>EEE</option><option>AIML</option><option>CS</option><option>DS</option>
              </Select>
            </FormField>
            <FormField label="Section" error={errors.section}>
              <Select
                value={form.section}
                onChange={set("section")}
              >
                <option>A</option><option>B</option><option>C</option><option>D</option>
              </Select>
            </FormField>
          </>
        )}
        <FormField label="Choose a password" error={errors.password}>
          <Input type="password" autoComplete="new-password" value={form.password} onChange={set("password")} />
        </FormField>
        <FormField label="Confirm password" error={errors.confirm}>
          <Input type="password" autoComplete="new-password" value={form.confirm} onChange={set("confirm")} />
        </FormField>
      </div>
      {errors.root && (
        <div className="mt-3 rounded-[20px] bg-neutral-100 px-3 py-2 text-xs text-black">{errors.root}</div>
      )}
      <Button className="mt-5 w-full" size="lg" loading={accept.isPending} onClick={submit}>
        Create my account
      </Button>
    </AuthLayout>
  );
}
