"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useAuth } from "@/app/auth/AuthProvider";
import type { Id } from "@convex/_generated/dataModel";

type FilterType = "all" | "stored" | "sold" | "fees_due";

type StoredProduce = {
  _id: string;
  cropType: string;
  grade?: string;
  quantityAvailable?: number;
  quantityReceived?: number;
  unit: string;
  status: string;
  storageFeeAccrued?: number;
  receivedAt: number;
  preferredWarehouseId?: string;
  warehouseId?: string;
};

type SaleSummary = {
  _id: string;
  cropType: string;
  quantitySold: number;
  unit: string;
  grossAmount?: number;
  storageFeeDeducted?: number;
  commissionDeducted?: number;
  netAmountDueToFarmer?: number;
  paymentStatus: string;
  createdAt: number;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEMO_NOW = Date.UTC(2026, 0, 1);

export default function ProducePage() {
  const { principal } = useAuth();
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");

  const farmerProfile = principal?.profiles?.find((p) => p.profileType === "farmer");
  const farmerId = farmerProfile?.profileId as Id<"farmers"> | undefined;

  // Query database
  const receipts = useQuery(
    api.inventoryBatches.listFarmerReceipts,
    principal !== null && principal !== undefined && farmerId !== undefined
      ? { actorUserId: principal.userId as Id<"users">, farmerId }
      : "skip"
  ) as StoredProduce[] | undefined;

  const sales = useQuery(
    api.sales.listForFarmer,
    principal !== null && principal !== undefined && farmerId !== undefined
      ? { actorUserId: principal.userId as Id<"users">, farmerId }
      : "skip"
  ) as SaleSummary[] | undefined;

  const warehouses = useQuery(api.warehouses.list, {});

  // Demo fallback data if DB is empty
  const demoStored: StoredProduce[] = [
    { _id: "demo1", cropType: "Maize", grade: "A", quantityAvailable: 5, unit: "bags", status: "stored", storageFeeAccrued: 24, receivedAt: DEMO_NOW - 12 * MS_PER_DAY, preferredWarehouseId: "w1" },
    { _id: "demo2", cropType: "Cassava", grade: "B", quantityAvailable: 10, unit: "bags", status: "received", storageFeeAccrued: 15, receivedAt: DEMO_NOW - 5 * MS_PER_DAY, preferredWarehouseId: "w1" },
  ];

  const demoSales: SaleSummary[] = [
    {
      _id: "demosale1",
      cropType: "Maize",
      quantitySold: 4,
      unit: "bags",
      grossAmount: 400,
      storageFeeDeducted: 80,
      commissionDeducted: 20,
      netAmountDueToFarmer: 300,
      paymentStatus: "paid",
      createdAt: DEMO_NOW - 15 * MS_PER_DAY,
    },
  ];

  const getWarehouseName = (id?: string) => {
    return warehouses?.find((w) => w._id === id)?.name || "Akwatia Community Warehouse";
  };

  const getDaysStored = (receivedAt: number) => {
    return Math.max(0, Math.floor((DEMO_NOW - receivedAt) / MS_PER_DAY));
  };

  const renderFilterChips = () => {
    const filters: { value: FilterType; label: string }[] = [
      { value: "all", label: "All Produce" },
      { value: "stored", label: "Stored" },
      { value: "sold", label: "Sold / Earnings" },
      { value: "fees_due", label: "Fees Due" },
    ];

    return (
      <div className="filter-container">
        {filters.map((f) => (
          <button
            key={f.value}
            type="button"
            className={`filter-chip ${activeFilter === f.value ? "filter-chip-active" : ""}`}
            onClick={() => setActiveFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>
    );
  };

  const renderStoredCard = (batch: StoredProduce, isDemo = false) => {
    const days = getDaysStored(batch.receivedAt);
    const warehouseName = getWarehouseName(batch.preferredWarehouseId || batch.warehouseId);
    
    return (
      <div key={batch._id} className="farmer-card">
        <div className="card-header">
          <span className="card-title">
            <span>{batch.cropType === "Maize" ? "🌽" : "🍠"}</span>
            <span>{batch.cropType}</span>
            {isDemo && <span style={{ fontSize: "0.75rem", color: "var(--color-neutral)" }}>(Demo)</span>}
          </span>
          <span className={`status-chip status-${batch.status === "stored" || batch.status === "verified" ? "success" : "warning"}`}>
            {batch.status}
          </span>
        </div>
        <div className="card-meta">
          <strong>{batch.quantityAvailable || batch.quantityReceived} {batch.unit}</strong> · Grade {batch.grade || "A"}
          <div style={{ color: "var(--color-text-muted)", fontSize: "0.875rem", marginTop: "2px" }}>
            {warehouseName}
          </div>
        </div>
        <div className="card-details">
          <span>{days} days stored</span>
          <span className="card-math">Fee: GHS {batch.storageFeeAccrued || 0}</span>
        </div>
      </div>
    );
  };

  const renderSalesCard = (sale: SaleSummary, isDemo = false) => {
    return (
      <div key={sale._id} className="farmer-card" style={{ borderLeft: "4px solid var(--color-success)" }}>
        <div className="card-header">
          <span className="card-title">
            <span>{sale.cropType === "Maize" ? "🌽" : "🍠"}</span>
            <span>{sale.cropType} Sold</span>
            {isDemo && <span style={{ fontSize: "0.75rem", color: "var(--color-neutral)" }}>(Demo)</span>}
          </span>
          <span className={`status-chip status-${sale.paymentStatus === "paid" ? "success" : "warning"}`}>
            {sale.paymentStatus}
          </span>
        </div>
        <div className="card-meta" style={{ fontSize: "0.875rem" }}>
          <strong>{sale.quantitySold} {sale.unit}</strong> · Sold on {new Date(sale.createdAt).toLocaleDateString()}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", padding: "8px 0", borderTop: "1px dashed var(--color-line)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem" }}>
            <span>Gross Value</span>
            <strong>GHS {sale.grossAmount || 0}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", color: "var(--color-danger)" }}>
            <span>− Storage Fee</span>
            <span>−GHS {sale.storageFeeDeducted || 0}</span>
          </div>
          {sale.commissionDeducted !== undefined && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", color: "var(--color-danger)" }}>
              <span>− Commission</span>
              <span>−GHS {sale.commissionDeducted}</span>
            </div>
          )}
        </div>
        <div className="card-details" style={{ borderTop: "1.5px solid var(--color-line)" }}>
          <strong style={{ color: "var(--color-ink)" }}>Net Paid to You</strong>
          <span style={{ fontSize: "1.2rem", fontWeight: "800", color: "var(--color-success)" }}>
            GHS {sale.netAmountDueToFarmer || 0}
          </span>
        </div>
      </div>
    );
  };

  const hasRealReceipts = receipts && receipts.length > 0;
  const hasRealSales = sales && sales.length > 0;

  const activeReceiptsList = hasRealReceipts ? receipts : demoStored;
  const activeSalesList = hasRealSales ? sales : demoSales;

  return (
    <div style={{ display: "flex", flex: "1 0 auto", flexDirection: "column", gap: "16px" }}>
      <div>
        <p className="eyebrow">My Inventory</p>
        <h1>Produce & Earnings</h1>
      </div>

      {/* Horizontal Scroll Filter Chips */}
      {renderFilterChips()}

      {/* Conditional Rendering of Cards based on filters */}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {activeFilter === "all" && (
          <>
            {activeReceiptsList.map((r) => renderStoredCard(r, !hasRealReceipts))}
            {activeSalesList.map((s) => renderSalesCard(s, !hasRealSales))}
          </>
        )}

        {activeFilter === "stored" && (
          <>
            {activeReceiptsList.map((r) => renderStoredCard(r, !hasRealReceipts))}
            {activeReceiptsList.length === 0 && (
              <p style={{ textAlign: "center", padding: "20px", color: "var(--color-text-muted)" }}>No stored produce batches found.</p>
            )}
          </>
        )}

        {activeFilter === "sold" && (
          <>
            {activeSalesList.map((s) => renderSalesCard(s, !hasRealSales))}
            {activeSalesList.length === 0 && (
              <p style={{ textAlign: "center", padding: "20px", color: "var(--color-text-muted)" }}>No sales transactions found.</p>
            )}
          </>
        )}

        {activeFilter === "fees_due" && (
          <>
            {activeReceiptsList
              .filter((r) => (r.storageFeeAccrued || 0) > 0)
              .map((r) => renderStoredCard(r, !hasRealReceipts))}
            {activeReceiptsList.filter((r) => (r.storageFeeAccrued || 0) > 0).length === 0 && (
              <p style={{ textAlign: "center", padding: "20px", color: "var(--color-text-muted)" }}>No outstanding storage fees due.</p>
            )}
          </>
        )}
      </div>
      
      <p className="timestamp">Last updated: {new Date().toLocaleTimeString()} · Connected</p>
    </div>
  );
}
