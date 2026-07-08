"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { ChevronRight, Search, Truck } from "lucide-react";
import { useAuth } from "../../auth/AuthProvider";

type DispatchListItem = {
  _id: string;
  destination: string;
  status: string;
  totalQuantity: number;
  unit: string;
  plannedDepartureAt?: number;
  expectedArrivalAt?: number;
  createdAt: number;
};

function statusClass(status: string) {
  if (["delivered", "closed"].includes(status)) return "success";
  if (["cancelled", "issue_reported"].includes(status)) return "danger";
  if (["planned", "loading", "departed", "in_transit", "arrived"].includes(status)) return "warning";
  return "neutral";
}

export default function TransporterDispatchesPage() {
  const { principal } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const dispatches = useQuery(
    api.dispatches.listAssignedToTransporter,
    principal !== null && principal !== undefined ? { actorUserId: principal.userId as Id<"users">, limit: 50 } : "skip",
  ) as DispatchListItem[] | undefined;

  const filtered = (dispatches ?? []).filter((dispatch) =>
    `${dispatch.destination} ${dispatch.status}`.toLowerCase().includes(searchQuery.trim().toLowerCase()),
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div>
        <p className="eyebrow">My work</p>
        <h1>Dispatch Assignments</h1>
      </div>

      <div style={{ position: "relative" }}>
        <Search size={18} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)" }} />
        <input
          type="text"
          placeholder="Search destination or status..."
          className="form-input"
          style={{ paddingLeft: "42px" }}
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
        />
      </div>

      {dispatches === undefined ? (
        <div className="skeleton" style={{ height: "280px", borderRadius: "20px" }} />
      ) : filtered.length === 0 ? (
        <div className="farmer-card">
          <span className="card-title">No dispatches found</span>
          <span className="card-meta">Assignments from warehouse operations will appear here.</span>
        </div>
      ) : (
        <div className="compact-list">
          {filtered.map((dispatch) => (
            <Link href={`/transporter/dispatches/${dispatch._id}`} key={dispatch._id} className="farmer-card">
              <div className="card-header">
                <span className="card-title">
                  <Truck size={20} />
                  {dispatch.destination}
                </span>
                <span className={`status-chip status-${statusClass(dispatch.status)}`}>
                  {dispatch.status.replaceAll("_", " ")}
                </span>
              </div>
              <div className="card-meta">
                {dispatch.totalQuantity} {dispatch.unit}
                <br />
                Pickup: {dispatch.plannedDepartureAt === undefined ? "Not scheduled" : new Date(dispatch.plannedDepartureAt).toLocaleString()}
              </div>
              <div className="card-details">
                <span>Expected arrival</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontWeight: 700 }}>
                  {dispatch.expectedArrivalAt === undefined ? "Not set" : new Date(dispatch.expectedArrivalAt).toLocaleDateString()}
                  <ChevronRight size={16} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
