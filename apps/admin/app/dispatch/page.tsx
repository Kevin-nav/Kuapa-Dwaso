"use client";

import { DataTable, StatusBadge, gray, palette } from "@kuapa-dwaso/dashboard-ui";
import { OperationalAccessGate } from "../operational/OperationalAccessGate";
import { EvidencePanel } from "../operational/EvidencePanel";
import { useOperationalAdminData } from "../operational/useOperationalAdminData";

export default function DispatchPage() {
  const { access, dispatches, warehouses, transporters } = useOperationalAdminData();

  const columns = [
    {
      key: "warehouseId",
      header: "Warehouse",
      render: (row: Record<string, unknown>) => warehouses.find((warehouse) => warehouse.id === row.warehouseId)?.name ?? "Unknown",
    },
    { key: "destination", header: "Destination", type: "text" as const },
    {
      key: "transporterId",
      header: "Transporter",
      render: (row: Record<string, unknown>) => transporters.find((transporter) => transporter.id === row.transporterId)?.fullName ?? row.driverName ?? "Unassigned",
    },
    { key: "totalQuantity", header: "Quantity", type: "numeric" as const, render: (row: Record<string, unknown>) => `${String(row.totalQuantity)} ${String(row.unit)}` },
    { key: "plannedDepartureAt", header: "Planned", render: (row: Record<string, unknown>) => row.plannedDepartureAt === undefined ? "Not scheduled" : new Date(Number(row.plannedDepartureAt)).toLocaleString() },
    { key: "status", header: "Status", render: (row: Record<string, unknown>) => <StatusBadge status={String(row.status)} /> },
  ];

  return (
    <OperationalAccessGate
      firebaseUser={access.firebaseUser}
      principal={access.principal}
      isAuthLoading={access.isAuthLoading}
      isDataLoading={access.isDataLoading}
      isAllowed={access.canReadDispatches}
      limitedMessage="Dispatch oversight requires dispatches:read for your assigned scope."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: gray[900], margin: 0 }}>Dispatch & Logistics</h1>
          <p style={{ fontSize: "0.875rem", color: gray[500], margin: "4px 0 0" }}>
            Transporter assignment, route status, pickup/drop-off windows, and linked orders.
          </p>
        </div>

        <DataTable
          data={dispatches}
          columns={columns}
          rowIdKey="id"
          searchKey="destination"
          searchPlaceholder="Search destination..."
          filters={[
            { key: "status", label: "Filter Status", options: ["planned", "loading", "departed", "in_transit", "arrived", "delivered", "closed", "cancelled", "issue_reported"].map((value) => ({ value, label: value.replace(/_/g, " ") })) },
          ]}
          drawerTitle={(row) => `Dispatch to ${String(row.destination)}`}
          drawerContent={(row) => {
            const warehouse = warehouses.find((item) => item.id === row.warehouseId);
            const transporter = transporters.find((item) => item.id === row.transporterId);
            const orders = (row.buyerOrders as Record<string, unknown>[] | undefined) ?? [];
            const batches = (row.inventoryBatches as Record<string, unknown>[] | undefined) ?? [];

            return (
              <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                <section style={{ border: `1px solid ${gray[100]}`, borderRadius: "8px", background: gray[25], padding: "16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <Field label="Warehouse" value={String(warehouse?.name ?? "Unknown")} />
                  <Field label="Transporter" value={String(transporter?.fullName ?? row.driverName ?? "Unassigned")} />
                  <Field label="Driver phone" value={String(row.driverPhoneNumber ?? transporter?.phoneNumber ?? "Not set")} />
                  <Field label="Vehicle" value={String(row.vehicleType ?? transporter?.vehicleType ?? "Not set")} />
                  <Field label="Expected arrival" value={row.expectedArrivalAt === undefined ? "Not set" : new Date(Number(row.expectedArrivalAt)).toLocaleString()} />
                  <Field label="Transport cost" value={row.transportCost === undefined ? "Not set" : `GHS ${Number(row.transportCost).toFixed(2)}`} />
                </section>

                <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
                  <Timeline label="Departed" value={row.departedAt} />
                  <Timeline label="Arrived" value={row.arrivedAt} />
                </section>

                {access.canReadUploads && (
                  <EvidencePanel
                    actorUserId={access.actorUserId}
                    relatedEntityType="dispatch"
                    relatedEntityId={String(row.id)}
                    title="Dispatch Proof"
                    purpose="dispatch_proof_photo"
                    canManage={access.canManageUploads}
                  />
                )}

                {access.canReadUploads && transporter !== undefined && (
                  <EvidencePanel
                    actorUserId={access.actorUserId}
                    relatedEntityType="transporter_profile"
                    relatedEntityId={String(transporter.id)}
                    title="Transporter Truck Photos"
                    purpose="transporter_truck_photo"
                    canManage={access.canManageUploads}
                  />
                )}

                <section style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <span style={{ color: gray[500], fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase" }}>Linked Orders ({orders.length})</span>
                  {orders.length === 0 ? (
                    <p style={{ color: gray[500], margin: 0 }}>No linked orders are visible.</p>
                  ) : (
                    orders.map((order) => (
                      <div key={String(order._id ?? order.id)} style={{ border: `1px solid ${gray[100]}`, borderRadius: "6px", padding: "10px 12px", display: "flex", justifyContent: "space-between", gap: "10px" }}>
                        <span style={{ color: gray[800], fontSize: "0.875rem", fontWeight: 700 }}>{String(order.cropType)} to {String(order.destinationMarket)}</span>
                        <StatusBadge status={String(order.status)} />
                      </div>
                    ))
                  )}
                </section>

                <section style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <span style={{ color: gray[500], fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase" }}>Inventory Lots ({batches.length})</span>
                  {batches.map((batch) => (
                    <div key={String(batch._id ?? batch.id)} style={{ border: `1px solid ${gray[100]}`, borderRadius: "6px", padding: "10px 12px", display: "flex", justifyContent: "space-between", gap: "10px" }}>
                      <span style={{ color: gray[800], fontSize: "0.875rem", fontWeight: 700 }}>{String(batch.receiptCode ?? batch._id)}</span>
                      <span style={{ color: palette.field, fontSize: "0.8125rem", fontWeight: 800 }}>{String(batch.quantityAvailable ?? "")} {String(batch.unit ?? "")}</span>
                    </div>
                  ))}
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

function Timeline({ label, value }: { label: string; value: unknown }) {
  return (
    <div style={{ border: `1px solid ${gray[100]}`, borderRadius: "6px", padding: "10px 12px", background: gray[25] }}>
      <span style={{ color: gray[500], fontSize: "0.75rem", fontWeight: 700 }}>{label}</span>
      <p style={{ color: gray[800], fontSize: "0.875rem", fontWeight: 700, margin: "2px 0 0" }}>
        {value === undefined ? "Not recorded" : new Date(Number(value)).toLocaleString()}
      </p>
    </div>
  );
}
