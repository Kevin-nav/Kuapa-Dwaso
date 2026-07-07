"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Home, Sprout, Receipt, Wallet } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";

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

  const isActive = (path: string) => {
    if (path === "/farmer") {
      return pathname === "/farmer";
    }
    return pathname.startsWith(path);
  };

  return (
    <>
      <main className="page-shell">{children}</main>

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
