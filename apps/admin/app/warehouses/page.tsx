// apps/admin/app/warehouses/page.tsx
"use client";

import React, { useState } from "react";
import { useAdminData, DataTable, StatusBadge, ConfirmModal, useWarehouseFilter, gray, palette, status } from "@kuapa-dwaso/dashboard-ui";
import { Plus, Edit3, Shield, Calendar, MapPin, BarChart2 } from "lucide-react";

export default function WarehousesPage() {
  const { selectedWarehouseId } = useWarehouseFilter();
  const { warehouses, agents, inventory, actions } = useAdminData();
  const [selectedWarehouse, setSelectedWarehouse] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("profile");
  
  // Status Modal states
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<"active" | "inactive" | "maintenance" | "closed">("active");

  const filteredWarehouses = selectedWarehouseId === "all"
    ? warehouses
    : warehouses.filter(w => w.id === selectedWarehouseId);

  // Table Columns config
  const columns = [
    { key: "code", header: "Code", type: "text" as const },
    { key: "name", header: "Name", type: "text" as const },
    { key: "community", header: "Community", type: "text" as const },
    { key: "region", header: "Region", type: "text" as const },
    {
      key: "storageCapacity",
      header: "Capacity",
      type: "numeric" as const,
      render: (row: any) => `${row.storageCapacity} ${row.capacityUnit || "tonnes"}`
    },
    {
      key: "status",
      header: "Status",
      render: (row: any) => <StatusBadge status={row.status} />
    }
  ];

  const handleStatusChangeClick = (statusVal: typeof newStatus) => {
    setNewStatus(statusVal);
    setIsStatusModalOpen(true);
  };

  const handleStatusConfirm = (reason?: string) => {
    if (selectedWarehouse) {
      actions.updateWarehouseStatus(selectedWarehouse.id, newStatus, reason);
      // Sync local drawer selection status
      setSelectedWarehouse((prev: any) => ({ ...prev, status: newStatus }));
    }
    setIsStatusModalOpen(false);
  };

  // 7 days scheduler chips
  const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: gray[900], margin: 0 }}>
            Warehouse Management
          </h1>
          <p style={{ fontSize: "0.875rem", color: gray[500], margin: "4px 0 0" }}>
            Monitor and configure grain storage facilities.
          </p>
        </div>
        <button
          style={{
            background: palette.field,
            border: 0,
            color: "white",
            padding: "10px 18px",
            borderRadius: "6px",
            fontWeight: 700,
            fontSize: "0.875rem",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            cursor: "pointer",
            boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)"
          }}
          onClick={() => alert("Creating a new warehouse requires multi-region mapping. This action is placeholder for MVP.")}
        >
          <Plus size={16} /> Create Warehouse
        </button>
      </div>

      {/* Table grid */}
      <DataTable
        data={filteredWarehouses}
        columns={columns}
        rowIdKey="id"
        searchKey="name"
        searchPlaceholder="Search warehouse name..."
        filters={[
          {
            key: "status",
            label: "Filter Status",
            options: [
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
              { value: "maintenance", label: "Maintenance" },
              { value: "closed", label: "Closed" }
            ]
          },
          {
            key: "region",
            label: "Filter Region",
            options: [
              { value: "Ashanti", label: "Ashanti" },
              { value: "Bono", label: "Bono" },
              { value: "Northern", label: "Northern" }
            ]
          }
        ]}
        drawerTitle={(row) => row.name}
        drawerContent={(row, onClose) => {
          // If drawer loads, we keep local track of selection
          if (!selectedWarehouse || selectedWarehouse.id !== row.id) {
            setSelectedWarehouse(row);
            setActiveTab("profile");
          }

          const whStock = inventory.filter(i => i.warehouseId === row.id).reduce((sum, item) => sum + item.quantityAvailable, 0);
          const percent = row.storageCapacity ? Math.round((whStock / row.storageCapacity) * 100) : 0;
          const assignedAgents = agents.filter(a => a.assignedWarehouseIds.includes(row.id));

          return (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              {/* Header Status Row */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <StatusBadge status={selectedWarehouse?.status || row.status} />
                <div style={{ display: "flex", gap: "8px" }}>
                  {selectedWarehouse?.status !== "active" && (
                    <button
                      onClick={() => handleStatusChangeClick("active")}
                      style={{ fontSize: "0.75rem", fontWeight: 700, padding: "6px 12px", border: `1px solid ${gray[300]}`, backgroundColor: "white", color: palette.field, borderRadius: "4px", cursor: "pointer" }}
                    >
                      Set Active
                    </button>
                  )}
                  {selectedWarehouse?.status !== "maintenance" && (
                    <button
                      onClick={() => handleStatusChangeClick("maintenance")}
                      style={{ fontSize: "0.75rem", fontWeight: 700, padding: "6px 12px", border: `1px solid ${gray[300]}`, backgroundColor: "white", color: status.warning, borderRadius: "4px", cursor: "pointer" }}
                    >
                      Maintenance
                    </button>
                  )}
                  {selectedWarehouse?.status !== "closed" && (
                    <button
                      onClick={() => handleStatusChangeClick("closed")}
                      style={{ fontSize: "0.75rem", fontWeight: 700, padding: "6px 12px", border: `1px solid ${gray[300]}`, backgroundColor: "white", color: status.danger, borderRadius: "4px", cursor: "pointer" }}
                    >
                      Close
                    </button>
                  )}
                </div>
              </div>

              {/* Tab Navigation */}
              <div style={{ display: "flex", borderBottom: `1px solid ${gray[100]}`, gap: "16px" }}>
                {["profile", "capacity", "agents", "schedule"].map((tab) => (
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
                    {tab}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {activeTab === "profile" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                      <div>
                        <span style={{ fontSize: "0.75rem", color: gray[500], fontWeight: 600 }}>Warehouse Code</span>
                        <p style={{ margin: "2px 0 0", fontSize: "0.875rem", fontWeight: 700, color: gray[900] }}>{row.code}</p>
                      </div>
                      <div>
                        <span style={{ fontSize: "0.75rem", color: gray[500], fontWeight: 600 }}>Served Community</span>
                        <p style={{ margin: "2px 0 0", fontSize: "0.875rem", fontWeight: 700, color: gray[900] }}>{row.community}</p>
                      </div>
                      <div>
                        <span style={{ fontSize: "0.75rem", color: gray[500], fontWeight: 600 }}>District</span>
                        <p style={{ margin: "2px 0 0", fontSize: "0.875rem", fontWeight: 700, color: gray[900] }}>{row.district || "N/A"}</p>
                      </div>
                      <div>
                        <span style={{ fontSize: "0.75rem", color: gray[500], fontWeight: 600 }}>Region</span>
                        <p style={{ margin: "2px 0 0", fontSize: "0.875rem", fontWeight: 700, color: gray[900] }}>{row.region || "N/A"}</p>
                      </div>
                    </div>
                    <div>
                      <span style={{ fontSize: "0.75rem", color: gray[500], fontWeight: 600, display: "block", marginBottom: "6px" }}>Served Catchment Areas</span>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {row.servedCommunities.map((c: string, idx: number) => (
                          <span key={idx} style={{ padding: "4px 8px", backgroundColor: gray[50], border: `1px solid ${gray[100]}`, borderRadius: "4px", fontSize: "0.75rem", color: gray[700], fontWeight: 500 }}>
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span style={{ fontSize: "0.75rem", color: gray[500], fontWeight: 600, display: "block", marginBottom: "6px" }}>Destination Markets</span>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {row.destinationMarketsServed.map((m: string, idx: number) => (
                          <span key={idx} style={{ padding: "4px 8px", backgroundColor: palette.surface, border: `1px solid ${palette.line}`, borderRadius: "4px", fontSize: "0.75rem", color: palette.field, fontWeight: 600 }}>
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "capacity" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div style={{ backgroundColor: gray[25], padding: "16px", borderRadius: "8px", border: `1px solid ${gray[100]}` }}>
                      <span style={{ fontSize: "0.75rem", color: gray[500], fontWeight: 600 }}>Current Occupancy utilization</span>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: "8px" }}>
                        <span style={{ fontSize: "1.75rem", fontWeight: 800, color: gray[900] }}>{whStock}</span>
                        <span style={{ fontSize: "0.875rem", color: gray[500], fontWeight: 600 }}>of {row.storageCapacity} {row.capacityUnit} ({percent}%)</span>
                      </div>
                      
                      {/* Bar indicator */}
                      <div style={{ height: "10px", width: "100%", backgroundColor: "white", border: `1px solid ${gray[300]}`, borderRadius: "5px", overflow: "hidden", marginTop: "12px" }}>
                        <div style={{ height: "100%", width: `${Math.min(percent, 100)}%`, backgroundColor: percent > 80 ? status.danger : percent > 60 ? status.warning : palette.field }} />
                      </div>
                    </div>

                    <div>
                      <span style={{ fontSize: "0.75rem", color: gray[500], fontWeight: 600, display: "block", marginBottom: "6px" }}>Supported Crops</span>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {row.supportedCrops.map((c: string, idx: number) => (
                          <span key={idx} style={{ padding: "4px 8px", backgroundColor: gray[50], border: `1px solid ${gray[100]}`, borderRadius: "4px", fontSize: "0.75rem", color: gray[700], fontWeight: 500 }}>
                            🌾 {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "agents" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <span style={{ fontSize: "0.75rem", color: gray[500], fontWeight: 600 }}>Assigned Warehouse Agents ({assignedAgents.length})</span>
                    {assignedAgents.length === 0 ? (
                      <p style={{ margin: 0, fontSize: "0.875rem", color: gray[500], fontStyle: "italic", padding: "10px 0" }}>
                        No agents assigned to this warehouse. Assign agents via the People tab.
                      </p>
                    ) : (
                      assignedAgents.map(agt => (
                        <div
                          key={agt.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "10px 12px",
                            border: `1px solid ${gray[100]}`,
                            borderRadius: "6px",
                            backgroundColor: gray[25]
                          }}
                        >
                          <div>
                            <span style={{ fontSize: "0.875rem", fontWeight: 700, color: gray[900] }}>{agt.fullName}</span>
                            <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: gray[500] }}>Code: {agt.agentCode} · {agt.phoneNumber}</p>
                          </div>
                          <StatusBadge status={agt.status} />
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === "schedule" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div>
                      <span style={{ fontSize: "0.75rem", color: gray[500], fontWeight: 600, display: "block", marginBottom: "8px" }}>Operating Days Schedule</span>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {daysOfWeek.map((day) => {
                          const isOpen = row.operatingDays.includes(day);
                          return (
                            <span
                              key={day}
                              style={{
                                padding: "4px 8px",
                                borderRadius: "4px",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                backgroundColor: isOpen ? palette.field : gray[50],
                                border: `1px solid ${isOpen ? palette.field : gray[100]}`,
                                color: isOpen ? "white" : gray[400]
                              }}
                            >
                              {day.slice(0, 3)}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <span style={{ fontSize: "0.75rem", color: gray[500], fontWeight: 600, display: "block", marginBottom: "8px" }}>Dispatch Run Days</span>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {daysOfWeek.map((day) => {
                          const isDispatch = row.dispatchDays?.includes(day);
                          return (
                            <span
                              key={day}
                              style={{
                                padding: "4px 8px",
                                borderRadius: "4px",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                backgroundColor: isDispatch ? palette.sky : gray[50],
                                border: `1px solid ${isDispatch ? palette.sky : gray[100]}`,
                                color: isDispatch ? "white" : gray[400]
                              }}
                            >
                              {day.slice(0, 3)}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        }}
      />

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={isStatusModalOpen}
        title="Confirm Warehouse Status Update"
        impactMessage={`Updating ${selectedWarehouse?.name || "this warehouse"}'s status to "${newStatus.toUpperCase()}" will take effect across the platform immediately. Active agents, intake processes, and buyers will be affected.`}
        confirmText={`Set to ${newStatus.toUpperCase()}`}
        onConfirm={handleStatusConfirm}
        onCancel={() => setIsStatusModalOpen(false)}
        requireReason={true}
        reasonPlaceholder="Specify the reason (e.g. routine sanitation sweep, yearly inventory audits, facility repair)..."
      />
    </div>
  );
}
