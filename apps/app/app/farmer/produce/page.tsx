"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Sprout } from "lucide-react";
import { useAuth } from "@/app/auth/AuthProvider";

type FilterType = "all" | "stored" | "sold" | "fees_due" | "payouts";

type StoredProduce = {
  _id: string;
  receiptCode: string;
  cropType: string;
  grade?: string;
  quantityAvailable: number;
  quantityReceived: number;
  unit: string;
  status: string;
  storageFeeAccrued?: number;
  receivedAt: number;
  warehouseId?: string;
};

type SaleSummary = {
  _id: string;
  cropType?: string;
  quantitySold: number;
  unit: string;
  grossAmount: number;
  storageFeeDeducted: number;
  handlingFeeDeducted?: number;
  commissionDeducted?: number;
  transportFeeDeducted?: number;
  netAmountDueToFarmer: number;
  paymentStatus: string;
  createdAt: number;
  deductions?: { _id: string; label: string; amount: number }[];
};

type PayoutSummary = {
  _id: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: number;
  sale?: SaleSummary | null;
};

function statusClass(status: string) {
  if (["verified", "available", "paid"].includes(status)) return "success";
  if (["received", "pending", "part_paid", "approved", "processing"].includes(status)) return "warning";
  if (["disputed", "withheld", "failed", "manual_review"].includes(status)) return "danger";
  return "neutral";
}

