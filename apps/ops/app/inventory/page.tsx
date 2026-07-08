"use client";

/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, react-hooks/purity, react/no-unescaped-entities */

import type React from "react";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { allowedInventoryBatchStatusTransitions } from "@kuapa-dwaso/permissions";
import { api } from "../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";
import { useWarehouse } from "../context/WarehouseContext";
import { EvidencePanel } from "../EvidencePanel";
import { 
  Search, 
  Clock, 
  Coins, 
  AlertTriangle, 
  User, 
  X,
  ArrowLeft
} from "lucide-react";
import type { InventoryBatchStatus } from "@kuapa-dwaso/types";

function InventoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { 
    inventory, 
    farmers, 
    updateBatchQuantity, 
    updateBatchStatus, 
    updateBatchCondition,
    getBatchTimeline,
    disputes,
    actorUserId,
    errorMessage
  } = useWarehouse();

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCrop, setSelectedCrop] = useState<string>("all");
  const [selectedGrade, setSelectedGrade] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [filterExpiringSoon, setFilterExpiringSoon] = useState(false);
  const [filterHasIssues, setFilterHasIssues] = useState(false);

  // Active Batch in Drawer Detail
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  // Detail Sub-Modals
  const [showAdjustQtyModal, setShowAdjustQtyModal] = useState(false);
  const [showChangeStatusModal, setShowChangeStatusModal] = useState(false);
  const [showUpdateConditionModal, setShowUpdateConditionModal] = useState(false);
  const [showFeesLedgerModal, setShowFeesLedgerModal] = useState(false);

  // Form inputs for adjustments
  const [newQty, setNewQty] = useState(0);
  const [adjustReasonCategory, setAdjustReasonCategory] = useState("Spoilage");
  const [adjustReasonText, setAdjustReasonText] = useState("");

  const [newStatus, setNewStatus] = useState<InventoryBatchStatus>("available");
  const [statusReason, setStatusReason] = useState("");

  const [newCondition, setNewCondition] = useState("");
  const [mutationError, setMutationError] = useState("");
  const [isMutating, setIsMutating] = useState(false);

  // Process search params pre-filtering
  useEffect(() => {
    const filterParam = searchParams.get("filter");
    if (filterParam === "expiring") {
      setFilterExpiringSoon(true);
    } else if (filterParam === "issues") {
      setFilterHasIssues(true);
    }

    const searchParam = searchParams.get("search");
    if (searchParam) {
      setSearchQuery(searchParam);
    }
  }, [searchParams]);

  // Handle selected batch changes
  const activeBatch = inventory.find(b => b.id === selectedBatchId);
  const activeFarmer = activeBatch ? farmers.find(f => f.id === activeBatch.farmerId) : null;
  const activeTimeline = selectedBatchId ? getBatchTimeline(selectedBatchId) : [];
  const activeDisputes = activeBatch 
    ? disputes.filter(d => d.entityType === "inventory_batch" && d.entityId === activeBatch.id)
    : [];
  const activeFeeLedger = useQuery(
    api.storageFees.listByBatch,
    actorUserId && activeBatch
      ? {
          actorUserId: actorUserId as Id<"users">,
          inventoryBatchId: activeBatch.id as Id<"inventoryBatches">,
          limit: 50,
        }
      : "skip",
  ) as Doc<"storageFeeLedger">[] | undefined;

  // Seed values when opening sub-modals
  useEffect(() => {
    if (activeBatch) {
      setNewQty(activeBatch.quantityAvailable);
      setNewStatus(activeBatch.status);
      setNewCondition(activeBatch.conditionNotes || "");
    }
  }, [selectedBatchId, activeBatch]);

  // Filter & Sort Logic
  // Sorting: Sell-by ascending (expiring first)
  const filteredAndSortedBatches = [...inventory]
    .filter(batch => {
      // 1. Search Query (receipt code or farmer name)
      const farmer = farmers.find(f => f.id === batch.farmerId);
      const matchesSearch = 
        batch.receiptCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        batch.cropType.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (farmer && farmer.fullName.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      // 2. Crop
      if (selectedCrop !== "all" && batch.cropType !== selectedCrop) return false;

      // 3. Grade
      if (selectedGrade !== "all" && batch.grade !== selectedGrade) return false;

      // 4. Status
      if (selectedStatus !== "all" && batch.status !== selectedStatus) return false;

      // 5. Expiring soon (within 3 days, and not sold/spoiled)
      if (filterExpiringSoon) {
        const threeDays = Date.now() + 3 * 24 * 60 * 60 * 1000;
        const isExpiring = batch.sellByDate && batch.sellByDate <= threeDays && batch.quantityAvailable > 0 && batch.status !== "spoiled";
        if (!isExpiring) return false;
      }

      // 6. Has issues
      if (filterHasIssues) {
        const hasOpenDispute = disputes.some(
          d => d.entityType === "inventory_batch" && d.entityId === batch.id && d.status !== "resolved"
        );
        if (!hasOpenDispute) return false;
      }

      return true;
    })
    .sort((a, b) => {
      // Sort: Expiring first. If no sell-by, push to end
      const aTime = a.sellByDate || Infinity;
      const bTime = b.sellByDate || Infinity;
      return aTime - bTime;
    });

  // Calculate days remaining
  const getDaysRemainingText = (sellByDate?: number) => {
    if (!sellByDate) return { text: "No expiry", class: "text-gray" };
    const diffTime = sellByDate - Date.now();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return { text: `Expired ${Math.abs(diffDays)} days ago`, class: "text-danger" };
    }
    if (diffDays === 0) {
      return { text: "Expires today", class: "text-danger" };
    }
    if (diffDays === 1) {
      return { text: "Expires tomorrow", class: "text-danger" };
    }
    if (diffDays <= 3) {
      return { text: `Expires in ${diffDays} days`, class: "text-warning" };
    }
    return { text: `Expires in ${diffDays} days`, class: "text-muted" };
  };

  const getStatusBorderClass = (status: string) => {
    switch (status) {
      case "received": return "border-info";
      case "available": return "border-success";
      case "partially_reserved":
      case "reserved": return "border-warning";
      case "spoiled":
      case "expired": return "border-danger";
      default: return "border-neutral";
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "received": return "badge-info";
      case "available": return "badge-success";
      case "partially_reserved":
      case "reserved": return "badge-warning";
      case "spoiled":
      case "expired": return "badge-danger";
      default: return "badge-neutral";
    }
  };

  // Mutating Adjustments handlers
  const handleAdjustQtySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBatch) return;

    const reasonStr = `${adjustReasonCategory}${adjustReasonText.trim() ? `: ${adjustReasonText.trim()}` : ""}`;
    setIsMutating(true);
    setMutationError("");
    void updateBatchQuantity(activeBatch.id, newQty, reasonStr)
      .then(() => {
        setShowAdjustQtyModal(false);
        setAdjustReasonText("");
      })
      .catch((error: unknown) => {
        setMutationError(error instanceof Error ? error.message : "Could not update quantity.");
      })
      .finally(() => setIsMutating(false));
  };

  const handleChangeStatusSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBatch) return;

    setIsMutating(true);
    setMutationError("");
    void updateBatchStatus(activeBatch.id, newStatus, statusReason || `Status updated to ${newStatus}`)
      .then(() => {
        setShowChangeStatusModal(false);
        setStatusReason("");
      })
      .catch((error: unknown) => {
        setMutationError(error instanceof Error ? error.message : "Could not update status.");
      })
      .finally(() => setIsMutating(false));
  };

  const handleUpdateConditionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBatch) return;

    setIsMutating(true);
    setMutationError("");
    void updateBatchCondition(activeBatch.id, newCondition)
      .then(() => {
        setShowUpdateConditionModal(false);
      })
      .catch((error: unknown) => {
        setMutationError(error instanceof Error ? error.message : "Could not update condition notes.");
      })
      .finally(() => setIsMutating(false));
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCrop("all");
    setSelectedGrade("all");
    setSelectedStatus("all");
    setFilterExpiringSoon(false);
    setFilterHasIssues(false);
  };

  if (activeBatch) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button 
            type="button" 
            className="modal-close" 
            onClick={() => setSelectedBatchId(null)}
            style={{ width: "40px", height: "40px", backgroundColor: "var(--color-surface-raised)", display: "flex", alignItems: "center", justifyContent: "center" }}
            aria-label="Back to inventory"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div style={{ fontSize: "12px", color: "var(--gray-500)", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>Batch Details</span>
              <span>·</span>
              <span className="code-chip" style={{ fontSize: "11px" }}>{activeBatch.receiptCode}</span>
            </div>
            <h1 style={{ fontSize: "24px", fontWeight: "800", color: "var(--color-ink)", marginTop: "4px" }}>
              {activeBatch.cropType}
            </h1>
          </div>
        </div>

        {/* Content Pane */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px", paddingBottom: "40px" }}>
          
          {/* Stat card header metrics */}
          <div className="info-card" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: "14px", color: "var(--gray-500)" }}>Available Quantity</span>
              <span style={{ fontSize: "28px", fontWeight: "800" }}>
                {activeBatch.quantityAvailable} <span style={{ fontSize: "16px", fontWeight: "600" }}>{activeBatch.unit}s</span>
              </span>
            </div>
            
            {/* Thin progress bar */}
            <div style={{ width: "100%", height: "6px", backgroundColor: "var(--gray-100)", borderRadius: "3px", overflow: "hidden", marginTop: "4px" }}>
              <div 
                style={{ 
                  width: `${(activeBatch.quantityAvailable / activeBatch.quantityReceived) * 100}%`, 
                  height: "100%", 
                  backgroundColor: "var(--color-field)",
                  borderRadius: "3px"
                }} 
              />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--gray-500)" }}>
              <span>{(activeBatch.quantityAvailable / activeBatch.quantityReceived * 100).toFixed(0)}% available</span>
              <span>Total received: {activeBatch.quantityReceived} {activeBatch.unit}s</span>
            </div>
          </div>

          {/* Producer Details */}
          <div>
            <h3 className="detail-section-title">Producer Details</h3>
            <div className="info-card" style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "40px", height: "40px", borderRadius: "50%", backgroundColor: "var(--gray-50)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <User size={20} className="text-gray-500" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: "700" }}>{activeFarmer?.fullName || "Unknown"}</div>
                <div style={{ fontSize: "13px", color: "var(--gray-500)" }}>{activeFarmer?.phoneNumber} · {activeFarmer?.community}</div>
              </div>
              <button 
                type="button" 
                className="btn btn-outline" 
                style={{ width: "auto", height: "36px", padding: "0 12px", fontSize: "13px" }}
                onClick={() => router.push(`/farmers`)}
              >
                View
              </button>
            </div>
          </div>

          {/* Grade & condition notes */}
          <div>
            <h3 className="detail-section-title">Grade & Quality Condition</h3>
            <div className="info-card">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span className="badge badge-success">Grade {activeBatch.grade}</span>
                  <span style={{ fontSize: "14px", color: "var(--gray-600)" }}>{activeBatch.variety}</span>
                </div>
                <button 
                  type="button" 
                  className="btn btn-outline" 
                  style={{ width: "auto", height: "36px", padding: "0 12px", fontSize: "13px" }}
                  onClick={() => setShowUpdateConditionModal(true)}
                >
                  Update
                </button>
              </div>
              {activeBatch.conditionNotes ? (
                <div style={{ fontSize: "14px", color: "var(--gray-700)", fontStyle: "italic", marginTop: "8px", borderLeft: "2px solid var(--color-line)", paddingLeft: "10px" }}>
                  "{activeBatch.conditionNotes}"
                </div>
              ) : (
                <div style={{ fontSize: "14px", color: "var(--gray-500)", fontStyle: "italic", marginTop: "8px" }}>
                  No condition notes reported.
                </div>
              )}
            </div>
          </div>

          <EvidencePanel
            actorUserId={actorUserId}
            relatedEntityType="inventory_batch"
            relatedEntityId={activeBatch.id}
            purpose="condition_evidence"
            title="Condition Evidence"
          />

          {/* Storage Fees summary */}
          <div>
            <h3 className="detail-section-title">Storage Fees Overview</h3>
            <div className="info-card" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: "24px", fontWeight: "800", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Coins size={20} style={{ color: "var(--color-success)" }} />
                    <span>GHS {activeBatch.storageFeeAccrued.toFixed(2)}</span>
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--gray-500)", marginTop: "2px" }}>
                    Rate: GHS {activeBatch.storageRateSnapshot?.ratePerUnitPerDay?.toFixed(2)}/{activeBatch.unit}/day
                  </div>
                </div>
                
                <button 
                  type="button" 
                  className="btn btn-outline" 
                  style={{ width: "auto", height: "36px", padding: "0 12px", fontSize: "13px" }}
                  onClick={() => setShowFeesLedgerModal(true)}
                >
                  View Ledger
                </button>
              </div>
            </div>
          </div>

          {/* Related Issues */}
          <div>
            <h3 className="detail-section-title">Related Issues</h3>
            {activeDisputes.length === 0 ? (
              <div className="info-card" style={{ color: "var(--gray-500)", fontSize: "14px", fontStyle: "italic" }}>
                No open issues or disputes for this batch.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {activeDisputes.map(disp => (
                  <div key={disp.id} className="info-card" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: "700", fontSize: "14px" }}>{disp.title}</span>
                      <span className="badge badge-danger" style={{ fontSize: "10px" }}>{disp.status}</span>
                    </div>
                    <span style={{ fontSize: "13px", color: "var(--gray-600)" }}>{disp.summary}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Batch History Timeline */}
          <div>
            <h3 className="detail-section-title">Batch History Timeline</h3>
            <div className="info-card">
              <div className="timeline">
                {activeTimeline.map((evt, idx) => (
                  <div key={idx} className="timeline-item">
                    <div className={`timeline-dot ${getStatusBadgeClass(evt.status)}`} />
                    <div className="timeline-title">
                      Status Changed to {evt.status.replace(/_/g, " ")}
                    </div>
                    <div className="timeline-time">
                      {new Date(evt.timestamp).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · by {evt.actor}
                    </div>
                    {evt.reason && (
                      <div className="timeline-notes">
                        Reason: "{evt.reason}"
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {(mutationError || errorMessage) && (
            <div className="offline-banner" style={{ margin: "0", backgroundColor: "var(--color-danger-bg)", color: "var(--color-danger)", borderColor: "var(--color-danger-border)" }}>
              <AlertTriangle size={16} />
              <span>{mutationError || errorMessage}</span>
            </div>
          )}

          {/* Actions Tray */}
          <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
            <button 
              type="button" 
              className="btn btn-outline" 
              style={{ flex: 1, height: "46px", fontSize: "14px" }}
              onClick={() => {
                setNewStatus(allowedInventoryBatchStatusTransitions[activeBatch.status][0] ?? activeBatch.status);
                setShowChangeStatusModal(true);
              }}
            >
              Change Status
            </button>
            <button 
              type="button" 
              className="btn btn-outline" 
              style={{ flex: 1, height: "46px", fontSize: "14px" }}
              onClick={() => setShowAdjustQtyModal(true)}
            >
              Adjust Qty
            </button>
            <button 
              type="button" 
              className="btn btn-ghost" 
              style={{ flex: 0.5, height: "46px", padding: 0 }}
              onClick={() => {
                setSelectedBatchId(null);
                router.push(`/disputes/new?entityId=${activeBatch.id}&entityType=inventory_batch`);
              }}
              title="Raise issue / Dispute"
            >
              <AlertTriangle size={20} style={{ color: "var(--color-danger)" }} />
            </button>
          </div>
        </div>

        {/* Adjust Qty Confirmation Dialog */}
        {showAdjustQtyModal && (
          <div className="modal-backdrop" onClick={() => setShowAdjustQtyModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3 className="modal-title">Adjust Available Stock</h3>
                <button type="button" className="modal-close" onClick={() => setShowAdjustQtyModal(false)}>
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleAdjustQtySubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="newQtyInput">New Available Quantity ({activeBatch.unit}s)</label>
                  <input 
                    id="newQtyInput"
                    type="number" 
                    className="form-input" 
                    value={newQty}
                    onChange={(e) => setNewQty(parseInt(e.target.value) || 0)}
                    min="0"
                    max={activeBatch.quantityReceived}
                  />
                  <div style={{ fontSize: "12px", color: "var(--gray-500)", marginTop: "4px" }}>
                    Total received: {activeBatch.quantityReceived} {activeBatch.unit}s.
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="adjustCategory">Adjustment Reason Category</label>
                  <select 
                    id="adjustCategory"
                    className="form-select"
                    value={adjustReasonCategory}
                    onChange={(e) => setAdjustReasonCategory(e.target.value)}
                  >
                    <option value="Spoilage">Spoilage / Spilled</option>
                    <option value="Audit discrepancy">Audit Inventory Reconciliation</option>
                    <option value="Theft">Unaccounted shrinkage</option>
                    <option value="Re-grading transfer">Quality downgrade transfer</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="adjustNotes">Audit explanation notes</label>
                  <textarea 
                    id="adjustNotes"
                    className="form-textarea" 
                    placeholder="Provide context for audit records..."
                    value={adjustReasonText}
                    onChange={(e) => setAdjustReasonText(e.target.value)}
                  />
                </div>

                <div className="modal-actions">
                  <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => setShowAdjustQtyModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={isMutating}>
                    {isMutating ? "Saving..." : "Commit Change"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Change Status Confirmation Dialog */}
        {showChangeStatusModal && (
          <div className="modal-backdrop" onClick={() => setShowChangeStatusModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3 className="modal-title">Change Batch Status</h3>
                <button type="button" className="modal-close" onClick={() => setShowChangeStatusModal(false)}>
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleChangeStatusSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="newStatusSelect">New Batch Status</label>
                  <select 
                    id="newStatusSelect"
                    className="form-select"
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as any)}
                  >
                    {allowedInventoryBatchStatusTransitions[activeBatch.status].map(status => (
                      <option key={status} value={status}>
                        {status.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="statusReasonText">Reason / Audit explanation</label>
                  <textarea 
                    id="statusReasonText"
                    className="form-textarea" 
                    placeholder="Specify why status is changing..."
                    value={statusReason}
                    onChange={(e) => setStatusReason(e.target.value)}
                    required
                  />
                </div>

                <div className="modal-actions">
                  <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => setShowChangeStatusModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={isMutating || allowedInventoryBatchStatusTransitions[activeBatch.status].length === 0}>
                    {isMutating ? "Saving..." : "Commit Status"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Update Condition Note Dialog */}
        {showUpdateConditionModal && (
          <div className="modal-backdrop" onClick={() => setShowUpdateConditionModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3 className="modal-title">Update Condition Notes</h3>
                <button type="button" className="modal-close" onClick={() => setShowUpdateConditionModal(false)}>
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleUpdateConditionSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="newConditionNotes">Condition & Quality Notes</label>
                  <textarea 
                    id="newConditionNotes"
                    className="form-textarea" 
                    placeholder="Describe batch conditions (moisture level, insect checks, size variance)..."
                    value={newCondition}
                    onChange={(e) => setNewCondition(e.target.value)}
                    style={{ minHeight: "100px" }}
                  />
                </div>

                <div className="modal-actions">
                  <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => setShowUpdateConditionModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={isMutating}>
                    {isMutating ? "Saving..." : "Update Notes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Storage Fee View / Ledger Modal */}
        {showFeesLedgerModal && (
          <div className="modal-backdrop" onClick={() => setShowFeesLedgerModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ minHeight: "60vh" }}>
              <div className="modal-header">
                <h3 className="modal-title">Storage Fee Accruals</h3>
                <button type="button" className="modal-close" onClick={() => setShowFeesLedgerModal(false)}>
                  <X size={20} />
                </button>
              </div>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ backgroundColor: "var(--gray-50)", padding: "16px", borderRadius: "10px", textAlign: "center" }}>
                  <div style={{ fontSize: "14px", color: "var(--gray-500)" }}>Total Accrued Storage Fee</div>
                  <div style={{ fontSize: "32px", fontWeight: "900", color: "var(--color-field-dark)", marginTop: "4px" }}>
                    GHS {activeBatch.storageFeeAccrued.toFixed(2)}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--gray-400)", marginTop: "4px" }}>
                    Accruing per daily cycle
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {activeFeeLedger === undefined ? (
                    <div style={{ color: "var(--gray-500)", fontSize: "14px", padding: "8px 0" }}>
                      Loading ledger entries...
                    </div>
                  ) : activeFeeLedger.length === 0 ? (
                    <div style={{ color: "var(--gray-500)", fontSize: "14px", padding: "8px 0" }}>
                      No storage fee ledger entries have been recorded for this batch.
                    </div>
                  ) : (
                    activeFeeLedger.map(entry => (
                      <div key={entry._id} style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", padding: "8px 0", borderBottom: "1px dashed var(--color-line)" }}>
                        <span style={{ color: "var(--gray-500)" }}>
                          {new Date(entry.feeDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · {entry.status.replace(/_/g, " ")}
                        </span>
                        <strong style={{ color: "var(--color-ink)" }}>GHS {entry.amount.toFixed(2)}</strong>
                      </div>
                    ))
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", padding: "8px 0", borderBottom: "1px dashed var(--color-line)" }}>
                    <span style={{ color: "var(--gray-500)" }}>Daily Rate snapshot</span>
                    <strong style={{ color: "var(--color-ink)" }}>GHS {activeBatch.storageRateSnapshot?.ratePerUnitPerDay?.toFixed(2)} / {activeBatch.unit}</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", padding: "8px 0", borderBottom: "1px dashed var(--color-line)" }}>
                    <span style={{ color: "var(--gray-500)" }}>Current stockpile volume</span>
                    <strong style={{ color: "var(--color-ink)" }}>{activeBatch.quantityAvailable} {activeBatch.unit}s</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", padding: "8px 0", borderBottom: "1px dashed var(--color-line)" }}>
                    <span style={{ color: "var(--gray-500)" }}>Days in warehouse</span>
                    <strong style={{ color: "var(--color-ink)" }}>
                      {Math.max(1, Math.round((Date.now() - activeBatch.receivedAt) / (1000 * 60 * 60 * 24)))} days
                    </strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", padding: "8px 0" }}>
                    <span style={{ color: "var(--gray-500)" }}>Last calculated at</span>
                    <strong style={{ color: "var(--color-ink)" }}>
                      {new Date(activeBatch.lastFeeCalculatedAt || activeBatch.receivedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      
      {/* Header */}
      <div>
        <h1 style={{ fontSize: "24px", fontWeight: "800", color: "var(--color-ink)", marginBottom: "4px" }}>
          Warehouse Inventory
        </h1>
        <p style={{ color: "var(--gray-600)", fontSize: "14px" }}>
          Track available stockpiles, grades, storage accruals, and shelf life.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <section className="section-card" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
        <div className="search-wrapper">
          <div style={{ position: "relative", flex: 1 }}>
            <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--gray-400)", display: "flex" }}>
              <Search size={18} />
            </span>
            <input 
              type="text" 
              className="form-input" 
              style={{ paddingLeft: "38px" }}
              placeholder="Search receipt code or farmer name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {(selectedCrop !== "all" || selectedGrade !== "all" || selectedStatus !== "all" || filterExpiringSoon || filterHasIssues) && (
            <button 
              type="button" 
              className="btn btn-outline" 
              style={{ width: "auto", padding: "0 12px" }}
              onClick={clearFilters}
            >
              Clear
            </button>
          )}
        </div>

        {/* Scrolling filter chips */}
        <div className="filter-scroll-bar">
          {/* Crop filters */}
          {["all", "Maize", "Cocoa", "Yam", "Cassava", "Tomato"].map(crop => (
            <button
              key={crop}
              type="button"
              className={`filter-pill ${selectedCrop === crop ? "active" : ""}`}
              onClick={() => setSelectedCrop(crop)}
            >
              {crop === "all" ? "All Crops" : crop}
            </button>
          ))}
        </div>

        <div className="filter-scroll-bar" style={{ borderTop: "1px solid var(--gray-100)", paddingTop: "8px", paddingBottom: "4px" }}>
          {/* Grade Filters */}
          {["all", "A", "B", "C"].map(grade => (
            <button
              key={grade}
              type="button"
              className={`filter-pill ${selectedGrade === grade ? "active" : ""}`}
              onClick={() => setSelectedGrade(grade)}
            >
              {grade === "all" ? "All Grades" : `Grade ${grade}`}
            </button>
          ))}

          <span style={{ margin: "0 4px", color: "var(--color-line)" }}>|</span>

          {/* Special Toggle Filters */}
          <button
            type="button"
            className={`filter-pill ${filterExpiringSoon ? "active" : ""}`}
            onClick={() => setFilterExpiringSoon(!filterExpiringSoon)}
            style={{ display: "inline-flex", gap: "6px" }}
          >
            <Clock size={14} />
            <span>Expiring Soon</span>
          </button>

          <button
            type="button"
            className={`filter-pill ${filterHasIssues ? "active" : ""}`}
            onClick={() => setFilterHasIssues(!filterHasIssues)}
            style={{ display: "inline-flex", gap: "6px" }}
          >
            <AlertTriangle size={14} />
            <span>Open Issues</span>
          </button>
        </div>
      </section>

      {/* Main Batches List/Table Container */}
      <section aria-label="Inventory Batches">
        {filteredAndSortedBatches.length === 0 ? (
          /* Empty state block */
          <div className="section-card" style={{ textAlign: "center", padding: "48px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "50%", backgroundColor: "var(--gray-50)", color: "var(--gray-400)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Search size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: "18px", fontWeight: "700" }}>No Batches Match Filters</h3>
              <p style={{ color: "var(--gray-500)", fontSize: "14px", marginTop: "4px" }}>
                Try adjusting search query or clearing active crop, grade, or status selections.
              </p>
            </div>
            <button type="button" className="btn btn-primary" style={{ width: "auto" }} onClick={clearFilters}>
              Clear All Filters
            </button>
          </div>
        ) : (
          <>
            {/* Mobile View: Cards stack list */}
            <div className="cards-list">
              {filteredAndSortedBatches.map(batch => {
                const expiry = getDaysRemainingText(batch.sellByDate);
                const hasIssues = disputes.some(d => d.entityType === "inventory_batch" && d.entityId === batch.id && d.status !== "resolved");
                
                return (
                  <div 
                    key={batch.id} 
                    className={`batch-card ${getStatusBorderClass(batch.status)}`}
                    onClick={() => setSelectedBatchId(batch.id)}
                  >
                    <div className="batch-row-1">
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span className="batch-title">{batch.cropType}</span>
                        <span style={{ fontSize: "13px", color: "var(--gray-500)" }}>({batch.variety || "Standard"})</span>
                      </div>
                      <span className={`badge ${getStatusBadgeClass(batch.status)}`}>
                        {batch.status.replace(/_/g, " ")}
                      </span>
                    </div>

                    <div className="batch-row-2">
                      <strong>{batch.quantityAvailable} {batch.unit}s available</strong> of {batch.quantityReceived} received
                      <span style={{ margin: "0 6px", color: "var(--color-line)" }}>·</span>
                      <span className="code-chip" style={{ fontSize: "11px", padding: "1px 4px" }}>{batch.receiptCode}</span>
                    </div>

                    <div className="batch-row-3">
                      <span style={{ display: "flex", alignItems: "center", gap: "4px" }} className={expiry.class === "text-danger" ? "text-danger" : expiry.class === "text-warning" ? "text-warning" : ""}>
                        <Clock size={12} />
                        <span style={{ fontWeight: expiry.class !== "text-muted" ? "bold" : "normal" }}>{expiry.text}</span>
                      </span>
                      
                      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                        {hasIssues && (
                          <span style={{ color: "var(--color-danger)", display: "flex", alignItems: "center" }}>
                            <AlertTriangle size={14} />
                          </span>
                        )}
                        <span style={{ display: "flex", alignItems: "center", gap: "2px", fontWeight: "700" }}>
                          <Coins size={14} style={{ color: "var(--color-success)" }} />
                          <span>GHS {batch.storageFeeAccrued.toFixed(2)}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop View: Zebra Tables list */}
            <div className="desktop-table-container">
              <table className="desktop-table" aria-label="Inventory table layout">
                <thead>
                  <tr>
                    <th>Receipt</th>
                    <th>Farmer</th>
                    <th>Crop / Variety</th>
                    <th>Available / Received</th>
                    <th>Grade</th>
                    <th>Status</th>
                    <th>Fees Accrued</th>
                    <th>Expiry Countdown</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedBatches.map(batch => {
                    const farmer = farmers.find(f => f.id === batch.farmerId);
                    const expiry = getDaysRemainingText(batch.sellByDate);
                    return (
                      <tr key={batch.id} onClick={() => setSelectedBatchId(batch.id)}>
                        <td><span className="code-chip">{batch.receiptCode}</span></td>
                        <td>
                          <div style={{ fontWeight: "700" }}>{farmer?.fullName || "Unknown"}</div>
                          <div style={{ fontSize: "12px", color: "var(--gray-500)" }}>{farmer?.phoneNumber}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: "700" }}>{batch.cropType}</div>
                          <div style={{ fontSize: "12px", color: "var(--gray-500)" }}>{batch.variety}</div>
                        </td>
                        <td>
                          <strong>{batch.quantityAvailable} {batch.unit}s</strong>
                          <span style={{ color: "var(--gray-500)", fontSize: "13px" }}> / {batch.quantityReceived} {batch.unit}s</span>
                        </td>
                        <td><span className="badge badge-neutral" style={{ fontSize: "11px" }}>Grade {batch.grade}</span></td>
                        <td>
                          <span className={`badge ${getStatusBadgeClass(batch.status)}`}>
                            {batch.status.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <Coins size={14} style={{ color: "var(--color-success)" }} />
                            GHS {batch.storageFeeAccrued.toFixed(2)}
                          </span>
                        </td>
                        <td>
                          <span className={expiry.class === "text-danger" ? "text-danger" : expiry.class === "text-warning" ? "text-warning" : ""}>
                            {expiry.text}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

    </div>
  );
}

export default function InventoryPage() {
  return (
    <Suspense fallback={<div style={{ padding: "20px", color: "var(--gray-500)", textAlign: "center" }}>Loading inventory...</div>}>
      <InventoryContent />
    </Suspense>
  );
}
