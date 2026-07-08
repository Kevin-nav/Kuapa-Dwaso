"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, IdCard, Truck } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";

export default function TransporterLayout({ children }: { children: ReactNode }) {
  const { firebaseUser, principal, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isLogin = pathname === "/transporter/login";
  const transporterProfile = principal?.profiles?.find((profile) => profile.profileType === "transporter");
  const isTransporter = principal?.role === "transporter" || transporterProfile !== undefined;

  useEffect(() => {
    if (isLogin) {
      return;
    }
    if (!isLoading) {
      if (firebaseUser === null) {
        router.push("/transporter/login");
      } else if (!isTransporter) {
        router.push("/signup");
      }
    }
  }, [firebaseUser, isLoading, isLogin, isTransporter, router]);

  if (isLogin) {
    return <>{children}</>;
  }

  if (isLoading || firebaseUser === null || !isTransporter) {
    return (
      <main className="page-shell">
        <div style={{ padding: "40px 0", display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="skeleton" style={{ width: "220px", height: "24px" }} />
          <div className="skeleton" style={{ width: "100%", height: "110px", borderRadius: "16px" }} />
          <div className="skeleton" style={{ width: "100%", height: "180px", borderRadius: "16px" }} />
        </div>
      </main>
    );
  }

  const isActive = (path: string) => {
    if (path === "/transporter") {
      return pathname === "/transporter";
    }
    return pathname.startsWith(path);
  };

  return (
    <>
      <main className="page-shell">{children}</main>
      <nav className="bottom-nav">
        <Link href="/transporter" className={`nav-link ${isActive("/transporter") ? "nav-link-active" : ""}`}>
          <Home size={22} />
          <span>Home</span>
        </Link>
        <Link href="/transporter/dispatches" className={`nav-link ${isActive("/transporter/dispatches") ? "nav-link-active" : ""}`}>
          <Truck size={22} />
          <span>Dispatches</span>
        </Link>
        <Link href="/transporter/profile" className={`nav-link ${isActive("/transporter/profile") ? "nav-link-active" : ""}`}>
          <IdCard size={22} />
          <span>Profile</span>
        </Link>
      </nav>
    </>
  );
}
