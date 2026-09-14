"use client";

import { Suspense, useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useAuth } from "@/app/auth/AuthProvider";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, MapPin, HelpCircle, ChevronDown, ChevronUp, Package } from "lucide-react";
import type { Id } from "@convex/_generated/dataModel";
import type { ProduceGrade } from "@kuapa-dwaso/types";
import type { User } from "firebase/auth";
import { getSignedReadUrl } from "@/app/uploads/client";

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
  photos?: string[];
  status?: string;
};

type MarketRun = {
  _id: Id<"marketDeliveryRuns">;
  originWarehouseId: Id<"warehouses">;
  destinationName: string;
  destinationInstructions: string;
  deliveryDateAt: number;
  orderCutoffAt: number;
  expectedArrivalStartAt: number;
  expectedArrivalEndAt: number;
  timezone: string;
};

function ProduceImage({ photoId, user }: { photoId: string | undefined; user: User | null }) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!photoId || !user) return;
    getSignedReadUrl(user, photoId)
      .then((url) => setImgUrl(url))
      .catch(() => setError(true));
  }, [photoId, user]);

  if (error || !photoId) return null;
  if (!imgUrl) {
    return (
      <div style={{
        width: "72px",
        height: "72px",
        borderRadius: "8px",
        backgroundColor: "var(--color-surface-raised)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>...</span>
      </div>
    );
  }

  return (
    <img
      src={imgUrl}
      alt="Produce"
      style={{
        width: "72px",
        height: "72px",
        borderRadius: "8px",
        objectFit: "cover",
        border: "1px solid var(--color-line)",
      }}
    />
  );
}

function BatchImageFallback() {
  return (
    <div style={{
      width: "72px",
      height: "72px",
      borderRadius: "8px",
      backgroundColor: "var(--color-surface-raised)",
      border: "1px solid var(--color-line)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "var(--color-text-muted)",
    }}>
      <Package size={28} style={{ opacity: 0.5 }} />
    </div>
  );
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function InventorySummaryContent() {
  const { principal, firebaseUser } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [renderedAt] = useState(() => Date.now());

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
  const upcomingRuns = useQuery(
    api.marketDeliveryRuns.listUpcomingForBuyer,
    principal !== null && principal !== undefined && buyer?.destinationMarket
      ? { actorUserId: principal.userId as Id<"users">, destinationName: buyer.destinationMarket, limit: 20 }
      : "skip",
  ) as MarketRun[] | undefined;
  const selectedRun = upcomingRuns?.find((run) => run.originWarehouseId === warehouseId);

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

  const isInventoryLoading = batches === undefined;
  const hasAvailableBatches = batches !== undefined && batches.length > 0;
  const listToRender: InventoryBatchSummary[] = batches ?? [];

  const totalQuantity = listToRender.reduce((sum, item) => sum + item.availableQuantity, 0);
  const prices = listToRender
    .map((b) => b.askingPricePerUnit)
    .filter((price): price is number => price !== undefined);
  const minPrice = prices.length > 0 ? Math.min(...prices) : undefined;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : undefined;

  const priceRangeString = minPrice === undefined || maxPrice === undefined
    ? "Price not set"
    : minPrice === maxPrice
      ? `GHS ${minPrice.toLocaleString()}`
      : `GHS ${minPrice.toLocaleString()} - GHS ${maxPrice.toLocaleString()}`;

  const earliestSellBy = listToRender.reduce(
    (earliest, b) => (b.sellByDate && b.sellByDate < earliest ? b.sellByDate : earliest),
    Number.MAX_SAFE_INTEGER
  );
  const daysLeft = earliestSellBy !== Number.MAX_SAFE_INTEGER
    ? Math.max(0, Math.floor((earliestSellBy - renderedAt) / MS_PER_DAY))
    : null;

  const dispatchDays = warehouse?.dispatchDays || [];

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
        <span>Back to stock</span>
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
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.9375rem", color: "var(--color-text-muted)", marginTop: "4px" }}>
            <MapPin size={16} />
            <span>Kuapa Dwaso supply</span>
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
          <div className="slip-row"><span className="slip-label">Destination</span><span className="slip-value" style={{ fontWeight: "600" }}>{buyer?.destinationMarket ?? "Choose a destination in your profile"}</span></div>
          <div className="slip-row"><span className="slip-label">Next published delivery</span><span className="slip-value" style={{ fontWeight: "600" }}>{selectedRun === undefined ? (dispatchDays.length > 0 ? `No open run yet (${dispatchDays.join(", ")})` : "No open run yet") : new Date(selectedRun.deliveryDateAt).toLocaleDateString("en-GH", { dateStyle: "medium", timeZone: selectedRun.timezone })}</span></div>
          {selectedRun !== undefined && <><div className="slip-row"><span className="slip-label">Orders and payment close</span><span className="slip-value">{new Date(selectedRun.orderCutoffAt).toLocaleString("en-GH", { dateStyle: "medium", timeStyle: "short", timeZone: selectedRun.timezone })}</span></div><div className="slip-row"><span className="slip-label">Arrival / collection</span><span className="slip-value">{new Date(selectedRun.expectedArrivalStartAt).toLocaleTimeString("en-GH", { hour: "numeric", minute: "2-digit", timeZone: selectedRun.timezone })}–{new Date(selectedRun.expectedArrivalEndAt).toLocaleTimeString("en-GH", { hour: "numeric", minute: "2-digit", timeZone: selectedRun.timezone })}; {selectedRun.destinationInstructions}</span></div></>}
        </div>
      </div>

      {/* Itemized Stock Batches */}
      <div>
        <h3 className="section-title" style={{ marginBottom: "10px" }}>
          Itemized Stock Batches
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {isInventoryLoading && (
            <>
              <div className="skeleton" style={{ width: "100%", height: "76px", borderRadius: "12px" }} />
              <div className="skeleton" style={{ width: "100%", height: "76px", borderRadius: "12px" }} />
            </>
          )}

          {!isInventoryLoading && !hasAvailableBatches && (
            <div style={{ textAlign: "center", padding: "32px 16px", color: "var(--color-text-muted)" }}>
              This stock is no longer available for reservation. Try another listing or adjust your filters.
            </div>
          )}

          {listToRender.map((batch, idx) => (
            <div
              key={batch.inventoryBatchId || idx}
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-line)",
                borderRadius: "12px",
                padding: "14px",
                display: "flex",
                alignItems: "center",
                gap: "16px",
              }}
            >
              {batch.photos && batch.photos.length > 0 ? (
                <ProduceImage photoId={batch.photos[0]} user={firebaseUser} />
              ) : (
                <BatchImageFallback />
              )}
              <div style={{ flex: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
                <strong>1. Produce Price:</strong> The listed price covers the selected produce. There are no negotiation fees.
              </p>
              <p style={{ margin: 0 }}>
                <strong>2. Platform Service Fee:</strong> A small service charge is calculated upon checkout based on the quantity requested and grade category.
              </p>
              <p style={{ margin: 0 }}>
                <strong>3. Delivery:</strong> Kuapa Dwaso groups produce and ships it on the published delivery days. Transport costs are calculated for your destination.
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
          disabled={!hasAvailableBatches || minPrice === undefined || maxPrice === undefined || selectedRun === undefined}
          onClick={() =>
            router.push(
              `/buyer/orders/create?run=${selectedRun?._id ?? ""}&warehouseId=${warehouseId}&cropType=${cropType}&grade=${grade}&unit=${unit}&minPrice=${minPrice}&maxPrice=${maxPrice}`
            )
          }
        >
          <span>{selectedRun === undefined ? "No accepting delivery run" : "Continue to Place Order"}</span>
        </button>
      </div>

      <p className="timestamp">Kuapa Dwaso records · Connected</p>
    </div>
  );
}

export default function InventorySummaryPage() {
  return (
    <Suspense fallback={<div className="skeleton" style={{ width: "100%", height: "280px", borderRadius: "16px" }} />}>
      <InventorySummaryContent />
    </Suspense>
  );
}
