"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Search, ClipboardList, User, Home, Sprout, Receipt } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";

type BuyerLayoutProps = {
  children: ReactNode;
};

export default function BuyerLayout({ children }: BuyerLayoutProps) {
  const { firebaseUser, principal, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const buyerProfile = principal?.profiles?.find((p) => p.profileType === "buyer");
  const isBuyer = principal?.role === "buyer" || buyerProfile !== undefined;
  const farmerProfile = principal?.profiles?.find((p) => p.profileType === "farmer");
  const isFarmer = principal?.role === "farmer" || farmerProfile !== undefined;
  const isAllowed = isBuyer || isFarmer;
  const isLogin = pathname === "/buyer/login";
  const isOnboarding = pathname === "/buyer/onboarding";

  useEffect(() => {
    if (isLogin) {
      return;
    }
    if (!isLoading) {
      if (firebaseUser === null) {
        router.push("/buyer/login");
      } else if (!isAllowed && !isOnboarding) {
        router.push("/buyer/onboarding");
      } else if (isAllowed && isOnboarding) {
        router.push("/buyer");
      }
    }
  }, [isLoading, firebaseUser, isAllowed, isLogin, isOnboarding, router]);

  if (isLogin) {
    return <>{children}</>;
  }

  if (isLoading || firebaseUser === null || (!isAllowed && !isOnboarding)) {
    return (
      <main className="page-shell">
        <div style={{ padding: "40px 0", display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="skeleton" style={{ width: "200px", height: "24px" }} />
          <div className="skeleton" style={{ width: "100%", height: "120px", borderRadius: "16px" }} />
          <div className="skeleton" style={{ width: "100%", height: "80px", borderRadius: "16px" }} />
          <div className="skeleton" style={{ width: "100%", height: "200px", borderRadius: "16px" }} />
        </div>
      </main>
    );
  }

  const isActive = (path: string) => {
    if (path === "/buyer") {
      return pathname === "/buyer" || pathname.startsWith("/buyer/inventory");
    }
    return pathname.startsWith(path);
  };

  return (
    <>
      <header className="buyer-top-navbar">
        <div className="buyer-navbar-container">
          <Link href={isFarmer ? "/farmer" : "/buyer"} className="buyer-navbar-logo-area">
            <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="buyer-navbar-logo" style={{ width: "28px", height: "28px" }} aria-hidden="true">
              <circle cx="22" cy="30" r="6" fill="var(--color-primary)" opacity="0.5" />
              <circle cx="18" cy="60" r="6" fill="var(--color-primary)" opacity="0.65" />
              <circle cx="22" cy="90" r="6" fill="var(--color-primary)" opacity="0.8" />
              <circle cx="48" cy="45" r="8" fill="var(--color-primary)" opacity="0.85" />
              <circle cx="48" cy="75" r="8" fill="var(--color-primary)" opacity="0.9" />
              <circle cx="88" cy="60" r="22" fill="var(--color-primary)" />
            </svg>
            <span className="buyer-navbar-brand">KuapaDwaso</span>
          </Link>
          <Link href={isFarmer ? "/farmer/profile" : "/buyer/profile"} className="buyer-navbar-profile-button" aria-label="My Profile">
            <User size={20} />
          </Link>
        </div>
      </header>

      <main className="page-shell" style={{ paddingTop: "84px" }}>{children}</main>

      {!isOnboarding && (
        <nav className="bottom-nav">
          {isFarmer ? (
            <>
              <Link href="/farmer" className="nav-link">
                <Home size={22} />
                <span>Home</span>
              </Link>
              <Link href="/farmer/produce" className="nav-link">
                <Sprout size={22} />
                <span>Produce</span>
              </Link>
              <Link href="/buyer" className={`nav-link ${isActive("/buyer") ? "nav-link-active" : ""}`}>
                <Search size={22} />
                <span>Marketplace</span>
              </Link>
              <Link href="/farmer/receipts" className="nav-link">
                <Receipt size={22} />
                <span>Receipts</span>
              </Link>
            </>
          ) : (
            <>
              <Link href="/buyer" className={`nav-link ${isActive("/buyer") ? "nav-link-active" : ""}`}>
                <Search size={22} />
                <span>Marketplace</span>
              </Link>
              <Link href="/buyer/orders" className={`nav-link ${isActive("/buyer/orders") ? "nav-link-active" : ""}`}>
                <ClipboardList size={22} />
                <span>Orders</span>
              </Link>
              <Link href="/buyer/profile" className={`nav-link ${isActive("/buyer/profile") ? "nav-link-active" : ""}`}>
                <User size={22} />
                <span>Profile</span>
              </Link>
            </>
          )}
        </nav>
      )}
    </>
  );
}
