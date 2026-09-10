"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { ArrowLeft, CheckCircle2, Clock3, MapPin, PackageCheck, Phone, Truck } from "lucide-react";
import type { Id } from "@convex/_generated/dataModel";
import { api } from "@convex/_generated/api";
import { CustodyAction, type PurchaseCollectionBundle } from "../CustodyAction";
import { DiscrepancyForm } from "../DiscrepancyForm";

type Props = { params: Promise<{ id: string }> };
type DriverLot = {
  lotId: Id<"pilotProcurementLots">;
  lotCode: string;
  commercialMode: "coordination" | "kuapa_purchase";
  clearedGrams: number;
  qualityStatus: string;
  dispositionStatus: string;
  version: number;
  farmer: { fullName: string; phoneNumber: string; community: string };
  milestones: string[];
  purchaseCollection: PurchaseCollectionBundle | null;
};
type DriverStop = {
  stopId: Id<"pilotFulfilmentStops">;
  sequence: number;
  stopType: "collection" | "facility" | "destination";
  location: { label: string; address?: string };
  packagingNotes?: string;
  plannedGrams: number;
  collectedGrams: number;
  windowStartAt: number;
  windowEndAt: number;
  status: string;
  lots: DriverLot[];
};
type DriverJob = {
  plan: {
    planId: Id<"pilotFulfilmentPlans">;
    status: string;
    plannedGrams: number;
    vehicleRegistration?: string;
    version: number;
  };
  programme: { name: string; dataMode: "live" | "sample_only" };
  destination: { label: string };
  stops: DriverStop[];
  buyerAcceptanceStatus: "pending" | "recorded";
};

export default function DriverCollectionDetailPage({ params }: Props) {
  const { id } = use(params);
  const job = useQuery(api.pilotFulfilment.getDriverJob, { planId: id as Id<"pilotFulfilmentPlans"> }) as DriverJob | undefined;

  if (job === undefined) return <div className="skeleton" style={{ minHeight: 430, borderRadius: 20 }} />;
  const destinationStop = job.stops.find((stop) => stop.stopType === "destination");

  return (
    <div className="driver-page">
      <Link href="/transporter/collections" className="driver-back"><ArrowLeft size={16} /> Collection jobs</Link>
      {job.programme.dataMode === "sample_only" ? <div className="driver-sample-banner">SAMPLE DATA · No real collection or payment</div> : null}
      <header className="driver-route-head"><div><p className="eyebrow">{job.programme.name}</p><h1>{(job.plan.plannedGrams / 1_000).toLocaleString()} kg route</h1><p><Truck size={15} /> {job.plan.vehicleRegistration ?? "Vehicle not recorded"}</p></div><span className={`status-chip status-${job.plan.status === "ready" || job.plan.status === "delivered" ? "success" : "warning"}`}>{job.plan.status.replaceAll("_", " ")}</span></header>

      <section className="driver-handover-status">
        <div><PackageCheck size={20} /><span><strong>Driver handover</strong>{job.plan.status === "delivered" ? "Recorded" : "In progress"}</span></div>
        <div><CheckCircle2 size={20} /><span><strong>Buyer acceptance</strong>{job.buyerAcceptanceStatus === "recorded" ? "Recorded by buyer" : "Pending buyer review"}</span></div>
      </section>

      <div className="driver-stop-list">
        {[...job.stops].sort((a, b) => a.sequence - b.sequence).map((stop) => (
          <section key={stop.stopId} className={`driver-stop-card ${stop.stopType === "destination" ? "destination" : ""}`}>
            <div className="driver-stop-number">{stop.sequence}</div>
            <div className="driver-stop-content">
              <div className="driver-stop-head"><div><p className="eyebrow">{stop.stopType === "collection" ? "Collection" : "Delivery"}</p><h2>{stop.location.label}</h2></div><span className={`status-chip status-${stop.status === "completed" ? "success" : "warning"}`}>{stop.status}</span></div>
              <div className="driver-stop-meta"><span><Clock3 size={15} /> {new Date(stop.windowStartAt).toLocaleString("en-GH")} – {new Date(stop.windowEndAt).toLocaleTimeString("en-GH", { hour: "2-digit", minute: "2-digit" })}</span><span><MapPin size={15} /> {stop.location.address ?? stop.location.label}</span><span><PackageCheck size={15} /> {stop.packagingNotes ?? "Keep inspected lot identity visible at handover."}</span></div>
              {stop.stopType === "destination" ? <div className="driver-destination-note"><strong>Destination handover</strong><p>Arrival does not mean the buyer accepted quality or quantity. The buyer records acceptance separately.</p></div> : stop.lots.map((lot) => (
                <article key={lot.lotId} className="driver-lot-card">
                  <div className="driver-lot-head"><div><strong>{lot.lotCode}</strong><span>{(lot.clearedGrams / 1_000).toLocaleString()} kg cleared · {lot.qualityStatus}</span></div><span className="status-chip status-success">approved lot</span></div>
                  <div className="driver-contact"><div><strong>{lot.farmer.fullName}</strong><span>{lot.farmer.community}</span></div><a href={`tel:${lot.farmer.phoneNumber}`} className="btn btn-secondary"><Phone size={16} /> Call</a></div>
                  <CustodyAction planId={job.plan.planId} planVersion={job.plan.version} planStatus={job.plan.status} collectionStopId={stop.stopId} destinationStopId={destinationStop?.stopId} lot={lot} />
                  <DiscrepancyForm planId={job.plan.planId} stopId={stop.stopId} lotId={lot.lotId} clearedGrams={lot.clearedGrams} />
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
