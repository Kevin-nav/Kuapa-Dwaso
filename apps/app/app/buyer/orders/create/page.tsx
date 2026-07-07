"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useAuth } from "@/app/auth/AuthProvider";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, ShoppingCart } from "lucide-react";
import type { FormEvent } from "react";
import type { Id } from "@convex/_generated/dataModel";
import type { ProduceGrade } from "@kuapa-dwaso/types";

type BuyerProfile = {
  destinationMarket?: string;
};

type WarehouseSummary = {
  _id: string;
  name: string;
};

export default function CreateOrderPage() {
  const { principal } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  const createOrder = useMutation(api.buyerOrders.create);

  const warehouseId = searchParams.get("warehouseId") || "";
  const cropType = searchParams.get("cropType") || "";
  const preferredGrade = (searchParams.get("grade") || "mixed") as ProduceGrade;
  const unit = searchParams.get("unit") || "bags";
  const defaultMaxPrice = searchParams.get("maxPrice") || "";

  const buyerProfile = principal?.profiles?.find((p) => p.profileType === "buyer");
  const buyerId = buyerProfile?.profileId as Id<"buyers"> | undefined;

  // Retrieve Buyer Details
  const buyer = useQuery(
    api.buyers.getById,
    principal !== null && principal !== undefined && buyerId !== undefined
      ? { actorUserId: principal.userId as Id<"users">, buyerId }
      : "skip"
  ) as BuyerProfile | null | undefined;

  const warehouses = useQuery(api.warehouses.list, {}) as WarehouseSummary[] | undefined;
  const warehouse = warehouses?.find((w) => w._id === warehouseId);

  // Form states
  const [quantity, setQuantity] = useState<string>("");
  const [destinationMarket, setDestinationMarket] = useState<string>(
    buyer?.destinationMarket || "Makola Market"
  );
  const [maxPrice, setMaxPrice] = useState<string>(defaultMaxPrice);
  const [deliveryDate, setDeliveryDate] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formattedMarketString = destinationMarket || buyer?.destinationMarket || "Makola Market";

  const numQuantity = Number(quantity);
  const numPrice = Number(maxPrice);
  const estimatedCost = numQuantity && numPrice ? numQuantity * numPrice : 0;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!principal?.userId || !buyerId) {
      setError("User session or buyer profile not found. Please log in.");
      return;
    }
    if (!quantity || numQuantity <= 0) {
      setError("Please enter a valid positive quantity.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const orderArgs = {
        actorUserId: principal.userId as Id<"users">,
        buyerId,
        destinationMarket: formattedMarketString.trim(),
        cropType,
        requestedQuantity: numQuantity,
        unit,
        preferredGrade,
        ...(deliveryDate ? { requestedDeliveryDate: new Date(deliveryDate).getTime() } : {}),
        ...(numPrice ? { maxPricePerUnit: numPrice } : {}),
      };
      const orderId = await createOrder(orderArgs);

      // Redirect to the newly created order status page
      router.push(`/buyer/orders/${orderId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit order. Please check inventory stock.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formattedEstimate = estimatedCost > 0
    ? `GHS ${estimatedCost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
    : "GHS 0.00";

  return (
    <div style={{ display: "flex", flex: "1 0 auto", flexDirection: "column", gap: "20px" }}>
      {/* Back button */}
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
        <span>Back to Summary</span>
      </button>

      {/* Header */}
      <div>
        <p className="eyebrow">Purchase Request</p>
        <h1>Create Produce Order</h1>
        <p style={{ marginBottom: "10px" }}>
          Fill out the quantity and delivery schedule. The platform will automatically lock matches from available warehouse batches.
        </p>
      </div>

      {error && (
        <div className="attention-card" style={{ borderColor: "var(--color-danger-border)", backgroundColor: "var(--color-danger-bg)", color: "var(--color-danger)" }}>
          <div className="attention-body">
            <span className="attention-title">Order Failed</span>
            <span className="attention-text">{error}</span>
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={(e) => { void handleSubmit(e); }} className="auth-card" style={{ width: "100%", gap: "16px" }}>
        <div style={{ display: "flex", gap: "10px", backgroundColor: "var(--color-bg)", padding: "12px", borderRadius: "10px" }}>
          <div>
            <span style={{ fontSize: "1.4rem" }}>
              {cropType === "Maize" ? "🌽" : cropType === "Cassava" ? "🍠" : "🌾"}
            </span>
          </div>
          <div>
            <div style={{ fontWeight: "700", color: "var(--color-ink)", fontSize: "0.95rem" }}>
              {cropType} · Grade {preferredGrade}
            </div>
            <div style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
              Warehouse: {warehouse?.name || "Akwatia Community Warehouse"}
            </div>
          </div>
        </div>

        <div className="field-stack">
          <label htmlFor="quantity">Requested Quantity ({unit})</label>
          <input
            type="number"
            id="quantity"
            className="form-input"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="e.g. 50"
            min="1"
            disabled={isSubmitting}
            required
          />
        </div>

        <div className="field-stack">
          <label htmlFor="maxPrice">Maximum Price Per {unit.slice(0, -1)} (GHS)</label>
          <input
            type="number"
            id="maxPrice"
            className="form-input"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            placeholder="e.g. 130"
            min="1"
            disabled={isSubmitting}
          />
          <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
            Defaults to current warehouse asking price: GHS {defaultMaxPrice}
          </span>
        </div>

        <div className="field-stack">
          <label htmlFor="destinationMarket">Destination Market Delivery</label>
          <input
            type="text"
            id="destinationMarket"
            className="form-input"
            value={destinationMarket}
            onChange={(e) => setDestinationMarket(e.target.value)}
            placeholder="e.g. Makola Market, Accra"
            disabled={isSubmitting}
            required
          />
        </div>

        <div className="field-stack">
          <label htmlFor="deliveryDate">Requested Delivery Date (Optional)</label>
          <input
            type="date"
            id="deliveryDate"
            className="form-input"
            value={deliveryDate}
            onChange={(e) => setDeliveryDate(e.target.value)}
            disabled={isSubmitting}
          />
        </div>

        {/* Live Form Review Section */}
        {numQuantity > 0 && (
          <div
            style={{
              border: "1.5px solid var(--color-line)",
              borderRadius: "12px",
              padding: "14px",
              backgroundColor: "var(--color-bg)",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div style={{ fontWeight: "700", color: "var(--color-ink)", fontSize: "0.875rem" }}>
              Order Review Summary
            </div>
            <div style={{ fontSize: "0.875rem", display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--color-text-muted)" }}>Requested:</span>
              <strong style={{ color: "var(--color-ink)" }}>
                {numQuantity} {unit} of {cropType} (Grade {preferredGrade})
              </strong>
            </div>
            <div style={{ fontSize: "0.875rem", display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--color-text-muted)" }}>Destination:</span>
              <strong style={{ color: "var(--color-ink)" }}>{formattedMarketString}</strong>
            </div>
            {deliveryDate && (
              <div style={{ fontSize: "0.875rem", display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--color-text-muted)" }}>Deliver by:</span>
                <strong style={{ color: "var(--color-ink)" }}>{new Date(deliveryDate).toLocaleDateString()}</strong>
              </div>
            )}

            <div style={{ borderTop: "1px dashed var(--color-line)", margin: "4px 0" }} />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: "600", fontSize: "0.875rem", color: "var(--color-text-muted)" }}>
                Est. Purchase Cost:
              </span>
              <span className="card-math" style={{ fontSize: "1.1rem" }}>
                {formattedEstimate}
              </span>
            </div>
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary btn-full"
          disabled={isSubmitting}
          style={{ marginTop: "10px" }}
        >
          <ShoppingCart size={18} />
          <span>{isSubmitting ? "Submitting Order..." : "Request Produce"}</span>
        </button>
      </form>
    </div>
  );
}
