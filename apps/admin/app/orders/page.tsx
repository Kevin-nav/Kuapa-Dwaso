"use client";

import { DataTable, StatusBadge, gray, palette } from "@kuapa-dwaso/dashboard-ui";
import { OperationalAccessGate } from "../operational/OperationalAccessGate";
import { useOperationalAdminData } from "../operational/useOperationalAdminData";

export default function OrdersPage() {
  const { access, orders, buyers, inventory, warehouses } = useOperationalAdminData();

  const columns = [
    { key: "cropType", header: "Crop", type: "text" as const },
    {
      key: "buyerId",
      header: "Buyer",
      render: (row: Record<string, unknown>) => buyers.find((buyer) => buyer.id === row.buyerId)?.fullName ?? "Unknown",
    },
    { key: "destinationMarket", header: "Destination", type: "text" as const },
    {
      key: "requestedQuantity",
      header: "Quantity",
      type: "numeric" as const,
      render: (row: Record<string, unknown>) => `${String(row.requestedQuantity)} ${String(row.unit)}`,
    },
    {
      key: "totalAmount",
      header: "Total",
      type: "numeric" as const,
      render: (row: Record<string, unknown>) => row.totalAmount === undefined ? "Unpriced" : `GHS ${Number(row.totalAmount).toFixed(2)}`,
    },
    { key: "paymentStatus", header: "Payment", render: (row: Record<string, unknown>) => <StatusBadge status={String(row.paymentStatus)} /> },
    { key: "status", header: "Status", render: (row: Record<string, unknown>) => <StatusBadge status={String(row.status)} /> },
  ];

  return (
    <OperationalAccessGate
      firebaseUser={access.firebaseUser}
      principal={access.principal}
      isAuthLoading={access.isAuthLoading}
      isDataLoading={access.isDataLoading}
      isAllowed={access.canReadOrders}
      limitedMessage="Orders ledger access requires orders:read for your assigned scope."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: gray[900], margin: 0 }}>Orders Ledger</h1>
          <p style={{ fontSize: "0.875rem", color: gray[500], margin: "4px 0 0" }}>
            Buyer demand, reservations, payment state, and matched inventory.
          </p>
        </div>

        <DataTable
          data={orders}
          columns={columns}
          rowIdKey="id"
          searchKey="cropType"
          searchPlaceholder="Search crop..."
          filters={[
            { key: "status", label: "Filter Status", options: ["submitted", "reserved", "preparing", "ready_for_dispatch", "delivered", "completed", "cancelled", "unfulfilled", "disputed"].map((value) => ({ value, label: value.replace(/_/g, " ") })) },
            { key: "paymentStatus", label: "Filter Payment", options: ["awaiting_payment", "deposit_paid", "fully_paid", "payment_on_delivery", "failed", "refunded", "disputed"].map((value) => ({ value, label: value.replace(/_/g, " ") })) },
          ]}
          drawerTitle={(row) => `${String(row.cropType)} order`}
          drawerContent={(row) => {
            const buyer = buyers.find((item) => item.id === row.buyerId);
            const batches = (row.matchedInventoryBatchIds as string[] | undefined ?? [])
              .map((id) => inventory.find((item) => item.id === id))
              .filter((item) => item !== undefined);
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                <section style={{ border: `1px solid ${gray[100]}`, borderRadius: "8px", background: gray[25], padding: "16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <Field label="Buyer" value={String(buyer?.fullName ?? "Unknown")} />
                  <Field label="Destination" value={String(row.destinationMarket)} />
                  <Field label="Requested" value={`${String(row.requestedQuantity)} ${String(row.unit)}`} />
                  <Field label="Preferred grade" value={String(row.preferredGrade ?? "Any")} />
                  <Field label="Subtotal" value={row.subtotalAmount === undefined ? "Unpriced" : `GHS ${Number(row.subtotalAmount).toFixed(2)}`} />
                  <Field label="Service fee" value={row.serviceFee === undefined ? "None" : `GHS ${Number(row.serviceFee).toFixed(2)}`} />
                </section>

                <section style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <span style={{ color: gray[500], fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase" }}>Reservations ({batches.length})</span>
                  {batches.length === 0 ? (
                    <p style={{ color: gray[500], margin: 0 }}>No matched inventory is visible.</p>
                  ) : (
                    batches.map((batch) => {
                      const warehouse = warehouses.find((item) => item.id === batch.warehouseId);
                      return (
                        <div key={batch.id} style={{ border: `1px solid ${gray[100]}`, borderRadius: "6px", padding: "10px 12px", display: "flex", justifyContent: "space-between", gap: "10px" }}>
                          <div>
                            <strong style={{ color: gray[900], fontSize: "0.875rem" }}>{String(batch.receiptCode)}</strong>
                            <p style={{ color: gray[500], fontSize: "0.75rem", margin: "2px 0 0" }}>{String(warehouse?.name ?? "Unknown warehouse")}</p>
                          </div>
                          <span style={{ color: palette.field, fontSize: "0.8125rem", fontWeight: 800 }}>{String(batch.quantityAvailable)} {String(batch.unit)}</span>
                        </div>
                      );
                    })
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
