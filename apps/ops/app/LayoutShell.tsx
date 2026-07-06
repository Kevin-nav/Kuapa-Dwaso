"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWarehouse } from "./context/WarehouseContext";
import { 
  Home, 
  Package, 
  Plus, 
  Search, 
  AlertTriangle, 
  CloudOff, 
  RefreshCw, 
  CheckCircle
} from "lucide-react";

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isOffline, setIsOffline, syncQueue, activeWarehouse, activeAgent } = useWarehouse();

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
    <div className="app-shell">
      {/* Top Bar Navigation */}
      <header className="topbar">
        <div className="topbar-left">
          <div className="topbar-title">{activeWarehouse.name}</div>
          <div className="topbar-subtitle">Agent: {activeAgent.fullName} ({activeAgent.agentCode})</div>
        </div>
        
        <div className="topbar-right">
          <button 
            type="button"
            className={`sync-pill ${syncStatus.class}`} 
            onClick={handleSyncToggle}
            title={isOffline ? "Click to connect Online" : "Click to go Offline"}
            aria-label={`Sync Status: ${syncStatus.text}. Click to toggle.`}
          >
            {syncStatus.icon}
            <span>{syncStatus.text}</span>
          </button>
        </div>
      </header>

      {/* Sidebar Navigation (Desktop) */}
      <aside className="sidebar">
        <div className="sidebar-title">Operations Console</div>
        <nav aria-label="Desktop Navigation" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {navItems.map(item => {
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`sidebar-link ${isActive ? "active" : ""}`}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            );
          })}
          <Link 
            href="/intake" 
            className={`sidebar-link ${pathname.startsWith("/intake") ? "active" : ""}`}
            style={{ marginTop: "12px", border: "1px dashed var(--color-field)", color: "var(--color-field)" }}
          >
            <Plus size={20} />
            <span>New Produce Intake</span>
          </Link>
        </nav>
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
          className={`mobile-nav-item ${pathname.startsWith("/inventory") ? "active" : ""}`}
        >
          <Package size={20} />
          <span>Inventory</span>
        </Link>
        
        {/* Floating circular center intake button */}
        <div className="fab-container">
          <Link href="/intake" aria-label="Start Produce Intake">
            <button type="button" className="fab-button">
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
