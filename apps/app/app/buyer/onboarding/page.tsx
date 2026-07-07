"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { useAuth } from "@/app/auth/AuthProvider";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import type { Id } from "@convex/_generated/dataModel";
import type { BuyerType } from "@kuapa-dwaso/types";

export default function BuyerOnboarding() {
  const { principal, firebaseUser } = useAuth();
  const router = useRouter();
  const createProfile = useMutation(api.buyers.createOrUpdateProfile);

  const [fullName, setFullName] = useState(principal?.name || "");
  const [phoneNumber, setPhoneNumber] = useState(
    firebaseUser?.phoneNumber || principal?.phoneNumber || ""
  );
  const [buyerType, setBuyerType] = useState<BuyerType>(
    "market_trader"
  );
  const [organizationName, setOrganizationName] = useState("");
  const [destinationMarket, setDestinationMarket] = useState("Makola Market");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!principal?.userId) {
      setError("User session not found. Please log in again.");
      return;
    }
    if (!fullName.trim()) {
      setError("Full Name is required.");
      return;
    }
    if (!phoneNumber.trim()) {
      setError("Phone number is required.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await createProfile({
        actorUserId: principal.userId as Id<"users">,
        userId: principal.userId as Id<"users">,
        fullName: fullName.trim(),
        displayName: fullName.trim(),
        phoneNumber: phoneNumber.trim(),
        buyerType,
        ...(organizationName.trim() ? { organizationName: organizationName.trim() } : {}),
        ...(destinationMarket.trim() ? { destinationMarket: destinationMarket.trim() } : {}),
      });

      // Redirect to buyer homepage
      router.push("/buyer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create profile. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const buyerTypesList: { value: BuyerType; label: string }[] = [
    { value: "market_trader", label: "Market Trader" },
    { value: "retailer", label: "Retailer" },
    { value: "restaurant", label: "Restaurant" },
    { value: "hotel", label: "Hotel / Hospitality" },
    { value: "school", label: "School / Institution" },
    { value: "processor", label: "Food Processor" },
    { value: "exporter", label: "Exporter" },
    { value: "institution", label: "Government / Corporate Institution" },
    { value: "other", label: "Other Business" },
  ];

  const destinationMarketsList = [
    "Makola Market",
    "Kaneshie Market",
    "Kejetia Market",
    "Techiman Market",
    "Agbogbloshie Market",
    "Agona Swedru Market",
    "Koforidua Central Market",
    "Other",
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", padding: "10px 0" }}>
      <div>
        <p className="eyebrow">Setup Profile</p>
        <h1>Buyer Onboarding</h1>
        <p style={{ marginBottom: "10px" }}>
          Provide your business details to start browsing warehouse inventory and placing produce orders.
        </p>
      </div>

      {error && (
        <div className="attention-card" style={{ borderColor: "var(--color-danger-border)", backgroundColor: "var(--color-danger-bg)", color: "var(--color-danger)" }}>
          <div className="attention-body">
            <span className="attention-title">Submission Error</span>
            <span className="attention-text">{error}</span>
          </div>
        </div>
      )}

      <form onSubmit={(e) => { void handleSubmit(e); }} className="auth-card" style={{ width: "100%", gap: "18px" }}>
        <div className="field-stack">
          <label htmlFor="fullName">Full Name / Contact Name</label>
          <input
            type="text"
            id="fullName"
            className="form-input"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Ama Serwaa"
            disabled={isSubmitting}
            required
          />
        </div>

        <div className="field-stack">
          <label htmlFor="phoneNumber">Phone Number</label>
          <input
            type="tel"
            id="phoneNumber"
            className="form-input"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="e.g. +233 24 123 4567"
            disabled={isSubmitting}
            required
          />
        </div>

        <div className="field-stack">
          <label htmlFor="buyerType">Business / Buyer Type</label>
          <select
            id="buyerType"
            value={buyerType}
            onChange={(e) => setBuyerType(e.target.value as BuyerType)}
            disabled={isSubmitting}
          >
            {buyerTypesList.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field-stack">
          <label htmlFor="organizationName">Business / Org Name (Optional)</label>
          <input
            type="text"
            id="organizationName"
            className="form-input"
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
            placeholder="e.g. Serwaa Produce Traders Ltd"
            disabled={isSubmitting}
          />
        </div>

        <div className="field-stack">
          <label htmlFor="destinationMarket">Preferred Destination Market</label>
          <select
            id="destinationMarket"
            value={destinationMarket}
            onChange={(e) => setDestinationMarket(e.target.value)}
            disabled={isSubmitting}
          >
            {destinationMarketsList.map((market) => (
              <option key={market} value={market}>
                {market}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="btn btn-primary btn-full"
          style={{ marginTop: "10px" }}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Submitting Profile..." : "Complete Setup"}
        </button>
      </form>
    </div>
  );
}
