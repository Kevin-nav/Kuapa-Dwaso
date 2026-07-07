"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useAuth } from "@/app/auth/AuthProvider";
import Link from "next/link";
import { Search, ChevronRight, CircleDollarSign } from "lucide-react";
import type { Id } from "@convex/_generated/dataModel";

type BuyerOrderListItem = {
  _id: string;
  cropType: string;
  preferredGrade?: string;
  requestedQuantity: number;
  unit: string;
  destinationMarket: string;
  subtotalAmount?: number;
  totalAmount?: number;
  paymentStatus: string;
  status: string;
  createdAt: number;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEMO_NOW = Date.UTC(2026, 0, 1);

export default function OrdersListPage() {
  const { principal } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");

  const buyerProfile = principal?.profiles?.find((p) => p.profileType === "buyer");
  const buyerId = buyerProfile?.profileId as Id<"buyers"> | undefined;

  // Retrieve buyer orders
  const orders = useQuery(
    api.buyerOrders.listForBuyer,
    principal !== null && principal !== undefined && buyerId !== undefined
      ? { actorUserId: principal.userId as Id<"users">, buyerId }
      : "skip"
  ) as BuyerOrderListItem[] | undefined;

  // Fallback demo data if DB is empty
  const demoOrders: BuyerOrderListItem[] = [
    {
      _id: "demo1",
      cropType: "Maize",
      preferredGrade: "A",
      requestedQuantity: 50,
      unit: "bags",
      destinationMarket: "Makola Market",
      totalAmount: 6450,
      paymentStatus: "deposit_paid",
      status: "reserved",
      createdAt: DEMO_NOW - 2 * MS_PER_DAY,
    },
    {
      _id: "demo2",
      cropType: "Cassava",
      preferredGrade: "B",
      requestedQuantity: 30,
      unit: "bags",
      destinationMarket: "Makola Market",
      totalAmount: 2850,
      paymentStatus: "fully_paid",
      status: "completed",
      createdAt: DEMO_NOW - 10 * MS_PER_DAY,
    },
  ];

  const hasRealOrders = orders && orders.length > 0;
  const listToRender: BuyerOrderListItem[] = hasRealOrders ? orders : demoOrders;

  const filteredOrders = listToRender.filter((o) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return (
      o.cropType.toLowerCase().includes(query) ||
      o.destinationMarket.toLowerCase().includes(query) ||
      o._id.toLowerCase().includes(query)
    );
  });

  const getStatusClass = (status: string) => {
    if (["completed", "delivered", "confirmed", "reserved"].includes(status)) {
      return "status-success";
    }
    if (["submitted", "preparing", "ready_for_dispatch", "in_transit"].includes(status)) {
      return "status-info";
    }
    if (["awaiting_payment", "deposit_paid"].includes(status)) {
      return "status-warning";
    }
    return "status-danger";
  };

  return (
    <div style={{ display: "flex", flex: "1 0 auto", flexDirection: "column", gap: "16px" }}>
      <div>
        <p className="eyebrow">Purchase Orders</p>
        <h1>Order History</h1>
        <p style={{ marginBottom: "10px" }}>
          Track the matched inventory reservations, payment clearance, and shipping fulfillment timeline of your requests.
        </p>
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
            color: "var(--color-text-muted)",
          }}
        />
        <input
          type="text"
          placeholder="Search by crop, destination market, or ID..."
          className="form-input"
          style={{ paddingLeft: "42px" }}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Orders List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {filteredOrders.map((o) => {
          const formattedDate = new Date(o.createdAt).toLocaleDateString("en-US", {
            day: "numeric",
            month: "short",
            year: "numeric",
          });

          return (
            <Link href={`/buyer/orders/${o._id}`} key={o._id} className="farmer-card">
              <div className="card-header">
                <span style={{ fontFamily: "var(--font-mono)", fontWeight: "700", fontSize: "1.05rem", color: "var(--color-ink)" }}>
                  ORDER #{o._id.substring(0, 8).toUpperCase()}
                  {!hasRealOrders && (
                    <span style={{ fontSize: "0.75rem", color: "var(--color-neutral)", marginLeft: "4px" }}>(Demo)</span>
                  )}
                </span>
                <span className={`status-chip ${getStatusClass(o.status)}`}>
                  {o.status.replace(/_/g, " ")}
                </span>
              </div>

              <div className="card-meta">
                <div style={{ fontWeight: "700", color: "var(--color-ink)", marginBottom: "4px", fontSize: "1.05rem" }}>
                  {o.cropType} · {o.requestedQuantity} {o.unit}
                </div>
                <div style={{ fontSize: "0.875rem", color: "var(--color-text-muted)", display: "flex", flexDirection: "column", gap: "2px" }}>
                  <span>Market: {o.destinationMarket}</span>
                  <span>Submitted: {formattedDate}</span>
                </div>
              </div>

              <div className="card-details" style={{ borderTop: "1.5px dashed var(--color-line)", paddingTop: "12px", marginTop: "4px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <CircleDollarSign size={16} style={{ color: "var(--color-primary)" }} />
                  <span className="card-math" style={{ fontVariantNumeric: "tabular-nums" }}>
                    GHS {o.totalAmount?.toLocaleString() || o.subtotalAmount?.toLocaleString()}
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "2px", color: "var(--color-primary)", fontWeight: "700", fontSize: "0.875rem" }}>
                  <span>Track Status</span>
                  <ChevronRight size={14} />
                </div>
              </div>
            </Link>
          );
        })}

        {filteredOrders.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: "3rem", marginBottom: "16px" }}>📋</div>
            <h3 style={{ color: "var(--color-ink)", marginBottom: "8px" }}>No Orders Found</h3>
            <p style={{ maxWidth: "320px", margin: "0 auto", color: "var(--color-text-muted)" }}>
              {searchQuery ? `No orders matched search query "${searchQuery}"` : "You have not placed any produce orders yet."}
            </p>
          </div>
        )}
      </div>

      <p className="timestamp">Connected · Last synced {new Date().toLocaleTimeString()}</p>
    </div>
  );
}
