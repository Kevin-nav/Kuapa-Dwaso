"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { ArrowRight, CalendarDays, CircleHelp, HandCoins, MapPin, Sprout, Wheat } from "lucide-react";
import { useAuth } from "@/app/auth/AuthProvider";
import { farmerCopy } from "./copy";
import { EmptyCard, Fact, formatDate, formatMoney, StatusChip } from "./farmer-ui";

type Farmer = {
  fullName?: string;
  community?: string;
  region?: string;
};

type Receipt = {
  _id: string;
  cropType: string;
  quantityAvailable: number;
  quantityReceived: number;
  unit: string;
  status: string;
  receivedAt: number;
  grade?: string;
};

type Sale = {
  _id: string;
  quantitySold: number;
  unit: string;
  pricePerUnit: number;
  netAmountDueToFarmer: number;
  paymentStatus: string;
  createdAt: number;
  batch?: { cropType?: string } | null;
};

type Payout = {
  _id: string;
  saleRecordId?: string;
  amount: number;
  status: string;
  paidAt?: number;
};

type Dispatch = {
  dispatchId: string;
  cropType?: string;
  status: string;
  quantity: number;
  unit: string;
  plannedDepartureAt?: number;
};

function isMaize(cropType?: string): boolean {
  return cropType?.trim().toLowerCase() === "maize";
}

function getFirstName(name?: string): string {
  return name?.trim().split(/\s+/)[0] ?? "there";
}

function getOpenMaizeDispatches(dispatches: Dispatch[]): Dispatch[] {
  return dispatches
    .filter((dispatch) => isMaize(dispatch.cropType) && !["delivered", "closed", "cancelled"].includes(dispatch.status))
    .sort((left, right) => (left.plannedDepartureAt ?? Number.MAX_SAFE_INTEGER) - (right.plannedDepartureAt ?? Number.MAX_SAFE_INTEGER));
}

