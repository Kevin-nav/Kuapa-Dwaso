"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ToastTone = "success" | "error" | "info";

type ToastInput = {
  message: string;
  tone?: ToastTone;
  durationMs?: number;
};

type ToastItem = Required<Pick<ToastInput, "message" | "tone">> & {
  id: number;
  durationMs: number;
};

type ToastContextValue = {
  showToast: (input: ToastInput | string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((input: ToastInput | string) => {
    const normalized = typeof input === "string" ? { message: input } : input;
    const message = normalized.message.trim();
    if (message.length === 0) return;
    const item: ToastItem = {
      id: nextId.current++,
      message,
      tone: normalized.tone ?? "success",
      durationMs: normalized.durationMs ?? 4200,
    };
    setToasts((current) => [...current.slice(-2), item]);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-atomic="true"
        aria-live="polite"
        style={{
          display: "grid",
          gap: 10,
          left: "50%",
          maxWidth: "min(92vw, 560px)",
          pointerEvents: "none",
          position: "fixed",
          top: 18,
          transform: "translateX(-50%)",
          width: "max-content",
          zIndex: 10000,
        }}
      >
        {toasts.map((toast) => (
          <ToastMessage key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastMessage({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: number) => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.id), toast.durationMs);
    return () => window.clearTimeout(timer);
  }, [onDismiss, toast.durationMs, toast.id]);

  const colors =
    toast.tone === "error"
      ? { background: "#7f1d1d", border: "#fca5a5" }
      : toast.tone === "info"
        ? { background: "#173d2b", border: "#86b89d" }
        : { background: "#14532d", border: "#86efac" };

  return (
    <div
      role={toast.tone === "error" ? "alert" : "status"}
      style={{
        alignItems: "center",
        background: colors.background,
        border: `1px solid ${colors.border}`,
        borderRadius: 14,
        boxShadow: "0 14px 38px rgba(15, 31, 20, 0.24)",
        color: "#fff",
        display: "flex",
        fontSize: 14,
        fontWeight: 700,
        gap: 12,
        justifyContent: "space-between",
        lineHeight: 1.35,
        minWidth: "min(88vw, 320px)",
        padding: "12px 14px 12px 16px",
        pointerEvents: "auto",
      }}
    >
      <span>{toast.message}</span>
      <button
        aria-label="Dismiss notification"
        onClick={() => onDismiss(toast.id)}
        style={{
          background: "transparent",
          border: 0,
          color: "inherit",
          cursor: "pointer",
          font: "inherit",
          fontSize: 18,
          lineHeight: 1,
          opacity: 0.8,
          padding: 2,
        }}
        type="button"
      >
        x
      </button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (context === null) {
    throw new Error("useToast must be used within ToastProvider.");
  }
  return context;
}
