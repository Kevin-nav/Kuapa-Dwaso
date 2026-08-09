"use client";

import { use, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useAuth } from "@/app/auth/AuthProvider";
import { ArrowLeft, Phone, AlertTriangle, CheckCircle, Clipboard, CreditCard } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Id } from "@convex/_generated/dataModel";
import { initializeBuyerOrderPayment } from "../../paymentApi";

type Props = {
  params: Promise<{ id: string }>;
};

type OrderCharge = {
  label: string;
  amount: number;
};

type OrderReservation = {
  _id: string;
  quantityReserved: number;
  unit: string;
  status: string;
  expiresAt?: number;
};

type PaymentTransaction = {
  _id: string;
  provider: string;
  providerReference: string;
  authorizationUrl?: string;
  amount: number;
  currency: string;
  status: string;
  providerMessage?: string;
  createdAt: number;
  updatedAt: number;
};

type BuyerOrderDetail = {
  _id: string;
  cropType: string;
  preferredGrade?: string;
  requestedQuantity: number;
  unit: string;
  destinationMarket: string;
  subtotalAmount?: number;
  transportFee?: number;
  serviceFee?: number;
  totalAmount?: number;
  paymentStatus: string;
  status: string;
  createdAt: number;
  reservations?: OrderReservation[];
  charges?: OrderCharge[];
  payments?: PaymentTransaction[];
  deliveryDateSnapshot?: number;
  orderCutoffSnapshot?: number;
  expectedArrivalStartSnapshot?: number;
  expectedArrivalEndSnapshot?: number;
  fulfilmentInstructionsSnapshot?: string;
  paymentDeadline?: number;
  marketDeliveryRun?: { status: string; timezone: string; postponementReason?: string; cancellationReason?: string } | null;
};

