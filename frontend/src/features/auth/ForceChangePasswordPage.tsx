import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { AuthLayout } from "@/layouts/AuthLayout";
import { Button, FormField, Input } from "@/components/ui/forms";
import { useForceChangePassword } from "@/api/hooks";
import { errorMessage } from "@/api/client";

const schema = z
  .object({
    password: z.string().min(8, "At least 8 characters").regex(/[0-9]/, "Include at least one number"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "Passwords do not match" });
type FormData = z.infer<typeof schema>;

export function ForceChangePasswordPage() {
  const forceChange = useForceChangePassword();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      const res = await forceChange.mutateAsync(data.password);
      navigate(res.redirect || "/student/dashboard", { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <AuthLayout title="Set your new password" subtitle="For security, you must replace your temporary password before continuing.">
      <div className="mb-5 flex items-center gap-2 rounded-[20px] bg-neutral-100 px-3 py-2.5 text-xs text-black ring-1 ring-amber-100">
        <ShieldCheck size={15} />
        You're using a temporary password.
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField label="New password" error={errors.password?.message}>
          <Input type="password" autoComplete="new-password" {...register("password")} />
        </FormField>
        <FormField label="Confirm new password" error={errors.confirm?.message}>
          <Input type="password" autoComplete="new-password" {...register("confirm")} />
        </FormField>
        {error && <div className="rounded-[20px] bg-neutral-100 px-3 py-2 text-xs text-black">{error}</div>}
        <Button type="submit" className="w-full" loading={forceChange.isPending}>
          Save password and continue
        </Button>
      </form>
    </AuthLayout>
  );
}
