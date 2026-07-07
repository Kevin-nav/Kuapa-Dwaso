"use client";

/* eslint-disable react/no-unescaped-entities */

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../../convex/_generated/dataModel";
import { useWarehouse } from "../../context/WarehouseContext";
import { 
  CheckCircle, 
  Copy, 
  Share2, 
  Plus, 
  AlertTriangle,
  MoreVertical,
  ArrowLeft,
  Printer
} from "lucide-react";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default function ReceiptPage({ params }: PageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const batchId = resolvedParams.id;

  const { inventory, farmers, activeWarehouse, isOffline, actorUserId, errorMessage } = useWarehouse();
  
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const batchById = useQuery(
    api.inventoryBatches.getById,
    actorUserId && !batchId.startsWith("WH-")
      ? {
          actorUserId: actorUserId as Id<"users">,
          inventoryBatchId: batchId as Id<"inventoryBatches">,
        }
      : "skip",
  ) as Doc<"inventoryBatches"> | null | undefined;
  const batchByReceiptCode = useQuery(
    api.inventoryBatches.getByReceiptCode,
    actorUserId && batchId.startsWith("WH-")
      ? {
          actorUserId: actorUserId as Id<"users">,
          receiptCode: batchId,
        }
      : "skip",
  ) as Doc<"inventoryBatches"> | null | undefined;

  // Find matching batch from live query, falling back to the warehouse list while Convex refreshes.
  const queriedBatch = batchId.startsWith("WH-") ? batchByReceiptCode : batchById;
  const localBatch = inventory.find(b => b.id === batchId || b.receiptCode === batchId);
  const batch = queriedBatch === undefined
    ? localBatch
    : queriedBatch === null
      ? undefined
      : {
          ...queriedBatch,
          id: queriedBatch._id,
          farmerId: queriedBatch.farmerId,
          warehouseId: queriedBatch.warehouseId,
          receivedByWarehouseAgentId: queriedBatch.receivedByWarehouseAgentId,
        };
  const farmer = batch ? farmers.find(f => f.id === batch.farmerId) : null;

  if (queriedBatch === undefined && !localBatch) {
    return (
      <div className="section-card" style={{ textAlign: "center", padding: "48px 20px", color: "var(--gray-500)" }}>
        Loading receipt...
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="section-card" style={{ textAlign: "center", padding: "48px 20px" }}>
        <AlertTriangle size={48} style={{ color: "var(--color-danger)", marginBottom: "16px" }} />
        <h2 style={{ fontSize: "20px", fontWeight: "700" }}>Receipt Not Found</h2>
        <p style={{ color: "var(--gray-500)", marginTop: "8px" }}>
          {errorMessage || "The requested receipt code or batch ID could not be loaded."}
        </p>
        <button 
          type="button" 
          className="btn btn-primary" 
          style={{ marginTop: "20px" }}
          onClick={() => router.push("/")}
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  // Formatting values
  const formattedDate = new Date(batch.receivedAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  const formattedSellBy = batch.sellByDate 
    ? new Date(batch.sellByDate).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric"
      })
    : "Not specified";

  const handleCopy = () => {
    if (typeof navigator !== "undefined") {
      void navigator.clipboard.writeText(batch.receiptCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = () => {
    setShared(true);
    setTimeout(() => setShared(false), 3000);
  };

  const formatBadgeClass = (status: string) => {
    switch (status) {
      case "received":
        return "badge-info";
      case "available":
        return "badge-success";
      case "partially_reserved":
      case "reserved":
        return "badge-warning";
      case "spoiled":
      case "expired":
        return "badge-danger";
      default:
        return "badge-neutral";
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      
      {/* Top action header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button 
          type="button" 
          className="modal-close"
          style={{ width: "40px", height: "40px", backgroundColor: "var(--color-surface-raised)" }}
          onClick={() => router.push("/")}
        >
          <ArrowLeft size={20} />
        </button>
        
        <h1 style={{ fontSize: "18px", fontWeight: "700" }}>Receipt Confirmation</h1>

        <div style={{ position: "relative" }}>
          <button 
            type="button" 
            className="modal-close"
            style={{ width: "40px", height: "40px", backgroundColor: "var(--color-surface-raised)" }}
            onClick={() => setShowMenu(!showMenu)}
          >
            <MoreVertical size={20} />
          </button>
          
          {showMenu && (
            <div style={{ 
              position: "absolute", 
              right: 0, 
              top: "44px", 
              backgroundColor: "var(--color-surface-raised)", 
              border: "1px solid var(--color-line)",
              borderRadius: "8px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              zIndex: 200,
              width: "180px",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden"
            }}>
              <button 
                type="button"
                style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px", border: 0, background: "transparent", width: "100%", textAlign: "left", cursor: "pointer", fontSize: "14px" }}
                onClick={() => alert("Printing is coming soon in v1.1")}
              >
                <Printer size={16} />
                <span>Print Receipt</span>
              </button>
              <button 
                type="button"
                style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px", border: 0, background: "transparent", width: "100%", textAlign: "left", cursor: "pointer", fontSize: "14px", borderTop: "1px solid var(--gray-100)" }}
                onClick={() => router.push(`/disputes/new?entityId=${batch.id}&entityType=inventory_batch`)}
              >
                <AlertTriangle size={16} />
                <span>Report Issue</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Ticket Wrapper */}
      <div className="receipt-ticket">
        <div className="receipt-ticket-dashed" />
        
        {/* Success header banner */}
        <div className="receipt-header">
          <div style={{ color: "var(--color-success)", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
            <CheckCircle size={44} style={{ fill: "var(--color-success-bg)" }} />
            <h2 style={{ fontSize: "20px", fontWeight: "800" }}>
              {isOffline ? "Saved (Pending Sync)" : "Receipt Created Successfully"}
            </h2>
          </div>
          
          {/* Large Monospace code chip */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "12px" }}>
            <span className="code-chip" style={{ fontSize: "28px", padding: "6px 16px" }}>
              {batch.receiptCode}
            </span>
            <button 
              type="button"
              className="modal-close"
              style={{ width: "44px", height: "44px", backgroundColor: "var(--gray-50)", border: "1px solid var(--color-line)" }}
              onClick={handleCopy}
              title="Copy receipt code"
            >
              <Copy size={18} style={{ color: copied ? "var(--color-success)" : "inherit" }} />
            </button>
          </div>
          {copied && <span style={{ fontSize: "12px", color: "var(--color-success)", fontWeight: "600" }}>Copied to clipboard!</span>}
        </div>

        {/* Receipt details */}
        <div className="receipt-body">
          <div className="receipt-fact-grid">
            <div className="fact-item">
              <span className="fact-label">Farmer Name</span>
              <span className="fact-value">{farmer?.fullName || "Unregistered Farmer"}</span>
            </div>
            
            <div className="fact-item">
              <span className="fact-label">Farmer Code</span>
              <span className="fact-value">{farmer?.farmerCode || "N/A"}</span>
            </div>

            <div className="fact-item">
              <span className="fact-label">Crop Type</span>
              <span className="fact-value" style={{ fontSize: "18px", fontWeight: "800", color: "var(--color-field-dark)" }}>
                {batch.cropType}
              </span>
            </div>

            <div className="fact-item">
              <span className="fact-label">Variety Details</span>
              <span className="fact-value">{batch.variety || "Standard"}</span>
            </div>

            <div className="fact-item">
              <span className="fact-label">Grade Received</span>
              <div>
                <span className={`badge ${formatBadgeClass(batch.status)}`}>
                  Grade {batch.grade}
                </span>
              </div>
            </div>

            <div className="fact-item">
              <span className="fact-label">Total Quantity</span>
              <span className="fact-value-large" style={{ fontSize: "24px" }}>
                {batch.quantityReceived} <span style={{ fontSize: "14px", fontWeight: "600" }}>{batch.unit}s</span>
              </span>
            </div>

            <div className="fact-item">
              <span className="fact-label">Accrual Rate</span>
              <span className="fact-value">
                GHS {batch.storageRateSnapshot?.ratePerUnitPerDay?.toFixed(2) || "0.00"}/{batch.unit}/day
              </span>
            </div>

            <div className="fact-item">
              <span className="fact-label">Received At</span>
              <span className="fact-value">{formattedDate}</span>
            </div>

            <div className="fact-item">
              <span className="fact-label">Sell-By Date</span>
              <span className="fact-value">{formattedSellBy}</span>
            </div>

            <div className="fact-item">
              <span className="fact-label">Active Warehouse</span>
              <span className="fact-value">{activeWarehouse.name}</span>
            </div>
          </div>

          {/* Condition Notes */}
          {batch.conditionNotes && (
            <div style={{ marginTop: "16px", borderTop: "1px solid var(--color-line)", paddingTop: "12px" }}>
              <div className="fact-label" style={{ marginBottom: "2px" }}>Condition Notes</div>
              <div style={{ fontSize: "14px", fontStyle: "italic", color: "var(--gray-700)" }}>
                "{batch.conditionNotes}"
              </div>
            </div>
          )}

          {/* Share notification banner */}
          {shared && (
            <div className="offline-banner" style={{ margin: "16px 0 0", backgroundColor: "var(--color-success-bg)", color: "var(--color-success)", borderColor: "var(--color-success-border)" }}>
              <CheckCircle size={16} />
              <span>SMS confirmation containing receipt code {batch.receiptCode} dispatched to {farmer?.phoneNumber}!</span>
            </div>
          )}
        </div>
      </div>

      {/* Sticky Bottom Actions */}
      <div className="sticky-actions-bar">
        <button 
          type="button" 
          className="btn btn-primary"
          onClick={handleShare}
        >
          <Share2 size={18} />
          <span>Share Receipt Code</span>
        </button>

        <button 
          type="button" 
          className="btn btn-outline"
          onClick={() => {
            router.push("/intake");
          }}
        >
          <Plus size={18} />
          <span>Start Another Intake</span>
        </button>
      </div>

    </div>
  );
}
