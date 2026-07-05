// apps/admin/app/orders/page.tsx
"use client";

import React from "react";
import { gray, palette } from "@kuapa-dwaso/dashboard-ui";
import { ShoppingBag } from "lucide-react";

export default function OrdersPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", minHeight: "60vh", color: gray[500] }}>
      <ShoppingBag size={48} style={{ color: palette.field }} />
      <h2 style={{ color: gray[800], margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>Orders Ledger</h2>
      <p style={{ margin: 0, fontSize: "0.875rem", maxWidth: "360px", textAlign: "center", lineHeight: 1.5 }}>
        The Buyer Orders ledger resides in the main self-service client dashboard. Platform admins can view and audit matching contracts here in later phases.
      </p>
    </div>
  );
}