export default function OrderDetailPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();
  const { firebaseUser, principal } = useAuth();
  const [copied, setCopied] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [isInitializingPayment, setIsInitializingPayment] = useState(false);

  // Retrieve order details
  const orderDetails = useQuery(
    api.buyerOrders.getById,
    principal !== null && principal !== undefined
      ? { actorUserId: principal.userId as Id<"users">, buyerOrderId: id as Id<"buyerOrders"> }
      : "skip"
  ) as BuyerOrderDetail | null | undefined;

  const currentOrder = orderDetails;

  if (currentOrder === undefined) {
    return (
      <div style={{ display: "flex", flex: "1 0 auto", flexDirection: "column", gap: "20px", padding: "20px" }}>
        <p>Loading order details...</p>
      </div>
    );
  }

  if (currentOrder === null) {
    return (
      <div style={{ display: "flex", flex: "1 0 auto", flexDirection: "column", gap: "20px" }}>
        <button type="button" className="btn btn-secondary" onClick={() => router.push("/buyer/orders")}>
          <ArrowLeft size={18} />
          <span>Back to Orders</span>
        </button>
        <div className="attention-card" style={{ backgroundColor: "var(--color-danger-bg)", borderColor: "var(--color-danger-border)", color: "var(--color-danger)" }}>
          <AlertTriangle className="attention-icon" size={24} />
          <div className="attention-body">
            <span className="attention-title">Order not found</span>
            <span className="attention-text">This order could not be loaded for your buyer account.</span>
          </div>
        </div>
      </div>
    );
  }

  const handleCopy = () => {
    void navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Define steps mapping
  const steps = [
    { label: "Submitted", statuses: ["submitted"] },
    { label: "Confirmed", statuses: ["awaiting_payment", "confirmed", "matched_to_inventory"] },
    { label: "Reserved", statuses: ["reserved", "preparing", "ready_for_dispatch"] },
    { label: "In Transit", statuses: ["in_transit"] },
    { label: "Completed", statuses: ["delivered", "completed"] },
  ];

  // Find active step index based on order status
  let activeStepIndex = 0;
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (step !== undefined && step.statuses.includes(currentOrder.status)) {
      activeStepIndex = i;
      break;
    }
  }

  // Handle terminal abnormal statuses (cancelled, unfulfilled, disputed)
  const isAbnormal = ["cancelled", "unfulfilled", "disputed"].includes(currentOrder.status);

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

  const formattedDate = new Date(currentOrder.createdAt).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const latestPayment = currentOrder.payments?.[0];
  const canPay =
    currentOrder.totalAmount !== undefined &&
    currentOrder.totalAmount > 0 &&
    ["awaiting_payment", "failed", "deposit_paid"].includes(currentOrder.paymentStatus) &&
    !["cancelled", "unfulfilled", "disputed", "completed"].includes(currentOrder.status);

  const handlePay = async () => {
    if (firebaseUser === null) {
      setPaymentError("Please sign in again before starting payment.");
      return;
    }
    setIsInitializingPayment(true);
    setPaymentError(null);
    try {
      const callbackUrl = `${window.location.origin}/buyer/payments/return?buyerOrderId=${encodeURIComponent(id)}`;
      const initialized = await initializeBuyerOrderPayment({
        firebaseUser,
        buyerOrderId: id,
        callbackUrl,
      });
      if (initialized.authorizationUrl !== undefined) {
        window.location.assign(initialized.authorizationUrl);
        return;
      }
      router.refresh();
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : "Payment could not be initialized.");
    } finally {
      setIsInitializingPayment(false);
    }
  };

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
        <span>Back to Orders</span>
      </button>

      {/* Header */}
      <div>
        <p className="eyebrow">Order ID: #{id.substring(0, 8).toUpperCase()}</p>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <h1>
            {currentOrder.requestedQuantity} {currentOrder.unit} of {currentOrder.cropType}
          </h1>
          <span className={`status-chip ${getStatusClass(currentOrder.status)}`}>
            {currentOrder.status}
          </span>
        </div>
        <p style={{ marginTop: "4px", marginBottom: 0 }}>Submitted on {formattedDate}</p>
      </div>

      {/* Abnormal attention cards */}
      {isAbnormal && (
        <div className="attention-card" style={{ backgroundColor: "var(--color-danger-bg)", borderColor: "var(--color-danger-border)", color: "var(--color-danger)" }}>
          <AlertTriangle className="attention-icon" size={24} />
          <div className="attention-body">
            <span className="attention-title">Order status: {currentOrder.status}</span>
            <span className="attention-text">
              {currentOrder.status === "unfulfilled" && "The order could not be matched due to insufficient stock. Support has been notified."}
              {currentOrder.status === "cancelled" && "This purchase order has been cancelled."}
              {currentOrder.status === "disputed" && "A dispute has been opened for this order. Verification is halted during resolution."}
            </span>
          </div>
        </div>
      )}

      <section style={{ background: "var(--color-info-bg)", border: "1px solid var(--color-info-border)", borderRadius: 14, padding: 16, display: "grid", gap: 8 }}>
        <strong>Published delivery promise</strong>
        <span><strong>Destination:</strong> {currentOrder.destinationMarket}</span>
        <span><strong>Delivery day:</strong> {currentOrder.deliveryDateSnapshot ? new Date(currentOrder.deliveryDateSnapshot).toLocaleDateString("en-GH", { dateStyle: "full", ...(currentOrder.marketDeliveryRun?.timezone === undefined ? {} : { timeZone: currentOrder.marketDeliveryRun.timezone }) }) : "Legacy order — operations will confirm"}</span>
        <span><strong>Expected arrival:</strong> {currentOrder.expectedArrivalStartSnapshot && currentOrder.expectedArrivalEndSnapshot ? `${new Date(currentOrder.expectedArrivalStartSnapshot).toLocaleTimeString("en-GH", { hour: "numeric", minute: "2-digit", ...(currentOrder.marketDeliveryRun?.timezone === undefined ? {} : { timeZone: currentOrder.marketDeliveryRun.timezone }) })}–${new Date(currentOrder.expectedArrivalEndSnapshot).toLocaleTimeString("en-GH", { hour: "numeric", minute: "2-digit", ...(currentOrder.marketDeliveryRun?.timezone === undefined ? {} : { timeZone: currentOrder.marketDeliveryRun.timezone }) })}` : "Operations will confirm"}</span>
        <span><strong>Order/payment deadline:</strong> {currentOrder.paymentDeadline ? new Date(currentOrder.paymentDeadline).toLocaleString("en-GH", { dateStyle: "medium", timeStyle: "short", ...(currentOrder.marketDeliveryRun?.timezone === undefined ? {} : { timeZone: currentOrder.marketDeliveryRun.timezone }) }) : "Not recorded for this legacy order"}</span>
        <span><strong>Collection instructions:</strong> {currentOrder.fulfilmentInstructionsSnapshot ?? "Contact support for the collection point."}</span>
        {currentOrder.marketDeliveryRun?.status === "cancelled" && <span style={{ color: "var(--color-danger)", fontWeight: 700 }}>This delivery run was cancelled or postponed. Your reservation remains visible while operations contacts you. {currentOrder.marketDeliveryRun.postponementReason ?? currentOrder.marketDeliveryRun.cancellationReason}</span>}
      </section>

      {/* Simple Timeline Status Tracker */}
      {!isAbnormal && (
        <div
          style={{
            backgroundColor: "var(--color-surface)",
            border: "1.5px solid var(--color-line)",
            borderRadius: "16px",
            padding: "20px 16px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <div style={{ fontWeight: "700", color: "var(--color-ink)", fontSize: "0.9375rem" }}>
            Fulfillment Journey
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "20px", position: "relative", paddingLeft: "26px" }}>
            {/* Vertical timeline connector line */}
            <div
              style={{
                position: "absolute",
                left: "9px",
                top: "10px",
                bottom: "10px",
                width: "2px",
                backgroundColor: "var(--color-line)",
                zIndex: 1,
              }}
            />

            {steps.map((step, index) => {
              const isPast = index < activeStepIndex;
              const isCurrent = index === activeStepIndex;
              const isFuture = index > activeStepIndex;

              return (
                <div key={step.label} style={{ display: "flex", alignItems: "flex-start", gap: "12px", position: "relative", zIndex: 2 }}>
                  <div
                    style={{
                      position: "absolute",
                      left: "-26px",
                      top: "2px",
                      width: "20px",
                      height: "20px",
                      borderRadius: "50%",
                      backgroundColor: isPast
                        ? "var(--color-primary)"
                        : isCurrent
                        ? "var(--color-primary)"
                        : "var(--color-surface)",
                      border: `2px solid ${isFuture ? "var(--color-line)" : "var(--color-primary)"}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {isPast && <CheckCircle size={12} style={{ color: "white" }} />}
                    {isCurrent && (
                      <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "white" }} />
                    )}
                  </div>

                  <div>
                    <span
                      style={{
                        fontWeight: isCurrent ? "800" : "600",
                        color: isFuture ? "var(--color-text-muted)" : "var(--color-ink)",
                        fontSize: "0.9375rem",
                      }}
                    >
                      {step.label}
                    </span>
                    {isCurrent && (
                      <div style={{ fontSize: "0.8125rem", color: "var(--color-primary)", marginTop: "2px", fontWeight: "700" }}>
                        Current status: {currentOrder.status.replace(/_/g, " ")}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Cost Invoice Details */}
      <div
        className="receipt-slip"
        style={{
          boxShadow: "0 4px 12px rgba(15, 31, 20, 0.02)",
        }}
      >
        <div className="slip-header">
          <span className="slip-title">PRODUCE INVOICE</span>
          <div className="slip-code" onClick={handleCopy} style={{ cursor: "pointer" }}>
            <span>Order #{id.substring(0, 8).toUpperCase()}</span>
            {copied ? <CheckCircle size={14} style={{ color: "var(--color-success)" }} /> : <Clipboard size={14} />}
          </div>
        </div>

        <div className="slip-body">
          <div className="slip-row">
            <span className="slip-label">Requested Quantity</span>
            <span className="slip-value">
              {currentOrder.requestedQuantity} {currentOrder.unit}
            </span>
          </div>
          <div className="slip-row">
            <span className="slip-label">Quality Grade</span>
            <span className="slip-value">Grade {currentOrder.preferredGrade}</span>
          </div>
          <div className="slip-row">
            <span className="slip-label">Destination Market</span>
            <span className="slip-value">{currentOrder.destinationMarket}</span>
          </div>
          <div className="slip-row">
            <span className="slip-label">Payment Status</span>
            <span className="slip-value" style={{ fontWeight: "700", color: "var(--color-warning)" }}>
              {currentOrder.paymentStatus.replace(/_/g, " ")}
            </span>
          </div>

          <div className="slip-divider" />

          {/* Charges breakdown */}
          <span className="slip-section-title">Order Math Details</span>

          <div className="slip-math-box" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {currentOrder.charges?.map((charge, idx) => (
              <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem" }}>
                <span className="slip-label">{charge.label}</span>
                <span className="card-math" style={{ fontVariantNumeric: "tabular-nums" }}>
                  GHS {charge.amount.toLocaleString()}
                </span>
              </div>
            ))}

            <div className="slip-divider" />

            <div className="slip-math-result" style={{ marginTop: "4px" }}>
              <span style={{ fontWeight: "700", color: "var(--color-ink)" }}>Total Cost</span>
              <span className="slip-math-total" style={{ fontVariantNumeric: "tabular-nums" }}>
                {currentOrder.totalAmount !== undefined || currentOrder.subtotalAmount !== undefined
                  ? `GHS ${(currentOrder.totalAmount ?? currentOrder.subtotalAmount)?.toLocaleString()}`
                  : "Pending pricing"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment action */}
      <div className="attention-card" style={{ backgroundColor: "var(--color-info-bg)", borderColor: "var(--color-info-border)" }}>
        <CreditCard className="attention-icon" size={24} style={{ color: "var(--color-primary)" }} />
        <div className="attention-body">
          <span className="attention-title">Payment</span>
          <span className="attention-text">
            {latestPayment !== undefined
              ? `Latest transaction ${latestPayment.providerReference} is ${latestPayment.status.replace(/_/g, " ")}.`
              : currentOrder.totalAmount === undefined
                ? "Payment will be available after warehouse pricing is complete."
                : `Pay securely through the platform payment provider${currentOrder.paymentDeadline ? ` before ${new Date(currentOrder.paymentDeadline).toLocaleString("en-GH", { dateStyle: "medium", timeStyle: "short", ...(currentOrder.marketDeliveryRun?.timezone === undefined ? {} : { timeZone: currentOrder.marketDeliveryRun.timezone }) })}` : ""}. If payment or connectivity is interrupted, return to this order and try again; your order details remain saved.`}
          </span>
          {latestPayment?.providerMessage !== undefined && (
            <span className="attention-text">{latestPayment.providerMessage}</span>
          )}
        </div>
      </div>

      {paymentError && (
        <div className="attention-card" style={{ backgroundColor: "var(--color-danger-bg)", borderColor: "var(--color-danger-border)", color: "var(--color-danger)" }}>
          <AlertTriangle className="attention-icon" size={24} />
          <div className="attention-body">
            <span className="attention-title">Payment could not start</span>
            <span className="attention-text">{paymentError}</span>
          </div>
        </div>
      )}

      {canPay && (
        <button
          type="button"
          className="btn btn-primary btn-full"
          disabled={isInitializingPayment}
          onClick={() => {
            void handlePay();
          }}
        >
          <CreditCard size={18} />
          <span>{isInitializingPayment ? "Starting payment..." : "Pay Order"}</span>
        </button>
      )}

      {/* Reservation & Fulfillment status info */}
      {currentOrder.reservations && currentOrder.reservations.length > 0 && (
        <div>
          <h3 className="section-title" style={{ marginBottom: "10px" }}>
            Locked Warehouse Reservations
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {currentOrder.reservations.map((res, idx) => (
              <div
                key={res._id || idx}
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
                  <div style={{ fontWeight: "700", color: "var(--color-ink)" }}>
                    {res.quantityReserved} {res.unit} Locked
                  </div>
                  <div style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", marginTop: "2px" }}>
                    {res.status === "active" ? `Reserved${res.expiresAt ? ` until ${new Date(res.expiresAt).toLocaleString("en-GH", { dateStyle: "medium", timeStyle: "short" })}` : ""}` : `Reservation: ${res.status.replaceAll("_", " ")}`}
                  </div>
                </div>
                <div className="status-chip status-success" style={{ textTransform: "capitalize" }}>
                  {res.status}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Support Details */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "10px" }}>
        <a href="tel:+233240000000" className="btn btn-primary btn-full">
          <Phone size={18} />
          <span>Call Warehouse Support</span>
        </a>
      </div>

      <p className="timestamp">Official transactional copy · Secured by Convex Cloud</p>
    </div>
  );
}
