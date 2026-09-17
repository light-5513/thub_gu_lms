import { forwardRef, useState, useRef, useEffect, Children, isValidElement, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { clsx } from "clsx";
import { Loader2, ChevronDown } from "lucide-react";

// ---------------------------------------------------------------- Button
type Variant = "primary" | "secondary" | "danger" | "ghost" | "outline";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:   "btn-primary",
  secondary: "btn-secondary",
  danger:    "btn-danger",
  ghost:     "text-leather-200 hover:bg-cream-200 focus-visible:ring-leather-50/30",
  outline:   "btn-secondary",
};

const sizeClasses: Record<Size, string> = {
  sm: "rounded-full px-4 py-1.5 text-xs",
  md: "rounded-full px-5 py-2 text-sm",
  lg: "rounded-full px-6 py-2.5 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(
        "inline-flex items-center justify-center gap-2 font-bold tracking-tight transition focus:outline-none disabled:cursor-not-allowed",
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {loading && <Loader2 size={size === "lg" ? 17 : 15} className="animate-spin" />}
      {children}
    </button>
  )
);
Button.displayName = "Button";

// ---------------------------------------------------------------- Inputs
export const inputClasses =
  "input-recess w-full rounded-2xl px-4 py-2.5 text-sm disabled:cursor-not-allowed";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { error?: string }>(
  ({ className, error, ...props }, ref) => (
    <>
      <input
        ref={ref}
        className={clsx(inputClasses, error && "border-red-500 focus:!border-red-500", className)}
        {...props}
      />
      {error && <p className="mt-1 text-xs font-semibold text-primary-800">{error}</p>}
    </>
  )
);
Input.displayName = "Input";

export const Select = forwardRef<HTMLDivElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, value, onChange, ...props }, ref) => {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const handleOutside = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          setOpen(false);
        }
      };
      document.addEventListener("mousedown", handleOutside);
      return () => document.removeEventListener("mousedown", handleOutside);
    }, []);

    const options: { value: string; label: ReactNode }[] = [];
    Children.forEach(children, (child) => {
      if (isValidElement(child) && child.type === "option") {
        const val = child.props.value !== undefined ? String(child.props.value) : child.props.children;
        options.push({ value: val as string, label: child.props.children });
      }
    });

    const selectedOption = options.find((o) => o.value === String(value || "")) || options[0];

    const handleSelect = (val: string) => {
      if (onChange) {
        onChange({ target: { value: val } } as any);
      }
      setOpen(false);
    };

    return (
      <div ref={containerRef} className={clsx("relative inline-block w-full", className)}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={clsx(
            inputClasses,
            "flex w-full items-center justify-between text-left",
            !selectedOption && "text-leather-50/70"
          )}
          {...(props as any)}
        >
          <span className="truncate">{selectedOption ? selectedOption.label : "Select..."}</span>
          <ChevronDown size={14} className={clsx("ml-3 opacity-50 transition-transform shrink-0", open && "rotate-180")} />
        </button>

        {open && (
          <div
            className="absolute z-[999] mt-1.5 w-full min-w-[120px] rounded-2xl py-1"
            style={{
              backgroundColor: "var(--bg)",
              boxShadow: "var(--neo-out-lg)",
              border: "1px solid rgba(255, 255, 255, 0.5)"
            }}
          >
            <ul className="max-h-60 overflow-auto">
              {options.map((opt, i) => (
                <li
                  key={i}
                  onClick={() => handleSelect(opt.value)}
                  className={clsx(
                    "cursor-pointer px-3 py-2 text-sm transition-colors hover:bg-[rgba(21,128,61,0.08)]",
                    opt.value === String(value || "") ? "font-bold text-[#15803d]" : "text-black"
                  )}
                >
                  {opt.label}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }
);
Select.displayName = "Select";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={clsx(inputClasses, "min-h-[80px]", className)} {...props} />
));
Textarea.displayName = "Textarea";

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-leather-50/80">
      {children}
    </label>
  );
}

export function FormField({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
      {error && <p className="mt-1 text-xs font-semibold text-primary-800">{error}</p>}
    </div>
  );
}
