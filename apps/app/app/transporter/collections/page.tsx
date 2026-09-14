"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { ArrowRight, CalendarClock, MapPin, Truck } from "lucide-react";
import type { Id } from "@convex/_generated/dataModel";
import { api } from "@convex/_generated/api";

type DriverJob = {
  planId: Id<"pilotFulfilmentPlans">;
  programmeName: string;
  dataMode: "live" | "sample_only";
  status: string;
  plannedGrams: number;
  completedStops: number;
  totalStops: number;
  collectionWindowStartAt: number;
  destination: { label: string };
  vehicleRegistration?: string;
};

export default function DriverCollectionsPage() {
  const jobs = useQuery(api.pilotFulfilment.listDriverJobs, { limit: 30 }) as { page: DriverJob[] } | undefined;
  const demoPresentation = process.env.NEXT_PUBLIC_DEMO_PRESENTATION === "true";
  const visibleJobs = jobs?.page.filter((job) =>
    demoPresentation ? job.dataMode === "sample_only" : job.dataMode === "live",
  );

  return (
    <div className="driver-page">
      <header className="driver-page-head"><p className="eyebrow">Demand-led maize sourcing</p><h1>Collection jobs</h1><p>Only routes assigned to your verified driver account appear here.</p></header>
      {visibleJobs === undefined ? <div className="skeleton" style={{ minHeight: 280, borderRadius: 20 }} /> : visibleJobs.length === 0 ? <div className="driver-empty"><Truck size={30} /><h2>No collection assigned</h2><p>Warehouse dispatches remain available in the separate Dispatches tab.</p></div> : (
        <div className="driver-job-list">
          {visibleJobs.map((job) => (
            <Link key={job.planId} href={`/transporter/collections/${job.planId}`} className="driver-job-card">
              <div className="driver-job-top"><span className="driver-job-icon"><Truck size={21} /></span><div><strong>{(job.plannedGrams / 1_000).toLocaleString()} kg maize</strong><span>{job.programmeName}</span></div><span className={`status-chip status-${job.status === "ready" || job.status === "delivered" ? "success" : "warning"}`}>{job.status.replaceAll("_", " ")}</span></div>
              <div className="driver-job-meta"><span><MapPin size={15} /> {job.destination.label}</span><span><CalendarClock size={15} /> {new Date(job.collectionWindowStartAt).toLocaleString("en-GH")}</span></div>
              <div className="driver-job-foot"><span>{job.completedStops} of {job.totalStops} stops complete</span><ArrowRight size={18} /></div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
