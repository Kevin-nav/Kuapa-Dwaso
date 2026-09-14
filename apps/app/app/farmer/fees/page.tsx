"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { ArrowRight, WalletCards } from "lucide-react";
import { useAuth } from "@/app/auth/AuthProvider";
import { farmerCopy } from "../copy";
import { EmptyCard, Fact, formatDate, formatMoney, StatusChip } from "../farmer-ui";

type Sale = {
  _id: string;
  quantitySold: number;
  unit: string;
  netAmountDueToFarmer: number;
  paymentStatus: string;
  createdAt: number;
  batch?: { cropType?: string } | null;
};

type Payout = {
  _id: string;
  saleRecordId?: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: number;
  paidAt?: number;
};

function isMaize(cropType?: string): boolean {
  return cropType?.trim().toLowerCase() === "maize";
}

export default function PaymentsPage() {
  const { principal } = useAuth();
  const farmerProfile = principal?.profiles?.find((profile) => profile.profileType === "farmer");
  const farmerId = farmerProfile?.profileId as Id<"farmers"> | undefined;
  const actorUserId = principal?.userId as Id<"users"> | undefined;
  const sales = useQuery(
    api.sales.listForFarmer,
    actorUserId !== undefined && farmerId !== undefined ? { actorUserId, farmerId, limit: 50 } : "skip",
  ) as Sale[] | undefined;
  const payouts = useQuery(
    api.payments.listPayoutLedgerForFarmer,
    actorUserId !== undefined && farmerId !== undefined ? { actorUserId, farmerId, limit: 50 } : "skip",
  ) as Payout[] | undefined;

  if (sales === undefined || payouts === undefined) {
    return <div className="skeleton" style={{ minHeight: "420px", borderRadius: "20px" }} />;
  }

  const maizeSales = sales.filter((sale) => isMaize(sale.batch?.cropType));
  const due = maizeSales
    .filter((sale) => sale.paymentStatus !== "paid")
    .reduce((total, sale) => total + sale.netAmountDueToFarmer, 0);
  const paid = payouts
    .filter((payout) => payout.status === "paid")
    .reduce((total, payout) => total + payout.amount, 0);
  const recentPayments = [...payouts]
    .filter((payout) => payout.saleRecordId === undefined || maizeSales.some((sale) => sale._id === payout.saleRecordId))
    .sort((left, right) => right.createdAt - left.createdAt);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      <div>
        <p className="eyebrow">{farmerCopy.payments.eyebrow}</p>
        <h1>{farmerCopy.payments.title}</h1>
        <p className="card-meta" style={{ marginTop: "6px" }}>{farmerCopy.payments.intro}</p>
      </div>

      <section className="summary-strip" aria-label="Payment totals">
        <div className="summary-card" style={{ borderLeftColor: "var(--color-primary)" }}>
          <span className="summary-label">{farmerCopy.payments.due}</span>
          <span className="summary-value">{formatMoney(due)}</span>
        </div>
        <div className="summary-card" style={{ borderLeftColor: "var(--color-success)" }}>
          <span className="summary-label">{farmerCopy.payments.paid}</span>
          <span className="summary-value" style={{ color: "var(--color-success)" }}>{formatMoney(paid)}</span>
        </div>
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: "12px" }} aria-labelledby="payment-history-title">
        <div className="section-title-row">
          <h2 id="payment-history-title" className="section-title"><WalletCards size={18} /> {farmerCopy.payments.paymentHistory}</h2>
        </div>
        {recentPayments.length === 0 ? (
          <EmptyCard title={farmerCopy.payments.noPayments} hint={farmerCopy.payments.noPaymentsHint} />
        ) : (
          recentPayments.map((payout) => (
            <div key={payout._id} className="farmer-card">
              <div className="card-header">
                <span className="card-title">Maize payment</span>
                <StatusChip value={payout.status} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "14px" }}>
                <Fact label="Amount">{formatMoney(payout.amount, payout.currency)}</Fact>
                <Fact label="Date">{formatDate(payout.paidAt ?? payout.createdAt)}</Fact>
              </div>
              {payout.saleRecordId !== undefined ? (
                <Link href={`/farmer/produce#offers`} className="card-details" style={{ color: "var(--color-primary)" }}>
                  <span>{farmerCopy.payments.viewOffer}</span>
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              ) : null}
            </div>
          ))
        )}
      </section>
    </div>
  );
}
