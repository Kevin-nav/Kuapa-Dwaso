"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Search, ClipboardList, User } from "lucide-react";
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
  const isLogin = pathname === "/buyer/login";
  const isOnboarding = pathname === "/buyer/onboarding";

  useEffect(() => {
    if (isLogin) {
      return;
    }
    if (!isLoading) {
      if (firebaseUser === null) {
        router.push("/buyer/login");
      } else if (!isBuyer && !isOnboarding) {
        router.push("/buyer/onboarding");
      } else if (isBuyer && isOnboarding) {
        router.push("/buyer");
      }
    }
  }, [isLoading, firebaseUser, isBuyer, isLogin, isOnboarding, router]);

  if (isLogin) {
    return <>{children}</>;
  }

  if (isLoading || firebaseUser === null || (!isBuyer && !isOnboarding)) {
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
      <main className="page-shell">{children}</main>

      {!isOnboarding && (
        <nav className="bottom-nav">
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
        </nav>
      )}
    </>
  );
}
