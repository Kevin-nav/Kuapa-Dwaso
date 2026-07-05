// apps/admin/app/inventory/page.tsx
"use client";

import { useState } from "react";
import { useAdminData, DataTable, StatusBadge, useWarehouseFilter, gray, palette, status } from "@kuapa-dwaso/dashboard-ui";

export default function InventoryPage() {
  const { selectedWarehouseId } = useWarehouseFilter();
  const { inventory, warehouses, farmers, disputes, auditLogs } = useAdminData();
  const [selectedLot, setSelectedLot] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("details");

  const filteredInventory = selectedWarehouseId === "all"
    ? inventory
    : inventory.filter(i => i.warehouseId === selectedWarehouseId);

  // Proximity sell-by date styling helper
  const renderSellBy = (row: any) => {
    if (!row.sellByDate) return <span style={{ color: gray[400] }}>No date set</span>;
    
    const daysLeft = Math.round((row.sellByDate - Date.now()) / (24 * 60 * 60 * 1000));
    let color: string = gray[700];
    let icon = "";
    
    if (daysLeft <= 0) {
      color = status.danger;
      icon = "⚠️ ";
    } else if (daysLeft <= 14) {
      color = status.warning;
      icon = "⏳ ";
    }

    return (
      <span style={{ color, fontWeight: daysLeft <= 14 ? 700 : 500, fontVariantNumeric: "tabular-nums" }}>
        {icon}{new Date(row.sellByDate).toLocaleDateString()} ({daysLeft <= 0 ? "Expired" : `${daysLeft}d left`})
      </span>
    );
  };

  const columns = [
    { key: "receiptCode", header: "Receipt Code", type: "text" as const },
    {
      key: "farmerId",
      header: "Farmer",
      render: (row: any) => {
        const farmer = farmers.find(f => f.id === row.farmerId);
        return farmer ? farmer.fullName : "Unknown";
      }
    },
    {
      key: "warehouseId",
      header: "Warehouse",
      render: (row: any) => {
        const wh = warehouses.find(w => w.id === row.warehouseId);
        return wh ? wh.name : "Unknown";
      }
    },
    { key: "cropType", header: "Crop", type: "text" as const },
    {
      key: "quantityAvailable",
      header: "Available Stock",
      type: "numeric" as const,
      render: (row: any) => `${row.quantityAvailable} / ${row.quantityReceived} ${row.unit}s`
    },
    { key: "grade", header: "Grade", type: "text" as const },
    {
      key: "sellByDate",
      header: "Sell By Proximity",
      render: renderSellBy
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
          Inventory Lot Oversight
        </h1>
        <p style={{ fontSize: "0.875rem", color: gray[500], margin: "4px 0 0" }}>
          Inspect intake records, trace lot lifecycles, and check decay alarm limits.
        </p>
      </div>

      {/* Grid */}
      <DataTable
        data={filteredInventory}
        columns={columns}
        rowIdKey="id"
        searchKey="receiptCode"
        searchPlaceholder="Search receipt code..."
        filters={[
          {
            key: "cropType",
            label: "Filter Crop",
            options: [
              { value: "Maize", label: "Maize" },
              { value: "Cocoa", label: "Cocoa" },
              { value: "Yam", label: "Yam" }
            ]
          },
          {
            key: "grade",
            label: "Filter Grade",
            options: [
              { value: "A", label: "Grade A" },
              { value: "B", label: "Grade B" },
              { value: "C", label: "Grade C" }
            ]
          },
          {
            key: "status",
            label: "Filter Status",
            options: [
              { value: "available", label: "Available" },
              { value: "partially_reserved", label: "Partially Reserved" },
              { value: "reserved", label: "Fully Reserved" },
              { value: "spoiled", label: "Spoiled / Damaged" }
            ]
          }
        ]}
        drawerTitle={(row) => `Receipt ${row.receiptCode}`}
        drawerContent={(row, _onClose) => {
          if (!selectedLot || selectedLot.id !== row.id) {
            setSelectedLot(row);
            setActiveTab("details");
          }

          const farmerObj = farmers.find(f => f.id === row.farmerId);
          const whObj = warehouses.find(w => w.id === row.warehouseId);
          const lotDisputes = disputes.filter(d => d.entityType === "inventory_batch" && d.entityId === row.id);
          const lotLogs = auditLogs.filter(l => l.entityType === "inventory_batch" && l.entityId === row.id);

          return (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              {/* Header Badge Status */}
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <StatusBadge status={row.status} />
              </div>

              {/* Tabs */}
              <div style={{ display: "flex", borderBottom: `1px solid ${gray[100]}`, gap: "16px" }}>
                {["details", "history", "disputes"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    style={{
                      padding: "8px 0 12px",
                      background: "none",
                      border: 0,
                      borderBottom: activeTab === tab ? `2px solid ${palette.field}` : "none",
                      color: activeTab === tab ? palette.field : gray[500],
                      fontWeight: activeTab === tab ? 700 : 500,
                      fontSize: "0.875rem",
                      cursor: "pointer",
                      textTransform: "capitalize"
                    }}
                  >
                    {tab === "details" ? "Lot Details" : tab === "history" ? "Change Audit" : "Disputes"}
                  </button>
                ))}
              </div>

              {/* Tab Contents */}
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {activeTab === "details" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", fontSize: "0.8125rem" }}>
                      <div>
                        <span style={{ color: gray[500], fontWeight: 600 }}>Farmer depositor</span>
                        <p style={{ margin: "2px 0 0", fontWeight: 700, color: gray[800] }}>{farmerObj ? farmerObj.fullName : "Unknown"}</p>
                      </div>
                      <div>
                        <span style={{ color: gray[500], fontWeight: 600 }}>Warehouse location</span>
                        <p style={{ margin: "2px 0 0", fontWeight: 700, color: gray[800] }}>{whObj ? whObj.name : "Unknown"}</p>
                      </div>
                      <div>
                        <span style={{ color: gray[500], fontWeight: 600 }}>Crop variety</span>
                        <p style={{ margin: "2px 0 0", fontWeight: 700, color: gray[800] }}>{row.variety || "Standard Variety"}</p>
                      </div>
                      <div>
                        <span style={{ color: gray[500], fontWeight: 600 }}>Grade</span>
                        <p style={{ margin: "2px 0 0", fontWeight: 700, color: gray[800] }}>Grade {row.grade}</p>
                      </div>
                      <div>
                        <span style={{ color: gray[500], fontWeight: 600 }}>Receipt Date</span>
                        <p style={{ margin: "2px 0 0", fontWeight: 700, color: gray[800] }}>{new Date(row.receivedAt).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <span style={{ color: gray[500], fontWeight: 600 }}>Asking price / bag</span>
                        <p style={{ margin: "2px 0 0", fontWeight: 700, color: gray[800] }}>{row.askingPricePerUnit ? `${row.askingPricePerUnit} GHS` : "Not Listed"}</p>
                      </div>
                    </div>

                    <div style={{ padding: "12px", border: `1px solid ${gray[100]}`, borderRadius: "6px", backgroundColor: gray[25] }}>
                      <span style={{ fontSize: "0.75rem", color: gray[500], fontWeight: 600 }}>Storage Fee Balance</span>
                      <p style={{ margin: "4px 0 0", fontSize: "1.25rem", fontWeight: 800, color: palette.field }}>
                        GHS {row.storageFeeAccrued.toFixed(2)}
                      </p>
                    </div>
                  </div>
                )}

                {activeTab === "history" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <span style={{ fontSize: "0.75rem", color: gray[500], fontWeight: 700 }}>Lot Activity Trail ({lotLogs.length})</span>
                    {lotLogs.length === 0 ? (
                      <p style={{ margin: 0, fontSize: "0.875rem", color: gray[500], fontStyle: "italic" }}>
                        No changes tracked for this batch.
                      </p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        {lotLogs.map((l) => (
                          <div key={l.id} style={{ display: "flex", gap: "10px", fontSize: "0.8125rem" }}>
                            <div style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: palette.field, marginTop: "5px", flexShrink: 0 }} />
                            <div>
                              <span style={{ fontWeight: 700, color: gray[800] }}>{l.action}</span>
                              <span style={{ color: gray[500], marginLeft: "8px" }}>{new Date(l.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "disputes" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <span style={{ fontSize: "0.75rem", color: gray[500], fontWeight: 700 }}>Linked Disputes ({lotDisputes.length})</span>
                    {lotDisputes.length === 0 ? (
                      <p style={{ margin: 0, fontSize: "0.875rem", color: gray[500], fontStyle: "italic", padding: "10px 0" }}>
                        No disputes opened for this batch.
                      </p>
                    ) : (
                      lotDisputes.map(disp => (
                        <div key={disp.id} style={{ padding: "12px", border: `1px solid ${gray[100]}`, borderRadius: "6px", backgroundColor: disp.status === "open" ? status.dangerBg : gray[25] }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: gray[900] }}>{disp.title}</span>
                            <StatusBadge status={disp.status} />
                          </div>
                          <p style={{ margin: "6px 0 0", fontSize: "0.75rem", color: gray[600], lineHeight: 1.4 }}>
                            {disp.summary}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        }}
      />
    </div>
  );
}
