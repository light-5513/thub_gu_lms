import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { clsx } from "clsx";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";

// ---------------------------------------------------------------- Toasts
type ToastType = "success" | "error" | "info" | "warning";
interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

const ToastContext = createContext<{ push: (type: ToastType, message: string) => void }>({ push: () => {} });
export const useToast = () => useContext(ToastContext);

const icons = {
  success: <CheckCircle2 size={17} className="text-primary-500" />,
  error:   <XCircle size={17} className="text-primary-800" />,
  warning: <AlertTriangle size={17} className="text-leather-300" />,
  info:    <Info size={17} className="text-leather-200" />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const push = useCallback((type: ToastType, message: string) => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-80 max-w-[calc(100vw-2.5rem)] flex-col gap-2.5">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="card pointer-events-auto flex animate-fade-in items-start gap-2.5 p-3.5 shadow-card-toast"
            role="status"
          >
            <div className="sk-icon-disc mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
              {icons[toast.type]}
            </div>
            <p className="flex-1 text-xs font-semibold leading-relaxed text-leather-200">{toast.message}</p>
            <button onClick={() => setToasts((t) => t.filter((x) => x.id !== toast.id))} aria-label="Dismiss" className="rounded p-1 text-leather-50/60 hover:bg-cream-200 hover:text-leather-200">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ---------------------------------------------------------------- Modal / ConfirmDialog
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      {/* Backdrop: warm leather tone with blur + noise */}
      <div
        className="absolute inset-0"
        onClick={onClose}
        style={{
          backgroundColor: "rgba(44, 34, 24, 0.45)",
          backdropFilter: "blur(2px)",
          WebkitBackdropFilter: "blur(2px)",
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.30 0 0 0 0 0.22 0 0 0 0 0.12 0 0 0 0.08 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />
      <div className={clsx("card-lg relative w-full animate-fade-in overflow-hidden", wide ? "max-w-3xl" : "max-w-lg")}>
        <div className="flex items-center justify-between border-b border-leather-50/15 px-5 py-3.5">
          <h3 className="text-sm font-bold text-leather-300">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-leather-50/70 hover:bg-cream-200 hover:text-leather-300">
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[85vh] min-h-[32rem] overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  tone = "danger",
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  tone?: "danger" | "primary";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <div className="text-sm leading-relaxed text-leather-200">{message}</div>
      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onCancel} variant="secondary" size="sm">Cancel</Button>
        <Button onClick={onConfirm} loading={loading} variant={tone === "danger" ? "danger" : "primary"} size="sm">
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

import { Button } from "./forms";
