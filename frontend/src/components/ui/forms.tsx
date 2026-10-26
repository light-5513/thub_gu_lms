import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { clsx } from "clsx";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "danger" | "ghost" | "outline";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  danger: "btn-danger",
  ghost: "btn-ghost",
  outline: "btn-secondary",
};

const sizeClasses: Record<Size, string> = {
  sm: "rounded-full px-4 py-1.5 text-xs",
  md: "rounded-full px-5 py-2 text-sm",
  lg: "rounded-full px-6 py-2.5 text-sm",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={clsx(
        "inline-flex items-center justify-center gap-2 font-semibold tracking-tight disabled:cursor-not-allowed disabled:opacity-55",
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {loading && <Loader2 size={size === "lg" ? 17 : 15} className="animate-spin" aria-hidden="true" />}
      {children}
    </button>
  )
);
Button.displayName = "Button";

export const inputClasses = "input-recess w-full px-3.5 py-2.5 text-sm disabled:cursor-not-allowed";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { error?: string }>(
  ({ className, error, ...props }, ref) => (
    <input
      ref={ref}
      aria-invalid={error ? true : props["aria-invalid"]}
      className={clsx(inputClasses, error && "border-danger-500", className)}
      {...props}
    />
  )
);
Input.displayName = "Input";

export { Select } from "./Select";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={clsx(inputClasses, "min-h-24 resize-y", className)} {...props} />
  )
);
Textarea.displayName = "Textarea";

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-medium text-leather-200">
      {children}
    </label>
  );
}

export function FormField({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <Label>{label}</Label>
      {children}
      {error && <p className="mt-1.5 text-xs font-medium text-danger-700">{error}</p>}
    </div>
  );
}

export { DatePicker } from "./DatePicker";
