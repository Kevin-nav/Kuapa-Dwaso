"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useWarehouse } from "../context/WarehouseContext";
import { 
  Search, 
  Clock, 
  Coins, 
  AlertTriangle, 
  User, 
  X,
  Info
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
    disputes
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
    updateBatchQuantity(activeBatch.id, newQty, reasonStr);
    
    // Reset and Close
    setShowAdjustQtyModal(false);
    setAdjustReasonText("");
  };

  const handleChangeStatusSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBatch) return;

    updateBatchStatus(activeBatch.id, newStatus, statusReason || `Status updated to ${newStatus}`);
    
    // Reset and Close
    setShowChangeStatusModal(false);
    setStatusReason("");
  };

  const handleUpdateConditionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBatch) return;

    updateBatchCondition(activeBatch.id, newCondition);
    setShowUpdateConditionModal(false);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCrop("all");
    setSelectedGrade("all");
    setSelectedStatus("all");
    setFilterExpiringSoon(false);
    setFilterHasIssues(false);
  };

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

      {/* DETAIL MODAL DRAWER OVERLAY */}
      {activeBatch && (
        <div className="modal-backdrop" onClick={() => setSelectedBatchId(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ minHeight: "85vh" }}>
            
            {/* Drawer Header */}
            <div className="modal-header">
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: "12px", color: "var(--gray-500)", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>Batch Details</span>
                  <span>·</span>
                  <span className="code-chip" style={{ fontSize: "11px" }}>{activeBatch.receiptCode}</span>
                </div>
                <h2 className="modal-title" style={{ marginTop: "4px" }}>
                  {activeBatch.cropType}
                </h2>
              </div>
              <button type="button" className="modal-close" onClick={() => setSelectedBatchId(null)}>
                <X size={20} />
              </button>
            </div>

            {/* Content Scrolling Pane */}
            <div style={{ display: "flex", flexDirection: "column", gap: "20px", paddingBottom: "24px" }}>
              
              {/* Stat card header metrics */}
              <div className="info-card" style={{ display: "flex", flexDirection: "column", gap: "8px", borderLeft: `4px solid var(--color-field)` }}>
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

              {/* People & place section */}
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

              {/* Disputes & Related Issues */}
              <div>
                <h3 className="detail-section-title">Related Issues</h3>
                {activeDisputes.length === 0 ? (
                  <div className="info-card" style={{ color: "var(--gray-500)", fontSize: "14px", fontStyle: "italic" }}>
                    No open issues or disputes for this batch.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {activeDisputes.map(disp => (
                      <div key={disp.id} className="info-card" style={{ borderLeft: "3px solid var(--color-danger)", display: "flex", flexDirection: "column", gap: "6px" }}>
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

              {/* Vertical Audit timeline */}
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

              {/* Sticky action tray inside drawer */}
              <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
                <button 
                  type="button" 
                  className="btn btn-outline" 
                  style={{ flex: 1, height: "46px", fontSize: "14px" }}
                  onClick={() => setShowChangeStatusModal(true)}
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
                  <AlertTriangle size={18} style={{ color: "var(--color-danger)" }} />
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* SUB-MODAL 1: Adjust Quantity Confirmation Dialog */}
      {showAdjustQtyModal && activeBatch && (
        <div className="modal-backdrop" onClick={() => setShowAdjustQtyModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Adjust Available Stock</h3>
              <button type="button" className="modal-close" onClick={() => setShowAdjustQtyModal(false)}>
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleAdjustQtySubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="form-group">
                <label className="form-label" htmlFor="qtyAdjustInput">New Available Quantity ({activeBatch.unit}s)</label>
                <div className="counter-widget">
                  <button type="button" className="counter-btn" onClick={() => setNewQty(q => Math.max(0, q - 1))}>−</button>
                  <input 
                    id="qtyAdjustInput"
                    type="number" 
                    className="counter-value" 
                    value={newQty}
                    onChange={(e) => setNewQty(Math.max(0, parseInt(e.target.value) || 0))}
                  />
                  <button type="button" className="counter-btn" onClick={() => setNewQty(q => q + 1)}>+</button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="adjustCategory">Reason for adjustment</label>
                <select 
                  id="adjustCategory"
                  className="form-select"
                  value={adjustReasonCategory}
                  onChange={(e) => setAdjustReasonCategory(e.target.value)}
                >
                  <option value="Spoilage">Spoilage / Damage</option>
                  <option value="Weighing error">Weighing Error Correction</option>
                  <option value="Farmer withdrawal">Farmer Withdrawal</option>
                  <option value="Other">Other (specify below)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="adjustNotes">Explanation Notes</label>
                <textarea 
                  id="adjustNotes"
                  className="form-textarea" 
                  placeholder="Provide details about why the inventory level is being adjusted..."
                  value={adjustReasonText}
                  onChange={(e) => setAdjustReasonText(e.target.value)}
                  style={{ minHeight: "80px" }}
                />
              </div>

              {/* Destructive adjustment comparison summary */}
              <div className="receipt-callout" style={{ 
                backgroundColor: newQty < activeBatch.quantityAvailable ? "var(--color-danger-bg)" : "var(--color-success-bg)",
                borderColor: newQty < activeBatch.quantityAvailable ? "var(--color-danger-border)" : "var(--color-success-border)",
                color: newQty < activeBatch.quantityAvailable ? "var(--color-danger)" : "var(--color-success)"
              }}>
                <div style={{ display: "flex", gap: "8px", alignItems: "center", fontWeight: "bold" }}>
                  <Info size={16} />
                  <span>
                    Summary: Reduce from {activeBatch.quantityAvailable} → {newQty} {activeBatch.unit}s ({newQty - activeBatch.quantityAvailable} {activeBatch.unit}s)
                  </span>
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => setShowAdjustQtyModal(false)}>
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className={`btn ${newQty < activeBatch.quantityAvailable ? "btn-primary" : "btn-primary"}`}
                  style={{ flex: 1, backgroundColor: newQty < activeBatch.quantityAvailable ? "var(--color-danger)" : "var(--color-field)" }}
                >
                  Confirm Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUB-MODAL 2: Change Status Confirmation Dialog */}
      {showChangeStatusModal && activeBatch && (
        <div className="modal-backdrop" onClick={() => setShowChangeStatusModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Change Batch Status</h3>
              <button type="button" className="modal-close" onClick={() => setShowChangeStatusModal(false)}>
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleChangeStatusSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="form-group">
                <label className="form-label" htmlFor="statusSelect">New status</label>
                <select 
                  id="statusSelect"
                  className="form-select"
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as InventoryBatchStatus)}
                >
                  <option value="received">Received</option>
                  <option value="available">Available (Active in Storage)</option>
                  <option value="partially_reserved">Partially Reserved</option>
                  <option value="reserved">Reserved</option>
                  <option value="sold">Sold</option>
                  <option value="spoiled">Spoiled</option>
                  <option value="expired">Expired</option>
                  <option value="withdrawn">Withdrawn</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label form-label-required" htmlFor="statusNotes">Reason for update</label>
                <textarea 
                  id="statusNotes"
                  className="form-textarea" 
                  placeholder="Describe why status is changing (e.g. buyer payment completed, rot detected...)"
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  onBlur={() => {}}
                  style={{ minHeight: "80px" }}
                  required
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => setShowChangeStatusModal(false)}>
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ flex: 1 }}
                  disabled={!statusReason.trim()}
                >
                  Update Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUB-MODAL 3: Update Condition Note Prompt */}
      {showUpdateConditionModal && activeBatch && (
        <div className="modal-backdrop" onClick={() => setShowUpdateConditionModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Update Condition Notes</h3>
              <button type="button" className="modal-close" onClick={() => setShowUpdateConditionModal(false)}>
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleUpdateConditionSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="form-group">
                <label className="form-label" htmlFor="conditionNotesInput">Condition notes description</label>
                <textarea 
                  id="conditionNotesInput"
                  className="form-textarea" 
                  placeholder="Slightly bruised, wet, moisture content verified..."
                  value={newCondition}
                  onChange={(e) => setNewCondition(e.target.value)}
                  style={{ minHeight: "100px" }}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => setShowUpdateConditionModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Save Condition Notes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUB-MODAL 4: Storage Fee View / Ledger Modal */}
      {showFeesLedgerModal && activeBatch && (
        <div className="modal-backdrop" onClick={() => setShowFeesLedgerModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ minHeight: "60vh" }}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Storage Fees Ledger</h3>
                <span style={{ fontSize: "12px", color: "var(--gray-500)" }}>Receipt: {activeBatch.receiptCode}</span>
              </div>
              <button type="button" className="modal-close" onClick={() => setShowFeesLedgerModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              
              {/* Ledger Summary */}
              <div className="info-card" style={{ display: "flex", flexDirection: "column", gap: "8px", textAlign: "center" }}>
                <span style={{ fontSize: "14px", color: "var(--gray-500)" }}>Accrued Storage Rate</span>
                <span style={{ fontSize: "18px", fontWeight: "700" }}>
                  GHS {activeBatch.storageRateSnapshot?.ratePerUnitPerDay?.toFixed(2)} / {activeBatch.unit} / day
                </span>
                <div style={{ height: "1px", backgroundColor: "var(--color-line)", margin: "8px 0" }} />
                <span style={{ fontSize: "13px", color: "var(--gray-600)" }}>
                  Stored for {Math.ceil((Date.now() - activeBatch.receivedAt) / (1000 * 60 * 60 * 24))} Days
                </span>
                <div style={{ fontSize: "28px", fontWeight: "800", color: "var(--color-ink)", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                  <Coins size={24} style={{ color: "var(--color-success)" }} />
                  <span>GHS {activeBatch.storageFeeAccrued.toFixed(2)}</span>
                </div>
                <span className="badge badge-warning" style={{ alignSelf: "center", fontSize: "11px", marginTop: "4px" }}>
                  Pending Settlement
                </span>
              </div>

              <div style={{ fontSize: "13px", color: "var(--gray-500)", fontStyle: "italic", textAlign: "center" }}>
                "Fees stop when the produce is sold or collected."
              </div>

              {/* Simple ledger log rows */}
              <div>
                <h4 style={{ fontSize: "13px", fontWeight: "700", textTransform: "uppercase", color: "var(--gray-400)", letterSpacing: "0.05em", marginBottom: "8px" }}>
                  Ledger Transactions History
                </h4>
                
                <div style={{ display: "flex", flexDirection: "column", border: "1px solid var(--color-line)", borderRadius: "8px", overflow: "hidden" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", borderBottom: "1px solid var(--color-line)", backgroundColor: "var(--gray-50)", fontSize: "12px", fontWeight: "700", color: "var(--gray-600)" }}>
                    <span>Date</span>
                    <span>Accrual / Event</span>
                    <span>Amount</span>
                  </div>
                  
                  {/* Generate 3 simulated daily accrual records */}
                  {[0, 1, 2].map(daysAgo => {
                    const date = new Date();
                    date.setDate(date.getDate() - daysAgo);
                    return (
                      <div key={daysAgo} style={{ display: "flex", justifyContent: "space-between", padding: "12px", borderBottom: daysAgo !== 2 ? "1px solid var(--color-line)" : 0, backgroundColor: "var(--color-surface-raised)", fontSize: "13px" }}>
                        <span style={{ color: "var(--gray-500)" }}>{date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                        <span>Daily Fee Accrual</span>
                        <span style={{ fontWeight: "700" }}>+ GHS {(activeBatch.quantityAvailable * (activeBatch.storageRateSnapshot?.ratePerUnitPerDay || 0.15)).toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button 
                type="button" 
                className="btn btn-ghost" 
                style={{ color: "var(--color-danger)", marginTop: "8px", height: "44px" }}
                onClick={() => {
                  setShowFeesLedgerModal(false);
                  setSelectedBatchId(null);
                  router.push(`/disputes/new?entityId=${activeBatch.id}&entityType=inventory_batch&disputeType=Fees`);
                }}
              >
                Dispute Accrued Fees
              </button>

            </div>
          </div>
        </div>
      )}

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
