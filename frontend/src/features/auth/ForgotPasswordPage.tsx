import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AuthLayout } from "@/layouts/AuthLayout";
import { Button, FormField, Input } from "@/components/ui/forms";
import { useForgotPassword } from "@/api/hooks";

const schema = z.object({ email: z.string().email("Enter a valid email address") });
type FormData = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const forgot = useForgotPassword();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      await forgot.mutateAsync(data.email);
      setSent(true);
    } catch {
      setSent(true); // generic response either way
    }
  };

  return (
    <AuthLayout
      title={sent ? "Check your inbox" : "Reset your password"}
      subtitle={
        sent
          ? undefined
          : "Enter the email linked to your account and we'll send you a reset link."
      }
    >
      {sent ? (
        <div className="space-y-4 text-center">
          <div className="rounded-[20px] bg-neutral-100 px-4 py-3 text-xs leading-relaxed text-black ring-1 ring-primary-200">
            If an account exists for this email, a password reset link has been sent.
          </div>
          <div className="flex justify-center gap-3">
            <Button variant="outline" onClick={() => navigate("/login")}>
              Back to login
            </Button>
            <button className="text-xs font-medium text-primary-600 hover:underline" onClick={() => setSent(false)}>
              Use a different email
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <FormField label="Email" error={errors.email?.message}>
            <Input type="email" placeholder="you@example.com" autoComplete="email" {...register("email")} />
          </FormField>
          <Button type="submit" className="w-full" loading={forgot.isPending}>
            Send reset link
          </Button>
          <p className="text-center">
            <Link to="/login" className="text-xs font-medium text-primary-600 hover:underline">
              Back to login
            </Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
