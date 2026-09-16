"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { Home, IdCard, Route, Truck, User } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { AppConnectivity, WorkspaceSwitcher } from "../pwa/AppPwaTools";

const ProfilePwaTools = dynamic(
  () =>
    import("../pwa/ProfilePwaTools").then((module) => module.ProfilePwaTools),
  { ssr: false },
);

export default function TransporterLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { firebaseUser, principal, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isLogin = pathname === "/transporter/login";
  const previewAccessEnabled =
    process.env.NEXT_PUBLIC_PREVIEW_ACCESS_ENABLED === "true";
  const isPreviewBlockedRoute =
    previewAccessEnabled &&
    (pathname === "/transporter" ||
      pathname.startsWith("/transporter/dispatches"));
  const transporterProfile = principal?.profiles?.find(
    (profile) => profile.profileType === "transporter",
  );
  const isTransporter =
    principal?.role === "transporter" || transporterProfile !== undefined;

  useEffect(() => {
    if (isLogin) {
      return;
    }
    if (isPreviewBlockedRoute) {
      router.replace("/transporter/collections");
      return;
    }
    if (!isLoading) {
      if (firebaseUser === null) {
        router.push("/transporter/login");
      } else if (!isTransporter) {
        router.push("/signup");
      }
    }
  }, [
    firebaseUser,
    isLoading,
    isLogin,
    isPreviewBlockedRoute,
    isTransporter,
    router,
  ]);

  if (isLogin) {
    return <>{children}</>;
  }

  if (
    isLoading ||
    firebaseUser === null ||
    !isTransporter ||
    isPreviewBlockedRoute
  ) {
    return (
      <main className="page-shell">
        <div
          style={{
            padding: "40px 0",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <div
            className="skeleton"
            style={{ width: "220px", height: "24px" }}
          />
          <div
            className="skeleton"
            style={{ width: "100%", height: "110px", borderRadius: "16px" }}
          />
          <div
            className="skeleton"
            style={{ width: "100%", height: "180px", borderRadius: "16px" }}
          />
        </div>
      </main>
    );
  }
  const activePrincipal = principal!;

  const isActive = (path: string) => {
    if (path === "/transporter") {
      return pathname === "/transporter";
    }
    return pathname.startsWith(path);
  };

  return (
    <>
      <AppConnectivity ownerUserId={activePrincipal.userId} />
      <header className="transporter-top-navbar">
        <div className="transporter-navbar-container">
          <Link
            href={
              previewAccessEnabled ? "/transporter/collections" : "/transporter"
            }
            className="transporter-navbar-logo-area"
          >
            <svg
              viewBox="0 0 120 120"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="transporter-navbar-logo"
              style={{ width: "28px", height: "28px" }}
              aria-hidden="true"
            >
              <circle
                cx="22"
                cy="30"
                r="6"
                fill="var(--color-primary)"
                opacity="0.5"
              />
              <circle
                cx="18"
                cy="60"
                r="6"
                fill="var(--color-primary)"
                opacity="0.65"
              />
              <circle
                cx="22"
                cy="90"
                r="6"
                fill="var(--color-primary)"
                opacity="0.8"
              />
              <circle
                cx="48"
                cy="45"
                r="8"
                fill="var(--color-primary)"
                opacity="0.85"
              />
              <circle
                cx="48"
                cy="75"
                r="8"
                fill="var(--color-primary)"
                opacity="0.9"
              />
              <circle cx="88" cy="60" r="22" fill="var(--color-primary)" />
            </svg>
            <span className="transporter-navbar-brand">KuapaDwaso</span>
          </Link>
          <Link
            href="/transporter/profile"
            className="transporter-navbar-profile-button"
            aria-label="My Profile"
          >
            <User size={20} />
          </Link>
        </div>
      </header>

      <WorkspaceSwitcher principal={activePrincipal} current="transporter" />

      <main className="page-shell" style={{ paddingTop: "84px" }}>
        {children}
        {!previewAccessEnabled && pathname === "/transporter/profile" ? (
          <ProfilePwaTools />
        ) : null}
      </main>
      <nav className="bottom-nav">
        {!previewAccessEnabled ? (
          <Link
            href="/transporter"
            className={`nav-link ${isActive("/transporter") ? "nav-link-active" : ""}`}
          >
            <Home size={22} />
            <span>Home</span>
          </Link>
        ) : null}
        <Link
          href="/transporter/collections"
          className={`nav-link ${isActive("/transporter/collections") ? "nav-link-active" : ""}`}
        >
          <Route size={22} />
          <span>Collections</span>
        </Link>
        {!previewAccessEnabled ? (
          <Link
            href="/transporter/dispatches"
            className={`nav-link ${isActive("/transporter/dispatches") ? "nav-link-active" : ""}`}
          >
            <Truck size={22} />
            <span>Warehouse</span>
          </Link>
        ) : null}
        <Link
          href="/transporter/profile"
          className={`nav-link ${isActive("/transporter/profile") ? "nav-link-active" : ""}`}
        >
          <IdCard size={22} />
          <span>Profile</span>
        </Link>
      </nav>
    </>
  );
}
