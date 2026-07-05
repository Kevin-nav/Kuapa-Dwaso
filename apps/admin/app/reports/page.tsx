// apps/admin/app/reports/page.tsx
"use client";

import React from "react";
import { gray, palette } from "@kuapa-dwaso/dashboard-ui";
import { BarChart3 } from "lucide-react";

export default function ReportsPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", minHeight: "60vh", color: gray[500] }}>
      <BarChart3 size={48} style={{ color: palette.field }} />
      <h2 style={{ color: gray[800], margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>Platform Reports & Analytics</h2>
      <p style={{ margin: 0, fontSize: "0.875rem", maxWidth: "360px", textAlign: "center", lineHeight: 1.5 }}>
        Aggregated crop intakes, warehouse capacity forecasts, dispute rates and gross platform fee income. Reports can be generated in CSV format in later development.
      </p>
    </div>
  );
}
