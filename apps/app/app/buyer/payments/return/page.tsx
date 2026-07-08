"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle, LoaderCircle } from "lucide-react";
import type { User } from "firebase/auth";
import { useAuth } from "@/app/auth/AuthProvider";
import { verifyBuyerPayment } from "../../paymentApi";

function PaymentReturnContent() {
  const searchParams = useSearchParams();
  const { firebaseUser } = useAuth();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Verifying your payment with the provider.");

  const buyerOrderId = searchParams.get("buyerOrderId");
  const reference =
    searchParams.get("reference") ??
    searchParams.get("trxref") ??
    searchParams.get("paymentReference");
  const blockingMessage =
    firebaseUser === null
      ? "Please sign in again to verify this payment."
      : reference === null || reference.trim().length === 0
        ? "The payment provider did not return a reference."
        : null;

  useEffect(() => {
    const currentUser = firebaseUser;
    const paymentReference = reference;
    if (blockingMessage !== null || currentUser === null || paymentReference === null) {
      return;
    }
    const verifiedUser: User = currentUser;
    const verifiedReference: string = paymentReference;

    let cancelled = false;
    async function verify() {
      try {
        const result = await verifyBuyerPayment({ firebaseUser: verifiedUser, reference: verifiedReference });
        if (cancelled) {
          return;
        }
        setStatus(result.status === "successful" ? "success" : "error");
        setMessage(`Payment status: ${result.status.replace(/_/g, " ")}.`);
      } catch (error) {
        if (cancelled) {
          return;
        }
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Payment verification failed.");
      }
    }

    void verify();
    return () => {
      cancelled = true;
    };
  }, [blockingMessage, firebaseUser, reference]);

  const orderHref = buyerOrderId === null ? "/buyer/orders" : `/buyer/orders/${buyerOrderId}`;
  const displayStatus = blockingMessage === null ? status : "error";
  const displayMessage = blockingMessage ?? message;

  return (
    <div style={{ display: "flex", flex: "1 0 auto", flexDirection: "column", gap: "20px" }}>
      <div>
        <p className="eyebrow">Payment Return</p>
        <h1>Payment Status</h1>
      </div>

      <div className="attention-card" style={{ backgroundColor: displayStatus === "error" ? "var(--color-danger-bg)" : "var(--color-info-bg)", borderColor: displayStatus === "error" ? "var(--color-danger-border)" : "var(--color-info-border)" }}>
        {displayStatus === "loading" && <LoaderCircle className="attention-icon" size={24} />}
        {displayStatus === "success" && <CheckCircle className="attention-icon" size={24} style={{ color: "var(--color-success)" }} />}
        {displayStatus === "error" && <AlertTriangle className="attention-icon" size={24} style={{ color: "var(--color-danger)" }} />}
        <div className="attention-body">
          <span className="attention-title">
            {displayStatus === "loading" ? "Verifying payment" : displayStatus === "success" ? "Payment verified" : "Payment needs attention"}
          </span>
          <span className="attention-text">{displayMessage}</span>
        </div>
      </div>

      <Link href={orderHref} className="btn btn-primary btn-full">
        View Order
      </Link>
    </div>
  );
}

export default function PaymentReturnPage() {
  return (
    <Suspense fallback={<div className="skeleton" style={{ width: "100%", height: "160px", borderRadius: "16px" }} />}>
      <PaymentReturnContent />
    </Suspense>
  );
}
