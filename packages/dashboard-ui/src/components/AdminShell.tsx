// packages/dashboard-ui/src/components/AdminShell.tsx
"use client";

/* eslint-disable react/prop-types */

import { useState } from "react";
import type { ComponentType, CSSProperties, MouseEvent, ReactNode } from "react";
import { palette, gray } from "@kuapa-dwaso/design-tokens";
import { useWarehouseFilter } from "./WarehouseFilterContext.js";
import { MockDatabase } from "../mockDb.js";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Boxes,
  ShoppingBag,
  DollarSign,
  Truck,
  Sprout,
  Building,
  UserCheck,
  Warehouse as WarehouseIcon,
  Scale,
  AlertTriangle,
  History,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Search,
  User
} from "lucide-react";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

type LinkComponentProps = {
  href: string;
  title?: string | undefined;
  style?: CSSProperties;
  children: ReactNode;
  onMouseEnter?: (event: MouseEvent<HTMLAnchorElement>) => void;
  onMouseLeave?: (event: MouseEvent<HTMLAnchorElement>) => void;
};

const AnchorLink: ComponentType<LinkComponentProps> = ({ href, children, ...props }) => (
  <a href={href} {...props}>
    {children}
  </a>
);

export type AdminShellProps = {
  children: ReactNode;
  pathname?: string;
  LinkComponent?: ComponentType<LinkComponentProps>;
};

