"use client";

import type React from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  CheckCircle,
  ChevronDown,
  CloudOff,
  Home,
  Leaf,
  LogOut,
  Package,
  RefreshCw,
  Search,
  Sprout,
} from "lucide-react";
import { SampleDataBanner } from "@kuapa-dwaso/ui/pilot";
import { useOpsAuth } from "./auth/OpsAuthProvider";
import { usePilotOperations } from "./context/PilotOperationsContext";
import { useWarehouse } from "./context/WarehouseContext";

const pilotNav = [
  { href: "/pilot", label: "Demand queue", icon: Sprout },
  { href: "/pilot/supply", label: "Supply desk", icon: Leaf },
  { href: "/pilot/issues", label: "Blockers", icon: AlertTriangle },
];

const warehouseNav = [
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/farmers", label: "Farmers", icon: Search },
];

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { firebaseUser, principal, isLoading: isAuthLoading, signOut } = useOpsAuth();
  const {
    programmes,
    activeProgramme,
    activeProgrammeId,
    setActiveProgrammeId,
  } = usePilotOperations();
  const {
    activeWarehouse,
    assignedWarehouses,
    activeAgent,
    setActiveWarehouseId,
    isOffline,
    setIsOffline,
    syncQueue,
    triggerSync,
  } = useWarehouse();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [syncError, setSyncError] = useState<string>();
  const isAuthRoute = pathname === "/auth";
  const isPilotRoute = pathname.startsWith("/pilot");
  const hasOperationsIdentity =
    firebaseUser !== null && principal?.role === "warehouse_agent";

  useEffect(() => {
    if (!isAuthRoute && !isAuthLoading && !hasOperationsIdentity) router.replace("/auth");
  }, [hasOperationsIdentity, isAuthLoading, isAuthRoute, router]);

  if (isAuthRoute) return <>{children}</>;
  if (isAuthLoading || !hasOperationsIdentity)
    return (
      <main className="ops-auth-gate" aria-live="polite">
        <div className="ops-auth-gate-mark" />
        <p>{isAuthLoading ? "Checking operations access…" : "Taking you to secure sign in…"}</p>
      </main>
    );

  const syncStatus = isOffline
    ? { className: "offline", label: `Offline — ${syncQueue.length} pending`, icon: CloudOff }
    : syncQueue.length > 0
      ? { className: "syncing", label: `Syncing (${syncQueue.length})`, icon: RefreshCw }
      : { className: "synced", label: "Synced", icon: CheckCircle };
  const SyncIcon = syncStatus.icon;
  const sampleProgrammes = programmes
    .filter((programme) => programme.datasetProvenance === "sample_only")
    .map((programme) => ({
      programmeId: programme.id,
      programmeName: programme.name,
      dataMode: programme.datasetProvenance,
    }));

  async function retrySync() {
    setSyncError(undefined);
    if (process.env.NEXT_PUBLIC_ENABLE_DEV_ACTOR_FALLBACK === "true") {
      setIsOffline(!isOffline);
      return;
    }
    try {
      await triggerSync();
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "Saved actions could not be retried.");
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-left">
          {isPilotRoute && activeProgrammeId !== undefined ? (
            <label className="ops-workspace-picker">
              <span>Programme</span>
              <select
                value={activeProgrammeId}
                onChange={(event) =>
                  setActiveProgrammeId(event.target.value as typeof activeProgrammeId)
                }
                aria-label="Active pilot programme"
              >
                {programmes.map((programme) => (
                  <option key={programme.id} value={programme.id}>
                    {programme.name}
                  </option>
                ))}
              </select>
            </label>
          ) : assignedWarehouses.length > 1 ? (
            <label className="ops-workspace-picker">
              <span>Warehouse</span>
              <select
                value={activeWarehouse.id}
                onChange={(event) => setActiveWarehouseId(event.target.value)}
                aria-label="Active warehouse"
              >
                {assignedWarehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                ))}
              </select>
            </label>
          ) : (
            <div className="topbar-title">
              {isPilotRoute ? activeProgramme?.name ?? "Maize pilot" : activeWarehouse.name}
            </div>
          )}
        </div>

        <div className="topbar-right">
          <button
            type="button"
            className={`sync-pill ${syncStatus.className}`}
            onClick={() => void retrySync()}
          >
            <SyncIcon size={16} className={syncStatus.className === "syncing" ? "animate-spin" : undefined} />
            <span>{syncStatus.label}</span>
          </button>
          <button
            type="button"
            className="profile-trigger"
            onClick={() => setShowProfileMenu((open) => !open)}
            aria-expanded={showProfileMenu}
            aria-haspopup="true"
          >
            <span className="profile-avatar">
              {activeAgent.fullName.split(" ").map((name) => name[0]).join("").toUpperCase()}
            </span>
            <span className="profile-name">{activeAgent.fullName}</span>
            <ChevronDown size={14} />
          </button>
          {showProfileMenu ? (
            <div className="profile-dropdown">
              <div className="profile-dropdown-header">
                <strong>{activeAgent.fullName}</strong>
                <span>{activeAgent.agentCode}</span>
              </div>
              <div className="profile-dropdown-body">
                <span className="profile-info-label">Current workspace</span>
                <strong>{isPilotRoute ? activeProgramme?.name ?? "No pilot assignment" : activeWarehouse.name}</strong>
              </div>
              <div className="profile-dropdown-footer">
                <Link href="/notifications" className="btn-logout" onClick={() => setShowProfileMenu(false)}>
                  <Bell size={16} /> Notifications
                </Link>
                <button type="button" className="btn-logout" onClick={() => void signOut()}>
                  <LogOut size={16} /> Log out
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </header>

      <aside className="sidebar">
        <Link href="/" className="ops-brand"><span>KD</span><strong>KuapaDwaso</strong></Link>
        <nav aria-label="Operations navigation">
          <Link href="/" className={`sidebar-link ${pathname === "/" ? "active" : ""}`}>
            <Home size={19} /><span>Home</span>
          </Link>
          <p className="ops-nav-label">Maize pilot</p>
          {pilotNav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`sidebar-link ${pathname === href || (href !== "/pilot" && pathname.startsWith(href)) || (href === "/pilot" && /^\/pilot\/requests/.test(pathname)) ? "active" : ""}`}
            >
              <Icon size={19} /><span>{label}</span>
            </Link>
          ))}
          <p className="ops-nav-label">Warehouse workspace</p>
          {warehouseNav.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={`sidebar-link ${pathname.startsWith(href) ? "active" : ""}`}>
              <Icon size={19} /><span>{label}</span>
            </Link>
          ))}
          <Link href="/intake" className={`sidebar-link ${pathname.startsWith("/intake") ? "active" : ""}`}>
            <Package size={19} /><span>Produce intake</span>
          </Link>
        </nav>
      </aside>

      <main className="main-content">
        <SampleDataBanner programmes={sampleProgrammes} />
        <div className="content-container">
          {isOffline ? (
            <div className="offline-banner" role="alert">
              <CloudOff size={20} />
              <span>You are offline. Commercial decisions and inspection results require a connection.</span>
            </div>
          ) : null}
          {syncError === undefined ? null : (
            <div className="offline-banner" role="alert">
              <AlertTriangle size={20} /><span>{syncError} Try again when the connection is stable.</span>
            </div>
          )}
          {children}
        </div>
      </main>

      <nav aria-label="Mobile navigation" className="mobile-nav">
        <Link href="/" className={`mobile-nav-item ${pathname === "/" ? "active" : ""}`}><Home size={20} /><span>Home</span></Link>
        <Link href="/pilot" className={`mobile-nav-item ${pathname.startsWith("/pilot/requests") || pathname === "/pilot" ? "active" : ""}`}><Sprout size={20} /><span>Demand</span></Link>
        <Link href="/pilot/supply" className={`mobile-nav-item ${pathname.startsWith("/pilot/supply") ? "active" : ""}`}><Leaf size={20} /><span>Supply</span></Link>
        <Link href="/pilot/issues" className={`mobile-nav-item ${pathname.startsWith("/pilot/issues") ? "active" : ""}`}><AlertTriangle size={20} /><span>Blockers</span></Link>
      </nav>
    </div>
  );
}
