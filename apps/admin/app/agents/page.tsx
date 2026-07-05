// apps/admin/app/agents/page.tsx
"use client";

import React, { useState } from "react";
import { useAdminData, DataTable, StatusBadge, ConfirmModal, gray, palette, status } from "@kuapa-dwaso/dashboard-ui";
import { Check, ShieldAlert, BookOpen, Warehouse } from "lucide-react";

export default function AgentsPage() {
  const { agents, warehouses, actions } = useAdminData();
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  
  // Modals status
  const [modalType, setModalType] = useState<"approve" | "suspend" | "assign" | null>(null);
  const [checkedWarehouseIds, setCheckedWarehouseIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const columns = [
    { key: "agentCode", header: "Agent Code", type: "text" as const },
    { key: "fullName", header: "Full Name", type: "text" as const },
    { key: "phoneNumber", header: "Phone Number", type: "text" as const },
    {
      key: "assignedWarehouses",
      header: "Assigned Warehouses",
      render: (row: any) => {
        const count = row.assignedWarehouseIds.length;
        if (count === 0) return <span style={{ color: gray[500], fontStyle: "italic" }}>None</span>;
        const names = row.assignedWarehouseIds.map((id: string) => {
          const wh = warehouses.find(w => w.id === id);
          return wh ? wh.name : id;
        });
        return `${count} (${names.join(", ")})`;
      }
    },
    {
      key: "status",
      header: "Status",
      render: (row: any) => <StatusBadge status={row.status} />
    }
  ];

  const handleAction = (type: "approve" | "suspend" | "assign") => {
    setModalType(type);
    if (type === "assign" && selectedAgent) {
      setCheckedWarehouseIds([...selectedAgent.assignedWarehouseIds]);
    }
  };

  const handleConfirmAction = (reason?: string) => {
    if (!selectedAgent || !modalType) return;

    if (modalType === "approve") {
      actions.updateAgentStatus(selectedAgent.id, "approved", reason);
      setSelectedAgent((prev: any) => ({ ...prev, status: "approved" }));
    } else if (modalType === "suspend") {
      actions.updateAgentStatus(selectedAgent.id, "suspended", reason);
      setSelectedAgent((prev: any) => ({ ...prev, status: "suspended" }));
    } else if (modalType === "assign") {
      actions.assignWarehousesToAgent(selectedAgent.id, checkedWarehouseIds);
      setSelectedAgent((prev: any) => ({ ...prev, assignedWarehouseIds: checkedWarehouseIds }));
    }

    setModalType(null);
  };

  const handleCheckboxChange = (whId: string, checked: boolean) => {
    setCheckedWarehouseIds(prev => {
      if (checked) return [...prev, whId];
      return prev.filter(id => id !== whId);
    });
  };

  const filteredWarehouses = warehouses.filter(wh =>
    wh.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    wh.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: gray[900], margin: 0 }}>
          Warehouse Agent Management
        </h1>
        <p style={{ fontSize: "0.875rem", color: gray[500], margin: "4px 0 0" }}>
          Verify, assign and audit platform intake agents.
        </p>
      </div>

      {/* Grid Table */}
      <DataTable
        data={agents}
        columns={columns}
        rowIdKey="id"
        searchKey="fullName"
        searchPlaceholder="Search agent name..."
        filters={[
          {
            key: "status",
            label: "Filter Status",
            options: [
              { value: "pending", label: "Pending Approval" },
              { value: "approved", label: "Approved" },
              { value: "suspended", label: "Suspended" },
              { value: "deactivated", label: "Deactivated" }
            ]
          }
        ]}
        drawerTitle={(row) => row.fullName}
        drawerContent={(row, onClose) => {
          if (!selectedAgent || selectedAgent.id !== row.id) {
            setSelectedAgent(row);
          }

          const currentAgentStatus = selectedAgent?.status || row.status;
          const currentWarehouses = selectedAgent?.assignedWarehouseIds || row.assignedWarehouseIds;

          return (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              {/* Profile Card Summary */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", border: `1px solid ${gray[100]}`, padding: "16px", borderRadius: "8px", backgroundColor: gray[25] }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "1rem", fontWeight: 700, color: gray[900] }}>Agent Details</span>
                  <StatusBadge status={currentAgentStatus} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "0.8125rem", marginTop: "8px" }}>
                  <div>
                    <span style={{ color: gray[500], fontWeight: 600 }}>Agent ID Code</span>
                    <p style={{ margin: "2px 0 0", fontWeight: 700, color: gray[700] }}>{row.agentCode}</p>
                  </div>
                  <div>
                    <span style={{ color: gray[500], fontWeight: 600 }}>Registered Phone</span>
                    <p style={{ margin: "2px 0 0", fontWeight: 700, color: gray[700] }}>{row.phoneNumber}</p>
                  </div>
                  <div>
                    <span style={{ color: gray[500], fontWeight: 600 }}>Join Date</span>
                    <p style={{ margin: "2px 0 0", fontWeight: 700, color: gray[700] }}>{new Date(row.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons Row */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <span style={{ fontSize: "0.75rem", color: gray[500], fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}> OVERSIGHT ACTIONS </span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                  {currentAgentStatus === "pending" && (
                    <button
                      onClick={() => handleAction("approve")}
                      style={{ flex: 1, minWidth: "120px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", backgroundColor: palette.field, color: "white", padding: "10px", border: 0, borderRadius: "6px", fontSize: "0.8125rem", fontWeight: 700, cursor: "pointer" }}
                    >
                      <Check size={16} /> Approve Agent
                    </button>
                  )}
                  {currentAgentStatus === "approved" && (
                    <button
                      onClick={() => handleAction("suspend")}
                      style={{ flex: 1, minWidth: "120px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", backgroundColor: status.danger, color: "white", padding: "10px", border: 0, borderRadius: "6px", fontSize: "0.8125rem", fontWeight: 700, cursor: "pointer" }}
                    >
                      <ShieldAlert size={16} /> Suspend Agent
                    </button>
                  )}
                  {currentAgentStatus === "suspended" && (
                    <button
                      onClick={() => handleAction("approve")}
                      style={{ flex: 1, minWidth: "120px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", backgroundColor: palette.field, color: "white", padding: "10px", border: 0, borderRadius: "6px", fontSize: "0.8125rem", fontWeight: 700, cursor: "pointer" }}
                    >
                      <Check size={16} /> Reinstate Agent
                    </button>
                  )}
                  <button
                    onClick={() => handleAction("assign")}
                    style={{ flex: 1, minWidth: "120px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", backgroundColor: "white", color: gray[800], border: `1px solid ${gray[300]}`, padding: "10px", borderRadius: "6px", fontSize: "0.8125rem", fontWeight: 700, cursor: "pointer" }}
                  >
                    <Warehouse size={16} /> Assign Warehouses
                  </button>
                </div>
              </div>

              {/* Warehouse coverage listing */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <span style={{ fontSize: "0.75rem", color: gray[500], fontWeight: 700, textTransform: "uppercase" }}> Assigned Facilities ({currentWarehouses.length}) </span>
                {currentWarehouses.length === 0 ? (
                  <p style={{ margin: 0, fontSize: "0.875rem", color: gray[500], fontStyle: "italic" }}>
                    No warehouses assigned to this agent.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {currentWarehouses.map((id: string) => {
                      const wh = warehouses.find(w => w.id === id);
                      return (
                        <div key={id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", border: `1px solid ${gray[100]}`, borderRadius: "6px", fontSize: "0.8125rem" }}>
                          <span style={{ fontWeight: 700, color: gray[800] }}>{wh ? wh.name : id}</span>
                          <span style={{ color: gray[500], fontFamily: "monospace" }}>{wh ? wh.code : ""}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        }}
      />

      {/* Confirmation Overlay Modal */}
      {modalType && selectedAgent && (
        modalType === "assign" ? (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(15, 31, 20, 0.4)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              padding: "16px",
            }}
          >
            <div style={{ backgroundColor: "white", borderRadius: "12px", width: "100%", maxWidth: "460px", border: `1px solid ${gray[100]}`, display: "flex", flexDirection: "column", maxHeight: "80vh", overflow: "hidden" }}>
              <div style={{ padding: "20px 24px", borderBottom: `1px solid ${gray[100]}`, backgroundColor: gray[25] }}>
                <h3 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 700, color: gray[900] }}>Assign Warehouses to {selectedAgent.fullName}</h3>
              </div>

              {/* Warehouse selector area */}
              <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "16px" }}>
                <input
                  type="text"
                  placeholder="Search warehouses..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: `1px solid ${gray[300]}`, fontSize: "0.875rem", outline: "none" }}
                />

                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {filteredWarehouses.map(wh => {
                    const isChecked = checkedWarehouseIds.includes(wh.id);
                    return (
                      <label key={wh.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", border: `1px solid ${gray[100]}`, borderRadius: "6px", cursor: "pointer", fontSize: "0.875rem", transition: "background 0.1s" }}
                             onMouseEnter={(e) => e.currentTarget.style.backgroundColor = gray[25]}
                             onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => handleCheckboxChange(wh.id, e.target.checked)}
                          style={{ cursor: "pointer" }}
                        />
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontWeight: 700, color: gray[800] }}>{wh.name}</span>
                          <span style={{ fontSize: "0.75rem", color: gray[500], fontFamily: "monospace" }}>{wh.code} · {wh.community}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div style={{ padding: "16px 24px", borderTop: `1px solid ${gray[100]}`, backgroundColor: gray[25], display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  style={{ background: "transparent", border: `1px solid ${gray[300]}`, borderRadius: "6px", color: gray[700], padding: "8px 16px", fontWeight: 600, fontSize: "0.875rem", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmAction()}
                  style={{ background: palette.field, border: 0, borderRadius: "6px", color: "white", padding: "8px 16px", fontWeight: 700, fontSize: "0.875rem", cursor: "pointer" }}
                >
                  Save Assignments
                </button>
              </div>
            </div>
          </div>
        ) : (
          <ConfirmModal
            isOpen={modalType !== null}
            title={modalType === "approve" ? "Verify / Approve Agent Profile" : "Suspend Agent Profile"}
            impactMessage={modalType === "approve" 
              ? `Approving ${selectedAgent.fullName} enables them to receive and verify agricultural lots on behalf of KuapaDwaso, print storage receipts, and log dispatch runs.` 
              : `Suspending ${selectedAgent.fullName} IMMEDIATELY revokes their access to log intakes, verify stock quality or process dispatches. They will be locked out of the operations console.`
            }
            confirmText={modalType === "approve" ? "Verify Agent" : "Suspend Access"}
            onConfirm={handleConfirmAction}
            onCancel={() => setModalType(null)}
            requireReason={modalType === "suspend"}
            reasonPlaceholder="Specify reason for suspension (e.g. security breach, incorrect logging audit failures, inactive)..."
          />
        )
      )}
    </div>
  );
}
