"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useAuth } from "@/app/auth/AuthProvider";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, MapPin, HelpCircle, ChevronDown, ChevronUp } from "lucide-react";
import type { Id } from "@convex/_generated/dataModel";
import type { ProduceGrade } from "@kuapa-dwaso/types";

type WarehouseSummary = {
  _id: string;
  name: string;
  community: string;
  dispatchDays?: string[];
};

type InventoryBatchSummary = {
  inventoryBatchId: string;
  warehouseName: string;
  warehouseCommunity: string;
  cropType: string;
  grade: string;
  unit: string;
  availableQuantity: number;
  askingPricePerUnit?: number;
  sellByDate?: number;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEMO_NOW = Date.UTC(2026, 0, 1);

export default function InventorySummaryPage() {
  const { principal } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  const warehouseId = searchParams.get("warehouseId") || "";
  const cropType = searchParams.get("cropType") || "";
  const grade = searchParams.get("grade") || "";
  const unit = searchParams.get("unit") || "bags";

  const buyerProfile = principal?.profiles?.find((p) => p.profileType === "buyer");
  const buyerId = buyerProfile?.profileId as Id<"buyers"> | undefined;

  // Retrieve Buyer Details
  const buyer = useQuery(
    api.buyers.getById,
    principal !== null && principal !== undefined && buyerId !== undefined
      ? { actorUserId: principal.userId as Id<"users">, buyerId }
      : "skip"
  );

  const defaultMarket = buyer?.destinationMarket || "Makola Market";

  // Query Warehouses
  const warehouses = useQuery(api.warehouses.list, {}) as WarehouseSummary[] | undefined;
  const warehouse = warehouses?.find((w) => w._id === warehouseId);

  // Retrieve matching individual batches
  const batches = useQuery(
    api.buyerOrders.listAvailableInventory,
    principal !== null && principal !== undefined && warehouseId
      ? {
          warehouseId: warehouseId as Id<"warehouses">,
          cropType,
          grade: grade as ProduceGrade,
          destinationMarket: defaultMarket,
        }
      : "skip"
  ) as InventoryBatchSummary[] | undefined;

  // State for "How fees work" collapse panel
  const [feesOpen, setFeesOpen] = useState(() =>
    typeof window === "undefined" ? true : localStorage.getItem("visited_summary_before") !== "true"
  );

  // Tracking if first-visit has happened (to remember fees state)
  useEffect(() => {
    if (localStorage.getItem("visited_summary_before") !== "true") {
      localStorage.setItem("visited_summary_before", "true");
    }
  }, []);

  const hasRealBatches = batches && batches.length > 0;

  // Fallback demo data
  const demoBatches: InventoryBatchSummary[] = [
    {
      inventoryBatchId: "batch1",
      warehouseName: warehouse?.name || "Akwatia Community Warehouse",
      warehouseCommunity: warehouse?.community || "Akwatia",
      cropType: cropType || "Maize",
      grade: grade || "A",
      unit: unit || "bags",
      availableQuantity: 90,
      askingPricePerUnit: 120,
      sellByDate: DEMO_NOW + 45 * MS_PER_DAY,
    },
    {
      inventoryBatchId: "batch2",
      warehouseName: warehouse?.name || "Akwatia Community Warehouse",
      warehouseCommunity: warehouse?.community || "Akwatia",
      cropType: cropType || "Maize",
      grade: grade || "A",
      unit: unit || "bags",
      availableQuantity: 60,
      askingPricePerUnit: 135,
      sellByDate: DEMO_NOW + 50 * MS_PER_DAY,
    },
  ];

  const listToRender: InventoryBatchSummary[] = hasRealBatches ? batches : demoBatches;

  const totalQuantity = listToRender.reduce((sum, item) => sum + item.availableQuantity, 0);
  const prices = listToRender
    .map((b) => b.askingPricePerUnit)
    .filter((price): price is number => price !== undefined);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  const priceRangeString = minPrice === maxPrice
    ? `GHS ${minPrice.toLocaleString()}`
    : `GHS ${minPrice.toLocaleString()} - GHS ${maxPrice.toLocaleString()}`;

  const earliestSellBy = listToRender.reduce(
    (earliest, b) => (b.sellByDate && b.sellByDate < earliest ? b.sellByDate : earliest),
    Number.MAX_SAFE_INTEGER
  );
  const daysLeft = earliestSellBy !== Number.MAX_SAFE_INTEGER
    ? Math.max(0, Math.floor((earliestSellBy - DEMO_NOW) / MS_PER_DAY))
    : null;

  const warehouseName = warehouse?.name || "Akwatia Community Warehouse";
  const dispatchDays = warehouse?.dispatchDays || ["Monday", "Wednesday", "Friday"];

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
          padding: "8px 0",
        }}
      >
        <ArrowLeft size={18} />
        <span>Back to Marketplace</span>
      </button>

      {/* Main Stock Summary Header - Screenshot friendly layout */}
      <div
        className="receipt-slip"
        style={{
          boxShadow: "0 4px 16px rgba(15, 31, 20, 0.05)",
          border: "1.5px solid var(--color-primary)",
        }}
      >
        <div className="slip-header" style={{ paddingBottom: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="slip-title">STOCK DETAIL SUMMARY</span>
            <span className="status-chip status-success">Grade {grade}</span>
          </div>
          <h2 style={{ fontSize: "1.6rem", color: "var(--color-ink)", marginTop: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
            <span>{cropType === "Maize" ? "🌽" : cropType === "Cassava" ? "🍠" : "🌾"}</span>
            <span>{cropType} Produce</span>
            {!hasRealBatches && <span style={{ fontSize: "0.75rem", color: "var(--color-neutral)", fontWeight: "normal" }}>(Demo)</span>}
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.9375rem", color: "var(--color-text-muted)", marginTop: "4px" }}>
            <MapPin size={16} />
            <span>{warehouseName}</span>
          </div>
        </div>

        <div className="slip-body" style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "10px" }}>
          <div className="slip-row">
            <span className="slip-label">Total Available</span>
            <span className="slip-value" style={{ fontSize: "1.1rem", fontWeight: "800", color: "var(--color-ink)" }}>
              {totalQuantity.toLocaleString()} {unit}
            </span>
          </div>
          <div className="slip-row">
            <span className="slip-label">Asking Price Range</span>
            <span className="slip-value card-math" style={{ fontSize: "1.1rem" }}>
              {priceRangeString} per {unit}
            </span>
          </div>
          {daysLeft !== null && (
            <div className="slip-row">
              <span className="slip-label">Freshness / Shelf Life</span>
              <span className="slip-value" style={{ color: daysLeft < 20 ? "var(--color-danger)" : "var(--color-success)", fontWeight: "700" }}>
                ~{daysLeft} days left (Sell-by)
              </span>
            </div>
          )}
          <div className="slip-row">
            <span className="slip-label">Dispatch Schedule</span>
            <span className="slip-value" style={{ fontWeight: "600" }}>
              {dispatchDays.join(", ")}
            </span>
          </div>
        </div>
      </div>

      {/* Itemized Stock Batches */}
      <div>
        <h3 className="section-title" style={{ marginBottom: "10px" }}>
          Itemized Stock Batches
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {listToRender.map((batch, idx) => (
            <div
              key={batch.inventoryBatchId || idx}
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-line)",
                borderRadius: "12px",
                padding: "14px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>
                  BATCH #{batch.inventoryBatchId.substring(0, 8).toUpperCase()}
                </div>
                <div style={{ fontWeight: "700", color: "var(--color-ink)", marginTop: "2px" }}>
                  {batch.availableQuantity} {unit}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="card-math" style={{ fontSize: "1rem" }}>
                  GHS {batch.askingPricePerUnit} / {unit}
                </div>
                {batch.sellByDate && (
                  <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "2px" }}>
                    Sell-by: {new Date(batch.sellByDate).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Collapsible How Fees Work Section */}
      <div
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1.5px solid var(--color-line)",
          borderRadius: "16px",
          overflow: "hidden",
        }}
      >
        <button
          type="button"
          onClick={() => setFeesOpen(!feesOpen)}
          style={{
            width: "100%",
            padding: "16px",
            background: "none",
            border: "none",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontWeight: "700",
            fontSize: "1rem",
            color: "var(--color-ink)",
            cursor: "pointer",
            minHeight: "56px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <HelpCircle size={18} style={{ color: "var(--color-primary)" }} />
            <span>How Fees & Transportation Work</span>
          </div>
          {feesOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {feesOpen && (
          <div
            style={{
              padding: "0 16px 16px 16px",
              fontSize: "0.9375rem",
              lineHeight: "1.5",
              color: "var(--color-text-muted)",
              borderTop: "1px solid var(--color-line)",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "12px" }}>
              <p style={{ margin: 0 }}>
                <strong>1. Purchase Price:</strong> The listed price goes directly to matching the farmer&apos;s produce. There are no negotiation fees.
              </p>
              <p style={{ margin: 0 }}>
                <strong>2. Platform Service Fee:</strong> A small service charge is calculated upon checkout based on the quantity requested and grade category.
              </p>
              <p style={{ margin: 0 }}>
                <strong>3. Dispatch & Shipping:</strong> Produce is grouped and shipped on the warehouse&apos;s dispatch days. Transporter delivery costs are calculated per destination market and split according to the default platform parameters.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Primary Action Zone - Reachable Bottom Placement */}
      <div style={{ marginTop: "10px" }}>
        <button
          type="button"
          className="btn btn-primary btn-full"
          onClick={() =>
            router.push(
              `/buyer/orders/create?warehouseId=${warehouseId}&cropType=${cropType}&grade=${grade}&unit=${unit}&minPrice=${minPrice}&maxPrice=${maxPrice}`
            )
          }
        >
          <span>Continue to Place Order</span>
        </button>
      </div>

      <p className="timestamp">Official warehouse records synced · Connected</p>
    </div>
  );
}
