"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { AlertTriangle, ArrowLeft, Check, CheckCircle, Copy, Phone } from "lucide-react";
import { useAuth } from "@/app/auth/AuthProvider";

type Props = {
  params: Promise<{ id: string }>;
};

type ReceiptDetail = {
  _id: string;
  receiptCode: string;
  cropType: string;
  grade?: string;
  quantityReceived: number;
  quantityAvailable: number;
  unit: string;
  status: string;
  receivedAt: number;
  storageRateSnapshot?: { ratePerUnitPerDay?: number; currency?: string; label?: string };
  storageFeeAccrued?: number;
  warehouseId?: string;
};

type LedgerEntry = {
  _id: string;
  feeDate: number;
  amount: number;
  amountDeducted?: number;
  status: string;
};

function statusClass(status: string) {
  if (["verified", "available", "paid", "waived", "deducted_from_sale"].includes(status)) return "success";
  if (["received", "accrued", "partially_deducted_from_sale"].includes(status)) return "warning";
  if (["disputed", "spoiled", "expired"].includes(status)) return "danger";
  return "neutral";
}

export default function ReceiptDetailPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();
  const { principal } = useAuth();
  const [copied, setCopied] = useState(false);
  const [now] = useState(() => Date.now());

  const batch = useQuery(
    api.inventoryBatches.getById,
    principal !== null && principal !== undefined
      ? { actorUserId: principal.userId as Id<"users">, inventoryBatchId: id as Id<"inventoryBatches"> }
      : "skip",
  ) as ReceiptDetail | null | undefined;
  const ledger = useQuery(
    api.storageFees.listByBatch,
    principal !== null && principal !== undefined
      ? { actorUserId: principal.userId as Id<"users">, inventoryBatchId: id as Id<"inventoryBatches">, limit: 20 }
      : "skip",
  ) as LedgerEntry[] | undefined;
  const warehouses = useQuery(api.warehouses.list, {});
  const agents = useQuery(
    api.warehouseAgents.listByWarehouseForFarmer,
    principal !== null && principal !== undefined && batch?.warehouseId !== undefined
      ? { actorUserId: principal.userId as Id<"users">, warehouseId: batch.warehouseId as Id<"warehouses"> }
      : "skip"
  );

  if (batch === undefined || ledger === undefined || agents === undefined) {
    return <div className="skeleton" style={{ minHeight: "420px", borderRadius: "20px" }} />;
  }

  if (batch === null) {
    return (
      <div className="farmer-card">
        <span className="card-title">Receipt not found</span>
        <span className="card-meta">This receipt may have been removed or you may not have access to it.</span>
        <Link href="/farmer/receipts" className="btn btn-primary">Back to receipts</Link>
      </div>
    );
  }

  const warehouseName = warehouses?.find((warehouse) => warehouse._id === batch.warehouseId)?.name ?? "Warehouse";
  const agent = agents && agents.length > 0 ? agents[0] : null;
  const agentName = agent?.fullName || "Warehouse";
  const phone = agent?.phoneNumber || "+233240000000";
  const daysStored = Math.max(0, Math.floor((now - batch.receivedAt) / (24 * 60 * 60 * 1000)));
  const rate = batch.storageRateSnapshot?.ratePerUnitPerDay ?? 0;
  const currency = batch.storageRateSnapshot?.currency ?? "GHS";
  const openLedgerTotal = ledger
    .filter((entry) => !["paid", "waived", "deducted_from_sale"].includes(entry.status))
    .reduce((total, entry) => total + Math.max(0, entry.amount - (entry.amountDeducted ?? 0)), 0);

  const handleCopy = () => {
    void navigator.clipboard.writeText(batch.receiptCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <button type="button" onClick={() => router.back()} style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: "8px", background: "none", border: "none", cursor: "pointer", fontSize: "1rem", fontWeight: 700, color: "var(--color-primary)", padding: "8px 0" }}>
        <ArrowLeft size={18} />
        <span>Back to Receipts</span>
      </button>

      <div className="receipt-slip">
        <div className="slip-header">
          <span className="slip-title">RECEIPT SLIP</span>
          <div>
            <button type="button" className="slip-code" onClick={handleCopy} style={{ cursor: "pointer", border: "none" }}>
              <span>{batch.receiptCode}</span>
              {copied ? <Check size={14} style={{ color: "var(--color-success)" }} /> : <Copy size={14} />}
            </button>
          </div>
          <div style={{ marginTop: "12px" }}>
            <span className={`status-chip status-${statusClass(batch.status)}`}>
              <CheckCircle size={12} />
              <span>{batch.status.replaceAll("_", " ")}</span>
            </span>
          </div>
        </div>

        <div className="slip-body">
          <div className="slip-row"><span className="slip-label">Crop Type</span><span className="slip-value">{batch.cropType}</span></div>
          <div className="slip-row"><span className="slip-label">Quantity Received</span><span className="slip-value">{batch.quantityReceived} {batch.unit}</span></div>
          <div className="slip-row"><span className="slip-label">Quantity Available</span><span className="slip-value">{batch.quantityAvailable} {batch.unit}</span></div>
          <div className="slip-row"><span className="slip-label">Quality Grade</span><span className="slip-value">Grade {batch.grade ?? "ungraded"}</span></div>
          <div className="slip-row"><span className="slip-label">Warehouse Facility</span><span className="slip-value">{warehouseName}</span></div>
          <div className="slip-row"><span className="slip-label">Date Received</span><span className="slip-value">{new Date(batch.receivedAt).toLocaleString()}</span></div>

          <div className="slip-divider" />
          <span className="slip-section-title">Storage Fee Calculation</span>
          <div className="slip-math-box">
            <div style={{ display: "flex", justifyContent: "space-between" }}><span className="slip-label">Daily Rate</span><strong>{currency} {rate.toFixed(2)} / {batch.unit} / day</strong></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span className="slip-label">Time Elapsed</span><strong>{daysStored} {daysStored === 1 ? "day" : "days"} stored</strong></div>
            <div className="slip-divider" />
            <div className="slip-math-result">
              <span style={{ fontWeight: 700, color: "var(--color-ink)" }}>Receipt Accrued</span>
              <span className="slip-math-total">{currency} {(batch.storageFeeAccrued ?? 0).toFixed(2)}</span>
            </div>
            <div className="slip-math-result">
              <span style={{ fontWeight: 700, color: "var(--color-ink)" }}>Open Ledger</span>
              <span className="slip-math-total">{currency} {openLedgerTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {ledger.length > 0 && (
        <div className="farmer-card">
          <span className="card-title">Fee Ledger</span>
          <div className="compact-list">
            {ledger.map((entry) => (
              <div key={entry._id} className="compact-row">
                <div className="row-info">
                  <span className="row-title">{new Date(entry.feeDate).toLocaleDateString()}</span>
                  <span className="row-subtitle">Deducted {currency} {(entry.amountDeducted ?? 0).toFixed(2)}</span>
                </div>
                <span className={`status-chip status-${statusClass(entry.status)}`}>{entry.status.replaceAll("_", " ")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "10px" }}>
        <a href={`tel:${phone}`} className="btn btn-primary btn-full"><Phone size={18} /><span>Call {agentName}</span></a>
        <Link href={`/farmer/issue?receiptId=${id}`} style={{ width: "100%" }}>
          <button type="button" className="btn btn-secondary btn-full"><AlertTriangle size={18} /><span>Dispute this receipt / report issue</span></button>
        </Link>
      </div>
    </div>
  );
}
