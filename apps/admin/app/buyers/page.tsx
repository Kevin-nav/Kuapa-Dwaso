// apps/admin/app/buyers/page.tsx
"use client";

import { useState } from "react";
import { DataTable, StatusBadge, ConfirmModal, gray, palette, status } from "@kuapa-dwaso/dashboard-ui";
import { AlertTriangle, Check } from "lucide-react";
import { OperationalAccessGate } from "../operational/OperationalAccessGate";
import { useOperationalAdminData } from "../operational/useOperationalAdminData";

export default function BuyersPage() {
  const { access, buyers, orders, actions } = useOperationalAdminData();
  const [selectedBuyer, setSelectedBuyer] = useState<any>(null);
  const [verificationType, setVerificationType] = useState<"verify" | "reject" | null>(null);

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

  const handleVerificationClick = (type: "verify" | "reject") => {
    setVerificationType(type);
  };

  const handleVerificationConfirm = (reason?: string) => {
    if (!selectedBuyer || !verificationType) return;

    const newStatus = verificationType === "verify" ? "verified" : "rejected";
    void actions.updateBuyerVerification(selectedBuyer.id, newStatus, reason);
    setSelectedBuyer((prev: any) => ({
      ...prev,
      verificationStatus: newStatus
    }));

    setVerificationType(null);
  };

  return (
    <OperationalAccessGate
      firebaseUser={access.firebaseUser}
      principal={access.principal}
      isAuthLoading={access.isAuthLoading}
      isDataLoading={access.isDataLoading}
      isAllowed={access.canReadBuyers}
      limitedMessage="Buyer directory access requires buyers:read for your destination-market scope."
    >
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
        drawerTitle={(row) => row.fullName}
        drawerContent={(row) => {
          if (!selectedBuyer || selectedBuyer.id !== row.id) {
            setSelectedBuyer(row);
          }

          const buyerOrders = orders.filter((order) => order.buyerId === row.id);
          const currentVerifyStatus = selectedBuyer?.id === row.id ? selectedBuyer.verificationStatus : row.verificationStatus;

          return (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <section style={{ border: `1px solid ${gray[100]}`, borderRadius: "8px", background: gray[25], padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ color: gray[900], fontSize: "1rem" }}>Buyer Profile</strong>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <StatusBadge status={String(currentVerifyStatus)} />
                    <StatusBadge status={String(row.status)} />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "0.8125rem" }}>
                  <div>
                    <span style={{ color: gray[500], fontWeight: 700 }}>Phone</span>
                    <p style={{ margin: "2px 0 0", color: gray[800], fontWeight: 700 }}>{String(row.phoneNumber)}</p>
                  </div>
                  <div>
                    <span style={{ color: gray[500], fontWeight: 700 }}>Market</span>
                    <p style={{ margin: "2px 0 0", color: gray[800], fontWeight: 700 }}>{String(row.destinationMarket ?? "Not set")}</p>
                  </div>
                  <div>
                    <span style={{ color: gray[500], fontWeight: 700 }}>Organization</span>
                    <p style={{ margin: "2px 0 0", color: gray[800], fontWeight: 700 }}>{String(row.organizationName ?? "None")}</p>
                  </div>
                  <div>
                    <span style={{ color: gray[500], fontWeight: 700 }}>Created</span>
                    <p style={{ margin: "2px 0 0", color: gray[800], fontWeight: 700 }}>{new Date(Number(row.createdAt)).toLocaleDateString()}</p>
                  </div>
                </div>
              </section>

              {/* Admin Override Section */}
              {access.canManageBuyers && currentVerifyStatus === "pending" && (
                <section style={{ 
                  border: `1px solid ${status.warningBorder}`, 
                  borderRadius: "8px", 
                  background: status.warningBg, 
                  padding: "16px", 
                  display: "flex", 
                  flexDirection: "column", 
                  gap: "10px" 
                }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <strong style={{ color: status.warning, fontSize: "0.875rem", display: "flex", alignItems: "center", gap: "6px" }}>
                      <AlertTriangle size={16} /> Admin Verification Override
                    </strong>
                    <span style={{ color: gray[700], fontSize: "0.75rem", lineHeight: 1.4 }}>
                      Standard buyers are automatically verified during the standard registration flow. Use these controls to manually override and force-verify this buyer.
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                    <button
                      onClick={() => handleVerificationClick("verify")}
                      style={{ 
                        fontSize: "0.75rem", 
                        fontWeight: 700, 
                        padding: "6px 12px", 
                        border: 0, 
                        backgroundColor: palette.field, 
                        color: "white", 
                        borderRadius: "4px", 
                        cursor: "pointer" 
                      }}
                    >
                      Verify Buyer
                    </button>
                    <button
                      onClick={() => handleVerificationClick("reject")}
                      style={{ 
                        fontSize: "0.75rem", 
                        fontWeight: 700, 
                        padding: "6px 12px", 
                        border: `1px solid ${status.dangerBorder}`, 
                        backgroundColor: "white", 
                        color: status.danger, 
                        borderRadius: "4px", 
                        cursor: "pointer" 
                      }}
                    >
                      Reject Profile
                    </button>
                  </div>
                </section>
              )}

              {currentVerifyStatus === "verified" && (
                <section style={{ border: `1px solid ${status.successBorder}`, borderRadius: "8px", background: status.successBg, padding: "12px", display: "flex", alignItems: "center", gap: "8px", fontSize: "0.8125rem", color: status.success, fontWeight: 700 }}>
                  <Check size={16} /> Profile Credentials Verified (Admin Override)
                </section>
              )}

              <section style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <span style={{ color: gray[500], fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase" }}>Linked Orders ({buyerOrders.length})</span>
                {buyerOrders.length === 0 ? (
                  <p style={{ color: gray[500], fontSize: "0.875rem", margin: 0 }}>No scoped orders are visible for this buyer.</p>
                ) : (
                  buyerOrders.map((order) => (
                    <div key={order.id} style={{ border: `1px solid ${gray[100]}`, borderRadius: "6px", padding: "10px 12px", display: "flex", justifyContent: "space-between", gap: "12px" }}>
                      <div>
                        <strong style={{ color: gray[900], fontSize: "0.875rem" }}>{String(order.cropType)} to {String(order.destinationMarket)}</strong>
                        <p style={{ color: gray[500], fontSize: "0.75rem", margin: "2px 0 0" }}>{String(order.requestedQuantity)} {String(order.unit)} requested</p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <StatusBadge status={String(order.status)} />
                        <p style={{ color: palette.field, fontSize: "0.75rem", fontWeight: 800, margin: "4px 0 0" }}>
                          {order.totalAmount === undefined ? "No total" : `GHS ${Number(order.totalAmount).toFixed(2)}`}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </section>
            </div>
          );
        }}
      />

      {/* Verification Modals */}
      {verificationType && selectedBuyer && (
        <ConfirmModal
          isOpen={verificationType !== null}
          title={verificationType === "verify" ? "Confirm Admin Override: Verify Buyer" : "Confirm Admin Override: Reject Buyer"}
          impactMessage={verificationType === "verify"
            ? `OVERRIDE ACTION: Manually verifying the profile for ${selectedBuyer.fullName} will force-approve their account. Use this action only to bypass standard verification flows and immediately activate the buyer.`
            : `OVERRIDE ACTION: Rejecting the verification for ${selectedBuyer.fullName} will force-deactivate their account. They will not be permitted to place orders or receive dispatches.`
          }
          confirmText={verificationType === "verify" ? "Force Verify Buyer" : "Force Reject Profile"}
          onConfirm={handleVerificationConfirm}
          onCancel={() => setVerificationType(null)}
          requireReason={verificationType === "reject"}
          reasonPlaceholder="Specify the manual override/rejection reason..."
        />
      )}
    </div>
    </OperationalAccessGate>
  );
}
