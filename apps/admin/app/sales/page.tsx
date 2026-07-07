"use client";

import { DataTable, StatusBadge, gray, palette } from "@kuapa-dwaso/dashboard-ui";
import { OperationalAccessGate } from "../operational/OperationalAccessGate";
import { useOperationalAdminData } from "../operational/useOperationalAdminData";

export default function SalesPage() {
  const { access, sales, farmers, buyers, orders, inventory, warehouses } = useOperationalAdminData();

  const columns = [
    {
      key: "farmerId",
      header: "Farmer",
      render: (row: Record<string, unknown>) => farmers.find((farmer) => farmer.id === row.farmerId)?.fullName ?? "Unknown",
    },
    {
      key: "buyerOrderId",
      header: "Buyer",
      render: (row: Record<string, unknown>) => {
        const order = orders.find((item) => item.id === row.buyerOrderId);
        return buyers.find((buyer) => buyer.id === order?.buyerId)?.fullName ?? "Unknown";
      },
    },
    {
      key: "inventoryBatchId",
      header: "Receipt",
      render: (row: Record<string, unknown>) => inventory.find((item) => item.id === row.inventoryBatchId)?.receiptCode ?? String(row.inventoryBatchId),
    },
    { key: "quantitySold", header: "Quantity", type: "numeric" as const, render: (row: Record<string, unknown>) => `${String(row.quantitySold)} ${String(row.unit)}` },
    { key: "grossAmount", header: "Gross", type: "numeric" as const, render: (row: Record<string, unknown>) => `GHS ${Number(row.grossAmount ?? 0).toFixed(2)}` },
    { key: "netAmountDueToFarmer", header: "Farmer Net", type: "numeric" as const, render: (row: Record<string, unknown>) => `GHS ${Number(row.netAmountDueToFarmer ?? 0).toFixed(2)}` },
    { key: "paymentStatus", header: "Payment", render: (row: Record<string, unknown>) => <StatusBadge status={String(row.paymentStatus)} /> },
  ];

  return (
    <OperationalAccessGate
      firebaseUser={access.firebaseUser}
      principal={access.principal}
      isAuthLoading={access.isAuthLoading}
      isDataLoading={access.isDataLoading}
      isAllowed={access.canReadSales}
      limitedMessage="Sales ledger access requires sales:read for your assigned scope."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: gray[900], margin: 0 }}>Sales Records</h1>
          <p style={{ fontSize: "0.875rem", color: gray[500], margin: "4px 0 0" }}>
            Gross sales, farmer net amounts, deductions, and payment status.
          </p>
        </div>

        <DataTable
          data={sales}
          columns={columns}
          rowIdKey="id"
          searchKey="paymentStatus"
          searchPlaceholder="Search payment status..."
          filters={[
            { key: "paymentStatus", label: "Filter Payment", options: ["pending", "part_paid", "paid", "withheld", "disputed"].map((value) => ({ value, label: value.replace(/_/g, " ") })) },
          ]}
          drawerTitle={(row) => `Sale ${String(row.id).slice(-8)}`}
          drawerContent={(row) => {
            const farmer = farmers.find((item) => item.id === row.farmerId);
            const batch = inventory.find((item) => item.id === row.inventoryBatchId);
            const warehouse = warehouses.find((item) => item.id === row.warehouseId);
            const deductions = (row.deductions as Record<string, unknown>[] | undefined) ?? [];
            const totalDeductions = Number(row.grossAmount ?? 0) - Number(row.netAmountDueToFarmer ?? 0);

            return (
              <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                <section style={{ border: `1px solid ${gray[100]}`, borderRadius: "8px", background: gray[25], padding: "16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <Field label="Farmer" value={String(farmer?.fullName ?? "Unknown")} />
                  <Field label="Warehouse" value={String(warehouse?.name ?? "Unknown")} />
                  <Field label="Receipt" value={String(batch?.receiptCode ?? row.inventoryBatchId)} />
                  <Field label="Price per unit" value={`GHS ${Number(row.pricePerUnit ?? 0).toFixed(2)}`} />
                  <Field label="Total deductions" value={`GHS ${totalDeductions.toFixed(2)}`} />
                  <Field label="Payment" value={String(row.paymentStatus)} />
                </section>

                <section style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <span style={{ color: gray[500], fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase" }}>Deductions ({deductions.length})</span>
                  {deductions.length === 0 ? (
                    <p style={{ color: gray[500], margin: 0 }}>No deduction records are visible.</p>
                  ) : (
                    deductions.map((deduction, index) => (
                      <div key={String(deduction._id ?? deduction.id ?? index)} style={{ border: `1px solid ${gray[100]}`, borderRadius: "6px", padding: "10px 12px", display: "flex", justifyContent: "space-between", gap: "10px" }}>
                        <span style={{ color: gray[800], fontSize: "0.875rem", fontWeight: 700 }}>{String(deduction.label ?? "Deduction")}</span>
                        <span style={{ color: palette.field, fontSize: "0.8125rem", fontWeight: 800 }}>GHS {Number(deduction.amount ?? 0).toFixed(2)}</span>
                      </div>
                    ))
                  )}
                </section>
              </div>
            );
          }}
        />
      </div>
    </OperationalAccessGate>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span style={{ color: gray[500], fontSize: "0.75rem", fontWeight: 700 }}>{label}</span>
      <p style={{ color: gray[800], fontSize: "0.875rem", fontWeight: 700, margin: "2px 0 0" }}>{value}</p>
    </div>
  );
}
