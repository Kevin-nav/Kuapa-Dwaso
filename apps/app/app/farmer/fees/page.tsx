"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useAuth } from "@/app/auth/AuthProvider";
import { ChevronDown, ChevronUp, Info, AlertTriangle, ArrowRight } from "lucide-react";
import Link from "next/link";
import type { Id } from "@convex/_generated/dataModel";

type FeeReceipt = {
  _id: string;
  receiptCode: string;
  cropType: string;
  quantityReceived: number;
  unit: string;
  status: string;
  receivedAt: number;
  storageRateSnapshot?: { ratePerUnitPerDay?: number };
  storageFeeAccrued?: number;
  feeStatus?: string;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEMO_NOW = Date.UTC(2026, 0, 1);

export default function FeesPage() {
  const { principal } = useAuth();
  const [explainerOpen, setExplainerOpen] = useState(false);

  const farmerProfile = principal?.profiles?.find((p) => p.profileType === "farmer");
  const farmerId = farmerProfile?.profileId as Id<"farmers"> | undefined;

  // Query receipts from database
  const receipts = useQuery(
    api.inventoryBatches.listFarmerReceipts,
    principal !== null && principal !== undefined && farmerId !== undefined
      ? { actorUserId: principal.userId as Id<"users">, farmerId }
      : "skip"
  ) as FeeReceipt[] | undefined;

  // Fallback demo data if DB is empty
  const demoReceipts: FeeReceipt[] = [
    { _id: "demo1", receiptCode: "RCP-2401", cropType: "Maize", quantityReceived: 5, unit: "bags", status: "verified", receivedAt: DEMO_NOW - 12 * MS_PER_DAY, storageRateSnapshot: { ratePerUnitPerDay: 2 }, storageFeeAccrued: 120, feeStatus: "open" },
    { _id: "demo2", receiptCode: "RCP-2394", cropType: "Cassava", quantityReceived: 10, unit: "bags", status: "received", receivedAt: DEMO_NOW - 5 * MS_PER_DAY, storageRateSnapshot: { ratePerUnitPerDay: 1.5 }, storageFeeAccrued: 75, feeStatus: "open" },
    { _id: "demo3", receiptCode: "RCP-2388", cropType: "Cassava", quantityReceived: 8, unit: "bags", status: "waived", receivedAt: DEMO_NOW - 25 * MS_PER_DAY, storageRateSnapshot: { ratePerUnitPerDay: 1.5 }, storageFeeAccrued: 0, feeStatus: "waived" },
  ];

  const hasRealReceipts = receipts && receipts.length > 0;
  const listToRender = hasRealReceipts ? receipts : demoReceipts;

  const totalOpenFees = listToRender
    .filter((r) => r.status !== "waived" && r.feeStatus !== "waived" && r.feeStatus !== "paid")
    .reduce((acc, r) => acc + (r.storageFeeAccrued || 0), 0);

  const getDaysStored = (receivedAt: number) => {
    return Math.max(0, Math.floor((DEMO_NOW - receivedAt) / MS_PER_DAY));
  };

  return (
    <div style={{ display: "flex", flex: "1 0 auto", flexDirection: "column", gap: "16px" }}>
      <div>
        <p className="eyebrow">Fees & Transparency</p>
        <h1>Storage Fees</h1>
      </div>

      {/* Hero Open Fees Card */}
      <div
        className="farmer-card"
        style={{
          background: "linear-gradient(135deg, var(--color-ink) 0%, #1a2e20 100%)",
          color: "white",
          border: "none",
          padding: "24px",
          alignItems: "center",
          textAlign: "center"
        }}
      >
        <span style={{ fontSize: "0.9375rem", fontWeight: "600", opacity: 0.85, color: "var(--color-bg)" }}>
          Total Open Storage Fees
        </span>
        <span style={{ fontSize: "2.25rem", fontWeight: "800", margin: "8px 0", fontFamily: "var(--font-mono)", color: "var(--color-bg)" }}>
          GHS {totalOpenFees.toFixed(2)}
        </span>
        <span style={{ fontSize: "0.875rem", opacity: 0.8, color: "var(--color-line)" }}>
          Across {listToRender.filter((r) => (r.storageFeeAccrued || 0) > 0).length} receipts
        </span>
      </div>

      {/* Plain Language Explainer Accordion */}
      <div className="accordion">
        <button
          type="button"
          className="accordion-trigger"
          onClick={() => setExplainerOpen(!explainerOpen)}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Info size={18} style={{ color: "var(--color-primary)" }} />
            <span>How fees are calculated?</span>
          </div>
          {explainerOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        {explainerOpen && (
          <div className="accordion-content">
            <p style={{ marginBottom: "8px", color: "var(--color-text)", fontSize: "0.9375rem" }}>
              KuapaDwaso charges fee per bag, per day stored in warehouse facilities.
            </p>
            <ol style={{ paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "6px", color: "var(--color-text)" }}>
              <li><strong>Accrual:</strong> Fees accumulate every day the produce remains unsold.</li>
              <li><strong>Deduction:</strong> The accrued fee is automatically deducted from your final sales payout when a buyer purchases your produce.</li>
              <li><strong>Waivers:</strong> In specific cases, storage fees can be waived by administrative decision.</li>
            </ol>
          </div>
        )}
      </div>

      {/* Receipt-by-receipt breakdown header */}
      <h3 className="section-title" style={{ marginTop: "10px" }}>Receipt Breakdown</h3>

      {/* Breakdown list */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {listToRender.map((r) => {
          const days = getDaysStored(r.receivedAt);
          const rate = r.storageRateSnapshot?.ratePerUnitPerDay || 2;
          const status = r.status === "waived" || r.feeStatus === "waived" ? "waived" : "open";
          
          return (
            <div key={r._id} className="compact-row" style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontWeight: "700", color: "var(--color-ink)" }}>
                  {r.receiptCode}
                  {!hasRealReceipts && <span style={{ fontSize: "0.75rem", color: "var(--color-neutral)", marginLeft: "4px" }}>(Demo)</span>}
                </span>
                <span className={`status-chip status-${status === "waived" ? "neutral" : "warning"}`}>
                  {status}
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.875rem" }}>
                <span style={{ color: "var(--color-text-muted)" }}>
                  {days} days × {r.quantityReceived} bags × GHS {rate}
                </span>
                <strong style={{ color: status === "waived" ? "var(--color-text-muted)" : "var(--color-primary)", fontSize: "1.1rem", fontFamily: "var(--font-mono)" }}>
                  GHS {(r.storageFeeAccrued || 0).toFixed(2)}
                </strong>
              </div>

              <div style={{ borderTop: "1px dashed var(--color-line)", paddingTop: "8px", marginTop: "4px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Link
                  href={`/farmer/issue?receiptId=${r._id}`}
                  style={{
                    fontSize: "0.8125rem",
                    color: "var(--color-danger)",
                    fontWeight: "700",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px"
                  }}
                >
                  <AlertTriangle size={12} />
                  <span>Dispute fee</span>
                </Link>
                <Link
                  href={`/farmer/receipts/${r._id}`}
                  style={{
                    fontSize: "0.8125rem",
                    color: "var(--color-primary)",
                    fontWeight: "700",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px"
                  }}
                >
                  <span>Receipt Details</span>
                  <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
      
      <p className="timestamp">Last updated: {new Date().toLocaleTimeString()} · Connected</p>
    </div>
  );
}