export default function ProducePage() {
  const { principal } = useAuth();
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [now] = useState(() => Date.now());

  const farmerProfile = principal?.profiles?.find((profile) => profile.profileType === "farmer");
  const farmerId = farmerProfile?.profileId as Id<"farmers"> | undefined;
  const receipts = useQuery(
    api.inventoryBatches.listFarmerReceipts,
    principal !== null && principal !== undefined && farmerId !== undefined
      ? { actorUserId: principal.userId as Id<"users">, farmerId }
      : "skip",
  ) as StoredProduce[] | undefined;
  const sales = useQuery(
    api.sales.listForFarmer,
    principal !== null && principal !== undefined && farmerId !== undefined
      ? { actorUserId: principal.userId as Id<"users">, farmerId, limit: 50 }
      : "skip",
  ) as SaleSummary[] | undefined;
  const payouts = useQuery(
    api.payments.listPayoutLedgerForFarmer,
    principal !== null && principal !== undefined && farmerId !== undefined
      ? { actorUserId: principal.userId as Id<"users">, farmerId, limit: 50 }
      : "skip",
  ) as PayoutSummary[] | undefined;
  const warehouses = useQuery(api.warehouses.list, {});

  if (receipts === undefined || sales === undefined || payouts === undefined) {
    return <div className="skeleton" style={{ minHeight: "420px", borderRadius: "20px" }} />;
  }

  const filters: { value: FilterType; label: string }[] = [
    { value: "all", label: "All" },
    { value: "stored", label: "Stored" },
    { value: "sold", label: "Sales" },
    { value: "fees_due", label: "Fees Due" },
    { value: "payouts", label: "Payouts" },
  ];
  const feeReceipts = receipts.filter((receipt) => (receipt.storageFeeAccrued ?? 0) > 0);

  const getWarehouseName = (id?: string) => warehouses?.find((warehouse) => warehouse._id === id)?.name ?? "Warehouse";
  const getDaysStored = (receivedAt: number) => Math.max(0, Math.floor((now - receivedAt) / (24 * 60 * 60 * 1000)));

  const renderStoredCard = (batch: StoredProduce) => (
    <div key={batch._id} className="farmer-card">
      <div className="card-header">
        <span className="card-title"><Sprout size={18} />{batch.cropType}</span>
        <span className={`status-chip status-${statusClass(batch.status)}`}>{batch.status.replaceAll("_", " ")}</span>
      </div>
      <div className="card-meta">
        <strong>{batch.quantityAvailable} {batch.unit}</strong> available from {batch.quantityReceived} received. Grade {batch.grade ?? "ungraded"}.
        <div style={{ color: "var(--color-text-muted)", fontSize: "0.875rem", marginTop: "2px" }}>{getWarehouseName(batch.warehouseId)}</div>
      </div>
      <div className="card-details">
        <span>{getDaysStored(batch.receivedAt)} days stored</span>
        <span className="card-math">Fee: GHS {(batch.storageFeeAccrued ?? 0).toFixed(2)}</span>
      </div>
    </div>
  );

  const renderSaleCard = (sale: SaleSummary) => (
    <div key={sale._id} className="farmer-card" style={{ borderLeft: "4px solid var(--color-success)" }}>
      <div className="card-header">
        <span className="card-title">{sale.cropType ?? "Produce"} Sold</span>
        <span className={`status-chip status-${statusClass(sale.paymentStatus)}`}>{sale.paymentStatus.replaceAll("_", " ")}</span>
      </div>
      <div className="card-meta"><strong>{sale.quantitySold} {sale.unit}</strong> sold on {new Date(sale.createdAt).toLocaleDateString()}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: "4px", padding: "8px 0", borderTop: "1px dashed var(--color-line)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem" }}><span>Gross value</span><strong>GHS {sale.grossAmount.toFixed(2)}</strong></div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", color: "var(--color-danger)" }}><span>Storage fee</span><span>-GHS {sale.storageFeeDeducted.toFixed(2)}</span></div>
        {(sale.deductions ?? []).map((deduction) => (
          <div key={deduction._id} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", color: "var(--color-danger)" }}>
            <span>{deduction.label}</span><span>-GHS {deduction.amount.toFixed(2)}</span>
          </div>
        ))}
      </div>
      <div className="card-details" style={{ borderTop: "1.5px solid var(--color-line)" }}>
        <strong>Net amount</strong>
        <span style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--color-success)" }}>GHS {sale.netAmountDueToFarmer.toFixed(2)}</span>
      </div>
    </div>
  );

  const renderPayoutCard = (payout: PayoutSummary) => (
    <div key={payout._id} className="farmer-card">
      <div className="card-header">
        <span className="card-title">Payout</span>
        <span className={`status-chip status-${statusClass(payout.status)}`}>{payout.status.replaceAll("_", " ")}</span>
      </div>
      <div className="card-details">
        <span>{new Date(payout.createdAt).toLocaleDateString()}</span>
        <span className="card-math">{payout.currency} {payout.amount.toFixed(2)}</span>
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div>
        <p className="eyebrow">My inventory</p>
        <h1>Produce & Earnings</h1>
      </div>

      <div className="filter-container">
        {filters.map((filter) => (
          <button key={filter.value} type="button" className={`filter-chip ${activeFilter === filter.value ? "filter-chip-active" : ""}`} onClick={() => setActiveFilter(filter.value)}>
            {filter.label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {(activeFilter === "all" || activeFilter === "stored") && receipts.map(renderStoredCard)}
        {(activeFilter === "all" || activeFilter === "sold") && sales.map(renderSaleCard)}
        {activeFilter === "fees_due" && feeReceipts.map(renderStoredCard)}
        {activeFilter === "payouts" && payouts.map(renderPayoutCard)}
        {((activeFilter === "stored" && receipts.length === 0) ||
          (activeFilter === "sold" && sales.length === 0) ||
          (activeFilter === "fees_due" && feeReceipts.length === 0) ||
          (activeFilter === "payouts" && payouts.length === 0) ||
          (activeFilter === "all" && receipts.length === 0 && sales.length === 0)) && (
          <div className="farmer-card">
            <span className="card-title">Nothing to show yet</span>
            <span className="card-meta">New receipts, sales, fees, and payouts will appear here when warehouse workflows create them.</span>
          </div>
        )}
      </div>
    </div>
  );
}
