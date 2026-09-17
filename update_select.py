import re

with open('frontend/src/components/ui/forms.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

if 'import { useState, useRef, useEffect, Children, isValidElement' not in content:
    content = content.replace('import { forwardRef', 'import { forwardRef, useState, useRef, useEffect, Children, isValidElement')
    content = content.replace('import { Loader2 } from "lucide-react";', 'import { Loader2, ChevronDown } from "lucide-react";')

old_select = r'''export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select ref={ref} className={clsx(inputClasses, "pr-8 appearance-none", className)} {...props}>
      {children}
    </select>
  )
);
Select.displayName = "Select";'''

new_select = r'''export const Select = forwardRef<HTMLDivElement, SelectHTMLAttributes<HTMLSelectElement>>(
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
            !selectedOption && "text-slate-400"
          )}
          {...(props as any)}
        >
          <span className="truncate">{selectedOption ? selectedOption.label : "Select..."}</span>
          <ChevronDown size={14} className={clsx("ml-3 opacity-50 transition-transform shrink-0", open && "rotate-180")} />
        </button>

        {open && (
          <div
            className="absolute z-[999] mt-1.5 w-full min-w-[120px] rounded-md py-1"
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
Select.displayName = "Select";'''

content = content.replace(old_select, new_select)

with open('frontend/src/components/ui/forms.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("done")
