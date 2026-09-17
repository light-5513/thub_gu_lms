import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AuthLayout } from "@/layouts/AuthLayout";
import { Button, FormField, Input } from "@/components/ui/forms";
import { useResetPassword } from "@/api/hooks";
import { errorMessage } from "@/api/client";

const schema = z
  .object({
    password: z.string().min(8, "At least 8 characters").regex(/[0-9]/, "Include at least one number"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "Passwords do not match" });
type FormData = z.infer<typeof schema>;

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const reset = useResetPassword();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    if (!token) {
      setError("This reset link is missing its token. Request a new link.");
      return;
    }
    try {
      await reset.mutateAsync({ token, new_password: data.password });
      setDone(true);
      setTimeout(() => navigate("/login"), 2500);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  if (!token || done) {
    return (
      <AuthLayout title={!token ? "Invalid link" : "Password updated"}>
        <p className="text-center text-xs leading-relaxed text-leather-50/80">
          {!token
            ? "This reset link is incomplete. Please request a fresh one."
            : "Your password has been changed. Redirecting you to login…"}
        </p>
        <div className="mt-4 text-center">
          <Link to={done ? "/login" : "/forgot-password"} className="text-xs font-medium text-primary-600 hover:underline">
            {done ? "Go to login" : "Request new link"}
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Choose a new password" subtitle="Make it strong — at least 8 characters with a number.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField label="New password" error={errors.password?.message}>
          <Input type="password" autoComplete="new-password" {...register("password")} />
        </FormField>
        <FormField label="Confirm password" error={errors.confirm?.message}>
          <Input type="password" autoComplete="new-password" {...register("confirm")} />
        </FormField>
        {error && <div className="rounded-[20px] bg-neutral-100 px-3 py-2 text-xs text-black">{error}</div>}
        <Button type="submit" className="w-full" loading={reset.isPending}>
          Update password
        </Button>
      </form>
    </AuthLayout>
  );
}
