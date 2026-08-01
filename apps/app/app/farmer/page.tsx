"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { AlertTriangle, Bell, ChevronRight, FileText, HelpCircle, MapPin, Phone, Sprout } from "lucide-react";
import { useAuth } from "@/app/auth/AuthProvider";

type Receipt = {
  _id: string;
  receiptCode: string;
  cropType: string;
  quantityAvailable: number;
  quantityReceived: number;
  unit: string;
  status: string;
  receivedAt: number;
  storageFeeAccrued?: number;
};

type Sale = {
  _id: string;
  paymentStatus: string;
  netAmountDueToFarmer: number;
};

type Dispatch = {
  dispatchId: string;
  destination: string;
  status: string;
  quantity: number;
  unit: string;
};

function statusClass(status: string) {
  if (["verified", "available", "paid", "delivered", "closed", "read"].includes(status)) return "success";
  if (["received", "pending", "part_paid", "planned", "loading", "in_transit", "arrived"].includes(status)) return "warning";
  if (["disputed", "withheld", "cancelled", "issue_reported"].includes(status)) return "danger";
  return "neutral";
}

export default function FarmerDashboard() {
  const { principal } = useAuth();
  const farmerProfile = principal?.profiles?.find((profile) => profile.profileType === "farmer");
  const farmerId = farmerProfile?.profileId as Id<"farmers"> | undefined;
  const markNotificationRead = useMutation(api.notifications.markRead);
  const acknowledgeNotification = useMutation(api.notifications.acknowledge);

  const farmer = useQuery(
    api.farmers.getById,
    principal !== null && principal !== undefined && farmerId !== undefined
      ? { actorUserId: principal.userId as Id<"users">, farmerId }
      : "skip",
  );
  const receipts = useQuery(
    api.inventoryBatches.listFarmerReceipts,
    principal !== null && principal !== undefined && farmerId !== undefined
      ? { actorUserId: principal.userId as Id<"users">, farmerId }
      : "skip",
  ) as Receipt[] | undefined;
  const sales = useQuery(
    api.sales.listForFarmer,
    principal !== null && principal !== undefined && farmerId !== undefined
      ? { actorUserId: principal.userId as Id<"users">, farmerId, limit: 20 }
      : "skip",
  ) as Sale[] | undefined;
  const payouts = useQuery(
    api.payments.listPayoutLedgerForFarmer,
    principal !== null && principal !== undefined && farmerId !== undefined
      ? { actorUserId: principal.userId as Id<"users">, farmerId, limit: 20 }
      : "skip",
  );
  const dispatches = useQuery(
    api.dispatches.listForFarmer,
    principal !== null && principal !== undefined && farmerId !== undefined
      ? { actorUserId: principal.userId as Id<"users">, farmerId, limit: 3 }
      : "skip",
  ) as Dispatch[] | undefined;
  const notifications = useQuery(
    api.notifications.listForActor,
    principal !== null && principal !== undefined ? { actorUserId: principal.userId as Id<"users">, limit: 3 } : "skip",
  );
  const warehouses = useQuery(api.warehouses.list, {});

  if (farmer === undefined || receipts === undefined || sales === undefined || payouts === undefined || dispatches === undefined) {
    return <div className="skeleton" style={{ minHeight: "420px", borderRadius: "20px" }} />;
  }

  if (farmer === null) {
    return (
      <div className="farmer-card">
        <span className="card-title">Farmer profile not found</span>
        <span className="card-meta">Complete signup or claim your warehouse-created farmer profile.</span>
        <Link href="/signup" className="btn btn-primary">Continue signup</Link>
      </div>
    );
  }

  const warehouse = warehouses?.find((item) => item._id === farmer.preferredWarehouseId);
  const activeBatches = receipts.filter((receipt) =>
    ["received", "verified", "available", "partially_reserved", "reserved", "partially_sold"].includes(receipt.status),
  );
  const totalDueAmount = sales
    .filter((sale) => sale.paymentStatus === "pending" || sale.paymentStatus === "part_paid")
    .reduce((total, sale) => total + sale.netAmountDueToFarmer, 0);
  const totalAccruedFees = receipts.reduce((total, receipt) => total + (receipt.storageFeeAccrued ?? 0), 0);
  const pendingPayoutAmount = payouts
    .filter((payout) => payout.status !== "paid" && payout.status !== "cancelled")
    .reduce((total, payout) => total + payout.amount, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div className="home-header">
        <p className="eyebrow">Farmer portal</p>
        <h1>{farmer.fullName}</h1>
        <div className="home-warehouse">
          <MapPin size={16} />
          <span>{warehouse?.name ?? farmer.community}</span>
        </div>
      </div>

      {totalAccruedFees > 0 && (
        <div className="attention-card">
          <AlertTriangle className="attention-icon" size={24} />
          <div className="attention-body">
            <span className="attention-title">Storage fees accruing</span>
            <span className="attention-text">GHS {totalAccruedFees.toFixed(2)} is currently tracked and will be settled through sale deductions or fee updates.</span>
            <Link href="/farmer/fees" style={{ fontSize: "0.875rem", fontWeight: 700, textDecoration: "underline" }}>View details</Link>
          </div>
        </div>
      )}

      <div className="summary-strip">
        <div className="summary-card">
          <span className="summary-label">Stored Batches</span>
          <span className="summary-value">{activeBatches.length}</span>
        </div>
        <div className="summary-card" style={{ borderLeftColor: "var(--color-primary)" }}>
          <span className="summary-label">Payouts Pending</span>
          <span className="summary-value" style={{ color: "var(--color-primary)" }}>GHS {pendingPayoutAmount.toFixed(2)}</span>
        </div>
      </div>

      <div className="summary-strip">
        <div className="summary-card">
          <span className="summary-label">Sales Due</span>
          <span className="summary-value">GHS {totalDueAmount.toFixed(2)}</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">Dispatch Updates</span>
          <span className="summary-value">{dispatches.length}</span>
        </div>
      </div>

      <section>
        <div className="section-title-row">
          <h2 className="section-title">My Produce</h2>
          <Link href="/farmer/produce" className="section-link">See all</Link>
        </div>
        <div className="compact-list" style={{ marginTop: "8px" }}>
          {receipts.length === 0 ? (
            <div className="compact-row">
              <div className="row-info">
                <span className="row-title">No receipts yet</span>
                <span className="row-subtitle">Warehouse receipts will appear after intake.</span>
              </div>
            </div>
          ) : (
            receipts.slice(0, 3).map((receipt) => (
              <Link href={`/farmer/receipts/${receipt._id}`} key={receipt._id} className="compact-row">
                <div className="row-left">
                  <div className="row-icon-wrapper"><Sprout size={18} /></div>
                  <div className="row-info">
                    <span className="row-title">{receipt.cropType}</span>
                    <span className="row-subtitle">{receipt.quantityAvailable} {receipt.unit} available</span>
                  </div>
                </div>
                <span className={`status-chip status-${statusClass(receipt.status)}`}>{receipt.status.replaceAll("_", " ")}</span>
              </Link>
            ))
          )}
        </div>
      </section>

      <section>
        <div className="section-title-row">
          <h2 className="section-title">Recent Receipts</h2>
          <Link href="/farmer/receipts" className="section-link">See all</Link>
        </div>
        <div className="compact-list" style={{ marginTop: "8px" }}>
          {receipts.slice(0, 2).map((receipt) => (
            <Link href={`/farmer/receipts/${receipt._id}`} key={receipt._id} className="compact-row">
              <div className="row-left">
                <div className="row-icon-wrapper" style={{ backgroundColor: "#f1f5f9", color: "#475569" }}><FileText size={18} /></div>
                <div className="row-info">
                  <span className="row-title" style={{ fontFamily: "var(--font-mono)" }}>{receipt.receiptCode}</span>
                  <span className="row-subtitle">Received {new Date(receipt.receivedAt).toLocaleDateString()}</span>
                </div>
              </div>
              <ChevronRight size={18} style={{ color: "var(--color-line)" }} />
            </Link>
          ))}
        </div>
      </section>

      {dispatches.length > 0 && (
        <section>
          <div className="section-title-row"><h2 className="section-title">Dispatch Status</h2></div>
          <div className="compact-list" style={{ marginTop: "8px" }}>
            {dispatches.map((dispatch) => (
              <div key={dispatch.dispatchId} className="compact-row">
                <div className="row-info">
                  <span className="row-title">{dispatch.destination}</span>
                  <span className="row-subtitle">{dispatch.quantity} {dispatch.unit}</span>
                </div>
                <span className={`status-chip status-${statusClass(dispatch.status)}`}>{dispatch.status.replaceAll("_", " ")}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {notifications !== undefined && notifications.length > 0 && (
        <section>
          <div className="section-title-row"><h2 className="section-title">Notifications</h2></div>
          <div className="compact-list" style={{ marginTop: "8px" }}>
            {notifications.map((notification) => (
              <div key={notification._id} className="compact-row">
                <div className="row-left">
                  <div className="row-icon-wrapper"><Bell size={18} /></div>
                  <div className="row-info">
                    <span className="row-title">{notification.title}</span>
                    <span className="row-subtitle">{notification.message}</span>
                    {notification.dueAt !== undefined && <span className="row-subtitle">Due {new Date(notification.dueAt).toLocaleString()}</span>}
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "6px" }}>
                      {notification.actionUrl !== undefined && <Link href={notification.actionUrl} className="btn btn-secondary">Open</Link>}
                      {notification.status !== "read" && principal !== null && principal !== undefined && (
                        <button type="button" className="btn btn-secondary" onClick={() => void markNotificationRead({ actorUserId: principal.userId as Id<"users">, notificationId: notification._id })}>Mark read</button>
                      )}
                      {notification.actionRequired === true && notification.acknowledgedAt === undefined && principal !== null && principal !== undefined && (
                        <button type="button" className="btn btn-primary" onClick={() => void acknowledgeNotification({ actorUserId: principal.userId as Id<"users">, notificationId: notification._id })}>Acknowledge</button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "10px" }}>
        <Link href="/farmer/contact" style={{ width: "100%" }}>
          <button type="button" className="btn btn-secondary btn-full"><Phone size={18} /><span>Contact Warehouse</span></button>
        </Link>
        <Link href="/farmer/issue" style={{ width: "100%" }}>
          <button type="button" className="btn btn-secondary btn-full"><HelpCircle size={18} /><span>Report an Issue</span></button>
        </Link>
      </div>
    </div>
  );
}
