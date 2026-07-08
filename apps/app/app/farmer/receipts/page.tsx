"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { MouseEvent } from "react";
import { Check, ChevronRight, Copy, Search } from "lucide-react";
import { useAuth } from "@/app/auth/AuthProvider";

type ReceiptListItem = {
  _id: string;
  receiptCode: string;
  cropType: string;
  quantityReceived: number;
  quantityAvailable: number;
  unit: string;
  status: string;
  receivedAt: number;
  warehouseId?: string;
};

function statusClass(status: string) {
  if (["verified", "available"].includes(status)) return "success";
  if (["received", "partially_reserved", "reserved"].includes(status)) return "warning";
  if (["disputed", "spoiled", "expired"].includes(status)) return "danger";
  return "neutral";
}

export default function ReceiptsPage() {
  const { principal } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const farmerProfile = principal?.profiles?.find((profile) => profile.profileType === "farmer");
  const farmerId = farmerProfile?.profileId as Id<"farmers"> | undefined;

  const receipts = useQuery(
    api.inventoryBatches.listFarmerReceipts,
    principal !== null && principal !== undefined && farmerId !== undefined
      ? { actorUserId: principal.userId as Id<"users">, farmerId }
      : "skip",
  ) as ReceiptListItem[] | undefined;
  const warehouses = useQuery(api.warehouses.list, {});

  const handleCopy = (event: MouseEvent, code: string, id: string) => {
    event.preventDefault();
    event.stopPropagation();
    void navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredReceipts = (receipts ?? []).filter((receipt) =>
    `${receipt.receiptCode} ${receipt.cropType}`.toLowerCase().includes(searchQuery.trim().toLowerCase()),
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div>
        <p className="eyebrow">My Proof</p>
        <h1>Warehouse Receipts</h1>
      </div>

      <div style={{ position: "relative" }}>
        <Search size={18} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)" }} />
        <input
          type="text"
          placeholder="Search by receipt code..."
          className="form-input"
          style={{ paddingLeft: "42px" }}
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
        />
      </div>

      {receipts === undefined ? (
        <div className="skeleton" style={{ height: "320px", borderRadius: "20px" }} />
      ) : filteredReceipts.length === 0 ? (
        <div className="farmer-card">
          <span className="card-title">No receipts found</span>
          <span className="card-meta">Warehouse receipts will appear here after produce intake.</span>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {filteredReceipts.map((receipt) => {
            const warehouseName = warehouses?.find((warehouse) => warehouse._id === receipt.warehouseId)?.name ?? "Warehouse";
            const isCopied = copiedId === receipt._id;
            return (
              <Link href={`/farmer/receipts/${receipt._id}`} key={receipt._id} className="farmer-card">
                <div className="card-header">
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "1.1rem", color: "var(--color-ink)" }}>{receipt.receiptCode}</span>
                  <span className={`status-chip status-${statusClass(receipt.status)}`}>{receipt.status.replaceAll("_", " ")}</span>
                </div>
                <div className="card-meta">
                  <div style={{ fontWeight: 700, color: "var(--color-ink)", marginBottom: "4px" }}>
                    {receipt.cropType}: {receipt.quantityAvailable} of {receipt.quantityReceived} {receipt.unit} available
                  </div>
                  <div style={{ fontSize: "0.875rem", color: "var(--color-text-muted)" }}>
                    {warehouseName} - Received {new Date(receipt.receivedAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="card-details" style={{ borderTop: "1px dashed var(--color-line)", paddingTop: "10px", marginTop: "4px" }}>
                  <button
                    type="button"
                    onClick={(event) => handleCopy(event, receipt.receiptCode, receipt._id)}
                    style={{ background: "var(--color-bg)", border: "1px solid var(--color-line)", borderRadius: "8px", padding: "6px 12px", fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-text)", display: "inline-flex", alignItems: "center", gap: "6px", minHeight: "32px" }}
                  >
                    {isCopied ? <Check size={12} style={{ color: "var(--color-success)" }} /> : <Copy size={12} />}
                    <span>{isCopied ? "Copied" : "Copy Code"}</span>
                  </button>
                  <div style={{ display: "flex", alignItems: "center", gap: "2px", color: "var(--color-primary)", fontWeight: 700, fontSize: "0.875rem" }}>
                    <span>View Details</span>
                    <ChevronRight size={14} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
