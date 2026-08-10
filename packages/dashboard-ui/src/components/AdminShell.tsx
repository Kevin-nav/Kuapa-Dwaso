// packages/dashboard-ui/src/components/AdminShell.tsx
"use client";

/* eslint-disable react/prop-types */

import { useEffect, useRef, useState } from "react";
import type {
  ComponentType,
  CSSProperties,
  MouseEvent,
  ReactNode,
} from "react";
import { palette, gray } from "@kuapa-dwaso/design-tokens";
import { useWarehouseFilter } from "./WarehouseFilterContext.js";
import { MockDatabase } from "../mockDb.js";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Boxes,
  ShoppingBag,
  DollarSign,
  Landmark,
  Truck,
  Sprout,
  Building,
  UserCheck,
  ShieldCheck,
  Warehouse as WarehouseIcon,
  Scale,
  AlertTriangle,
  History,
  BarChart3,
  Bell,
  Newspaper,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Search,
  User,
  ChevronDown,
  LogOut,
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

const AnchorLink: ComponentType<LinkComponentProps> = ({
  href,
  children,
  ...props
}) => (
  <a href={href} {...props}>
    {children}
  </a>
);

export type AdminShellProps = {
  children: ReactNode;
  pathname?: string;
  LinkComponent?: ComponentType<LinkComponentProps>;
  warehouseOptions?: { id: string; name: string }[];
  principalName?: string;
  principalRoleLabel?: string;
  onSignOut?: () => Promise<void>;
  showStories?: boolean;
};

