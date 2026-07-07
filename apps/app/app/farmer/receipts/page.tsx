"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useAuth } from "@/app/auth/AuthProvider";
import { Search, Copy, Check, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { MouseEvent } from "react";
import type { Id } from "@convex/_generated/dataModel";

type ReceiptListItem = {
  _id: string;
  receiptCode: string;
  cropType: string;
  quantityReceived: number;
  unit: string;
  status: string;
  receivedAt: number;
  warehouseId?: string;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEMO_NOW = Date.UTC(2026, 0, 1);

export default function ReceiptsPage() {
  const { principal } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const farmerProfile = principal?.profiles?.find((p) => p.profileType === "farmer");
  const farmerId = farmerProfile?.profileId as Id<"farmers"> | undefined;

  // Retrieve receipts from database
  const receipts = useQuery(
    api.inventoryBatches.listFarmerReceipts,
    principal !== null && principal !== undefined && farmerId !== undefined
      ? { actorUserId: principal.userId as Id<"users">, farmerId }
      : "skip"
  ) as ReceiptListItem[] | undefined;

  const warehouses = useQuery(api.warehouses.list, {});

  // Demo fallback data if DB is empty
  const demoReceipts: ReceiptListItem[] = [
    { _id: "demo1", receiptCode: "RCP-2401", cropType: "Maize", quantityReceived: 5, unit: "bags", status: "verified", receivedAt: DEMO_NOW - 12 * MS_PER_DAY, warehouseId: "w1" },
    { _id: "demo2", receiptCode: "RCP-2394", cropType: "Cassava", quantityReceived: 10, unit: "bags", status: "received", receivedAt: DEMO_NOW - 3 * MS_PER_DAY, warehouseId: "w1" },
    { _id: "demo3", receiptCode: "RCP-2388", cropType: "Cassava", quantityReceived: 8, unit: "bags", status: "waived", receivedAt: DEMO_NOW - 25 * MS_PER_DAY, warehouseId: "w1" },
  ];

  const getWarehouseName = (id?: string) => {
    return warehouses?.find((w) => w._id === id)?.name || "Akwatia Community Warehouse";
  };

  const handleCopy = (e: MouseEvent, code: string, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    void navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const hasRealReceipts = receipts && receipts.length > 0;
  const listToRender = hasRealReceipts ? receipts : demoReceipts;

  const filteredReceipts = listToRender.filter((r) =>
    r.receiptCode.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
    r.cropType.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  return (
    <div style={{ display: "flex", flex: "1 0 auto", flexDirection: "column", gap: "16px" }}>
      <div>
        <p className="eyebrow">My Proof</p>
        <h1>Warehouse Receipts</h1>
      </div>

      {/* Search Input Bar */}
      <div style={{ position: "relative" }}>
        <Search
          size={18}
          style={{
            position: "absolute",
            left: "14px",
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--color-text-muted)"
          }}
        />
        <input
          type="text"
          placeholder="Search by receipt code..."
          className="form-input"
          style={{ paddingLeft: "42px" }}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Receipts list */}
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {filteredReceipts.map((r) => {
          const formattedDate = new Date(r.receivedAt).toLocaleDateString("en-US", {
            day: "numeric",
            month: "short",
            year: "numeric"
          });
          const warehouseName = getWarehouseName(r.warehouseId);
          const isCopied = copiedId === r._id;

          return (
            <Link href={`/farmer/receipts/${r._id}`} key={r._id} className="farmer-card">
              <div className="card-header">
                <span style={{ fontFamily: "var(--font-mono)", fontWeight: "700", fontSize: "1.1rem", color: "var(--color-ink)" }}>
                  {r.receiptCode}
                  {!hasRealReceipts && <span style={{ fontSize: "0.75rem", color: "var(--color-neutral)", marginLeft: "4px" }}>(Demo)</span>}
                </span>
                <span className={`status-chip status-${r.status === "verified" || r.status === "available" ? "success" : r.status === "received" ? "info" : "neutral"}`}>
                  {r.status === "verified" || r.status === "available" ? "Fresh" : r.status}
                </span>
              </div>
              
              <div className="card-meta">
                <div style={{ fontWeight: "700", color: "var(--color-ink)", marginBottom: "4px" }}>
                  {r.cropType} · {r.quantityReceived} {r.unit}
                </div>
                <div style={{ fontSize: "0.875rem", color: "var(--color-text-muted)" }}>
                  {warehouseName} · Received {formattedDate}
                </div>
              </div>

              <div className="card-details" style={{ borderTop: "1px dashed var(--color-line)", paddingTop: "10px", marginTop: "4px" }}>
                <button
                  type="button"
                  onClick={(e) => handleCopy(e, r.receiptCode, r._id)}
                  style={{
                    background: "var(--color-bg)",
                    border: "1px solid var(--color-line)",
                    borderRadius: "8px",
                    padding: "6px 12px",
                    fontSize: "0.8125rem",
                    fontWeight: "600",
                    color: "var(--color-text)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    minHeight: "32px",
                    cursor: "pointer"
                  }}
                >
                  {isCopied ? <Check size={12} style={{ color: "var(--color-success)" }} /> : <Copy size={12} />}
                  <span>{isCopied ? "Copied" : "Copy Code"}</span>
                </button>
                <div style={{ display: "flex", alignItems: "center", gap: "2px", color: "var(--color-primary)", fontWeight: "700", fontSize: "0.875rem" }}>
                  <span>View Details</span>
                  <ChevronRight size={14} />
                </div>
              </div>
            </Link>
          );
        })}

        {filteredReceipts.length === 0 && (
          <p style={{ textAlign: "center", padding: "40px", color: "var(--color-text-muted)" }}>
            No receipts found matching &quot;{searchQuery}&quot;
          </p>
        )}
      </div>

      <p className="timestamp">Last updated: {new Date().toLocaleTimeString()} · Connected</p>
    </div>
  );
}
