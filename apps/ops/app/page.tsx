"use client";

/* eslint-disable react-hooks/purity, react/no-unescaped-entities */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWarehouse } from "./context/WarehouseContext";
import { 
  PackagePlus, 
  Clock, 
  AlertTriangle, 
  Warehouse, 
  ArrowRight,
  Search,
  FileSpreadsheet
} from "lucide-react";

export default function OpsHomePage() {
  const router = useRouter();
  const { inventory, disputes, activeAgent, activeWarehouse, assignedWarehouses, isLoading, errorMessage } = useWarehouse();

  // Dynamically compute stats from our state
  // 1. Intakes received today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayIntakesCount = inventory.filter(b => b.createdAt >= todayStart.getTime()).length;

  // 2. Expiring soon (sellByDate within next 3 days)
  const threeDaysFromNow = Date.now() + 3 * 24 * 60 * 60 * 1000;
  const expiringSoonCount = inventory.filter(
    b => b.sellByDate && b.sellByDate <= threeDaysFromNow && b.quantityAvailable > 0 && b.status !== "spoiled"
  ).length;

  // 3. Open Issues (status === "open" or "under_review")
  const openIssuesCount = disputes.filter(d => d.status === "open" || d.status === "under_review").length;

  // 4. Available batches (batches with available inventory)
  const availableBatchesCount = inventory.filter(b => b.quantityAvailable > 0).length;

  // Recent activity: last 5 batches
  const recentBatches = [...inventory]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 5);

  const formatBadgeClass = (status: string) => {
    switch (status) {
      case "received":
        return "badge-info";
      case "available":
        return "badge-success";
      case "partially_reserved":
      case "reserved":
        return "badge-warning";
      case "spoiled":
      case "expired":
        return "badge-danger";
      default:
        return "badge-neutral";
    }
  };

  const formatStatusLabel = (status: string) => {
    return status.replace(/_/g, " ");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Welcome Banner */}
      <div>
        <h1 style={{ fontSize: "24px", fontWeight: "800", color: "var(--color-ink)", marginBottom: "4px" }}>
          Welcome back, {activeAgent.fullName.split(" ")[0]}
        </h1>
        <p style={{ color: "var(--gray-600)", fontSize: "14px" }}>
          {assignedWarehouses.length > 0
            ? `Ready to manage producer crop collections at ${activeWarehouse.name}.`
            : "Warehouse assignment is required before intake workflows can begin."}
        </p>
      </div>

      {isLoading && (
        <div className="section-card" style={{ color: "var(--gray-500)", padding: "16px" }}>
          Loading warehouse operations data...
        </div>
      )}

      {errorMessage && (
        <div className="offline-banner" style={{ margin: 0, backgroundColor: "var(--color-danger-bg)", color: "var(--color-danger)", borderColor: "var(--color-danger-border)" }}>
          <AlertTriangle size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 2x2 Stats Count Grid */}
      <section className="stats-grid" aria-label="Operations Overview Stats">
        <div className="stat-card" onClick={() => router.push("/inventory")}>
          <div className="stat-header">
            <span className="stat-label">Today's Intakes</span>
            <div className="stat-icon">
              <PackagePlus size={20} />
            </div>
          </div>
          <div className="stat-value">{todayIntakesCount}</div>
          <div className="stat-delta">+ {todayIntakesCount} vs yesterday</div>
        </div>

        <div className="stat-card warning-left" onClick={() => router.push("/inventory?filter=expiring")}>
          <div className="stat-header">
            <span className="stat-label">Expiring ≤ 3 Days</span>
            <div className="stat-icon">
              <Clock size={20} />
            </div>
          </div>
          <div className="stat-value" style={{ color: "var(--color-warning)" }}>{expiringSoonCount}</div>
          <div className="stat-delta">Requires attention</div>
        </div>

        <div className="stat-card danger-left" onClick={() => router.push("/inventory?filter=issues")}>
          <div className="stat-header">
            <span className="stat-label">Open Issues</span>
            <div className="stat-icon">
              <AlertTriangle size={20} />
            </div>
          </div>
          <div className="stat-value" style={{ color: openIssuesCount > 0 ? "var(--color-danger)" : "inherit" }}>
            {openIssuesCount}
          </div>
          <div className="stat-delta">{openIssuesCount > 0 ? "Needs escalation" : "All clear"}</div>
        </div>

        <div className="stat-card" onClick={() => router.push("/inventory")}>
          <div className="stat-header">
            <span className="stat-label">Active Batches</span>
            <div className="stat-icon">
              <Warehouse size={20} />
            </div>
          </div>
          <div className="stat-value">{availableBatchesCount}</div>
          <div className="stat-delta">In storage</div>
        </div>
      </section>

      {/* Quick Actions Stack */}
      <section style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <h2 style={{ fontSize: "16px", fontWeight: "700", textTransform: "uppercase", color: "var(--gray-400)", letterSpacing: "0.05em" }}>
          Quick Actions
        </h2>
        <div className="quick-actions">
          <Link href="/intake" style={{ flex: 1 }}>
            <button type="button" className="btn btn-primary">
              <PackagePlus size={20} />
              <span>Start Produce Intake</span>
            </button>
          </Link>
          <Link href="/farmers" style={{ flex: 1 }}>
            <button type="button" className="btn btn-outline">
              <Search size={20} />
              <span>Find Farmer by Phone</span>
            </button>
          </Link>
          <Link href="/inventory" style={{ flex: 1 }}>
            <button type="button" className="btn btn-outline">
              <FileSpreadsheet size={20} />
              <span>Search Receipt Code</span>
            </button>
          </Link>
          <Link href="/disputes/new" style={{ flex: 1 }}>
            <button type="button" className="btn btn-ghost">
              <AlertTriangle size={20} />
              <span>Report Issue</span>
            </button>
          </Link>
        </div>
      </section>

      {/* Recent Activity List */}
      <section className="section-card">
        <div className="section-title">
          <span>Recent Activity</span>
          <Link href="/inventory" style={{ fontSize: "14px", color: "var(--color-field)", display: "flex", alignItems: "center", gap: "4px" }}>
            <span>View All</span>
            <ArrowRight size={14} />
          </Link>
        </div>
        
        {recentBatches.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 0", color: "var(--gray-500)" }}>
            No produce receipts created today.
          </div>
        ) : (
          <div className="activity-list">
            {recentBatches.map(batch => (
              <div 
                key={batch.id} 
                className="activity-row"
                onClick={() => router.push(`/receipts/${batch.receiptCode || batch.id}`)}
              >
                <div className="activity-left">
                  <div className="activity-title">
                    <span className="code-chip">{batch.receiptCode}</span>
                    <span style={{ fontWeight: "700" }}>{batch.cropType}</span>
                  </div>
                  <div className="activity-meta">
                    Received {new Date(batch.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div className="activity-right">
                  <span className="activity-qty">{batch.quantityReceived} {batch.unit}s</span>
                  <span className={`badge ${formatBadgeClass(batch.status)}`}>
                    {formatStatusLabel(batch.status)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
