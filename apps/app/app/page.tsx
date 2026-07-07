"use client";

import { useEffect } from "react";
import type { MarketplaceAudience } from "@kuapa-dwaso/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "./auth/AuthProvider";

const audience: MarketplaceAudience = "farmer";

export default function ProductHomePage() {
  const { firebaseUser, principal, isLoading, signOut } = useAuth();
  const router = useRouter();

  const farmerProfile = principal?.profiles?.find((p) => p.profileType === "farmer");
  const isFarmer = principal?.role === "farmer" || farmerProfile !== undefined;

  useEffect(() => {
    if (!isLoading && firebaseUser !== null && isFarmer) {
      router.push("/farmer");
    }
  }, [isLoading, firebaseUser, isFarmer, router]);

  if (isLoading) {
    return (
      <main className="page-shell">
        <section className="intro">
          <div className="skeleton" style={{ width: "120px", height: "20px", marginBottom: "16px" }} />
          <div className="skeleton" style={{ width: "280px", height: "40px", marginBottom: "20px" }} />
          <div className="skeleton" style={{ width: "100%", height: "60px", marginBottom: "24px" }} />
          <div className="button-row" style={{ width: "100%" }}>
            <div className="skeleton" style={{ flex: 1, height: "56px", borderRadius: "12px" }} />
            <div className="skeleton" style={{ flex: 1, height: "56px", borderRadius: "12px" }} />
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <section className="intro">
        <p className="eyebrow">{audience} portal</p>
        <h1 style={{ fontSize: "2.25rem", color: "var(--color-ink)" }}>KuapaDwaso Warehouse Network</h1>
        <p style={{ maxWidth: "480px", margin: "0 auto 32px" }}>
          Create the account that matches your work, or return directly to your own workspace.
        </p>

        {firebaseUser !== null ? (
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "16px" }}>
            {isFarmer ? (
              <button type="button" className="btn btn-primary btn-full" onClick={() => router.push("/farmer")}>
                Go to Farmer Dashboard
              </button>
            ) : (
              <div className="attention-card" style={{ textAlign: "left", marginBottom: "8px" }}>
                <div className="attention-body">
                  <span className="attention-title">Profile Required</span>
                  <span className="attention-text">
                    You are logged in, but you don&apos;t have a linked farmer profile. Please contact support or verify your role.
                  </span>
                </div>
              </div>
            )}
            <button type="button" className="btn btn-secondary btn-full" onClick={() => void signOut()}>
              Sign Out
            </button>
          </div>
        ) : (
          <div className="button-row" style={{ width: "100%", display: "flex", flexDirection: "column", gap: "12px" }}>
            <Link href="/signup" style={{ width: "100%" }}>
              <button type="button" className="btn btn-primary btn-full">
                Create an account
              </button>
            </Link>
            <div className="auth-route-grid">
              <Link href="/farmer/login">Farmer login</Link>
              <Link href="/buyer/login">Buyer login</Link>
              <Link href="/transporter/login">Transporter login</Link>
            </div>
            <Link href="/invites/accept" style={{ width: "100%" }}>
              <button type="button" className="btn btn-secondary btn-full">
                Accept Platform Invite
              </button>
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