export default function FarmerDashboard() {
  const { principal } = useAuth();
  const farmerProfile = principal?.profiles?.find((profile) => profile.profileType === "farmer");
  const farmerId = farmerProfile?.profileId as Id<"farmers"> | undefined;
  const actorUserId = principal?.userId as Id<"users"> | undefined;

  const farmer = useQuery(
    api.farmers.getById,
    actorUserId !== undefined && farmerId !== undefined ? { actorUserId, farmerId } : "skip",
  ) as Farmer | null | undefined;
  const receipts = useQuery(
    api.inventoryBatches.listFarmerReceipts,
    actorUserId !== undefined && farmerId !== undefined ? { actorUserId, farmerId, limit: 30 } : "skip",
  ) as Receipt[] | undefined;
  const sales = useQuery(
    api.sales.listForFarmer,
    actorUserId !== undefined && farmerId !== undefined ? { actorUserId, farmerId, limit: 20 } : "skip",
  ) as Sale[] | undefined;
  const payouts = useQuery(
    api.payments.listPayoutLedgerForFarmer,
    actorUserId !== undefined && farmerId !== undefined ? { actorUserId, farmerId, limit: 20 } : "skip",
  ) as Payout[] | undefined;
  const dispatches = useQuery(
    api.dispatches.listForFarmer,
    actorUserId !== undefined && farmerId !== undefined ? { actorUserId, farmerId, limit: 20 } : "skip",
  ) as Dispatch[] | undefined;

  if (farmer === undefined || receipts === undefined || sales === undefined || payouts === undefined || dispatches === undefined) {
    return <div className="skeleton" style={{ minHeight: "420px", borderRadius: "20px" }} />;
  }

  if (farmer === null) {
    return (
      <EmptyCard
        title="Your profile is not ready"
        hint="Finish signup so Kuapa Dwaso can record your maize and payments."
        action={<Link href="/signup" className="btn btn-primary">Continue signup</Link>}
      />
    );
  }

  const maizeReceipts = receipts.filter((receipt) => isMaize(receipt.cropType));
  const maizeSales = sales
    .filter((sale) => isMaize(sale.batch?.cropType))
    .sort((left, right) => right.createdAt - left.createdAt);
  const openDispatches = getOpenMaizeDispatches(dispatches);
  const pendingAmount = maizeSales
    .filter((sale) => sale.paymentStatus !== "paid")
    .reduce((total, sale) => total + sale.netAmountDueToFarmer, 0);
  const paidAmount = payouts
    .filter((payout) => payout.status === "paid")
    .reduce((total, payout) => total + payout.amount, 0);
  const availableQuantity = maizeReceipts.reduce((total, receipt) => total + Math.max(0, receipt.quantityAvailable), 0);
  const nextCollection = openDispatches[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      <header className="home-header">
        <p className="eyebrow">{farmerCopy.home.eyebrow}</p>
        <h1>{farmerCopy.home.welcome}, {getFirstName(farmer.fullName)}</h1>
        <p className="card-meta" style={{ maxWidth: "38rem" }}>See your maize, offers, next collection, and payments in one place.</p>
      </header>

      <section className="pilot-farmer-callout">
        <div><span className="pilot-buyer-kicker">Sell maize</span><h2>Have maize ready?</h2><p>Tell Kuapa Dwaso the quantity and location. You will see the full offer before collection.</p></div>
        <Link className="btn btn-primary" href="/farmer/supply"><Sprout size={18} /> Add maize</Link>
      </section>

      <section className="farmer-card" aria-labelledby="available-maize-title" style={{ borderColor: "var(--color-primary)", background: "linear-gradient(145deg, var(--color-surface), var(--color-primary-tint))" }}>
        <div className="card-header">
          <span id="available-maize-title" className="card-title"><Wheat size={19} />{farmerCopy.home.available}</span>
          <Link href="/farmer/produce" className="section-link">See all</Link>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: "8px", flexWrap: "wrap" }}>
          <strong style={{ fontSize: "2.15rem", color: "var(--color-ink)", lineHeight: 1 }}>{availableQuantity.toLocaleString("en-GH")}</strong>
          <span style={{ color: "var(--color-text-muted)", fontWeight: 700 }}>kg</span>
        </div>
        <span className="card-meta">{farmerCopy.home.availableHint}</span>
        <Link href="/farmer/produce" className="btn btn-primary btn-full">View my maize <ArrowRight size={17} /></Link>
      </section>

      <section className="farmer-card" aria-labelledby="next-collection-title">
        <div className="card-header">
          <span id="next-collection-title" className="card-title"><CalendarDays size={18} />{farmerCopy.home.nextCollection}</span>
          {nextCollection !== undefined ? <StatusChip value={nextCollection.status} /> : null}
        </div>
        {nextCollection === undefined ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <strong style={{ color: "var(--color-ink)" }}>{farmerCopy.home.noCollection}</strong>
            <span className="card-meta">{farmerCopy.home.collectionHint}</span>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "14px" }}>
            <Fact label="Date">{formatDate(nextCollection.plannedDepartureAt)}</Fact>
            <Fact label="Quantity">{nextCollection.quantity.toLocaleString("en-GH")} {nextCollection.unit}</Fact>
          </div>
        )}
        {nextCollection !== undefined ? <span className="card-meta">{farmerCopy.home.collectionHint}</span> : null}
        <Link href="/farmer/contact" className="section-link" style={{ alignSelf: "flex-start" }}>Ask about collection</Link>
      </section>

      <section className="farmer-card" aria-labelledby="latest-offer-title">
        <div className="card-header">
          <span id="latest-offer-title" className="card-title"><HandCoins size={18} />Offers</span>
          <Link href="/farmer/offers" className="section-link">See all</Link>
        </div>
        <p className="card-meta">Review Kuapa Dwaso offers, including quantity, price, collection, and payment date.</p>
        <Link href="/farmer/offers" className="btn btn-secondary btn-full">View offers <ArrowRight size={17} /></Link>
      </section>

      <section className="summary-strip" aria-label="Payment summary">
        <div className="summary-card">
          <span className="summary-label">{farmerCopy.home.payment}</span>
          <span className="summary-value">{formatMoney(pendingAmount)}</span>
          <span className="card-meta">{pendingAmount > 0 ? "Due to you" : farmerCopy.home.noPayment}</span>
        </div>
        <div className="summary-card" style={{ borderLeftColor: "var(--color-success)" }}>
          <span className="summary-label">Paid</span>
          <span className="summary-value" style={{ color: "var(--color-success)" }}>{formatMoney(paidAmount)}</span>
          <span className="card-meta">Recorded payments</span>
        </div>
      </section>

      <section className="attention-card" style={{ backgroundColor: "var(--color-info-bg)", borderColor: "var(--color-info-border)", color: "var(--color-info)" }}>
        <CircleHelp size={20} aria-hidden="true" />
        <div className="attention-body">
          <span className="attention-title">{farmerCopy.home.support}</span>
          <span className="attention-text">{farmerCopy.home.supportHint}</span>
          <Link href="/farmer/contact" className="section-link" style={{ alignSelf: "flex-start" }}>Contact us</Link>
        </div>
      </section>

      <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--color-text-muted)", fontSize: "0.82rem" }}>
        <MapPin size={14} aria-hidden="true" />
        <span>{farmer.community ?? farmer.region ?? "Ghana"}</span>
      </div>
    </div>
  );
}
