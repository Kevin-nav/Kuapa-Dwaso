// apps/admin/app/dispatch/page.tsx
"use client";

import React from "react";
import { gray, palette } from "@kuapa-dwaso/dashboard-ui";
import { Truck } from "lucide-react";

export default function DispatchPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", minHeight: "60vh", color: gray[500] }}>
      <Truck size={48} style={{ color: palette.field }} />
      <h2 style={{ color: gray[800], margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>Dispatch & Logistics</h2>
      <p style={{ margin: 0, fontSize: "0.875rem", maxWidth: "360px", textAlign: "center", lineHeight: 1.5 }}>
        Transporter assignments, route scheduling and delivery logs. Controlled from the Operations and Logistics consoles.
      </p>
    </div>
  );
}