export function AdminShell({
  children,
  pathname = "/",
  LinkComponent = AnchorLink,
  warehouseOptions,
  principalName = "Dev Admin",
  principalRoleLabel = "Administrator",
  onSignOut,
  showStories = false,
}: AdminShellProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string>();
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);
  const signOutButtonRef = useRef<HTMLButtonElement>(null);
  const { selectedWarehouseId, setSelectedWarehouseId } = useWarehouseFilter();
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!isProfileMenuOpen) {
      return;
    }

    signOutButtonRef.current?.focus();

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsProfileMenuOpen(false);
        profileButtonRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isProfileMenuOpen]);

  const handleSignOut = async () => {
    if (onSignOut === undefined || isSigningOut) {
      return;
    }
    setSignOutError(undefined);
    setIsSigningOut(true);
    try {
      await onSignOut();
      setIsProfileMenuOpen(false);
    } catch {
      setSignOutError("Sign out failed. Check your connection and try again.");
    } finally {
      setIsSigningOut(false);
    }
  };

  const warehouses = warehouseOptions ?? MockDatabase.getWarehouses();

  const navGroups: NavGroup[] = [
    {
      title: "Operations",
      items: [
        { label: "Overview", href: "/", icon: LayoutDashboard },
        { label: "Inventory", href: "/inventory", icon: Boxes },
        { label: "Orders", href: "/orders", icon: ShoppingBag },
        { label: "Sales", href: "/sales", icon: DollarSign },
        { label: "Finance", href: "/finance", icon: Landmark },
        { label: "Dispatch", href: "/dispatch", icon: Truck },
        {
          label: "Market Services",
          href: "/market-services",
          icon: CalendarDays,
        },
      ],
    },
    {
      title: "People",
      items: [
        { label: "Farmers", href: "/farmers", icon: Sprout },
        { label: "Buyers", href: "/buyers", icon: Building },
        { label: "Agents", href: "/agents", icon: UserCheck },
        { label: "Access", href: "/access", icon: ShieldCheck },
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
        ...(showStories
          ? [{ label: "Stories", href: "/blog", icon: Newspaper }]
          : []),
        { label: "Disputes", href: "/disputes", icon: AlertTriangle },
        { label: "Notifications", href: "/notifications", icon: Bell },
        { label: "Audit Logs", href: "/audit-logs", icon: History },
        { label: "Reports", href: "/reports", icon: BarChart3 },
      ],
    },
  ];

  return (
    <div
      style={{ display: "flex", minHeight: "100vh", backgroundColor: gray[25] }}
    >
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
              <svg
                width="28"
                height="28"
                viewBox="0 0 120 120"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style={{ flexShrink: 0 }}
              >
                <circle
                  cx="22"
                  cy="30"
                  r="6"
                  fill={palette.field}
                  opacity="0.5"
                />
                <circle
                  cx="18"
                  cy="60"
                  r="6"
                  fill={palette.field}
                  opacity="0.65"
                />
                <circle
                  cx="22"
                  cy="90"
                  r="6"
                  fill={palette.field}
                  opacity="0.8"
                />
                <circle
                  cx="48"
                  cy="45"
                  r="8"
                  fill={palette.field}
                  opacity="0.85"
                />
                <circle
                  cx="48"
                  cy="75"
                  r="8"
                  fill={palette.field}
                  opacity="0.9"
                />
                <circle cx="88" cy="60" r="22" fill={palette.field} />
              </svg>
              <span
                style={{
                  fontWeight: 800,
                  fontSize: "1.05rem",
                  letterSpacing: "0.02em",
                }}
              >
                KuapaDwaso <span style={{ color: palette.accent }}>Admin</span>
              </span>
            </div>
          )}
          {isCollapsed && (
            <svg
              width="36"
              height="36"
              viewBox="0 0 120 120"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ flexShrink: 0 }}
            >
              <circle
                cx="22"
                cy="30"
                r="6"
                fill={palette.field}
                opacity="0.5"
              />
              <circle
                cx="18"
                cy="60"
                r="6"
                fill={palette.field}
                opacity="0.65"
              />
              <circle
                cx="22"
                cy="90"
                r="6"
                fill={palette.field}
                opacity="0.8"
              />
              <circle
                cx="48"
                cy="45"
                r="8"
                fill={palette.field}
                opacity="0.85"
              />
              <circle
                cx="48"
                cy="75"
                r="8"
                fill={palette.field}
                opacity="0.9"
              />
              <circle cx="88" cy="60" r="22" fill={palette.field} />
            </svg>
          )}
        </div>

        {/* Sidebar Nav Items */}
        <div
          className="sidebar-scroll"
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 8px",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
          }}
        >
          {navGroups.map((group, groupIdx) => (
            <div
              key={groupIdx}
              style={{ display: "flex", flexDirection: "column", gap: "4px" }}
            >
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
                        e.currentTarget.style.backgroundColor =
                          "rgba(45, 138, 78, 0.15)";
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
            {isCollapsed ? (
              <ChevronRight size={18} />
            ) : (
              <ChevronLeft size={18} />
            )}
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flex: 1,
              maxWidth: "320px",
            }}
          >
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
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  color: gray[500],
                  textTransform: "uppercase",
                }}
              >
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

            <div
              style={{
                height: "24px",
                width: "1px",
                backgroundColor: gray[100],
              }}
            />

            {/* User Profile */}
            <div
              ref={profileMenuRef}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  setIsProfileMenuOpen(false);
                }
              }}
              style={{ position: "relative" }}
            >
              <button
                ref={profileButtonRef}
                type="button"
                aria-expanded={isProfileMenuOpen}
                aria-haspopup="menu"
                aria-label={`Open profile menu for ${principalName}`}
                onClick={() => {
                  setSignOutError(undefined);
                  setIsProfileMenuOpen((isOpen) => !isOpen);
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setIsProfileMenuOpen(true);
                  }
                }}
                style={{
                  appearance: "none",
                  background: "transparent",
                  border: 0,
                  borderRadius: "8px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "4px",
                  textAlign: "left",
                }}
              >
                <span
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
                </span>
                <span
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    justifySelf: "center",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.875rem",
                      fontWeight: 700,
                      color: gray[900],
                      lineHeight: 1.2,
                    }}
                  >
                    {principalName}
                  </span>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: gray[500],
                      fontWeight: 500,
                    }}
                  >
                    {principalRoleLabel}
                  </span>
                </span>
                <ChevronDown
                  aria-hidden="true"
                  size={16}
                  style={{ color: gray[500] }}
                />
              </button>

              {isProfileMenuOpen ? (
                <div
                  role="menu"
                  aria-label="Profile actions"
                  style={{
                    backgroundColor: gray[0],
                    border: `1px solid ${gray[100]}`,
                    borderRadius: "8px",
                    boxShadow: "0 10px 25px rgba(15, 31, 20, 0.14)",
                    minWidth: "190px",
                    padding: "6px",
                    position: "absolute",
                    right: 0,
                    top: "calc(100% + 8px)",
                    zIndex: 100,
                  }}
                >
                  <button
                    ref={signOutButtonRef}
                    type="button"
                    role="menuitem"
                    disabled={isSigningOut || onSignOut === undefined}
                    onClick={() => void handleSignOut()}
                    style={{
                      alignItems: "center",
                      background: "transparent",
                      border: 0,
                      borderRadius: "6px",
                      color: gray[700],
                      cursor: isSigningOut ? "wait" : "pointer",
                      display: "flex",
                      font: "inherit",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      gap: "10px",
                      padding: "10px",
                      textAlign: "left",
                      width: "100%",
                    }}
                  >
                    <LogOut aria-hidden="true" size={17} />
                    {isSigningOut ? "Signing out…" : "Sign out"}
                  </button>
                  {signOutError !== undefined ? (
                    <p
                      role="alert"
                      style={{
                        color: "#b91c1c",
                        fontSize: "0.75rem",
                        lineHeight: 1.4,
                        margin: "4px 10px 6px",
                      }}
                    >
                      {signOutError}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </header>

        {/* Inner Page View */}
        <main
          style={{
            flex: 1,
            padding: "24px 32px",
            display: "flex",
            flexDirection: "column",
            gap: "24px",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
