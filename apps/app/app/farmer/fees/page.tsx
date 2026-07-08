"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { ArrowRight, ChevronDown, ChevronUp, Info } from "lucide-react";
import { useAuth } from "@/app/auth/AuthProvider";

type FeeReceipt = {
  _id: string;
  receiptCode: string;
  cropType: string;
  quantityReceived: number;
  unit: string;
  storageFeeAccrued?: number;
};

type LedgerEntry = {
  _id: string;
  inventoryBatchId: string;
  feeDate: number;
  quantityCharged: number;
  unit: string;
  amount: number;
  amountDeducted?: number;
  status: string;
  appliedRuleSnapshot: { ratePerUnitPerDay?: number; label: string; currency: string };
};

function statusClass(status: string) {
  if (["paid", "waived", "deducted_from_sale"].includes(status)) return "success";
  if (["accrued", "partially_deducted_from_sale"].includes(status)) return "warning";
  if (["disputed"].includes(status)) return "danger";
  return "neutral";
}

export default function FeesPage() {
  const { principal } = useAuth();
  const [explainerOpen, setExplainerOpen] = useState(false);
  const farmerProfile = principal?.profiles?.find((profile) => profile.profileType === "farmer");
  const farmerId = farmerProfile?.profileId as Id<"farmers"> | undefined;

  const receipts = useQuery(
    api.inventoryBatches.listFarmerReceipts,
    principal !== null && principal !== undefined && farmerId !== undefined
      ? { actorUserId: principal.userId as Id<"users">, farmerId }
      : "skip",
  ) as FeeReceipt[] | undefined;
  const ledger = useQuery(
    api.storageFees.listForFarmer,
    principal !== null && principal !== undefined && farmerId !== undefined
      ? { actorUserId: principal.userId as Id<"users">, farmerId, limit: 100 }
      : "skip",
  ) as LedgerEntry[] | undefined;

  if (receipts === undefined || ledger === undefined) {
    return <div className="skeleton" style={{ minHeight: "420px", borderRadius: "20px" }} />;
  }

  const receiptById = new Map(receipts.map((receipt) => [receipt._id, receipt]));
  const openLedger = ledger.filter((entry) => !["paid", "waived", "deducted_from_sale"].includes(entry.status));
  const totalOpenFees = openLedger.reduce((total, entry) => total + Math.max(0, entry.amount - (entry.amountDeducted ?? 0)), 0);
  const receiptAccrued = receipts.reduce((total, receipt) => total + (receipt.storageFeeAccrued ?? 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div>
        <p className="eyebrow">Fees & Transparency</p>
        <h1>Storage Fees</h1>
      </div>

      <div className="farmer-card" style={{ background: "var(--color-ink)", color: "white", border: "none", padding: "24px", alignItems: "center", textAlign: "center" }}>
        <span style={{ fontSize: "0.9375rem", fontWeight: 600, opacity: 0.85, color: "var(--color-bg)" }}>Open Ledger Fees</span>
        <span style={{ fontSize: "2.25rem", fontWeight: 800, margin: "8px 0", fontFamily: "var(--font-mono)", color: "var(--color-bg)" }}>
          GHS {totalOpenFees.toFixed(2)}
        </span>
        <span style={{ fontSize: "0.875rem", opacity: 0.8, color: "var(--color-line)" }}>
          Receipt accrued total: GHS {receiptAccrued.toFixed(2)}
        </span>
      </div>

      <div className="accordion">
        <button type="button" className="accordion-trigger" onClick={() => setExplainerOpen(!explainerOpen)}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Info size={18} style={{ color: "var(--color-primary)" }} />
            <span>How fees are calculated</span>
          </div>
          {explainerOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        {explainerOpen && (
          <div className="accordion-content">
            <p style={{ marginBottom: "8px", color: "var(--color-text)", fontSize: "0.9375rem" }}>
              Storage fees are recorded in ledger entries. Sale settlement can deduct all or part of an entry, and admins can waive or mark entries disputed.
            </p>
          </div>
        )}
      </div>

      <h3 className="section-title" style={{ marginTop: "10px" }}>Ledger Breakdown</h3>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {ledger.length === 0 ? (
          <div className="compact-row">
            <div className="row-info">
              <span className="row-title">No fee ledger entries yet</span>
              <span className="row-subtitle">Accrued and deducted fees will appear here.</span>
            </div>
          </div>
        ) : (
          ledger.map((entry) => {
            const receipt = receiptById.get(entry.inventoryBatchId);
            const outstanding = Math.max(0, entry.amount - (entry.amountDeducted ?? 0));
            return (
              <div key={entry._id} className="compact-row" style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--color-ink)" }}>{receipt?.receiptCode ?? entry.inventoryBatchId}</span>
                  <span className={`status-chip status-${statusClass(entry.status)}`}>{entry.status.replaceAll("_", " ")}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.875rem" }}>
                  <span style={{ color: "var(--color-text-muted)" }}>
                    {new Date(entry.feeDate).toLocaleDateString()} - {entry.quantityCharged} {entry.unit} at {entry.appliedRuleSnapshot.label}
                  </span>
                  <strong style={{ color: "var(--color-primary)", fontSize: "1.1rem", fontFamily: "var(--font-mono)" }}>
                    {entry.appliedRuleSnapshot.currency} {outstanding.toFixed(2)}
                  </strong>
                </div>
                <div style={{ borderTop: "1px dashed var(--color-line)", paddingTop: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
                    Deducted: GHS {(entry.amountDeducted ?? 0).toFixed(2)}
                  </span>
                  <Link href={`/farmer/receipts/${entry.inventoryBatchId}`} style={{ fontSize: "0.8125rem", color: "var(--color-primary)", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <span>Receipt Details</span>
                    <ArrowRight size={12} />
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
