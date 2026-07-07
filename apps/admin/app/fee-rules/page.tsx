// apps/admin/app/fee-rules/page.tsx
"use client";

import { useState } from "react";
import { DataTable, StatusBadge, useWarehouseFilter, gray, palette, status } from "@kuapa-dwaso/dashboard-ui";
import { Plus, History } from "lucide-react";
import { OperationalAccessGate } from "../operational/OperationalAccessGate";
import { useOperationalAdminData } from "../operational/useOperationalAdminData";

export default function FeeRulesPage() {
  const { selectedWarehouseId } = useWarehouseFilter();
  const { access, feeRules, warehouses, actions } = useOperationalAdminData();
  const [selectedRule, setSelectedRule] = useState<any>(null);

  // States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newRate, setNewRate] = useState<number>(0);
  const [updateReason, setUpdateReason] = useState("");
  const [rateError, setRateError] = useState("");

  const filteredRules = selectedWarehouseId === "all"
    ? feeRules
    : feeRules.filter(r => !r.scope.warehouseId || r.scope.warehouseId === selectedWarehouseId);

  const columns = [
    { key: "code", header: "Rule Code", type: "text" as const },
    { key: "label", header: "Description Label", type: "text" as const },
    {
      key: "scope",
      header: "Application Scope",
      render: (row: any) => {
        const chips: string[] = [];
        if (row.scope.cropType) chips.push(`Crop: ${row.scope.cropType}`);
        if (row.scope.grade) chips.push(`Grade: ${row.scope.grade}`);
        if (row.scope.unit) chips.push(`Unit: ${row.scope.unit}`);
        if (row.scope.warehouseId) {
          const name = warehouses.find(w => w.id === row.scope.warehouseId)?.name || row.scope.warehouseId;
          chips.push(`Facility: ${name}`);
        }

        if (chips.length === 0) return <span style={{ fontSize: "0.75rem", color: gray[500], fontStyle: "italic" }}>Global Rule</span>;

        return (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
            {chips.map((c, i) => (
              <span key={i} style={{ fontSize: "0.75rem", padding: "2px 6px", backgroundColor: gray[50], border: `1px solid ${gray[100]}`, borderRadius: "4px", color: gray[700], fontWeight: 500 }}>
                {c}
              </span>
            ))}
          </div>
        );
      }
    },
    {
      key: "rate",
      header: "Current Value",
      type: "numeric" as const,
      render: (row: any) => {
        if (row.calculationType === "per_unit_per_day") {
          return `${row.ratePerUnitPerDay.toFixed(2)} ${row.currency} / day`;
        }
        if (row.calculationType === "percentage_of_gross_sale") {
          return `${row.percentage}% Gross`;
        }
        if (row.calculationType === "fixed_amount") {
          return `${row.amount} ${row.currency} Flat`;
        }
        return `${row.ratePerUnit} ${row.currency} / unit`;
      }
    },
    {
      key: "version",
      header: "Version",
      type: "numeric" as const,
      render: (row: any) => `v${row.version}`
    },
    {
      key: "status",
      header: "Status",
      render: (row: any) => <StatusBadge status={row.status} />
    }
  ];

  const handleEditRateClick = () => {
    if (!selectedRule) return;
    const currentRate = selectedRule.ratePerUnitPerDay ?? selectedRule.percentage ?? selectedRule.amount ?? selectedRule.ratePerUnit ?? 0;
    setNewRate(currentRate);
    setRateError("");
    setUpdateReason("");
    setIsModalOpen(true);
  };

  const handleConfirmVersionChange = (reason?: string) => {
    if (!selectedRule || newRate <= 0) {
      setRateError("Rate must be greater than zero.");
      return;
    }
    void actions.updateFeeRuleVersion(selectedRule.id, newRate, reason || updateReason);
    setIsModalOpen(false);

    // Refresh selected state
    const rules = feeRules; // fetch updated
    const updated = rules.find(r => r.code === selectedRule.code && r.status === "active");
    if (updated) {
      setSelectedRule(updated);
    }
  };

  return (
    <OperationalAccessGate
      firebaseUser={access.firebaseUser}
      principal={access.principal}
      isAuthLoading={access.isAuthLoading}
      isDataLoading={access.isDataLoading}
      isAllowed={access.canReadFees}
      limitedMessage="Fee configuration requires fees:read for your assigned scope."
    >
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: gray[900], margin: 0 }}>
          Fee Rule Configuration
        </h1>
        <p style={{ fontSize: "0.875rem", color: gray[500], margin: "4px 0 0" }}>
          Platform rates, storage charges, and deductions. Inline-editing is disabled for audit safety.
        </p>
      </div>

      {/* Grid */}
      <DataTable
        data={filteredRules}
        columns={columns}
        rowIdKey="id"
        searchKey="label"
        searchPlaceholder="Search fee descriptions..."
        drawerTitle={(row) => row.label}
        drawerContent={(row, _onClose) => {
          if (!selectedRule || selectedRule.code !== row.code) {
            setSelectedRule(row);
          }

          // Fetch version history for this rule
          const history = feeRules
            .filter(r => r.code === row.code)
            .sort((a, b) => b.version - a.version);

          const activeVersion = history.find(h => h.status === "active") || row;
          const currentRateValue = activeVersion.ratePerUnitPerDay ?? activeVersion.percentage ?? activeVersion.amount ?? activeVersion.ratePerUnit ?? 0;
          const payerLabel = activeVersion.payer.toUpperCase();

          return (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              
              {/* Top summary card */}
              <div style={{ padding: "16px", border: `1px solid ${gray[100]}`, borderRadius: "8px", backgroundColor: gray[25], display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "1rem", fontWeight: 800, color: gray[900] }}>Active Version Details</span>
                  <StatusBadge status={activeVersion.status} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "0.8125rem", marginTop: "8px" }}>
                  <div>
                    <span style={{ color: gray[500], fontWeight: 600 }}>Rule Code</span>
                    <p style={{ margin: "2px 0 0", fontWeight: 700, color: gray[700] }}>{activeVersion.code}</p>
                  </div>
                  <div>
                    <span style={{ color: gray[500], fontWeight: 600 }}>Billing Payer</span>
                    <p style={{ margin: "2px 0 0", fontWeight: 700, color: gray[700] }}>{payerLabel}</p>
                  </div>
                  <div>
                    <span style={{ color: gray[500], fontWeight: 600 }}>Calculation Method</span>
                    <p style={{ margin: "2px 0 0", fontWeight: 700, color: gray[700], textTransform: "capitalize" }}>{activeVersion.calculationType.replace(/_/g, " ")}</p>
                  </div>
                  <div>
                    <span style={{ color: gray[500], fontWeight: 600 }}>Active Rate Value</span>
                    <p style={{ margin: "2px 0 0", fontWeight: 700, color: palette.field }}>
                      {currentRateValue} {activeVersion.currency}
                    </p>
                  </div>
                </div>
              </div>

              {/* Versioning Actions */}
              {access.canManageFees && activeVersion.status === "active" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <span style={{ fontSize: "0.75rem", color: gray[500], fontWeight: 700, textTransform: "uppercase" }}>Administrative Actions</span>
                  <button
                    onClick={handleEditRateClick}
                    style={{
                      width: "100%",
                      backgroundColor: palette.field,
                      color: "white",
                      border: 0,
                      borderRadius: "6px",
                      padding: "10px",
                      fontWeight: 700,
                      fontSize: "0.875rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px"
                    }}
                  >
                    <Plus size={16} /> Propose New Rate Version
                  </button>
                </div>
              )}

              {/* Version timeline history list */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <span style={{ fontSize: "0.75rem", color: gray[500], fontWeight: 700, textTransform: "uppercase", display: "flex", alignItems: "center", gap: "6px" }}>
                  <History size={14} /> Version History Timeline
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {history.map((h) => {
                    const hRate = h.ratePerUnitPerDay ?? h.percentage ?? h.amount ?? h.ratePerUnit ?? 0;
                    return (
                      <div
                        key={h.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "12px 14px",
                          border: `1px solid ${gray[100]}`,
                          borderRadius: "6px",
                          backgroundColor: h.status === "active" ? "#f0fdf4" : "transparent"
                        }}
                      >
                        <div>
                          <span style={{ fontSize: "0.875rem", fontWeight: 700, color: gray[800] }}>
                            Version {h.version} ({hRate.toFixed(2)} {h.currency})
                          </span>
                          <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: gray[500] }}>
                            Effective: {new Date(h.effectiveFrom).toLocaleDateString()} {h.effectiveTo ? `to ${new Date(h.effectiveTo).toLocaleDateString()}` : " - Present"}
                          </p>
                        </div>
                        <StatusBadge status={h.status} />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        }}
      />

      {/* Confirmation Modal */}
      {isModalOpen && selectedRule && (
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
          <div style={{ backgroundColor: "white", borderRadius: "12px", width: "100%", maxWidth: "460px", border: `1px solid ${gray[100]}`, display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "20px 24px", borderBottom: `1px solid ${gray[100]}`, backgroundColor: gray[25] }}>
              <h3 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 700, color: gray[900] }}>Propose Rate Update</h3>
            </div>

            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ backgroundColor: status.warningBg, borderLeft: "none", borderRadius: "6px", padding: "12px" }}>
                <span style={{ fontSize: "0.8125rem", color: status.warning, fontWeight: 700 }}>⚠️ Audit Impact Statement</span>
                <p style={{ margin: "4px 0 0", fontSize: "0.8125rem", color: gray[700], lineHeight: 1.4 }}>
                  This change creates a new rule version (v{(selectedRule?.version || 1) + 1}) replacing the active rule code <strong style={{ fontFamily: "monospace" }}>{selectedRule?.code}</strong>. New rate will apply immediately to deposits scoped to: <strong>{selectedRule?.scope.cropType || "Global"} · Grade {selectedRule?.scope.grade || "All"}</strong>. Historical accruals remain locked.
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "0.875rem", fontWeight: 600, color: gray[700] }}>New Proportional Rate ({selectedRule?.currency})</label>
                <input
                  type="number"
                  step="0.01"
                  value={newRate}
                  onChange={(e) => {
                    setNewRate(parseFloat(e.target.value) || 0);
                    if (parseFloat(e.target.value) > 0) setRateError("");
                  }}
                  style={{ width: "100%", padding: "10px 12px", border: `1px solid ${rateError ? status.danger : gray[300]}`, borderRadius: "6px", fontSize: "0.875rem", outline: "none" }}
                />
                {rateError && <span style={{ fontSize: "0.75rem", color: status.danger, fontWeight: 500 }}>{rateError}</span>}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "0.875rem", fontWeight: 600, color: gray[700] }}>Version Amendment Reason / Notes *</label>
                <textarea
                  value={updateReason}
                  onChange={(e) => setUpdateReason(e.target.value)}
                  placeholder="Explain rate adjustment rationale (e.g. alignment to market price indexing, fuel cost additions, operational adjustments)..."
                  rows={3}
                  style={{ width: "100%", padding: "10px 12px", border: `1px solid ${gray[300]}`, borderRadius: "6px", fontSize: "0.875rem", outline: "none", resize: "vertical", fontFamily: "inherit" }}
                />
              </div>
            </div>

            <div style={{ padding: "16px 24px", borderTop: `1px solid ${gray[100]}`, backgroundColor: gray[25], display: "flex", justifyContent: "flex-end", gap: "12px" }}>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{ background: "transparent", border: `1px solid ${gray[300]}`, borderRadius: "6px", color: gray[700], padding: "8px 16px", fontWeight: 600, fontSize: "0.875rem", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleConfirmVersionChange()}
                disabled={!updateReason.trim()}
                style={{ background: palette.field, border: 0, borderRadius: "6px", color: "white", padding: "8px 16px", fontWeight: 700, fontSize: "0.875rem", cursor: updateReason.trim() ? "pointer" : "not-allowed", opacity: updateReason.trim() ? 1 : 0.6 }}
              >
                Apply New Version
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </OperationalAccessGate>
  );
}
