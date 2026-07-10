"use client";

import { useAuth } from "../../auth/AuthProvider";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useRouter } from "next/navigation";
import { LogOut, CheckCircle, ShieldAlert, Phone, Building, MapPin, Tag } from "lucide-react";
import type { Id } from "@convex/_generated/dataModel";

export default function FarmerProfilePage() {
  const { principal, signOut } = useAuth();
  const router = useRouter();

  const farmerProfile = principal?.profiles?.find((p) => p.profileType === "farmer");
  const farmerId = farmerProfile?.profileId as Id<"farmers"> | undefined;

  // Retrieve Farmer Profile
  const farmer = useQuery(
    api.farmers.getById,
    principal !== null && principal !== undefined && farmerId !== undefined
      ? { actorUserId: principal.userId as Id<"users">, farmerId }
      : "skip"
  );

  const warehouses = useQuery(api.warehouses.list, {});

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  const getVerificationChip = (status?: string) => {
    if (status === "verified") {
      return (
        <span className="status-chip status-success">
          <CheckCircle size={12} />
          <span>Verified Farmer</span>
        </span>
      );
    }
    if (status === "rejected") {
      return (
        <span className="status-chip status-danger">
          <ShieldAlert size={12} />
          <span>Rejected Profile</span>
        </span>
      );
    }
    return (
      <span className="status-chip status-warning">
        <ShieldAlert size={12} />
        <span>Pending Verification</span>
      </span>
    );
  };

  if (farmer === undefined) {
    return <div className="skeleton" style={{ minHeight: "420px", borderRadius: "20px" }} />;
  }

  if (farmer === null) {
    return (
      <div className="farmer-card">
        <span className="card-title">Farmer profile not found</span>
        <span className="card-meta">Please contact operations or register.</span>
      </div>
    );
  }

  const displayName = farmer.fullName || principal?.name || "Market Farmer";
  const farmerCode = farmer.farmerCode || "N/A";
  const phoneNumber = farmer.phoneNumber || principal?.phoneNumber || "N/A";
  const community = farmer.community || "N/A";
  const region = farmer.region || "N/A";
  const verificationStatus = farmer.verificationStatus || "pending";
  
  const preferredWarehouse = warehouses?.find((w) => w._id === farmer.preferredWarehouseId);
  const warehouseName = preferredWarehouse?.name || "None Assigned";

  return (
    <div style={{ display: "flex", flex: "1 0 auto", flexDirection: "column", gap: "24px" }}>
      {/* Header */}
      <div>
        <p className="eyebrow">Settings</p>
        <h1>My Profile</h1>
      </div>

      {/* Profile Card */}
      <div className="farmer-card" style={{ gap: "16px", padding: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ fontSize: "1.35rem", color: "var(--color-ink)" }}>{displayName}</h2>
            <div style={{ fontSize: "0.875rem", color: "var(--color-text-muted)", marginTop: "2px" }}>
              Farmer Profile
            </div>
          </div>
          {getVerificationChip(verificationStatus)}
        </div>

        <div style={{ borderTop: "1px dashed var(--color-line)", paddingTop: "14px" }} />

        <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "0.9375rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Tag size={16} style={{ color: "var(--color-primary)", flexShrink: 0 }} />
            <div>
              <span style={{ color: "var(--color-text-muted)", fontSize: "0.8125rem", display: "block" }}>
                Farmer Code
              </span>
              <strong style={{ color: "var(--color-ink)" }}>{farmerCode}</strong>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <MapPin size={16} style={{ color: "var(--color-primary)", flexShrink: 0 }} />
            <div>
              <span style={{ color: "var(--color-text-muted)", fontSize: "0.8125rem", display: "block" }}>
                Community & Region
              </span>
              <strong style={{ color: "var(--color-ink)" }}>{community} ({region})</strong>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Building size={16} style={{ color: "var(--color-primary)", flexShrink: 0 }} />
            <div>
              <span style={{ color: "var(--color-text-muted)", fontSize: "0.8125rem", display: "block" }}>
                Preferred Warehouse
              </span>
              <strong style={{ color: "var(--color-ink)" }}>{warehouseName}</strong>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Phone size={16} style={{ color: "var(--color-primary)", flexShrink: 0 }} />
            <div>
              <span style={{ color: "var(--color-text-muted)", fontSize: "0.8125rem", display: "block" }}>
                Phone Contact
              </span>
              <strong style={{ color: "var(--color-ink)" }}>{phoneNumber}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Info Message */}
      <div className="attention-card" style={{ backgroundColor: "var(--color-info-bg)", borderColor: "var(--color-info-border)", color: "var(--color-info)" }}>
        <div className="attention-body">
          <span className="attention-title" style={{ color: "var(--color-info)" }}>Deposit and Receipts Info</span>
          <span className="attention-text" style={{ color: "var(--color-text)" }}>
            Your farmer profile is registered to track inventory deposits and issue receipts at the warehouse network. For details or updates, contact your local warehouse agent.
          </span>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "12px" }}>
        <button
          type="button"
          className="btn btn-danger btn-full"
          onClick={() => { void handleSignOut(); }}
        >
          <LogOut size={18} />
          <span>Sign Out</span>
        </button>
      </div>

      <p className="timestamp">KuapaDwaso Farmer Client · Connected</p>
    </div>
  );
}
