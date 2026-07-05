// apps/admin/app/sales/page.tsx
"use client";

import React from "react";
import { gray, palette } from "@kuapa-dwaso/dashboard-ui";
import { DollarSign } from "lucide-react";

export default function SalesPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", minHeight: "60vh", color: gray[500] }}>
      <DollarSign size={48} style={{ color: palette.field }} />
      <h2 style={{ color: gray[800], margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>Sales Records</h2>
      <p style={{ margin: 0, fontSize: "0.875rem", maxWidth: "360px", textAlign: "center", lineHeight: 1.5 }}>
        Gross sale listings and automatic platform storage fee deductions are processed automatically upon buyer dispatch confirmation.
      </p>
    </div>
  );
}
