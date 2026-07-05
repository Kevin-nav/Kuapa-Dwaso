// packages/dashboard-ui/src/components/StatusBadge.tsx
"use client";

import { status as statusTokens } from "@kuapa-dwaso/design-tokens";

export type StatusBadgeProps = {
  status: string;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const norm = status.toLowerCase().replace(/_/g, " ");

  let colors: string = statusTokens.neutral;
  let bg: string = statusTokens.neutralBg;
  let border: string = statusTokens.neutralBorder;

  // Mapping based on the admin-page.md spec
  if (
    norm === "verified" ||
    norm === "active" ||
    norm === "approved" ||
    norm === "available" ||
    norm === "fulfilled" ||
    norm === "paid" ||
    norm === "resolved" ||
    norm === "delivered" ||
    norm === "success"
  ) {
    colors = statusTokens.success;
    bg = statusTokens.successBg;
    border = statusTokens.successBorder;
  } else if (
    norm === "pending" ||
    norm === "under review" ||
    norm === "open" ||
    norm === "expiring soon" ||
    norm === "warning" ||
    norm === "deposit paid"
  ) {
    colors = statusTokens.warning;
    bg = statusTokens.warningBg;
    border = statusTokens.warningBorder;
  } else if (
    norm === "suspended" ||
    norm === "rejected" ||
    norm === "danger" ||
    norm === "overdue" ||
    norm === "delayed" ||
    norm === "expired" ||
    norm === "spoiled"
  ) {
    colors = statusTokens.danger;
    bg = statusTokens.dangerBg;
    border = statusTokens.dangerBorder;
  } else if (
    norm === "reserved" ||
    norm === "info" ||
    norm === "in transit" ||
    norm === "scheduled"
  ) {
    colors = statusTokens.info;
    bg = statusTokens.infoBg;
    border = statusTokens.infoBorder;
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "4px 10px",
        borderRadius: "9999px",
        fontSize: "0.75rem",
        fontWeight: 600,
        color: colors,
        backgroundColor: bg,
        border: `1px solid ${border}`,
        textTransform: "capitalize",
        whiteSpace: "nowrap",
        width: "fit-content"
      }}
    >
      <span
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          backgroundColor: colors,
          display: "inline-block",
        }}
      />
      {norm}
    </span>
  );
}
