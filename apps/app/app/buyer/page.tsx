"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useAuth } from "@/app/auth/AuthProvider";
import Link from "next/link";
import { Search, MapPin, Calendar, CircleDollarSign, ArrowRight, ShieldCheck, Package, Bell, Clock3 } from "lucide-react";
import type { Id } from "@convex/_generated/dataModel";
import type { ProduceGrade } from "@kuapa-dwaso/types";
import { getSignedReadUrl } from "@/app/uploads/client";
import type { User } from "firebase/auth";

type BuyerProfile = {
  fullName?: string;
  destinationMarket?: string;
  verificationStatus?: string;
};

type InventorySummary = {
  warehouseId: string;
  warehouseName: string;
  warehouseCommunity: string;
  cropType: string;
  grade: string;
  unit: string;
  destinationMarket: string;
  availableQuantity: number;
  askingPriceRange?: { min: number; max: number };
  earliestSellByDate?: number;
  dispatchDays?: string[];
  photoId?: string;
};
type MarketRun = { _id: Id<"marketDeliveryRuns">; destinationName: string; destinationInstructions: string; timezone: string; deliveryDateAt: number; orderCutoffAt: number; expectedArrivalStartAt: number; expectedArrivalEndAt: number; status: string };
type BuyerNotification = { _id: Id<"notifications">; title: string; message: string; actionUrl?: string; actionRequired?: boolean; acknowledgedAt?: number; priority?: string; dueAt?: number; status: string };

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export default function BuyerDashboard() {
  const { principal, firebaseUser } = useAuth();
  const [selectedCrop, setSelectedCrop] = useState<string>("All");
  const [selectedGrade, setSelectedGrade] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [renderedAt] = useState(() => Date.now());

  const buyerProfile = principal?.profiles?.find((p) => p.profileType === "buyer");
  const buyerId = buyerProfile?.profileId as Id<"buyers"> | undefined;

  // Retrieve Buyer details
  const buyer = useQuery(
    api.buyers.getById,
    principal !== null && principal !== undefined && buyerId !== undefined
      ? { actorUserId: principal.userId as Id<"users">, buyerId }
      : "skip"
  ) as BuyerProfile | null | undefined;

  // We query summaries. Filter destination market based on buyer's preferred market
  const defaultMarket = buyer?.destinationMarket || "Makola Market";

  const summaryArgs =
    principal !== null && principal !== undefined
      ? {
          destinationMarket: defaultMarket,
          ...(selectedCrop === "All" ? {} : { cropType: selectedCrop }),
          ...(selectedGrade === "All" ? {} : { grade: selectedGrade as ProduceGrade }),
        }
      : "skip";
  const summaries = useQuery(
    api.buyerOrders.summarizeAvailableInventory,
    summaryArgs
  ) as InventorySummary[] | undefined;
  const allSummaries = useQuery(
    api.buyerOrders.summarizeAvailableInventory,
    principal !== null && principal !== undefined ? { destinationMarket: defaultMarket } : "skip",
  ) as InventorySummary[] | undefined;
  const upcomingRuns = useQuery(api.marketDeliveryRuns.listUpcomingForBuyer, principal?.userId ? { actorUserId: principal.userId as Id<"users">, destinationName: defaultMarket, limit: 3 } : "skip") as MarketRun[] | undefined;
  const notifications = useQuery(api.notifications.listForActor, principal?.userId ? { actorUserId: principal.userId as Id<"users">, limit: 6 } : "skip") as BuyerNotification[] | undefined;
  const acknowledgeNotification = useMutation(api.notifications.acknowledge);
  const markNotificationRead = useMutation(api.notifications.markRead);

  // Greets based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const displayName = buyer?.fullName || principal?.name || "Buyer";

  const formatPriceRange = (range?: { min: number; max: number }, unit = "bag") => {
    if (!range) return "Price not set";
    const minVal = range.min;
    const maxVal = range.max;
    if (minVal === maxVal) {
      return `GHS ${minVal.toLocaleString()} per ${unit}`;
    }
    return `GHS ${minVal.toLocaleString()} - GHS ${maxVal.toLocaleString()} per ${unit}`;
  };

  const isInventoryLoading = summaries === undefined;
  const listToRender: InventorySummary[] = summaries ?? [];
  const cropOptions = ["All", ...new Set((allSummaries ?? []).map((item) => item.cropType))];
  const gradeOptions = ["All", ...new Set((allSummaries ?? []).map((item) => item.grade))];

  // Filter list locally based on searchQuery (filters warehouse name or crop type)
  const filteredSummaries = listToRender.filter((item) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return (
      item.warehouseName.toLowerCase().includes(query) ||
      item.cropType.toLowerCase().includes(query) ||
      item.warehouseCommunity.toLowerCase().includes(query)
    );
  });

  return (
    <div style={{ display: "flex", flex: "1 0 auto", flexDirection: "column", gap: "20px" }}>
      {/* Buyer Header */}
      <div className="home-header">
        <p className="eyebrow">{getGreeting()},</p>
        <h1 style={{ fontSize: "1.75rem", marginBottom: "4px" }}>{displayName}</h1>
        <div className="home-warehouse">
          <MapPin size={16} />
          <span>Sourcing for {defaultMarket}</span>
        </div>
      </div>

      {/* Verification / Welcome Card */}
      {buyer && buyer.verificationStatus === "pending" && (
        <div className="attention-card">
          <ShieldCheck className="attention-icon" size={24} style={{ color: "var(--color-warning)" }} />
          <div className="attention-body">
            <span className="attention-title">Profile Pending Verification</span>
            <span className="attention-text">
              Your buyer profile is currently pending verification. You can still browse stock and request produce orders, but dispatch will require verification confirmation.
            </span>
          </div>
        </div>
      )}

      <section style={{ display: "grid", gap: 10 }}>
        <div className="section-title-row"><h2 className="section-title">Next delivery to {defaultMarket}</h2><Link href="/buyer/orders/create" className="section-link">See runs</Link></div>
        {upcomingRuns === undefined ? <div className="skeleton" style={{ height: 110, borderRadius: 14 }} /> : upcomingRuns.length === 0 ? <div className="attention-card"><div className="attention-body"><span className="attention-title">No published run is open yet</span><span className="attention-text">Operations will publish the next destination, cutoff, and collection window here.</span></div></div> : upcomingRuns.map((run) => <Link key={run._id} href={`/buyer/orders/create?run=${run._id}`} className="farmer-card"><div className="card-header"><span className="card-title"><MapPin size={17} /> {run.destinationName}</span><span className="status-chip status-success">Orders open</span></div><div className="card-meta" style={{ display: "grid", gap: 5 }}><span><Calendar size={16} /> Delivery {formatRunDate(run.deliveryDateAt, run.timezone)}, {formatRunTime(run.expectedArrivalStartAt, run.timezone)}–{formatRunTime(run.expectedArrivalEndAt, run.timezone)}</span><span><Clock3 size={16} /> Order and pay by {formatRunDateTime(run.orderCutoffAt, run.timezone)}</span><span><strong>Collection:</strong> {run.destinationInstructions}</span></div><div className="card-details"><strong>Browse stock for this run</strong><ArrowRight size={17} /></div></Link>)}
      </section>

      {(() => {
        const visibleNotifications = (notifications ?? []).filter((notification) => notification.status !== "archived").slice(0, 4);
        return visibleNotifications.length === 0 ? null : <section style={{ display: "grid", gap: 10 }}><div className="section-title-row"><h2 className="section-title"><Bell size={18} /> Updates needing attention</h2></div>{visibleNotifications.map((notification) => <article key={notification._id} className="attention-card"><Bell className="attention-icon" size={20} /><div className="attention-body"><span className="attention-title">{notification.title}</span><span className="attention-text">{notification.message}</span>{notification.dueAt && <span className="attention-text">Due {new Date(notification.dueAt).toLocaleString("en-GH")}</span>}<div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>{notification.actionUrl && <Link href={notification.actionUrl} className="btn btn-primary">Open</Link>}{notification.actionRequired && notification.acknowledgedAt === undefined ? <button className="btn btn-secondary" onClick={() => principal?.userId && void acknowledgeNotification({ actorUserId: principal.userId as Id<"users">, notificationId: notification._id }).catch((error: unknown) => alert(error instanceof Error ? error.message : "Could not acknowledge this notification."))}>I understand</button> : notification.status !== "read" && <button className="btn btn-secondary" onClick={() => principal?.userId && void markNotificationRead({ actorUserId: principal.userId as Id<"users">, notificationId: notification._id }).catch((error: unknown) => alert(error instanceof Error ? error.message : "Could not mark this notification as read."))}>Mark read</button>}</div></div></article>)}</section>;
      })()}

      {/* Search Input Bar */}
      <div style={{ position: "relative" }}>
        <Search
          size={18}
          style={{
            position: "absolute",
            left: "14px",
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--color-text-muted)",
          }}
        />
        <input
          type="text"
          placeholder="Search crop or warehouse location..."
          className="form-input"
          style={{ paddingLeft: "42px" }}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Filter Chips - Crop Type */}
      <div>
        <span className="summary-label" style={{ display: "block", marginBottom: "8px" }}>
          Filter Crop
        </span>
        <div className="filter-container">
          {cropOptions.map((crop) => (
            <button
              key={crop}
              type="button"
              className={`filter-chip ${selectedCrop === crop ? "filter-chip-active" : ""}`}
              onClick={() => setSelectedCrop(crop)}
            >
              {crop === "All" ? "🌽 All Crops" : crop}
            </button>
          ))}
        </div>
      </div>

      {/* Filter Chips - Grade */}
      <div>
        <span className="summary-label" style={{ display: "block", marginBottom: "8px" }}>
          Quality Grade
        </span>
        <div className="filter-container">
          {gradeOptions.map((grade) => (
            <button
              key={grade}
              type="button"
              className={`filter-chip ${selectedGrade === grade ? "filter-chip-active" : ""}`}
              onClick={() => setSelectedGrade(grade)}
            >
              {grade === "All" ? "⭐ All Grades" : `Grade ${grade}`}
            </button>
          ))}
        </div>
      </div>

      {/* Marketplace Listings */}
      <div>
        <div className="section-title-row" style={{ marginBottom: "12px" }}>
          <h2 className="section-title">Available Warehouse Stock</h2>
          <span style={{ fontSize: "0.875rem", color: "var(--color-text-muted)" }}>
            {filteredSummaries.length} listings
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {filteredSummaries.map((item, idx) => {
            const daysLeft = item.earliestSellByDate
              ? Math.max(0, Math.floor((item.earliestSellByDate - renderedAt) / MS_PER_DAY))
              : null;

            return (
              <Link
                href={`/buyer/inventory/summary?warehouseId=${item.warehouseId}&cropType=${item.cropType}&grade=${item.grade}&unit=${item.unit}`}
                key={`${item.warehouseId}-${item.cropType}-${item.grade}-${idx}`}
                className="farmer-card"
                style={{ cursor: "pointer" }}
              >
                <ListingPhoto photoId={item.photoId} user={firebaseUser} cropType={item.cropType} />
                <div className="card-header">
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "1.5rem" }}>
                      {item.cropType === "Maize" ? "🌽" : item.cropType === "Cassava" ? "🍠" : "🌾"}
                    </span>
                    <div>
                      <span className="card-title" style={{ fontSize: "1.1rem" }}>
                        {item.cropType}
                      </span>
                      <span style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
                        {item.warehouseName}
                      </span>
                    </div>
                  </div>
                  <span className="status-chip status-success">Grade {item.grade}</span>
                </div>

                <div className="card-meta" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <CircleDollarSign size={16} style={{ color: "var(--color-primary)" }} />
                    <span className="card-math" style={{ fontSize: "0.95rem" }}>
                      {formatPriceRange(item.askingPriceRange, item.unit)}
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.875rem", color: "var(--color-text-muted)" }}>
                    <Calendar size={16} />
                    <span>
                      {daysLeft !== null && item.earliestSellByDate !== undefined
                        ? `Sell-by: ~${daysLeft} days left (${new Date(item.earliestSellByDate).toLocaleDateString()})`
                        : "No sell-by date"}
                    </span>
                  </div>
                </div>

                <div className="card-details" style={{ borderTop: "1.5px dashed var(--color-line)", paddingTop: "12px", marginTop: "4px" }}>
                  <div>
                    <span className="summary-label" style={{ fontSize: "0.8125rem" }}>Available Stock:</span>
                    <div style={{ fontWeight: "800", color: "var(--color-ink)", fontSize: "1rem" }}>
                      {item.availableQuantity.toLocaleString()} {item.unit}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "var(--color-primary)", fontWeight: "700", fontSize: "0.875rem" }}>
                    <span>Order Details</span>
                    <ArrowRight size={16} />
                  </div>
                </div>
              </Link>
            );
          })}

          {isInventoryLoading && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div className="skeleton" style={{ width: "100%", height: "124px", borderRadius: "16px" }} />
              <div className="skeleton" style={{ width: "100%", height: "124px", borderRadius: "16px" }} />
            </div>
          )}

          {!isInventoryLoading && filteredSummaries.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <div style={{ fontSize: "3rem", marginBottom: "16px" }}>🌾</div>
              <h3 style={{ color: "var(--color-ink)", marginBottom: "8px" }}>No Produce Available</h3>
              <p style={{ maxWidth: "320px", margin: "0 auto", color: "var(--color-text-muted)" }}>
                There are no buyer-visible warehouse listings matching your filters for {defaultMarket}.
              </p>
            </div>
          )}
        </div>
      </div>

      <p className="timestamp">Connected · Last synced {new Date().toLocaleTimeString()}</p>
    </div>
  );
}

