import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { AuthLayout } from "@/layouts/AuthLayout";
import { Button, FormField, Input } from "@/components/ui/forms";
import { useLogin } from "@/api/hooks";
import { errorMessage } from "@/api/client";
import { useAuth } from "@/context/AuthContext";

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});
type FormData = z.infer<typeof schema>;

export function LoginPage() {
  const login = useLogin();
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshSession } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      await login.mutateAsync(data);
      const session = await refreshSession();
      if (session?.must_change_password) navigate("/force-change-password", { replace: true });
      else if (session?.role === "STUDENT") navigate("/student/dashboard", { replace: true });
      else navigate("/admin/dashboard", { replace: true });
    } catch (err) {
      setError("root", { message: errorMessage(err) });
    }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Log in to continue to your portal.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField label="Email" error={errors.email?.message}>
          <Input type="email" placeholder="you@example.com" autoComplete="email" {...register("email")} error={errors.email?.message} />
        </FormField>
        <div className="relative">
          <FormField label="Password" error={errors.password?.message}>
            <Input type={showPassword ? "text" : "password"} placeholder="••••••••" autoComplete="current-password" {...register("password")} />
          </FormField>
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="absolute right-3 top-[30px] text-leather-50/80 hover:text-leather-200"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {errors.root && (
          <div className="rounded-[20px] bg-neutral-100 px-3 py-2 text-xs text-black ring-1 ring-black">{errors.root.message}</div>
        )}
        <Button type="submit" className="w-full" size="lg" loading={login.isPending}>
          Log in
        </Button>
        <p className="text-center">
          <Link to="/forgot-password" className="text-xs font-medium text-primary-600 hover:underline">
            Forgot your password?
          </Link>
        </p>
        <p className="text-center">
          <Link to="/contact" className="text-[11px] font-medium text-leather-100 hover:text-leather-300 hover:underline">
            Need help? Contact us →
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
