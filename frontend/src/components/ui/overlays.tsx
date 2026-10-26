import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
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
  success: <CheckCircle2 size={17} className="text-success-700" />,
  error:   <XCircle size={17} className="text-danger-700" />,
  warning: <AlertTriangle size={17} className="text-warning-700" />,
  info:    <Info size={17} className="text-info-700" />,
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
            <button onClick={() => setToasts((t) => t.filter((x) => x.id !== toast.id))} aria-label="Dismiss" className="btn-ghost rounded-full p-1 text-leather-50/60 hover:text-leather-200">
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
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const isTopmost = () => {
      const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]');
      return dialogs[dialogs.length - 1] === dialog;
    };
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ) ?? []).filter((element) => element.tabIndex >= 0 && element.getClientRects().length > 0);
    const frame = requestAnimationFrame(() => {
      if (isTopmost()) (focusable()[0] ?? dialog)?.focus();
    });
    const handler = (e: KeyboardEvent) => {
      if (!isTopmost()) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
      } else if (e.key === "Tab") {
        const items = focusable();
        if (!items.length) {
          e.preventDefault();
          dialog?.focus();
        } else if (!dialog?.contains(document.activeElement)) {
          e.preventDefault();
          (e.shiftKey ? items[items.length - 1] : items[0]).focus();
        } else if (e.shiftKey && document.activeElement === items[0]) {
          e.preventDefault();
          items[items.length - 1].focus();
        } else if (!e.shiftKey && document.activeElement === items[items.length - 1]) {
          e.preventDefault();
          items[0].focus();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handler);
      previousFocus?.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;
  return (
    <div ref={dialogRef} tabIndex={-1} className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div
        className="absolute inset-0"
        onClick={onClose}
        style={{
          backgroundColor: "rgba(45, 55, 72, 0.32)",
          backdropFilter: "blur(3px)",
          WebkitBackdropFilter: "blur(3px)",
        }}
      />
      <div className={clsx("card-lg relative flex max-h-[85vh] w-full animate-fade-in flex-col overflow-hidden", wide ? "max-w-3xl" : "max-w-lg")}>
        <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] px-5 py-4 sm:px-6">
          <h3 id={titleId} className="text-base font-semibold text-leather-300">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="btn-ghost rounded-full p-1.5 text-leather-50 hover:text-leather-300">
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto p-5 sm:p-6">{children}</div>
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
