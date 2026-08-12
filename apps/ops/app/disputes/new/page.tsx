"use client";

/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */

import type React from "react";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useWarehouse } from "../../context/WarehouseContext";
import { EvidencePanel } from "../../EvidencePanel";
import { 
  AlertTriangle, 
  User, 
  FileText, 
  Warehouse, 
  Coins, 
  ShoppingBag, 
  CheckCircle, 
  ArrowLeft,
  X
} from "lucide-react";

function NewDisputeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { createDispute, inventory, farmers, actorUserId } = useWarehouse();

  // Query parameter pre-fills
  const queryEntityId = searchParams.get("entityId") || "";
  const queryEntityType = searchParams.get("entityType") || "";
  const queryDisputeType = searchParams.get("disputeType") || "";

  // Form states
  const [disputeType, setDisputeType] = useState("Inventory"); // Farmer, Receipt, Inventory, Fees, Order, Warehouse
  const [entityId, setEntityId] = useState("");
  const [entityType, setEntityType] = useState("");
  const [summary, setSummary] = useState("");
  const [notes, setNotes] = useState("");

  // Search entity (for picker if not locked)
  const [entitySearch, setEntitySearch] = useState("");
  const [selectedEntityName, setSelectedEntityName] = useState("");
  const [isEntityLocked, setIsEntityLocked] = useState(false);

  // Submission State
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedTicketCode, setSubmittedTicketCode] = useState("");
  const [submittedDisputeId, setSubmittedDisputeId] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Lock parameters if passed via query
  useEffect(() => {
    if (queryEntityId && queryEntityType) {
      setEntityId(queryEntityId);
      setEntityType(queryEntityType);
      setIsEntityLocked(true);

      // Resolve human-readable name for locked entity
      if (queryEntityType === "inventory_batch") {
        const batch = inventory.find(b => b.id === queryEntityId);
        if (batch) {
          setSelectedEntityName(`Batch ${batch.receiptCode} (${batch.cropType})`);
          setDisputeType(queryDisputeType || "Inventory");
        }
      } else if (queryEntityType === "farmer") {
        const farmer = farmers.find(f => f.id === queryEntityId);
        if (farmer) {
          setSelectedEntityName(`Farmer ${farmer.fullName} (${farmer.farmerCode})`);
          setDisputeType(queryDisputeType || "Farmer");
        }
      }
    }
  }, [queryEntityId, queryEntityType, queryDisputeType, inventory, farmers]);

  const handleSelectEntity = (id: string, type: "inventory_batch" | "farmer", name: string) => {
    setEntityId(id);
    setEntityType(type);
    setSelectedEntityName(name);
    setIsEntityLocked(true);
    setEntitySearch("");
  };

  const handleClearEntity = () => {
    setEntityId("");
    setEntityType("");
    setSelectedEntityName("");
    setIsEntityLocked(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary.trim() || isSubmitting) return;

    // Save dispute
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const ticketCode = `TKT-KUM-${randomSuffix}`;

    setIsSubmitting(true);
    setSubmitError("");
    void createDispute({
      title: summary,
      summary: notes || summary,
      entityType: (entityType as any) || "inventory_batch",
      entityId: entityId || "unknown"
    })
      .then((dispute) => {
        setSubmittedDisputeId(dispute.id);
        setSubmittedTicketCode(ticketCode);
        setIsSubmitted(true);
      })
      .catch((error: unknown) => {
        setSubmitError(error instanceof Error ? error.message : "Could not submit issue ticket.");
      })
      .finally(() => setIsSubmitting(false));
  };

  // Inline filter for entity list selection
  const filteredEntities = () => {
    if (!entitySearch) return [];

    const matchedBatches = inventory
      .filter(b => b.receiptCode.toLowerCase().includes(entitySearch.toLowerCase()))
      .slice(0, 3)
      .map(b => ({
        id: b.id,
        type: "inventory_batch" as const,
        name: `Batch ${b.receiptCode} (${b.cropType})`,
        meta: `Farmer: ${farmers.find(f => f.id === b.farmerId)?.fullName || "Unknown"}`
      }));

    const matchedFarmers = farmers
      .filter(f => f.fullName.toLowerCase().includes(entitySearch.toLowerCase()) || f.farmerCode.toLowerCase().includes(entitySearch.toLowerCase()))
      .slice(0, 3)
      .map(f => ({
        id: f.id,
        type: "farmer" as const,
        name: `Farmer ${f.fullName} (${f.farmerCode})`,
        meta: f.phoneNumber
      }));

    return [...matchedBatches, ...matchedFarmers];
  };

  // Emojis and icons grid representation
  const disputeTypes = [
    { name: "Farmer", icon: <User size={20} /> },
    { name: "Receipt", icon: <FileText size={20} /> },
    { name: "Inventory", icon: <AlertTriangle size={20} /> },
    { name: "Fees", icon: <Coins size={20} /> },
    { name: "Order", icon: <ShoppingBag size={20} /> },
    { name: "Warehouse", icon: <Warehouse size={20} /> }
  ];

  if (isSubmitted) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div />
          <h1 style={{ fontSize: "18px", fontWeight: "700" }}>Issue Ticket</h1>
          <div />
        </div>

        {/* Ticket receipt confirmation card */}
        <div className="receipt-ticket">
          <div className="receipt-ticket-dashed" />
          <div className="receipt-header" style={{ padding: "32px 20px" }}>
            <div style={{ color: "var(--color-danger)", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
              <CheckCircle size={48} style={{ fill: "var(--color-danger-bg)" }} />
              <h2 style={{ fontSize: "20px", fontWeight: "800", color: "var(--color-ink)" }}>Issue Escalated</h2>
            </div>
            
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "12px" }}>
              <span className="code-chip" style={{ fontSize: "clamp(18px, 5vw, 28px)", padding: "6px 16px" }}>
                {submittedTicketCode}
              </span>
            </div>
          </div>

          <div className="receipt-body" style={{ textAlign: "center", paddingBottom: "32px" }}>
            <p style={{ color: "var(--gray-700)", fontSize: "15px", lineHeight: "1.6", maxWidth: "340px", margin: "0 auto" }}>
              An administrator has been notified. You can review and track updates for this ticket under the **Issues** workspace log.
            </p>
            
            {entityId && (
              <div style={{ marginTop: "16px", backgroundColor: "var(--gray-50)", padding: "10px", borderRadius: "6px", fontSize: "13px", display: "inline-block" }}>
                Linked Entity: <strong>{selectedEntityName}</strong>
              </div>
            )}

            {submittedDisputeId && (
              <div style={{ marginTop: "16px", textAlign: "left" }}>
                <EvidencePanel
                  actorUserId={actorUserId}
                  relatedEntityType="dispute"
                  relatedEntityId={submittedDisputeId}
                  purpose="dispute_evidence"
                  title="Dispute Evidence"
                />
              </div>
            )}
          </div>
        </div>

        <button 
          type="button" 
          className="btn btn-primary"
          onClick={() => router.push("/")}
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <button 
          type="button" 
          className="modal-close"
          style={{ width: "40px", height: "40px", backgroundColor: "var(--color-surface-raised)" }}
          onClick={() => router.back()}
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: "800" }}>Escalate Operation Issue</h1>
          <p style={{ fontSize: "13px", color: "var(--gray-500)" }}>Admin Review Dispatch</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        
        {/* Issue Type grid */}
        <div className="section-card" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <h2 className="detail-section-title">1. Select Issue Category</h2>
          
          <div className="tile-grid dispute-tile-grid">
            {disputeTypes.map(t => (
              <div 
                key={t.name}
                className={`tile ${disputeType === t.name ? "active" : ""}`}
                style={{ minHeight: "80px", padding: "12px" }}
                onClick={() => setDisputeType(t.name)}
              >
                <span className="tile-icon" style={{ fontSize: "20px" }}>{t.icon}</span>
                <span className="tile-label" style={{ fontSize: "13px" }}>{t.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Related Entity chip or search */}
        <div className="section-card" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <h2 className="detail-section-title">2. Link Entity / Batch (Optional)</h2>

          {isEntityLocked ? (
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "space-between", 
              backgroundColor: "var(--gray-50)", 
              padding: "10px 14px", 
              borderRadius: "8px",
              border: "1px solid var(--color-line)"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="badge badge-neutral" style={{ fontSize: "11px" }}>{entityType.replace(/_/g, " ")}</span>
                <span style={{ fontWeight: "700", fontSize: "14px" }}>{selectedEntityName}</span>
              </div>
              <button 
                type="button" 
                className="modal-close"
                style={{ width: "24px", height: "24px", backgroundColor: "var(--gray-200)" }}
                onClick={handleClearEntity}
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Search receipt code or farmer name to link..." 
                value={entitySearch}
                onChange={(e) => setEntitySearch(e.target.value)}
              />
              
              {entitySearch && filteredEntities().length > 0 && (
                <div style={{ border: "1px solid var(--color-line)", borderRadius: "8px", overflow: "hidden", backgroundColor: "var(--color-surface-raised)" }}>
                  {filteredEntities().map(ent => (
                    <div 
                      key={ent.id}
                      style={{ padding: "12px", borderBottom: "1px solid var(--gray-100)", cursor: "pointer" }}
                      onClick={() => handleSelectEntity(ent.id, ent.type, ent.name)}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
                        <strong style={{ color: "var(--color-ink)" }}>{ent.name}</strong>
                        <span className="badge badge-neutral" style={{ fontSize: "10px" }}>{ent.type.replace(/_/g, " ")}</span>
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--gray-500)", marginTop: "2px" }}>{ent.meta}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Inputs */}
        <div className="section-card" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <h2 className="detail-section-title">3. Escalation Notes</h2>

          <div className="form-group">
            <label className="form-label form-label-required" htmlFor="summaryInput">Issue Summary Title</label>
            <input 
              id="summaryInput"
              type="text" 
              className="form-input"
              placeholder="Brief summary of the issue..."
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="descriptionNotes">Detailed explanation notes</label>
            <textarea 
              id="descriptionNotes"
              className="form-textarea"
              placeholder="Describe what occurred, any farmer dispute arguments, or physical damage detected..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ minHeight: "120px" }}
            />
          </div>
        </div>

        <button 
          type="submit" 
          className="btn btn-primary"
          style={{ backgroundColor: "var(--color-danger)" }}
          disabled={!summary.trim() || isSubmitting}
        >
          {isSubmitting ? "Submitting..." : "Submit Issue Ticket"}
        </button>

        {submitError && (
          <div className="offline-banner" style={{ margin: 0, backgroundColor: "var(--color-danger-bg)", color: "var(--color-danger)", borderColor: "var(--color-danger-border)" }}>
            <AlertTriangle size={16} />
            <span>{submitError}</span>
          </div>
        )}

      </form>
    </div>
  );
}

export default function NewDisputePage() {
  return (
    <Suspense fallback={<div style={{ padding: "20px", color: "var(--gray-500)", textAlign: "center" }}>Loading issue escalation...</div>}>
      <NewDisputeContent />
    </Suspense>
  );
}
