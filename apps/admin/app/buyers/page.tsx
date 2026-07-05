// apps/admin/app/buyers/page.tsx
"use client";

import { useAdminData, DataTable, StatusBadge, gray } from "@kuapa-dwaso/dashboard-ui";

export default function BuyersPage() {
  const { buyers } = useAdminData();

  const columns = [
    { key: "fullName", header: "Full Name", type: "text" as const },
    { key: "phoneNumber", header: "Phone Number", type: "text" as const },
    { key: "buyerType", header: "Buyer Type", type: "text" as const, render: (row: any) => <span style={{ textTransform: "capitalize" }}>{row.buyerType.replace("_", " ")}</span> },
    { key: "organizationName", header: "Organization", type: "text" as const, render: (row: any) => row.organizationName || <span style={{ color: gray[400], fontStyle: "italic" }}>None</span> },
    { key: "destinationMarket", header: "Target Market", type: "text" as const, render: (row: any) => row.destinationMarket || <span style={{ color: gray[400], fontStyle: "italic" }}>None</span> },
    {
      key: "verificationStatus",
      header: "Verification",
      render: (row: any) => <StatusBadge status={row.verificationStatus} />
    },
    {
      key: "status",
      header: "Status",
      render: (row: any) => <StatusBadge status={row.status} />
    }
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: gray[900], margin: 0 }}>
          Buyer Directory
        </h1>
        <p style={{ fontSize: "0.875rem", color: gray[500], margin: "4px 0 0" }}>
          Monitor buyer types, verification stages, and delivery locations.
        </p>
      </div>

      {/* Grid */}
      <DataTable
        data={buyers}
        columns={columns}
        rowIdKey="id"
        searchKey="fullName"
        searchPlaceholder="Search buyer name..."
        filters={[
          {
            key: "buyerType",
            label: "Filter Type",
            options: [
              { value: "processor", label: "Processor" },
              { value: "market_trader", label: "Market Trader" },
              { value: "retailer", label: "Retailer" }
            ]
          },
          {
            key: "verificationStatus",
            label: "Filter Verification",
            options: [
              { value: "verified", label: "Verified" },
              { value: "pending", label: "Pending" }
            ]
          }
        ]}
      />
    </div>
  );
}
