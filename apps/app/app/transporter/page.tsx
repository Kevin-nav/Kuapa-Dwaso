"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { AlertTriangle, Bell, CheckCircle2, ChevronRight, Clock, MapPin, Truck } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";

type DispatchListItem = {
  _id: string;
  destination: string;
  status: string;
  totalQuantity: number;
  unit: string;
  plannedDepartureAt?: number;
  expectedArrivalAt?: number;
};

function statusClass(status: string) {
  if (["verified", "active", "delivered", "closed"].includes(status)) return "success";
  if (["pending", "planned", "loading", "departed", "in_transit", "arrived"].includes(status)) return "warning";
  if (["rejected", "suspended", "cancelled", "issue_reported"].includes(status)) return "danger";
  return "neutral";
}

function formatDate(value?: number) {
  return value === undefined ? "Not scheduled" : new Date(value).toLocaleString();
}

export default function TransporterDashboard() {
  const { principal } = useAuth();
  const transporterProfileLink = principal?.profiles?.find((profile) => profile.profileType === "transporter");
  const transporterId = transporterProfileLink?.profileId as Id<"transporterProfiles"> | undefined;

  const profile = useQuery(
    api.transporters.getById,
    principal !== null && principal !== undefined && transporterId !== undefined
      ? { actorUserId: principal.userId as Id<"users">, transporterId }
      : "skip",
  );
  const dispatches = useQuery(
    api.dispatches.listAssignedToTransporter,
    principal !== null && principal !== undefined ? { actorUserId: principal.userId as Id<"users">, limit: 5 } : "skip",
  ) as DispatchListItem[] | undefined;
  const notifications = useQuery(
    api.notifications.listForActor,
    principal !== null && principal !== undefined ? { actorUserId: principal.userId as Id<"users">, limit: 3 } : "skip",
  );
  const truckEvidence = useQuery(
    api.uploads.listByRelatedEntity,
    principal !== null && principal !== undefined && transporterId !== undefined
      ? {
          actorUserId: principal.userId as Id<"users">,
          relatedEntityType: "transporter_profile",
          relatedEntityId: transporterId,
          purpose: "transporter_truck_photo",
          limit: 3,
        }
      : "skip",
  );

  if (profile === undefined || dispatches === undefined) {
    return <div className="skeleton" style={{ minHeight: "420px", borderRadius: "20px" }} />;
  }

  if (profile === null) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div className="attention-card">
          <AlertTriangle size={20} />
          <div className="attention-body">
            <span className="attention-title">Transporter profile needed</span>
            <span className="attention-text">Complete signup before dispatch assignments can appear here.</span>
          </div>
        </div>
        <Link href="/signup" className="btn btn-primary btn-full">Continue signup</Link>
      </div>
    );
  }

  const activeDispatches = dispatches.filter((dispatch) =>
    ["planned", "loading", "departed", "in_transit", "arrived", "issue_reported"].includes(dispatch.status),
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      <div className="home-header">
        <p className="eyebrow">Transporter portal</p>
        <h1>{profile.fullName}</h1>
        <div className="home-warehouse">
          <MapPin size={16} />
          <span>{profile.baseLocation}</span>
        </div>
      </div>

      <div className="farmer-card">
        <div className="card-header">
          <span className="card-title">
            <Truck size={20} />
            {profile.vehicleType}
          </span>
          <span className={`status-chip status-${statusClass(profile.verificationStatus)}`}>
            {profile.verificationStatus}
          </span>
        </div>
        <div className="card-meta">
          {profile.vehicleCapacity ?? "Capacity not set"} {profile.vehicleCapacityUnit ?? ""}
          <br />
          Routes: {profile.routesServed.join(", ")}
        </div>
        {profile.verificationStatus !== "verified" && (
          <div className="attention-card" style={{ backgroundColor: "var(--color-info-bg)", borderColor: "var(--color-info-border)" }}>
            <AlertTriangle size={18} />
            <div className="attention-body">
              <span className="attention-text">
                {profile.verificationStatus === "pending"
                  ? "Your transporter profile is pending approval. Keep truck evidence current while admins review it."
                  : "Your profile was rejected. Update evidence and wait for admin review."}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="summary-strip">
        <div className="summary-card">
          <span className="summary-label">Active Dispatches</span>
          <span className="summary-value">{activeDispatches.length}</span>
        </div>
        <div className="summary-card" style={{ borderLeftColor: "var(--color-primary)" }}>
          <span className="summary-label">Truck Photos</span>
          <span className="summary-value">{truckEvidence?.length ?? 0}</span>
        </div>
      </div>

      <div>
        <div className="section-title-row">
          <h2 className="section-title">Assigned Dispatches</h2>
          <Link href="/transporter/dispatches" className="section-link">See all</Link>
        </div>
        <div className="compact-list" style={{ marginTop: "8px" }}>
          {dispatches.length === 0 ? (
            <div className="compact-row">
              <div className="row-info">
                <span className="row-title">No assignments yet</span>
                <span className="row-subtitle">Approved dispatches will appear here.</span>
              </div>
            </div>
          ) : (
            dispatches.slice(0, 3).map((dispatch) => (
              <Link href={`/transporter/dispatches/${dispatch._id}`} key={dispatch._id} className="compact-row">
                <div className="row-left">
                  <div className="row-icon-wrapper"><Truck size={18} /></div>
                  <div className="row-info">
                    <span className="row-title">{dispatch.destination}</span>
                    <span className="row-subtitle">
                      {dispatch.totalQuantity} {dispatch.unit} - {formatDate(dispatch.plannedDepartureAt)}
                    </span>
                  </div>
                </div>
                <span className={`status-chip status-${statusClass(dispatch.status)}`}>{dispatch.status.replaceAll("_", " ")}</span>
              </Link>
            ))
          )}
        </div>
      </div>

      {notifications !== undefined && notifications.length > 0 && (
        <div>
          <div className="section-title-row">
            <h2 className="section-title">Updates</h2>
          </div>
          <div className="compact-list" style={{ marginTop: "8px" }}>
            {notifications.map((notification) => (
              <div key={notification._id} className="compact-row">
                <div className="row-left">
                  <div className="row-icon-wrapper"><Bell size={18} /></div>
                  <div className="row-info">
                    <span className="row-title">{notification.title}</span>
                    <span className="row-subtitle">{notification.message}</span>
                  </div>
                </div>
                {notification.status === "read" ? <CheckCircle2 size={18} /> : <Clock size={18} />}
              </div>
            ))}
          </div>
        </div>
      )}

      <Link href="/transporter/profile" className="btn btn-secondary btn-full">
        <span>Manage profile and truck evidence</span>
        <ChevronRight size={18} />
      </Link>
    </div>
  );
}
