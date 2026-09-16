"use client";

import { useAuth } from "../../auth/AuthProvider";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useRouter } from "next/navigation";
import {
  LogOut,
  CheckCircle,
  ShieldAlert,
  Edit3,
  Phone,
  Building,
  MapPin,
} from "lucide-react";
import type { Id } from "@convex/_generated/dataModel";
import { PreviewProfileImage } from "../../preview/PreviewProfileImage";

export default function BuyerProfilePage() {
  const { principal, signOut } = useAuth();
  const router = useRouter();

  const buyerProfile = principal?.profiles?.find(
    (p) => p.profileType === "buyer",
  );
  const buyerId = buyerProfile?.profileId as Id<"buyers"> | undefined;

  // Retrieve Buyer Profile
  const buyer = useQuery(
    api.buyers.getById,
    principal !== null && principal !== undefined && buyerId !== undefined
      ? { actorUserId: principal.userId as Id<"users">, buyerId }
      : "skip",
  );

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  const getBuyerTypeLabel = (type?: string) => {
    switch (type) {
      case "market_trader":
        return "Market Trader";
      case "retailer":
        return "Retailer";
      case "restaurant":
        return "Restaurant";
      case "hotel":
        return "Hotel / Hospitality";
      case "school":
        return "School / Institution";
      case "processor":
        return "Food Processor";
      case "exporter":
        return "Exporter";
      case "institution":
        return "Government / Corporate Institution";
      case "other":
        return "Other Business";
      default:
        return "Buyer Business";
    }
  };

  const getVerificationChip = (status?: string) => {
    if (status === "verified") {
      return (
        <span className="status-chip status-success">
          <CheckCircle size={12} />
          <span>Verified Account</span>
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

  const displayName = buyer?.fullName || principal?.name || "Market Buyer";
  const organizationName = buyer?.organizationName || "Independent Aggregator";
  const buyerTypeLabel = getBuyerTypeLabel(buyer?.buyerType);
  const phoneNumber = buyer?.phoneNumber || principal?.phoneNumber || "N/A";
  const destinationMarket = buyer?.destinationMarket || "Makola Market";
  const verificationStatus = buyer?.verificationStatus || "pending";
  const showPreviewPortrait =
    process.env.NEXT_PUBLIC_PREVIEW_ACCESS_ENABLED === "true" &&
    displayName === "Adwoa Owusu";

  return (
    <div
      style={{
        display: "flex",
        flex: "1 0 auto",
        flexDirection: "column",
        gap: "24px",
      }}
    >
      {/* Header */}
      <div>
        <p className="eyebrow">Settings</p>
        <h1>My Profile</h1>
      </div>

      {/* Profile Card */}
      <div className="farmer-card" style={{ gap: "16px", padding: "20px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div className="preview-profile-card-identity">
            {showPreviewPortrait ? (
              <PreviewProfileImage
                asset="buyer"
                alt="Adwoa Owusu"
                className="preview-profile-card-portrait"
              />
            ) : null}
            <div>
              <h2 style={{ fontSize: "1.35rem", color: "var(--color-ink)" }}>
                {displayName}
              </h2>
              <div
                style={{
                  fontSize: "0.875rem",
                  color: "var(--color-text-muted)",
                  marginTop: "2px",
                }}
              >
                {buyerTypeLabel}
              </div>
            </div>
          </div>
          {getVerificationChip(verificationStatus)}
        </div>

        <div
          style={{
            borderTop: "1px dashed var(--color-line)",
            paddingTop: "14px",
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            fontSize: "0.9375rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Building
              size={16}
              style={{ color: "var(--color-primary)", flexShrink: 0 }}
            />
            <div>
              <span
                style={{
                  color: "var(--color-text-muted)",
                  fontSize: "0.8125rem",
                  display: "block",
                }}
              >
                Business / Org Name
              </span>
              <strong style={{ color: "var(--color-ink)" }}>
                {organizationName}
              </strong>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <MapPin
              size={16}
              style={{ color: "var(--color-primary)", flexShrink: 0 }}
            />
            <div>
              <span
                style={{
                  color: "var(--color-text-muted)",
                  fontSize: "0.8125rem",
                  display: "block",
                }}
              >
                Target Delivery Market
              </span>
              <strong style={{ color: "var(--color-ink)" }}>
                {destinationMarket}
              </strong>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Phone
              size={16}
              style={{ color: "var(--color-primary)", flexShrink: 0 }}
            />
            <div>
              <span
                style={{
                  color: "var(--color-text-muted)",
                  fontSize: "0.8125rem",
                  display: "block",
                }}
              >
                Phone Contact
              </span>
              <strong style={{ color: "var(--color-ink)" }}>
                {phoneNumber}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* Support Message */}
      <div
        className="attention-card"
        style={{
          backgroundColor: "var(--color-info-bg)",
          borderColor: "var(--color-info-border)",
          color: "var(--color-info)",
        }}
      >
        <div className="attention-body">
          <span
            className="attention-title"
            style={{ color: "var(--color-info)" }}
          >
            Kuapa Dwaso fulfilment
          </span>
          <span
            className="attention-text"
            style={{ color: "var(--color-text)" }}
          >
            We manage sourcing, quality checks, delivery, and payment records
            for your orders. Contact us if your delivery market changes.
          </span>
        </div>
      </div>

      {buyer?.buyerType === "institution" ? (
        <button
          type="button"
          className="btn btn-primary btn-full"
          onClick={() => router.push("/buyer/verification")}
        >
          <ShieldAlert size={18} />
          <span>Enhanced verification</span>
        </button>
      ) : null}

      {/* Navigation Buttons */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          marginTop: "12px",
        }}
      >
        <button
          type="button"
          className="btn btn-secondary btn-full"
          style={{
            borderColor: "var(--color-primary)",
            color: "var(--color-primary)",
          }}
          onClick={() => router.push("/buyer/onboarding")}
        >
          <Edit3 size={18} />
          <span>Edit Profile Details</span>
        </button>

        <button
          type="button"
          className="btn btn-danger btn-full"
          onClick={() => {
            void handleSignOut();
          }}
        >
          <LogOut size={18} />
          <span>Sign Out</span>
        </button>
      </div>

      <p className="timestamp">Kuapa Dwaso · Connected</p>
    </div>
  );
}
