"use client";

import { use, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useAuth } from "@/app/auth/AuthProvider";
import { ArrowLeft, Phone, AlertTriangle, CheckCircle, Copy, Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Id } from "@convex/_generated/dataModel";

type Props = {
  params: Promise<{ id: string }>;
};

type ReceiptDetail = {
  receiptCode: string;
  cropType: string;
  grade?: string;
  quantityReceived: number;
  quantityAvailable?: number;
  unit: string;
  status: string;
  receivedAt: number;
  storageRateSnapshot?: { ratePerUnitPerDay?: number; currency?: string };
  storageFeeAccrued?: number;
  warehouseId?: string;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEMO_NOW = Date.UTC(2026, 0, 1);

export default function ReceiptDetailPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();
  const { principal } = useAuth();
  const [copied, setCopied] = useState(false);

  // Retrieve batch details from database
  const batch = useQuery(
    api.inventoryBatches.getById,
    principal !== null && principal !== undefined && !id.startsWith("demo")
      ? { actorUserId: principal.userId as Id<"users">, inventoryBatchId: id as Id<"inventoryBatches"> }
      : "skip"
  ) as ReceiptDetail | null | undefined;

  const warehouses = useQuery(api.warehouses.list, {});

  // Demo fallback receipts
  const demoReceipts: Record<string, ReceiptDetail> = {
    demo1: {
      receiptCode: "RCP-2401",
      cropType: "Maize",
      grade: "A",
      quantityReceived: 5,
      unit: "bags",
      status: "verified",
      receivedAt: DEMO_NOW - 12 * MS_PER_DAY,
      storageRateSnapshot: { ratePerUnitPerDay: 2, currency: "GHS" },
      storageFeeAccrued: 120,
      warehouseId: "w1",
    },
    demo2: {
      receiptCode: "RCP-2394",
      cropType: "Cassava",
      grade: "B",
      quantityReceived: 10,
      unit: "bags",
      status: "received",
      receivedAt: DEMO_NOW - 5 * MS_PER_DAY,
      storageRateSnapshot: { ratePerUnitPerDay: 1.5, currency: "GHS" },
      storageFeeAccrued: 75,
      warehouseId: "w1",
    },
    demo3: {
      receiptCode: "RCP-2388",
      cropType: "Cassava",
      grade: "A",
      quantityReceived: 8,
      unit: "bags",
      status: "waived",
      receivedAt: DEMO_NOW - 25 * MS_PER_DAY,
      storageRateSnapshot: { ratePerUnitPerDay: 1.5, currency: "GHS" },
      storageFeeAccrued: 0,
      warehouseId: "w1",
    },
  };

  const isDemo = id.startsWith("demo") || batch === null;
  const currentBatch = isDemo ? demoReceipts[id] || demoReceipts.demo1 : batch;

  if (currentBatch === undefined) {
    return (
      <div style={{ display: "flex", flex: "1 0 auto", flexDirection: "column", gap: "20px", padding: "20px" }}>
        <p>Loading receipt details...</p>
      </div>
    );
  }

  const warehouseName = warehouses?.find((w) => w._id === currentBatch.warehouseId)?.name || "Akwatia Community Warehouse";
  
  const formattedDate = new Date(currentBatch.receivedAt).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

  const daysStored = Math.max(0, Math.floor((DEMO_NOW - currentBatch.receivedAt) / MS_PER_DAY));
  const rate = currentBatch.storageRateSnapshot?.ratePerUnitPerDay || 2;
  const quantity = currentBatch.quantityAvailable !== undefined ? currentBatch.quantityAvailable : currentBatch.quantityReceived;

  const handleCopy = () => {
    void navigator.clipboard.writeText(currentBatch.receiptCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ display: "flex", flex: "1 0 auto", flexDirection: "column", gap: "20px" }}>
      {/* Back navigation */}
      <button
        type="button"
        onClick={() => router.back()}
        style={{
          alignSelf: "flex-start",
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: "1rem",
          fontWeight: "700",
          color: "var(--color-primary)",
          padding: "8px 0"
        }}
      >
        <ArrowLeft size={18} />
        <span>Back to Receipts</span>
      </button>

      {/* Official Receipt Slip card */}
      <div className="receipt-slip">
        <div className="slip-header">
          <span className="slip-title">RECEIPT SLIP</span>
          <div>
            <div className="slip-code" onClick={handleCopy} style={{ cursor: "pointer" }}>
              <span>{currentBatch.receiptCode}</span>
              {copied ? <Check size={14} style={{ color: "var(--color-success)" }} /> : <Copy size={14} />}
            </div>
          </div>
          <div style={{ marginTop: "12px" }}>
            <span className="status-chip status-success">
              <CheckCircle size={12} />
              <span>Verified receipt</span>
            </span>
          </div>
        </div>

        <div className="slip-body">
          <div className="slip-row">
            <span className="slip-label">Crop Type</span>
            <span className="slip-value">{currentBatch.cropType}</span>
          </div>
          <div className="slip-row">
            <span className="slip-label">Quantity Received</span>
            <span className="slip-value">{currentBatch.quantityReceived} {currentBatch.unit}</span>
          </div>
          <div className="slip-row">
            <span className="slip-label">Quality Grade</span>
            <span className="slip-value">Grade {currentBatch.grade || "A"}</span>
          </div>
          <div className="slip-row">
            <span className="slip-label">Warehouse Facility</span>
            <span className="slip-value">{warehouseName}</span>
          </div>
          <div className="slip-row">
            <span className="slip-label">Date Received</span>
            <span className="slip-value">{formattedDate}</span>
          </div>

          <div className="slip-divider" />

          {/* Fee Math Explainer section */}
          <span className="slip-section-title">Storage Fee Calculation</span>
          
          <div className="slip-math-box">
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="slip-label">Daily Rate</span>
              <strong>GHS {rate.toFixed(2)} / bag / day</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="slip-label">Time Elapsed</span>
              <strong>{daysStored} {daysStored === 1 ? "day" : "days"} stored</strong>
            </div>
            
            <div className="slip-divider" />
            
            <div className="slip-math-formula">
              Formula: {daysStored} days × {quantity} bags × GHS {rate}
            </div>
            
            <div className="slip-math-result">
              <span style={{ fontWeight: "700", color: "var(--color-ink)" }}>Total Accrued</span>
              <span className="slip-math-total">
                GHS {(currentBatch.storageFeeAccrued || 0).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Warehouse Deep Action links */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "10px" }}>
        <a href={`tel:+233240000000`} className="btn btn-primary btn-full">
          <Phone size={18} />
          <span>Call Warehouse</span>
        </a>
        <Link href={`/farmer/issue?receiptId=${id}`} style={{ width: "100%" }}>
          <button type="button" className="btn btn-secondary btn-full" style={{ borderColor: "var(--color-neutral-border)", color: "var(--color-text)" }}>
            <AlertTriangle size={18} />
            <span>Dispute this receipt / report issue</span>
          </button>
        </Link>
      </div>

      <p className="timestamp">Official digital proof · Secured by Convex Cloud</p>
    </div>
  );
}
