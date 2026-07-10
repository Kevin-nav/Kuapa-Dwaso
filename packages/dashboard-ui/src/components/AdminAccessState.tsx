// packages/dashboard-ui/src/components/AdminAccessState.tsx
"use client";

import type { ReactNode } from "react";
import { AlertTriangle, Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import { gray, palette, status } from "@kuapa-dwaso/design-tokens";

export type AdminAccessStateProps = {
  variant: "denied" | "limited" | "ready" | "loading";
  title: string;
  message: string;
  detail?: string;
  action?: ReactNode;
};

export function AdminAccessState({ variant, title, message, detail, action }: AdminAccessStateProps) {
  const Icon =
    variant === "denied"
      ? LockKeyhole
      : variant === "limited"
        ? AlertTriangle
        : variant === "loading"
          ? Loader2
          : ShieldCheck;

  const accent =
    variant === "denied"
      ? status.danger
      : variant === "limited"
        ? status.warning
        : variant === "loading"
          ? status.info
          : palette.field;

  const background =
    variant === "denied"
      ? status.dangerBg
      : variant === "limited"
        ? status.warningBg
        : variant === "loading"
          ? status.infoBg
          : status.successBg;

  const border =
    variant === "denied"
      ? status.dangerBorder
      : variant === "limited"
        ? status.warningBorder
        : variant === "loading"
          ? status.infoBorder
          : status.successBorder;

  return (
    <section
      style={{
        alignItems: "flex-start",
        background,
        border: `1px solid ${border}`,
        borderRadius: "8px",
        color: gray[900],
        display: "flex",
        gap: "14px",
        maxWidth: "760px",
        padding: "18px",
      }}
    >
      {variant === "loading" && (
        <style>{`
          @keyframes admin-spin {
            to { transform: rotate(360deg); }
          }
          .admin-animate-spin {
            animation: admin-spin 1.2s linear infinite;
          }
        `}</style>
      )}
      <div
        style={{
          alignItems: "center",
          backgroundColor: "white",
          border: `1px solid ${border}`,
          borderRadius: "8px",
          color: accent,
          display: "flex",
          flexShrink: 0,
          height: "38px",
          justifyContent: "center",
          width: "38px",
        }}
      >
        <Icon size={20} className={variant === "loading" ? "admin-animate-spin" : undefined} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", minWidth: 0 }}>
        <h2 style={{ color: gray[900], fontSize: "1rem", fontWeight: 800, margin: 0 }}>{title}</h2>
        <p style={{ color: gray[700], fontSize: "0.875rem", lineHeight: 1.5, margin: 0 }}>{message}</p>
        {detail !== undefined && (
          <p style={{ color: gray[600], fontSize: "0.8125rem", lineHeight: 1.45, margin: 0 }}>{detail}</p>
        )}
        {action !== undefined && <div style={{ marginTop: "4px" }}>{action}</div>}
      </div>
    </section>
  );
}

