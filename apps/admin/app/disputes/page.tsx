// apps/admin/app/disputes/page.tsx
"use client";

import { useState } from "react";
import { DataTable, StatusBadge, ConfirmModal, useWarehouseFilter, gray, palette, status } from "@kuapa-dwaso/dashboard-ui";
import { CheckSquare } from "lucide-react";
import { OperationalAccessGate } from "../operational/OperationalAccessGate";
import { useOperationalAdminData } from "../operational/useOperationalAdminData";

export default function DisputesPage() {
  const { selectedWarehouseId } = useWarehouseFilter();
  const { access, disputes, inventory, actions } = useOperationalAdminData();
  const [selectedDispute, setSelectedDispute] = useState<any>(null);
  
  // Resolution notes modal state
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);

  const filteredDisputes = selectedWarehouseId === "all"
    ? disputes
    : disputes.filter(d => {
        if (d.warehouseId) {
          return d.warehouseId === selectedWarehouseId;
        }
        if (d.entityType === "inventory_batch") {
          const batch = inventory.find(i => i.id === d.entityId);
          return batch?.warehouseId === selectedWarehouseId;
        }
        return true;
      });

  const columns = [
    { key: "id", header: "Dispute ID", type: "text" as const },
    { key: "title", header: "Dispute Title", type: "text" as const },
    {
      key: "entityType",
      header: "Linked Target",
      render: (row: any) => (
        <span style={{ textTransform: "capitalize", fontSize: "0.8125rem" }}>
          {row.entityType.replace(/_/g, " ")} ({row.entityId})
        </span>
      )
    },
    {
      key: "createdAt",
      header: "Opened At",
      render: (row: any) => new Date(row.createdAt).toLocaleDateString()
    },
    {
      key: "status",
      header: "Status",
      render: (row: any) => <StatusBadge status={row.status} />
    }
  ];

  const handleResolveClick = () => {
    setIsResolveModalOpen(true);
  };

  const handleConfirmResolution = (reason?: string) => {
    if (selectedDispute && reason) {
      void actions.resolveDispute(selectedDispute.id, reason);
      setSelectedDispute((prev: any) => ({
        ...prev,
        status: "resolved",
        resolutionNotes: reason,
        resolvedAt: Date.now()
      }));
    }
    setIsResolveModalOpen(false);
  };

  return (
    <OperationalAccessGate
      firebaseUser={access.firebaseUser}
      principal={access.principal}
      isAuthLoading={access.isAuthLoading}
      isDataLoading={access.isDataLoading}
      isAllowed={access.canReadDisputes}
      limitedMessage="Dispute management requires disputes:read for your assigned scope."
    >
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: gray[900], margin: 0 }}>
          Dispute Management Console
        </h1>
        <p style={{ fontSize: "0.875rem", color: gray[500], margin: "4px 0 0" }}>
          Mediate quality reports, quantity conflicts and rate disputes. Resolution notes are logged.
        </p>
      </div>

      {/* Grid */}
      <DataTable
        data={filteredDisputes}
        columns={columns}
        rowIdKey="id"
        searchKey="title"
        searchPlaceholder="Search dispute title..."
        filters={[
          {
            key: "status",
            label: "Filter Status",
            options: [
              { value: "open", label: "Open" },
              { value: "under_review", label: "Under Review" },
              { value: "resolved", label: "Resolved" },
              { value: "cancelled", label: "Cancelled" }
            ]
          },
          {
            key: "entityType",
            label: "Filter Target",
            options: [
              { value: "inventory_batch", label: "Inventory Batch" },
              { value: "farmer", label: "Farmer" },
              { value: "buyer_order", label: "Buyer Order" }
            ]
          }
        ]}
        drawerTitle={(row) => row.title}
        drawerContent={(row, _onClose) => {
          if (!selectedDispute || selectedDispute.id !== row.id) {
            setSelectedDispute(row);
          }

          const curDisputeStatus = selectedDispute?.status || row.status;
          const curNotes = selectedDispute?.resolutionNotes || row.resolutionNotes;
          const curResolvedAt = selectedDispute?.resolvedAt || row.resolvedAt;

          return (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              {/* Header Status */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <StatusBadge status={curDisputeStatus} />
                {access.canManageDisputes && curDisputeStatus !== "resolved" && curDisputeStatus !== "cancelled" && (
                  <button
                    onClick={handleResolveClick}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      backgroundColor: palette.field,
                      color: "white",
                      border: 0,
                      borderRadius: "4px",
                      padding: "6px 12px",
                      fontSize: "0.8125rem",
                      fontWeight: 700,
                      cursor: "pointer"
                    }}
                  >
                    <CheckSquare size={14} /> Resolve Dispute
                  </button>
                )}
              </div>

              {/* Summary Description Section */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <span style={{ fontSize: "0.75rem", color: gray[500], fontWeight: 700, textTransform: "uppercase" }}>Dispute Statement Summary</span>
                <p style={{ margin: 0, fontSize: "0.875rem", color: gray[800], lineHeight: 1.5, padding: "12px", border: `1px solid ${gray[100]}`, borderRadius: "6px", backgroundColor: gray[25] }}>
                  {row.summary}
                </p>
              </div>

              {/* Linked entity */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <span style={{ fontSize: "0.75rem", color: gray[500], fontWeight: 700, textTransform: "uppercase" }}>Linked Target Record</span>
                <div style={{ padding: "10px 12px", border: `1px solid ${gray[100]}`, borderRadius: "6px", fontSize: "0.8125rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontWeight: 700, color: gray[800], textTransform: "capitalize" }}>{row.entityType.replace(/_/g, " ")}</span>
                    <span style={{ color: gray[500], marginLeft: "8px" }}>ID: {row.entityId}</span>
                  </div>
                </div>
              </div>

              {/* Timeline / Resolution notes */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <span style={{ fontSize: "0.75rem", color: gray[500], fontWeight: 700, textTransform: "uppercase" }}>Mediation Timeline</span>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", borderLeft: `2px solid ${gray[100]}`, paddingLeft: "16px", marginLeft: "8px" }}>
                  <div style={{ position: "relative" }}>
                    <div style={{ position: "absolute", left: "-21px", top: "4px", width: "8px", height: "8px", borderRadius: "50%", backgroundColor: status.danger }} />
                    <span style={{ fontSize: "0.75rem", color: gray[500], fontWeight: 600 }}>{new Date(row.createdAt).toLocaleString()}</span>
                    <p style={{ margin: "2px 0 0", fontSize: "0.8125rem", fontWeight: 700, color: gray[800] }}>Dispute opened on platform</p>
                  </div>
                  
                  {curDisputeStatus === "resolved" && (
                    <div style={{ position: "relative" }}>
                      <div style={{ position: "absolute", left: "-21px", top: "4px", width: "8px", height: "8px", borderRadius: "50%", backgroundColor: palette.field }} />
                      <span style={{ fontSize: "0.75rem", color: gray[500], fontWeight: 600 }}>{new Date(curResolvedAt).toLocaleString()}</span>
                      <p style={{ margin: "2px 0 0", fontSize: "0.8125rem", fontWeight: 700, color: gray[800] }}>Dispute resolved</p>
                      
                      {curNotes && (
                        <div style={{ margin: "8px 0 0", padding: "10px", backgroundColor: "#f0fdf4", border: `1px solid ${status.successBorder}`, borderRadius: "6px", fontSize: "0.8125rem", color: status.success, lineHeight: 1.4 }}>
                          <strong style={{ display: "block", marginBottom: "4px", fontSize: "0.75rem", textTransform: "uppercase" }}>Resolution Note:</strong>
                          {curNotes}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

            </div>
          );
        }}
      />

      {/* Resolution Notes Modal */}
      {isResolveModalOpen && selectedDispute && (
        <ConfirmModal
          isOpen={isResolveModalOpen}
          title="Resolve Dispute Mediation"
          impactMessage={`Resolving dispute "${selectedDispute.title}" will close this conflict permanently. Both farmer and buyer accounts will be updated based on this resolution.`}
          confirmText="Resolve Conflict"
          onConfirm={handleConfirmResolution}
          onCancel={() => setIsResolveModalOpen(false)}
          requireReason={true}
          reasonPlaceholder="Specify resolution notes (e.g. storage credits credited to farmer, batch marked available with price reduction, insurance claim filed)..."
        />
      )}
    </div>
    </OperationalAccessGate>
  );
}