function formatRunDate(value: number, timezone: string) { return new Intl.DateTimeFormat("en-GH", { dateStyle: "medium", timeZone: timezone }).format(value); }
function formatRunTime(value: number, timezone: string) { return new Intl.DateTimeFormat("en-GH", { timeStyle: "short", timeZone: timezone }).format(value); }
function formatRunDateTime(value: number, timezone: string) { return new Intl.DateTimeFormat("en-GH", { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(value); }

function ListingPhoto({ photoId, user, cropType }: { photoId: string | undefined; user: User | null; cropType: string }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let active = true;
    if (photoId !== undefined && user !== null) {
      void getSignedReadUrl(user, photoId).then((nextUrl) => { if (active) setUrl(nextUrl); }).catch(() => undefined);
    }
    return () => { active = false; };
  }, [photoId, user]);

  return url === undefined ? (
    <div style={{ height: "150px", borderRadius: "12px", background: "linear-gradient(135deg, var(--color-surface-raised), var(--color-bg))", display: "grid", placeItems: "center", color: "var(--color-text-muted)", marginBottom: "14px" }}>
      <div style={{ textAlign: "center" }}><Package size={34} style={{ opacity: 0.55 }} /><div style={{ fontSize: "12px", marginTop: "6px" }}>{cropType} lot</div></div>
    </div>
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={`${cropType} produce at the warehouse`} loading="lazy" style={{ width: "100%", height: "180px", objectFit: "cover", borderRadius: "12px", marginBottom: "14px", border: "1px solid var(--color-line)" }} />
  );
}
