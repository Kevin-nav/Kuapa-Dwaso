// apps/admin/app/farmers/page.tsx
"use client";

import { useState } from "react";
import { DataTable, StatusBadge, ConfirmModal, gray, palette, status } from "@kuapa-dwaso/dashboard-ui";
import { OperationalAccessGate } from "../operational/OperationalAccessGate";
import { useOperationalAdminData } from "../operational/useOperationalAdminData";

export default function FarmersPage() {
  const { access, farmers, warehouses, inventory, disputes, actions } = useOperationalAdminData();
  const [selectedFarmer, setSelectedFarmer] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("profile");

  // Verification modal status
  const [verificationType, setVerificationType] = useState<"verify" | "reject" | null>(null);

  const columns = [
    { key: "farmerCode", header: "Farmer Code", type: "text" as const },
    { key: "fullName", header: "Full Name", type: "text" as const },
    { key: "phoneNumber", header: "Phone Number", type: "text" as const },
    { key: "community", header: "Community", type: "text" as const },
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
    if (!selectedFarmer || !verificationType) return;

    const newStatus = verificationType === "verify" ? "verified" : "rejected";
    void actions.updateFarmerVerification(selectedFarmer.id, newStatus, reason);
    setSelectedFarmer((prev: any) => ({ 
      ...prev, 
      verificationStatus: newStatus,
      status: newStatus === "verified" ? "active" : "deactivated"
    }));

    setVerificationType(null);
  };

  return (
    <OperationalAccessGate
      firebaseUser={access.firebaseUser}
      principal={access.principal}
      isAuthLoading={access.isAuthLoading}
      isDataLoading={access.isDataLoading}
      isAllowed={access.canReadFarmers}
      limitedMessage="Farmer oversight requires farmers:read for your assigned scope."
    >
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: gray[900], margin: 0 }}>
          Farmer Oversight
        </h1>
        <p style={{ fontSize: "0.875rem", color: gray[500], margin: "4px 0 0" }}>
          Verify farmer profiles, inspect intake history and track linked disputes.
        </p>
      </div>

      {/* Grid */}
      <DataTable
        data={farmers}
        columns={columns}
        rowIdKey="id"
        searchKey="fullName"
        searchPlaceholder="Search farmer name..."
        filters={[
          {
            key: "verificationStatus",
            label: "Filter Verification",
            options: [
              { value: "pending", label: "Pending" },
              { value: "verified", label: "Verified" },
              { value: "rejected", label: "Rejected" }
            ]
          },
          {
            key: "status",
            label: "Filter Account Status",
            options: [
              { value: "active", label: "Active" },
              { value: "suspended", label: "Suspended" },
              { value: "deactivated", label: "Deactivated" }
            ]
          }
        ]}
        drawerTitle={(row) => row.fullName}
        drawerContent={(row, _onClose) => {
          if (!selectedFarmer || selectedFarmer.id !== row.id) {
            setSelectedFarmer(row);
            setActiveTab("profile");
          }

          const farmerInventory = inventory.filter(i => i.farmerId === row.id);
          const farmerDisputes = disputes.filter(d => d.entityType === "farmer" && d.entityId === row.id || d.entityType === "inventory_batch" && farmerInventory.some(i => i.id === d.entityId));
          const currentVerifyStatus = selectedFarmer?.verificationStatus || row.verificationStatus;

          return (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              
              {/* Header Status indicators */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <StatusBadge status={currentVerifyStatus} />
                <div style={{ display: "flex", gap: "8px" }}>
                  {access.canVerifyFarmers && currentVerifyStatus === "pending" && (
                    <>
                      <button
                        onClick={() => handleVerificationClick("verify")}
                        style={{ fontSize: "0.75rem", fontWeight: 700, padding: "6px 12px", border: 0, backgroundColor: palette.field, color: "white", borderRadius: "4px", cursor: "pointer" }}
                      >
                        Verify Farmer
                      </button>
                      <button
                        onClick={() => handleVerificationClick("reject")}
                        style={{ fontSize: "0.75rem", fontWeight: 700, padding: "6px 12px", border: `1px solid ${gray[300]}`, backgroundColor: "white", color: status.danger, borderRadius: "4px", cursor: "pointer" }}
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {currentVerifyStatus === "verified" && (
                    <span style={{ fontSize: "0.75rem", color: palette.field, fontWeight: 700, display: "flex", alignItems: "center", gap: "4px" }}>
                      ✓ Credentials Verified
                    </span>
                  )}
                </div>
              </div>

              {/* Tabs */}
              <div style={{ display: "flex", borderBottom: `1px solid ${gray[100]}`, gap: "16px" }}>
                {["profile", "produce", "disputes"].map((tab) => (
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
                    {tab === "profile" ? "Profile & Verification" : tab === "produce" ? "Produce & Receipts" : "Disputes"}
                  </button>
                ))}
              </div>

              {/* Tab Contents */}
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {activeTab === "profile" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                      <div>
                        <span style={{ fontSize: "0.75rem", color: gray[500], fontWeight: 600 }}>Farmer Code</span>
                        <p style={{ margin: "2px 0 0", fontSize: "0.875rem", fontWeight: 700, color: gray[900] }}>{row.farmerCode}</p>
                      </div>
                      <div>
                        <span style={{ fontSize: "0.75rem", color: gray[500], fontWeight: 600 }}>Registered Phone</span>
                        <p style={{ margin: "2px 0 0", fontSize: "0.875rem", fontWeight: 700, color: gray[900] }}>{row.phoneNumber}</p>
                      </div>
                      <div>
                        <span style={{ fontSize: "0.75rem", color: gray[500], fontWeight: 600 }}>Community</span>
                        <p style={{ margin: "2px 0 0", fontSize: "0.875rem", fontWeight: 700, color: gray[900] }}>{row.community}</p>
                      </div>
                      <div>
                        <span style={{ fontSize: "0.75rem", color: gray[500], fontWeight: 600 }}>Region</span>
                        <p style={{ margin: "2px 0 0", fontSize: "0.875rem", fontWeight: 700, color: gray[900] }}>{row.region || "N/A"}</p>
                      </div>
                      <div>
                        <span style={{ fontSize: "0.75rem", color: gray[500], fontWeight: 600 }}>Registration Source</span>
                        <p style={{ margin: "2px 0 0", fontSize: "0.875rem", fontWeight: 700, color: gray[900], textTransform: "capitalize" }}>{row.registrationSource.replace("_", " ")}</p>
                      </div>
                      <div>
                        <span style={{ fontSize: "0.75rem", color: gray[500], fontWeight: 600 }}>Preferred Warehouse</span>
                        <p style={{ margin: "2px 0 0", fontSize: "0.875rem", fontWeight: 700, color: gray[900] }}>
                          {warehouses.find(w => w.id === row.preferredWarehouseId)?.name || "Not Specified"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "produce" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <span style={{ fontSize: "0.75rem", color: gray[500], fontWeight: 700 }}>Intake History ({farmerInventory.length} lots)</span>
                    {farmerInventory.length === 0 ? (
                      <p style={{ margin: 0, fontSize: "0.875rem", color: gray[500], fontStyle: "italic", padding: "10px 0" }}>
                        No agricultural lots registered under this profile yet.
                      </p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {farmerInventory.map(item => (
                          <div
                            key={item.id}
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
                              <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: gray[900] }}>{item.receiptCode} · {item.cropType}</span>
                              <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: gray[500] }}>
                                Qty: {item.quantityReceived} {item.unit}s · Grade {item.grade}
                              </p>
                            </div>
                            <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: palette.field }}>
                              {item.storageFeeAccrued.toFixed(2)} GHS
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "disputes" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <span style={{ fontSize: "0.75rem", color: gray[500], fontWeight: 700 }}>Linked Disputes ({farmerDisputes.length})</span>
                    {farmerDisputes.length === 0 ? (
                      <p style={{ margin: 0, fontSize: "0.875rem", color: gray[500], fontStyle: "italic", padding: "10px 0" }}>
                        No active or closed disputes linked to this farmer.
                      </p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {farmerDisputes.map(disp => (
                          <div
                            key={disp.id}
                            style={{
                              padding: "12px",
                              border: `1px solid ${gray[100]}`,
                              borderRadius: "6px",
                              backgroundColor: disp.status === "open" ? status.dangerBg : gray[25]
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: gray[900] }}>{disp.title}</span>
                              <StatusBadge status={disp.status} />
                            </div>
                            <p style={{ margin: "6px 0 0", fontSize: "0.75rem", color: gray[600], lineHeight: 1.4 }}>
                              {disp.summary}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        }}
      />

      {/* Verification Modals */}
      {verificationType && selectedFarmer && (
        <ConfirmModal
          isOpen={verificationType !== null}
          title={verificationType === "verify" ? "Confirm Farmer Verification" : "Reject Profile Verification"}
          impactMessage={verificationType === "verify"
            ? `Verifying the profile for ${selectedFarmer.fullName} will activate their account, allowing them to deposit agricultural lots and request storage receipts at KuapaDwaso warehouses.`
            : `Rejecting the verification for ${selectedFarmer.fullName} will mark their account as deactivated. They will not be permitted to register crops or claim storage credits.`
          }
          confirmText={verificationType === "verify" ? "Approve Profile" : "Reject Profile"}
          onConfirm={handleVerificationConfirm}
          onCancel={() => setVerificationType(null)}
          requireReason={verificationType === "reject"}
          reasonPlaceholder="Specify the rejection reason (e.g. invalid phone ownership document, mismatch in location detail, failed screening)..."
        />
      )}
    </div>
    </OperationalAccessGate>
  );
}
