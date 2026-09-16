import type { ReactNode } from "react";

const dateFormatter = new Intl.DateTimeFormat("en-GH", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatDate(value?: number): string {
  return value === undefined ? "To be confirmed" : dateFormatter.format(value);
}

export function formatMoney(value: number, currency = "GHS"): string {
  return `${currency} ${value.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function humanizeStatus(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function statusLabel(value: string): string {
  const labels: Record<string, string> = {
    pending: "Payment due",
    part_paid: "Part payment",
    paid: "Paid",
    withheld: "Held for review",
    disputed: "Needs attention",
    approved: "Approved",
    processing: "Being processed",
    failed: "Payment failed",
    manual_review: "Needs attention",
    planned: "Scheduled",
    loading: "Being loaded",
    departed: "On the way",
    in_transit: "On the way",
    arrived: "Arrived",
    delivered: "Delivered",
    closed: "Complete",
    issue_reported: "Delayed",
    received: "Received",
    verified: "Checked",
    available: "Available",
    partially_reserved: "Partly reserved",
    reserved: "Reserved",
    partially_sold: "Partly sold",
    sold: "Sold",
    prepared_for_dispatch: "Preparing collection",
    dispatched: "Collected",
    withdrawn: "Withdrawn",
    expired: "Expired",
    spoiled: "Needs attention",
  };
  return labels[value] ?? humanizeStatus(value);
}

export function statusTone(value: string): "success" | "warning" | "danger" | "neutral" {
  if (["paid", "approved", "delivered", "closed", "verified", "available", "sold", "dispatched"].includes(value)) {
    return "success";
  }
  if (["failed", "disputed", "manual_review", "issue_reported", "spoiled", "expired"].includes(value)) {
    return "danger";
  }
  if (["pending", "part_paid", "withheld", "processing", "planned", "loading", "departed", "in_transit", "arrived", "received", "partially_reserved", "reserved", "partially_sold", "prepared_for_dispatch"].includes(value)) {
    return "warning";
  }
  return "neutral";
}

export function StatusChip({ value }: { value: string }) {
  return <span className={`status-chip status-${statusTone(value)}`}>{statusLabel(value)}</span>;
}

export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
      <span style={{ color: "var(--color-text-muted)", fontSize: "0.8rem" }}>{label}</span>
      <strong style={{ color: "var(--color-ink)", fontSize: "0.95rem", lineHeight: 1.3 }}>{children}</strong>
    </div>
  );
}

export function EmptyCard({ title, hint, action }: { title: string; hint: string; action?: ReactNode }) {
  return (
    <div className="farmer-card" style={{ gap: "8px" }}>
      <span className="card-title">{title}</span>
      <span className="card-meta">{hint}</span>
      {action}
    </div>
  );
}