export function AdminShell({ children, pathname = "/", LinkComponent = AnchorLink }: AdminShellProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { selectedWarehouseId, setSelectedWarehouseId } = useWarehouseFilter();
  const [searchQuery, setSearchQuery] = useState("");
  
  const warehouses = MockDatabase.getWarehouses();

  const navGroups: NavGroup[] = [
    {
      title: "Operations",
      items: [
        { label: "Overview", href: "/", icon: LayoutDashboard },
        { label: "Inventory", href: "/inventory", icon: Boxes },
        { label: "Orders", href: "/orders", icon: ShoppingBag },
        { label: "Sales", href: "/sales", icon: DollarSign },
        { label: "Dispatch", href: "/dispatch", icon: Truck },
      ],
    },
    {
      title: "People",
      items: [
        { label: "Farmers", href: "/farmers", icon: Sprout },
        { label: "Buyers", href: "/buyers", icon: Building },
        { label: "Agents", href: "/agents", icon: UserCheck },
      ],
    },
    {
      title: "Configuration",
      items: [
        { label: "Warehouses", href: "/warehouses", icon: WarehouseIcon },
        { label: "Fee Rules", href: "/fee-rules", icon: Scale },
      ],
    },
    {
      title: "Governance",
      items: [
        { label: "Disputes", href: "/disputes", icon: AlertTriangle },
        { label: "Audit Logs", href: "/audit-logs", icon: History },
        { label: "Reports", href: "/reports", icon: BarChart3 },
      ],
    },
  ];

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: gray[25] }}>
      {/* Sidebar Navigation */}
      <aside
        style={{
          width: isCollapsed ? "72px" : "260px",
          backgroundColor: palette.ink,
          color: "white",
          display: "flex",
          flexDirection: "column",
          transition: "width 0.2s ease",
          position: "fixed",
          top: 0,
          bottom: 0,
          left: 0,
          zIndex: 100,
          boxShadow: "2px 0 8px rgba(0,0,0,0.15)",
        }}
      >
        {/* Sidebar Header */}
        <div
          style={{
            height: "64px",
            display: "flex",
            alignItems: "center",
            padding: isCollapsed ? "0" : "0 20px",
            justifyContent: isCollapsed ? "center" : "space-between",
            borderBottom: "1px solid #1a2e20",
          }}
        >
          {!isCollapsed && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "6px",
                  backgroundColor: palette.field,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  fontSize: "0.875rem",
                }}
              >
                KD
              </div>
              <span style={{ fontWeight: 800, fontSize: "1.05rem", letterSpacing: "0.02em" }}>
                KuapaDwaso <span style={{ color: palette.accent }}>Admin</span>
              </span>
            </div>
          )}
          {isCollapsed && (
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                backgroundColor: palette.field,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: "1.1rem",
              }}
            >
              K
            </div>
          )}
        </div>

        {/* Sidebar Nav Items */}
        <div
          className="sidebar-scroll"
          style={{ flex: 1, overflowY: "auto", padding: "16px 8px", display: "flex", flexDirection: "column", gap: "20px" }}
        >
          {navGroups.map((group, groupIdx) => (
            <div key={groupIdx} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {!isCollapsed && (
                <span
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                    color: palette.field,
                    paddingLeft: "12px",
                    marginBottom: "6px",
                  }}
                >
                  {group.title}
                </span>
              )}
              {group.items.map((item, itemIdx) => {
                const isActive = pathname === item.href;
                const IconComponent = item.icon;

                return (
                  <LinkComponent
                    key={itemIdx}
                    href={item.href}
                    title={isCollapsed ? item.label : undefined}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "10px 12px",
                      borderRadius: "6px",
                      color: isActive ? "white" : "#94a3b8",
                      backgroundColor: isActive ? palette.field : "transparent",
                      textDecoration: "none",
                      fontSize: "0.875rem",
                      fontWeight: isActive ? 700 : 500,
                      transition: "all 0.15s ease",
                      justifyContent: isCollapsed ? "center" : "flex-start",
                    }}
                    onMouseEnter={(e: MouseEvent<HTMLAnchorElement>) => {
                      if (!isActive) {
                        e.currentTarget.style.color = "white";
                        e.currentTarget.style.backgroundColor = "rgba(45, 138, 78, 0.15)";
                      }
                    }}
                    onMouseLeave={(e: MouseEvent<HTMLAnchorElement>) => {
                      if (!isActive) {
                        e.currentTarget.style.color = "#94a3b8";
                        e.currentTarget.style.backgroundColor = "transparent";
                      }
                    }}
                  >
                    <IconComponent size={18} style={{ flexShrink: 0 }} />
                    {!isCollapsed && <span>{item.label}</span>}
                  </LinkComponent>
                );
              })}
            </div>
          ))}
        </div>

        {/* Sidebar Footer Collapsible Toggle */}
        <div
          style={{
            padding: "12px",
            borderTop: "1px solid #1a2e20",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <button
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
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "white";
              e.currentTarget.style.backgroundColor = "#1a2e20";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "#94a3b8";
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>
      </aside>

      {/* Main Content Area Container */}
      <div
        style={{
          flex: 1,
          marginLeft: isCollapsed ? "72px" : "260px",
          transition: "margin-left 0.2s ease",
          display: "flex",
          flexDirection: "column",
          minWidth: 0, // prevents flex item overflow
        }}
      >
        {/* Top Header Navigation */}
        <header
          style={{
            height: "64px",
            backgroundColor: gray[0],
            borderBottom: `1px solid ${gray[100]}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 24px",
            position: "sticky",
            top: 0,
            zIndex: 90,
            boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
          }}
        >
          {/* Left search */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, maxWidth: "320px" }}>
            <Search size={18} style={{ color: gray[500] }} />
            <input
              type="text"
              placeholder="Search anything..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                border: 0,
                fontSize: "0.875rem",
                color: gray[700],
                outline: "none",
                width: "100%",
                backgroundColor: "transparent",
              }}
            />
          </div>

          {/* Right actions: Warehouse Selector + User Menu */}
          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            {/* Warehouse Dropdown */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: gray[500], textTransform: "uppercase" }}>
                Scope:
              </span>
              <select
                value={selectedWarehouseId}
                onChange={(e) => setSelectedWarehouseId(e.target.value)}
                style={{
                  padding: "6px 12px",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: gray[700],
                  border: `1px solid ${gray[300]}`,
                  borderRadius: "6px",
                  backgroundColor: "white",
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                <option value="all">All Warehouses</option>
                {warehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ height: "24px", width: "1px", backgroundColor: gray[100] }} />

            {/* User Profile */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  backgroundColor: palette.surface,
                  border: `1px solid ${palette.line}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: palette.field,
                }}
              >
                <User size={18} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", justifySelf: "center" }}>
                <span style={{ fontSize: "0.875rem", fontWeight: 700, color: gray[900], lineHeight: 1.2 }}>
                  Dev Admin
                </span>
                <span style={{ fontSize: "0.75rem", color: gray[500], fontWeight: 500 }}>
                  Administrator
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Inner Page View */}
        <main style={{ flex: 1, padding: "24px 32px", display: "flex", flexDirection: "column", gap: "24px" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
