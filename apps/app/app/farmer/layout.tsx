"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Home, Sprout, Receipt, Wallet, User } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { AppConnectivity, WorkspaceSwitcher } from "../pwa/AppPwaTools";

const ProfilePwaTools = dynamic(() => import("../pwa/ProfilePwaTools").then((module) => module.ProfilePwaTools), { ssr: false });

type FarmerLayoutProps = {
  children: ReactNode;
};

export default function FarmerLayout({ children }: FarmerLayoutProps) {
  const { firebaseUser, principal, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isLogin = pathname === "/farmer/login";

  const farmerProfile = principal?.profiles?.find((p) => p.profileType === "farmer");
  const isFarmer = principal?.role === "farmer" || farmerProfile !== undefined;

  useEffect(() => {
    if (isLogin) {
      return;
    }
    if (!isLoading) {
      if (firebaseUser === null) {
        router.push("/farmer/login");
      } else if (!isFarmer) {
        router.push("/");
      }
    }
  }, [isLoading, firebaseUser, isFarmer, isLogin, router]);

  if (isLogin) {
    return <>{children}</>;
  }

  if (isLoading || firebaseUser === null || !isFarmer) {
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
  const activePrincipal = principal!;

  const isActive = (path: string) => {
    if (path === "/farmer") {
      return pathname === "/farmer";
    }
    return pathname.startsWith(path);
  };

  return (
    <>
      <AppConnectivity ownerUserId={activePrincipal.userId} />
      <header className="farmer-top-navbar">
        <div className="farmer-navbar-container">
          <Link href="/farmer" className="farmer-navbar-logo-area">
            <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="farmer-navbar-logo" style={{ width: "28px", height: "28px" }} aria-hidden="true">
              <circle cx="22" cy="30" r="6" fill="var(--color-primary)" opacity="0.5" />
              <circle cx="18" cy="60" r="6" fill="var(--color-primary)" opacity="0.65" />
              <circle cx="22" cy="90" r="6" fill="var(--color-primary)" opacity="0.8" />
              <circle cx="48" cy="45" r="8" fill="var(--color-primary)" opacity="0.85" />
              <circle cx="48" cy="75" r="8" fill="var(--color-primary)" opacity="0.9" />
              <circle cx="88" cy="60" r="22" fill="var(--color-primary)" />
            </svg>
            <span className="farmer-navbar-brand">KuapaDwaso</span>
          </Link>
          <Link href="/farmer/profile" className="farmer-navbar-profile-button" aria-label="My Profile">
            <User size={20} />
          </Link>
        </div>
      </header>

      <WorkspaceSwitcher principal={activePrincipal} current="farmer" />

      <main className="page-shell" style={{ paddingTop: "84px" }}>{children}{pathname === "/farmer/profile" ? <ProfilePwaTools /> : null}</main>

      <nav className="bottom-nav">
        <Link href="/farmer" className={`nav-link ${isActive("/farmer") ? "nav-link-active" : ""}`}>
          <Home size={22} />
          <span>Home</span>
        </Link>
        <Link href="/farmer/produce" className={`nav-link ${isActive("/farmer/produce") ? "nav-link-active" : ""}`}>
          <Sprout size={22} />
          <span>Produce</span>
        </Link>
        <Link href="/farmer/receipts" className={`nav-link ${isActive("/farmer/receipts") ? "nav-link-active" : ""}`}>
          <Receipt size={22} />
          <span>Receipts</span>
        </Link>
        <Link href="/farmer/fees" className={`nav-link ${isActive("/farmer/fees") ? "nav-link-active" : ""}`}>
          <Wallet size={22} />
          <span>Fees</span>
        </Link>
      </nav>
    </>
  );
}
