"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { ChevronRight, HandCoins, Wheat } from "lucide-react";
import { useAuth } from "@/app/auth/AuthProvider";
import { farmerCopy } from "../copy";
import { EmptyCard, Fact, formatDate, StatusChip } from "../farmer-ui";

type Receipt = {
  _id: string;
  cropType: string;
  grade?: string;
  quantityAvailable: number;
  quantityReceived: number;
  unit: string;
  status: string;
  receivedAt: number;
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

function isMaize(cropType?: string): boolean {
  return cropType?.trim().toLowerCase() === "maize";
}

export default function ProducePage() {
  const { principal } = useAuth();
  const farmerProfile = principal?.profiles?.find((profile) => profile.profileType === "farmer");
  const farmerId = farmerProfile?.profileId as Id<"farmers"> | undefined;
  const actorUserId = principal?.userId as Id<"users"> | undefined;
  const receipts = useQuery(
    api.inventoryBatches.listFarmerReceipts,
    actorUserId !== undefined && farmerId !== undefined ? { actorUserId, farmerId, limit: 50 } : "skip",
  ) as Receipt[] | undefined;
  const sales = useQuery(
    api.sales.listForFarmer,
    actorUserId !== undefined && farmerId !== undefined ? { actorUserId, farmerId, limit: 20 } : "skip",
  ) as Sale[] | undefined;

  if (receipts === undefined || sales === undefined) {
    return <div className="skeleton" style={{ minHeight: "420px", borderRadius: "20px" }} />;
  }

  const maize = receipts.filter((receipt) => isMaize(receipt.cropType));
  const available = maize.reduce((total, receipt) => total + Math.max(0, receipt.quantityAvailable), 0);
  const received = maize.reduce((total, receipt) => total + Math.max(0, receipt.quantityReceived), 0);
  const maizeSales = sales.filter((sale) => isMaize(sale.batch?.cropType)).sort((left, right) => right.createdAt - left.createdAt);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      <div>
        <p className="eyebrow">{farmerCopy.maize.eyebrow}</p>
        <h1>{farmerCopy.maize.title}</h1>
        <p className="card-meta" style={{ marginTop: "6px" }}>{farmerCopy.maize.intro}</p>
      </div>

      <section className="summary-strip" aria-label="Maize totals">
        <div className="summary-card" style={{ borderLeftColor: "var(--color-primary)" }}>
          <span className="summary-label">{farmerCopy.maize.available}</span>
          <span className="summary-value">{available.toLocaleString("en-GH")} kg</span>
        </div>
        <div className="summary-card">
          <span className="summary-label">{farmerCopy.maize.received}</span>
          <span className="summary-value">{received.toLocaleString("en-GH")} kg</span>
        </div>
      </section>

      {maize.length === 0 ? (
        <EmptyCard title={farmerCopy.maize.noMaize} hint={farmerCopy.maize.noMaizeHint} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {maize.map((receipt) => (
            <Link href={`/farmer/receipts/${receipt._id}`} key={receipt._id} className="farmer-card" style={{ color: "inherit" }}>
              <div className="card-header">
                <span className="card-title"><Wheat size={18} />Maize</span>
                <StatusChip value={receipt.status} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "14px" }}>
                <Fact label={farmerCopy.maize.available}>{receipt.quantityAvailable.toLocaleString("en-GH")} {receipt.unit}</Fact>
                <Fact label={farmerCopy.maize.quality}>Grade {receipt.grade ?? "Not set"}</Fact>
                <Fact label={farmerCopy.maize.received}>{receipt.quantityReceived.toLocaleString("en-GH")} {receipt.unit}</Fact>
                <Fact label={farmerCopy.maize.added}>{formatDate(receipt.receivedAt)}</Fact>
              </div>
              <div className="card-details">
                <span>{farmerCopy.maize.viewRecord}</span>
                <ChevronRight size={18} aria-hidden="true" />
              </div>
            </Link>
          ))}
        </div>
      )}

      <section id="offers" style={{ display: "flex", flexDirection: "column", gap: "12px", scrollMarginTop: "90px" }} aria-labelledby="offers-title">
        <div className="section-title-row">
          <h2 id="offers-title" className="section-title"><HandCoins size={18} /> Offers</h2>
        </div>
        {maizeSales.length === 0 ? (
          <EmptyCard title={farmerCopy.offers.noOffers} hint={farmerCopy.offers.noOffersHint} />
        ) : (
          maizeSales.map((sale) => (
            <div key={sale._id} className="farmer-card">
              <div className="card-header">
                <span className="card-title">Maize offer</span>
                <StatusChip value={sale.paymentStatus} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "14px" }}>
                <Fact label={farmerCopy.offers.acceptedQuantity}>{sale.quantitySold.toLocaleString("en-GH")} {sale.unit}</Fact>
                <Fact label={farmerCopy.offers.price}>GHS {sale.pricePerUnit.toFixed(2)} / {sale.unit}</Fact>
                <Fact label={farmerCopy.offers.netAmount}>GHS {sale.netAmountDueToFarmer.toFixed(2)}</Fact>
                <Fact label="Recorded">{formatDate(sale.createdAt)}</Fact>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
