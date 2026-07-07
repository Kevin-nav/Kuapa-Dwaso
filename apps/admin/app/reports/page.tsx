"use client";

import { DataTable, MetricCard, StatusBadge, gray, palette, status } from "@kuapa-dwaso/dashboard-ui";
import { OperationalAccessGate } from "../operational/OperationalAccessGate";
import { useOperationalAdminData } from "../operational/useOperationalAdminData";

export default function ReportsPage() {
  const { access, summaryStats, warehouses, inventory, orders, sales, dispatches, disputes } = useOperationalAdminData();
  const summary = summaryStats.platformSummary ?? {};
  const grossSales = Number(summary.grossSalesAmount ?? sales.reduce((total, sale) => total + Number(sale.grossAmount ?? 0), 0));
  const farmerNet = Number(summary.netFarmerAmountDue ?? sales.reduce((total, sale) => total + Number(sale.netAmountDueToFarmer ?? 0), 0));

  const warehouseRows: Record<string, any>[] = warehouses.map((warehouse) => {
    const stock = inventory
      .filter((item) => item.warehouseId === warehouse.id)
      .reduce((total, item) => total + Number(item.quantityAvailable ?? 0), 0);
    const capacity = Number(warehouse.storageCapacity ?? 0);
    return {
      ...warehouse,
      availableStock: stock,
      utilization: capacity > 0 ? Math.round((stock / capacity) * 100) : 0,
    };
  });

  return (
    <OperationalAccessGate
      firebaseUser={access.firebaseUser}
      principal={access.principal}
      isAuthLoading={access.isAuthLoading}
      isDataLoading={access.isDataLoading}
      isAllowed={access.canReadReports}
      limitedMessage="Reports require reports:read for your assigned scope."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: gray[900], margin: 0 }}>Platform Reports</h1>
          <p style={{ fontSize: "0.875rem", color: gray[500], margin: "4px 0 0" }}>
            Scoped operational totals for inventory, orders, sales, dispatches, and disputes.
          </p>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "20px" }}>
          <MetricCard label="Warehouses" value={Number(summary.warehouses ?? warehouses.length)} contextLine={`${warehouses.filter((item) => item.status === "active").length} active in loaded scope`} accentColor={palette.field} />
          <MetricCard label="Inventory Batches" value={Number(summary.inventoryBatches ?? inventory.length)} contextLine={`${Number(summary.availableInventoryBatches ?? inventory.filter((item) => item.status === "available").length)} available`} accentColor={palette.sky} />
          <MetricCard label="Orders / Sales" value={`${Number(summary.buyerOrders ?? orders.length)} / ${Number(summary.saleRecords ?? sales.length)}`} contextLine={`Gross GHS ${grossSales.toFixed(2)}`} accentColor={palette.accent} />
          <MetricCard label="Farmer Net Due" value={`GHS ${farmerNet.toFixed(2)}`} contextLine="After visible deductions" accentColor={status.success} />
          <MetricCard label="Dispatches" value={Number(summary.dispatches ?? dispatches.length)} contextLine={`${Number(summary.inTransitDispatches ?? dispatches.filter((item) => ["departed", "in_transit", "arrived"].includes(String(item.status))).length)} in transit`} accentColor={status.warning} />
          <MetricCard label="Open Disputes" value={Number(summary.openDisputes ?? disputes.filter((item) => item.status === "open").length)} contextLine={`${Number(summary.disputes ?? disputes.length)} total visible`} accentColor={status.danger} />
        </div>

        <DataTable
          data={warehouseRows}
          columns={[
            { key: "code", header: "Code", type: "text" as const },
            { key: "name", header: "Warehouse", type: "text" as const },
            { key: "region", header: "Region", type: "text" as const },
            { key: "availableStock", header: "Available Stock", type: "numeric" as const, render: (row) => `${String(row.availableStock)} ${String(row.capacityUnit ?? "units")}` },
            { key: "utilization", header: "Utilization", type: "numeric" as const, render: (row) => `${String(row.utilization)}%` },
            { key: "status", header: "Status", render: (row) => <StatusBadge status={String(row.status)} /> },
          ]}
          rowIdKey="id"
          searchKey="name"
          searchPlaceholder="Search warehouse..."
          filters={[
            { key: "status", label: "Filter Status", options: ["active", "inactive", "maintenance", "closed"].map((value) => ({ value, label: value })) },
          ]}
        />
      </div>
    </OperationalAccessGate>
  );
}
