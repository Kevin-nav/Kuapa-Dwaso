"use client";

/* eslint-disable react/no-unescaped-entities */

import type React from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useOpsAuth } from "./auth/OpsAuthProvider";
import { useWarehouse } from "./context/WarehouseContext";
import { 
  Home, 
  Package, 
  Plus, 
  Search, 
  AlertTriangle, 
  CloudOff, 
  RefreshCw, 
  CheckCircle,
  ChevronDown,
  LogOut,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isOffline, setIsOffline, syncQueue, activeWarehouse, assignedWarehouses, activeAgent, setActiveWarehouseId } = useWarehouse();
  const { signOut, firebaseUser, principal, isLoading: isAuthLoading } = useOpsAuth();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const isAuthRoute = pathname === "/auth";
  const hasWarehouseAccess = firebaseUser !== null && principal?.role === "warehouse_agent";

  useEffect(() => {
    if (!isAuthRoute && !isAuthLoading && !hasWarehouseAccess) {
      router.replace("/auth");
    }
  }, [hasWarehouseAccess, isAuthLoading, isAuthRoute, router]);

  if (isAuthRoute) {
    return <>{children}</>;
  }

  if (isAuthLoading || !hasWarehouseAccess) {
    return (
      <main className="ops-auth-gate" aria-live="polite">
        <div className="ops-auth-gate-mark" />
        <p>{isAuthLoading ? "Checking warehouse access…" : "Taking you to secure sign in…"}</p>
      </main>
    );
  }

  // Determine sync status representation
  const getSyncStatus = () => {
    if (isOffline) {
      return {
        class: "offline",
        text: `Offline — ${syncQueue.length} pending`,
        icon: <CloudOff size={16} />
      };
    }
    if (syncQueue.length > 0) {
      return {
        class: "syncing",
        text: `Syncing (${syncQueue.length})`,
        icon: <RefreshCw size={16} className="animate-spin" />
      };
    }
    return {
      class: "synced",
      text: "Synced",
      icon: <CheckCircle size={16} />
    };
  };

  const syncStatus = getSyncStatus();

  const handleSyncToggle = () => {
    setIsOffline(!isOffline);
  };

  // Nav configuration
  const navItems = [
    { href: "/", label: "Home", icon: <Home size={20} /> },
    { href: "/inventory", label: "Inventory", icon: <Package size={20} /> },
    { href: "/farmers", label: "Farmers", icon: <Search size={20} /> },
    { href: "/disputes/new", label: "Issues", icon: <AlertTriangle size={20} /> },
  ];

  return (
    <div className={`app-shell ${isCollapsed ? "sidebar-collapsed" : ""}`}>
      {/* Top Bar Navigation */}
      <header className="topbar">
        <div className="topbar-left">
          {assignedWarehouses.length > 1 ? (
            <select
              value={activeWarehouse.id}
              onChange={(e) => setActiveWarehouseId(e.target.value)}
              className="topbar-select"
              aria-label="Active Warehouse Select"
              style={{
                fontSize: "18px",
                fontWeight: 700,
                color: "var(--color-ink)",
                background: "transparent",
                border: "none",
                padding: "4px 28px 4px 4px",
                borderRadius: "6px",
                cursor: "pointer",
                outline: "none",
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: "right 4px center",
                backgroundSize: "20px 20px",
                backgroundRepeat: "no-repeat",
                appearance: "none",
                WebkitAppearance: "none",
                MozAppearance: "none",
              }}
            >
              {assignedWarehouses.map((w) => (
                <option key={w.id} value={w.id} style={{ color: "var(--color-ink, black)", backgroundColor: "var(--color-surface, white)" }}>
                  {w.name}
                </option>
              ))}
            </select>
          ) : (
            <div className="topbar-title">{activeWarehouse.name}</div>
          )}
        </div>
        
        <div className="topbar-right" style={{ position: "relative" }}>
          <button
            type="button"
            className={`sync-pill ${syncStatus.class}`}
            onClick={handleSyncToggle}
            title="Toggle offline simulation"
          >
            {syncStatus.icon}
            <span>{syncStatus.text}</span>
          </button>

          <button 
            type="button" 
            className="profile-trigger"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            aria-expanded={showProfileMenu}
            aria-haspopup="true"
          >
            <div className="profile-avatar">
              {activeAgent.fullName.split(" ").map(n => n[0]).join("").toUpperCase()}
            </div>
            <span className="profile-name">
              {activeAgent.fullName}
            </span>
            <ChevronDown size={14} className={`profile-chevron ${showProfileMenu ? "open" : ""}`} />
          </button>

          {showProfileMenu && (
            <>
              <div 
                className="profile-menu-backdrop" 
                onClick={() => setShowProfileMenu(false)} 
              />
              <div className="profile-dropdown">
                <div className="profile-dropdown-header">
                  <div className="profile-dropdown-avatar">
                    {activeAgent.fullName.split(" ").map(n => n[0]).join("").toUpperCase()}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    <div className="profile-dropdown-name">{activeAgent.fullName}</div>
                    <div className="profile-dropdown-code">{activeAgent.agentCode}</div>
                  </div>
                </div>
                
                <div className="profile-dropdown-body">
                  <div className="profile-info-item">
                    <span className="profile-info-label">Phone:</span>
                    <span className="profile-info-value">{activeAgent.phoneNumber}</span>
                  </div>
                  <div className="profile-info-item">
                    <span className="profile-info-label">Warehouse:</span>
                    <span className="profile-info-value">{activeWarehouse.name}</span>
                  </div>
                  <div className="profile-info-item">
                    <span className="profile-info-label">Status:</span>
                    <span className="badge badge-success" style={{ fontSize: "11px", margin: 0 }}>Active</span>
                  </div>
                </div>

                <div className="profile-dropdown-footer">
                  <button 
                    type="button" 
                    className="btn-logout"
                    onClick={() => {
                      setShowProfileMenu(false);
                      void signOut();
                    }}
                  >
                    <LogOut size={16} />
                    <span>Log Out</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Sidebar Navigation (Desktop) */}
      <aside className="sidebar">
        <div className="sidebar-brand-container" style={{ display: "flex", alignItems: "center", gap: "8px", padding: "0 12px 16px 12px", borderBottom: "1px solid var(--color-ink-soft)", marginBottom: "16px" }}>
          <svg width="28" height="28" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
            <circle cx="22" cy="30" r="6" fill="var(--color-field)" opacity="0.5" />
            <circle cx="18" cy="60" r="6" fill="var(--color-field)" opacity="0.65" />
            <circle cx="22" cy="90" r="6" fill="var(--color-field)" opacity="0.8" />
            <circle cx="48" cy="45" r="8" fill="var(--color-field)" opacity="0.85" />
            <circle cx="48" cy="75" r="8" fill="var(--color-field)" opacity="0.9" />
            <circle cx="88" cy="60" r="22" fill="var(--color-field)" />
          </svg>
          <span className="sidebar-brand-text" style={{ fontWeight: 800, fontSize: "1.05rem", letterSpacing: "0.02em", color: "white" }}>
            KuapaDwaso
          </span>
        </div>
        <div className="sidebar-title">Operations Console</div>
        <nav aria-label="Desktop Navigation" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {navItems.map(item => {
            const isActive = 
              pathname === item.href || 
              (item.href !== "/" && pathname.startsWith(item.href)) ||
              (item.href === "/inventory" && pathname.startsWith("/receipts"));
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`sidebar-link ${isActive ? "active" : ""}`}
                title={isCollapsed ? item.label : undefined}
              >
                <span style={{ display: "flex", flexShrink: 0 }}>{item.icon}</span>
                <span className="sidebar-link-label">{item.label}</span>
              </Link>
            );
          })}
          <Link 
            href="/intake" 
            className={`sidebar-link ${pathname.startsWith("/intake") ? "active" : ""}`}
            style={{ marginTop: "12px", border: "1px dashed var(--color-field)", color: "var(--color-field)" }}
            title={isCollapsed ? "New Produce Intake" : undefined}
          >
            <Plus size={20} style={{ flexShrink: 0 }} />
            <span className="sidebar-link-label">New Produce Intake</span>
          </Link>
        </nav>
        
        {/* Sidebar Footer Collapsible Toggle */}
        <div className="sidebar-footer" style={{ marginTop: "auto", borderTop: "1px solid var(--color-ink-soft)", paddingTop: "12px", display: "flex", justifyContent: "center" }}>
          <button
            type="button"
            className="sidebar-collapse-btn"
            onClick={() => setIsCollapsed(!isCollapsed)}
            style={{
              background: "none",
              border: 0,
              color: "#94a3b8",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "8px",
              borderRadius: "50%",
              width: "36px",
              height: "36px",
              transition: "all 0.2s"
            }}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>
      </aside>

      {/* Main Panel Content Area */}
      <main className="main-content">
        <div className="content-container">
          {/* Offline warning notification banner */}
          {isOffline && (
            <div className="offline-banner" role="alert">
              <CloudOff size={20} />
              <span>You're offline — {syncQueue.length} action{syncQueue.length !== 1 ? "s" : ""} will sync automatically when connection restores.</span>
            </div>
          )}
          {children}
        </div>
      </main>

      {/* Bottom Navigation Tab Bar (Mobile) */}
      <nav aria-label="Mobile Navigation" className="mobile-nav">
        <Link 
          href="/" 
          className={`mobile-nav-item ${pathname === "/" ? "active" : ""}`}
        >
          <Home size={20} />
          <span>Home</span>
        </Link>
        <Link 
          href="/inventory" 
          className={`mobile-nav-item ${pathname.startsWith("/inventory") || pathname.startsWith("/receipts") ? "active" : ""}`}
        >
          <Package size={20} />
          <span>Inventory</span>
        </Link>
        
        {/* Floating circular center intake button */}
        <div className="fab-container">
          <Link href="/intake" aria-label="Start Produce Intake">
            <button 
              type="button" 
              className={`fab-button ${pathname.startsWith("/intake") ? "active" : ""}`}
            >
              <Plus size={28} />
            </button>
          </Link>
        </div>

        <Link 
          href="/farmers" 
          className={`mobile-nav-item ${pathname.startsWith("/farmers") ? "active" : ""}`}
        >
          <Search size={20} />
          <span>Search</span>
        </Link>
        <Link 
          href="/disputes/new" 
          className={`mobile-nav-item ${pathname.startsWith("/disputes") ? "active" : ""}`}
        >
          <AlertTriangle size={20} />
          <span>Issues</span>
        </Link>
      </nav>
    </div>
  );
}
