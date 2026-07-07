// apps/admin/app/page.tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { MetricCard, useWarehouseFilter, gray, palette, status } from "@kuapa-dwaso/dashboard-ui";
import { AlertTriangle, ChevronRight, Boxes } from "lucide-react";
import { OperationalAccessGate } from "./operational/OperationalAccessGate";
import { useOperationalAdminData } from "./operational/useOperationalAdminData";

export default function OverviewPage() {
  const { selectedWarehouseId } = useWarehouseFilter();
  const {
    access,
    warehouses,
    inventory,
    disputes,
    auditLogs,
    orders,
    sales,
    dispatches,
    summaryStats,
  } = useOperationalAdminData();
  const [now] = useState(() => Date.now());

  // Filter lists based on selected warehouse
  const filteredWarehouses = selectedWarehouseId === "all" 
    ? warehouses 
    : warehouses.filter(w => w.id === selectedWarehouseId);

  const filteredInventory = selectedWarehouseId === "all"
    ? inventory
    : inventory.filter(i => i.warehouseId === selectedWarehouseId);

  const filteredDisputes = selectedWarehouseId === "all"
    ? disputes
    : disputes.filter(d => {
        if (d.entityType === "inventory_batch") {
          const batch = inventory.find(i => i.id === d.entityId);
          return batch?.warehouseId === selectedWarehouseId;
        }
        return true;
      });

  // Calculate statistics based on filtered data
  const totalCapacity = filteredWarehouses.reduce((acc, w) => acc + (w.storageCapacity || 0), 0);
  const totalStock = filteredInventory.reduce((acc, i) => acc + i.quantityAvailable, 0);
  const capacityUtilPercent = totalCapacity > 0 ? Math.round((totalStock / totalCapacity) * 100) : 0;
  const activeDisputes = filteredDisputes.filter(d => d.status === "open" || d.status === "under_review");

  // Nearing Expiry items: sellByDate exists and is in the future but less than 30 days, or past (expired)
  const nearingExpiry = filteredInventory.filter(item => {
    if (!item.sellByDate) return false;
    return item.status === "available" || item.status === "partially_reserved" || item.status === "reserved";
  }).sort((a, b) => (a.sellByDate || 0) - (b.sellByDate || 0));

  return (
    <OperationalAccessGate
      firebaseUser={access.firebaseUser}
      principal={access.principal}
      isAuthLoading={access.isAuthLoading}
      isDataLoading={access.isDataLoading}
      isAllowed={access.canReadReports || access.canReadInventory || access.canReadDisputes}
      limitedMessage="Overview requires reporting, inventory, or dispute read access for at least one assigned scope."
    >
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Page Header */}
      <div>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: gray[900], margin: 0 }}>
          Operations Overview
        </h1>
        <p style={{ fontSize: "0.875rem", color: gray[500], margin: "4px 0 0" }}>
          Platform state intelligence and urgent action items.
        </p>
      </div>

      {/* Metrics Row */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "20px" }}>
        <MetricCard
          label="Total Warehouses"
          value={filteredWarehouses.length}
          contextLine={`${filteredWarehouses.filter(w => w.status === "active").length} active status`}
          accentColor={palette.field}
        />
        <MetricCard
          label="Active Inventory Stock"
          value={`${totalStock.toLocaleString()} bags`}
          contextLine={`Utilisation: ${capacityUtilPercent}% of capacity`}
          accentColor={palette.sky}
        />
        <MetricCard
          label="Active Disputes"
          value={activeDisputes.length}
          contextLine={`${filteredDisputes.filter(d => d.status === "open").length} open, require review`}
          accentColor={status.warning}
        />
        <MetricCard
          label="Recent System Logs"
          value={auditLogs.length}
          contextLine="Updated in real time"
          accentColor={gray[500]}
        />
        <MetricCard
          label="Orders / Sales / Dispatches"
          value={`${orders.length} / ${sales.length} / ${dispatches.length}`}
          contextLine={`${summaryStats.openDisputesCount} open disputes in scope`}
          accentColor={palette.accent}
        />
      </div>

      {/* Grid: Actions & Feeds */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(450px, 1fr))", gap: "24px" }}>
        {/* Left: Urgent Attention widgets */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* Open Disputes */}
          <div style={{ backgroundColor: gray[0], border: `1px solid ${gray[100]}`, borderRadius: "10px", padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <AlertTriangle size={20} style={{ color: status.danger }} />
                <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: gray[900] }}>
                  Disputes Requiring Action
                </h3>
              </div>
              <Link href="/disputes" style={{ fontSize: "0.8125rem", color: palette.sky, fontWeight: 600, textDecoration: "none" }}>
                View All Disputes
              </Link>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {activeDisputes.length === 0 ? (
                <p style={{ margin: 0, fontSize: "0.875rem", color: gray[500], padding: "10px 0" }}>
                  Nice work! No open disputes at this time.
                </p>
              ) : (
                activeDisputes.map(disp => (
                  <div
                    key={disp.id}
                    style={{
                      padding: "12px 14px",
                      borderRadius: "6px",
                      backgroundColor: disp.status === "open" ? status.dangerBg : status.warningBg,
                      borderLeft: "none",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}
                  >
                    <div>
                      <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 700, color: gray[900] }}>
                        {disp.title}
                      </p>
                      <p style={{ margin: "4px 0 0", fontSize: "0.75rem", color: gray[700], overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" }}>
                        {disp.summary}
                      </p>
                    </div>
                    <Link
                      href="/disputes"
                      style={{
                        padding: "6px",
                        borderRadius: "50%",
                        backgroundColor: "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: `1px solid ${gray[100]}`,
                        color: gray[700]
                      }}
                    >
                      <ChevronRight size={14} />
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Stock Nearing Expiry */}
          <div style={{ backgroundColor: gray[0], border: `1px solid ${gray[100]}`, borderRadius: "10px", padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Boxes size={20} style={{ color: status.warning }} />
                <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: gray[900] }}>
                  Stock Expiry Warnings
                </h3>
              </div>
              <Link href="/inventory" style={{ fontSize: "0.8125rem", color: palette.sky, fontWeight: 600, textDecoration: "none" }}>
                Oversight Panel
              </Link>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {nearingExpiry.slice(0, 3).map(batch => {
                const daysLeft = batch.sellByDate ? Math.round((batch.sellByDate - now) / (24 * 60 * 60 * 1000)) : 0;
                const isOverdue = daysLeft <= 0;
                
                return (
                  <div
                    key={batch.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 12px",
                      border: `1px solid ${gray[100]}`,
                      borderRadius: "6px",
                      backgroundColor: isOverdue ? status.dangerBg : daysLeft <= 14 ? status.warningBg : "transparent",
                    }}
                  >
                    <div>
                      <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: gray[900] }}>
                        {batch.receiptCode} · {batch.cropType} ({batch.grade})
                      </span>
                      <div style={{ display: "flex", gap: "12px", marginTop: "2px", fontSize: "0.75rem", color: gray[500] }}>
                        <span>Qty: {batch.quantityAvailable} {batch.unit}s</span>
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        color: isOverdue ? status.danger : daysLeft <= 14 ? status.warning : status.success,
                      }}
                    >
                      {isOverdue ? "Expired!" : `${daysLeft} days left`}
                    </span>
                  </div>
                );
              })}
              {nearingExpiry.length === 0 && (
                <p style={{ margin: 0, fontSize: "0.875rem", color: gray[500], padding: "10px 0" }}>
                  All inventory stock is fresh.
                </p>
              )}
            </div>
          </div>

        </div>

        {/* Right: Warehouse Utilization Table */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* Warehouse intelligence Utilization Summary */}
          <div style={{ backgroundColor: gray[0], border: `1px solid ${gray[100]}`, borderRadius: "10px", padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: gray[900] }}>
              Warehouse Capacity Utilization
            </h3>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {filteredWarehouses.map(wh => {
                const whStock = inventory.filter(i => i.warehouseId === wh.id).reduce((sum, item) => sum + item.quantityAvailable, 0);
                const percent = wh.storageCapacity ? Math.round((whStock / wh.storageCapacity) * 100) : 0;
                
                let barColor: string = palette.field;
                if (percent > 85) barColor = status.danger;
                else if (percent > 65) barColor = status.warning;
                
                return (
                  <div key={wh.id} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8125rem" }}>
                      <span style={{ fontWeight: 700, color: gray[800] }}>{wh.name}</span>
                      <span style={{ fontWeight: 600, color: gray[500] }}>
                        {whStock} / {wh.storageCapacity} {wh.capacityUnit} ({percent}%)
                      </span>
                    </div>
                    {/* Progress Bar */}
                    <div style={{ height: "8px", width: "100%", backgroundColor: gray[50], borderRadius: "4px", overflow: "hidden", border: `1px solid ${gray[100]}` }}>
                      <div style={{ height: "100%", width: `${Math.min(percent, 100)}%`, backgroundColor: barColor, borderRadius: "4px" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Audit Actions Activity Feed */}
          <div style={{ backgroundColor: gray[0], border: `1px solid ${gray[100]}`, borderRadius: "10px", padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: gray[900] }}>
                Recent Platform Activities
              </h3>
              <Link href="/audit-logs" style={{ fontSize: "0.8125rem", color: palette.sky, fontWeight: 600, textDecoration: "none" }}>
                Full Audit Trail
              </Link>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {auditLogs.slice(0, 4).map(log => (
                <div key={log.id} style={{ display: "flex", gap: "12px", alignItems: "flex-start", fontSize: "0.8125rem" }}>
                  <div
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor: palette.field,
                      marginTop: "5px",
                      flexShrink: 0
                    }}
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    <p style={{ margin: 0, color: gray[800], fontWeight: 500 }}>
                      <strong style={{ fontWeight: 700 }}>{log.actorName}</strong> completed action <span style={{ fontFamily: "monospace", color: palette.sky, fontWeight: 600 }}>{log.action}</span> on {log.entityType}
                    </p>
                    <span style={{ fontSize: "0.75rem", color: gray[500] }}>
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
    </OperationalAccessGate>
  );
}
