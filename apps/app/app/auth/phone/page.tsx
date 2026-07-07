"use client";

import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import type { BuyerType, MarketplaceRole } from "@kuapa-dwaso/types";
import { buyerTypes } from "@kuapa-dwaso/types";
import { api } from "../../../../../convex/_generated/api";
import { identityFromFirebaseUser } from "../identity";
import { PhoneAuthPanel } from "../PhoneAuthPanel";
import { useAuth } from "../AuthProvider";
import type { User } from "firebase/auth";
import {
  Sprout,
  ShoppingCart,
  Truck,
  Warehouse,
  ShieldCheck,
  KeyRound,
  Smartphone,
  ArrowLeft,
} from "lucide-react";

type PhoneRole = Extract<MarketplaceRole, "farmer" | "buyer" | "transporter" | "warehouse_agent">;
type OnboardingStep = "role" | "phone_verify" | "warehouse_invite" | "profile_setup";

function LogoIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 120 120" className={className} style={style} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="22" cy="30" r="6" fill="currentColor" opacity="0.5" />
      <circle cx="18" cy="60" r="6" fill="currentColor" opacity="0.65" />
      <circle cx="22" cy="90" r="6" fill="currentColor" opacity="0.8" />
      <circle cx="48" cy="45" r="8" fill="currentColor" opacity="0.85" />
      <circle cx="48" cy="75" r="8" fill="currentColor" opacity="0.9" />
      <circle cx="88" cy="60" r="22" fill="currentColor" />
    </svg>
  );
}

const ROLES = [
  { id: "farmer" as const, label: "Farmer", desc: "Sell your produce", icon: <Sprout size={20} /> },
  { id: "buyer" as const, label: "Buyer", desc: "Source from farms", icon: <ShoppingCart size={20} /> },
  { id: "transporter" as const, label: "Transporter", desc: "Move goods & routes", icon: <Truck size={20} /> },
  { id: "warehouse_agent" as const, label: "Warehouse agent", desc: "Invited storage staff", icon: <Warehouse size={20} /> },
];

export default function PhoneAuthPage() {
  const [step, setStep] = useState<OnboardingStep>("role");
  const [role, setRole] = useState<PhoneRole>("farmer");
  const [verifiedUser, setVerifiedUser] = useState<User | null>(null);
  const [fullName, setFullName] = useState("");
  const [community, setCommunity] = useState("");
  const [claimExistingFarmer, setClaimExistingFarmer] = useState(false);
  const [buyerType, setBuyerType] = useState<BuyerType>("market_trader");
  const [organizationName, setOrganizationName] = useState("");
  const [destinationMarket, setDestinationMarket] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [baseLocation, setBaseLocation] = useState("");
  const [routesServed, setRoutesServed] = useState("");
  const [result, setResult] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);

  const { firebaseUser, principal, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const createFarmer = useMutation(api.auth.createSelfAppFarmerProfile);
  const claimFarmer = useMutation(api.auth.claimFarmerProfileByVerifiedPhone);
  const createBuyer = useMutation(api.auth.createOrLinkBuyerProfileAfterPhoneAuth);
  const createTransporter = useMutation(api.auth.createOrLinkTransporterProfileAfterPhoneAuth);

  // Auto-redirect if user already has a configured profile
  useEffect(() => {
    if (!authLoading && firebaseUser !== null && principal !== null && principal !== undefined) {
      const farmerProfile = principal.profiles?.find((p) => p.profileType === "farmer");
      const buyerProfile = principal.profiles?.find((p) => p.profileType === "buyer");
      const transporterProfile = principal.profiles?.find((p) => p.profileType === "transporter");

      if (principal.role === "farmer" || farmerProfile !== undefined) {
        router.push("/farmer");
      } else if (principal.role === "buyer" || buyerProfile !== undefined) {
        router.push("/buyer");
      } else if (principal.role === "transporter" || transporterProfile !== undefined) {
        router.push("/");
      }
    }
  }, [authLoading, firebaseUser, principal, router]);

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (verifiedUser === null) {
      setError("Verify the phone number before saving a profile.");
      return;
    }
    setError(undefined);
    setIsSaving(true);
    const identity = identityFromFirebaseUser(verifiedUser, { displayName: fullName });

    try {
      if (role === "farmer") {
        const saved = claimExistingFarmer
          ? await claimFarmer({ identity })
          : await createFarmer({
              identity,
              fullName,
              community,
            });
        setResult(`Farmer profile ready: ${saved.farmerId}`);
        router.push("/farmer");
      } else if (role === "buyer") {
        const createBuyerArgs: Parameters<typeof createBuyer>[0] = {
          identity,
          fullName,
          buyerType,
        };
        const trimmedOrganizationName = organizationName.trim();
        const trimmedDestinationMarket = destinationMarket.trim();
        if (trimmedOrganizationName.length > 0) {
          createBuyerArgs.organizationName = trimmedOrganizationName;
        }
        if (trimmedDestinationMarket.length > 0) {
          createBuyerArgs.destinationMarket = trimmedDestinationMarket;
        }
        const saved = await createBuyer(createBuyerArgs);
        setResult(`Buyer profile ready: ${saved.buyerId}`);
        router.push("/buyer");
      } else if (role === "transporter") {
        const saved = await createTransporter({
          identity,
          fullName,
          vehicleType,
          baseLocation,
          routesServed: routesServed.split(",").map((route) => route.trim()).filter(Boolean),
          destinationsServed: destinationMarket.split(",").map((market) => market.trim()).filter(Boolean),
        });
        setResult(`Transporter profile ready: ${saved.transporterId}`);
        router.push("/");
      } else {
        setError("Warehouse agents must accept an SMS invite from the invite acceptance route.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRoleContinue = () => {
    if (role === "warehouse_agent") {
      setStep("warehouse_invite");
    } else {
      setStep("phone_verify");
    }
  };

  const handleBackNavigation = () => {
    if (step === "phone_verify" || step === "warehouse_invite") {
      setStep("role");
    } else if (step === "profile_setup") {
      setVerifiedUser(null);
      setStep("phone_verify");
    }
  };

  return (
    <div className="auth-layout">
      {/* Mobile Top Navbar (Hidden on desktop) */}
      <header className="mobile-auth-navbar">
        {step !== "role" ? (
          <button
            type="button"
            className="mobile-navbar-back"
            onClick={handleBackNavigation}
          >
            <ArrowLeft size={18} />
            <span>Back</span>
          </button>
        ) : (
          <div className="brand-lockup" style={{ gap: "8px" }}>
            <span style={{ display: "grid", placeItems: "center", color: "var(--color-primary)" }}>
              <LogoIcon style={{ width: "20px", height: "20px" }} />
            </span>
            <span className="brand-name" style={{ fontSize: "18px" }}>KuapaDwaso</span>
          </div>
        )}

        {step !== "warehouse_invite" && (
          <span className="mobile-navbar-step">
            {step === "role" && "1 / 3"}
            {step === "phone_verify" && "2 / 3"}
            {step === "profile_setup" && "3 / 3"}
          </span>
        )}
      </header>

      {/* Brand / hero side (Desktop only) */}
      <aside className="auth-hero">
        <div className="brand-lockup">
          <span className="brand-mark">
            <LogoIcon style={{ width: "24px", height: "24px" }} />
          </span>
          <span className="brand-name">KuapaDwaso</span>
        </div>

        <div className="auth-hero-body">
          <h2>One platform for the whole harvest chain.</h2>
          <p>
            Farmers, buyers, transporters, and warehouse agents connect,
            trade, and move produce — all verified and secure.
          </p>

          <ul className="auth-trust">
            <li>
              <ShieldCheck size={20} />
              Bank-grade phone verification
            </li>
            <li>
              <KeyRound size={20} />
              No passwords to remember
            </li>
            <li>
              <Smartphone size={20} />
              Works on any device
            </li>
          </ul>
        </div>

        <p className="auth-hero-foot">© {new Date().getFullYear()} KuapaDwaso</p>
      </aside>

      {/* Form side */}
      <main className="auth-main">
        <div className="auth-inner">
          {/* Step Indicator */}
          {step !== "warehouse_invite" && (
            <div className="step-indicator">
              <div className={`step-dot ${step === "role" || step === "phone_verify" || step === "profile_setup" ? "is-active" : ""}`} />
              <div className={`step-dot ${step === "phone_verify" || step === "profile_setup" ? "is-active" : ""}`} />
              <div className={`step-dot ${step === "profile_setup" ? "is-active" : ""}`} />
            </div>
          )}

          {/* Inline Back Button (Desktop only) */}
          {step !== "role" && (
            <button
              type="button"
              className="auth-back-btn"
              onClick={handleBackNavigation}
            >
              <ArrowLeft size={16} />
              Back
            </button>
          )}

          {/* STEP 1: ROLE SELECTION */}
          {step === "role" && (
            <>
              <header className="auth-head">
                <span className="eyebrow">Step 1 of 3</span>
                <h1>Choose your role</h1>
                <p className="auth-sub">
                  Select how you want to connect and trade on the platform.
                </p>
              </header>

              <fieldset className="role-fieldset">
                <legend className="sr-only">Select your account type</legend>
                <div className="role-grid" style={{ marginBottom: "24px" }}>
                  {ROLES.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      className={`role-card ${role === r.id ? "is-active" : ""}`}
                      aria-pressed={role === r.id}
                      onClick={() => setRole(r.id)}
                    >
                      <span className="role-icon" aria-hidden>
                        {r.icon}
                      </span>
                      <span className="role-text">
                        <span className="role-label">{r.label}</span>
                        <span className="role-desc">{r.desc}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <button
                type="button"
                className="btn btn-primary"
                style={{ width: "100%" }}
                onClick={handleRoleContinue}
              >
                Continue
              </button>
            </>
          )}

          {/* STEP 2: PHONE VERIFICATION */}
          {step === "phone_verify" && (
            <>
              <header className="auth-head">
                <span className="eyebrow">Step 2 of 3</span>
                <h1>Verify your phone</h1>
                <p className="auth-sub">
                  Verify your account as a <strong>{role}</strong>. We will text you a secure code.
                </p>
              </header>

              <PhoneAuthPanel
                submitLabel="Confirm code"
                onVerified={(user) => {
                  setVerifiedUser(user);
                  setResult("Phone verified. Complete the profile fields below.");
                  setStep("profile_setup");
                }}
              />
            </>
          )}

          {/* WAREHOUSE AGENT ONLY STEP */}
          {step === "warehouse_invite" && (
            <>
              <header className="auth-head">
                <h1>Invite required</h1>
                <p className="auth-sub">
                  Warehouse agents can only join by responding to an invitation link.
                </p>
              </header>

              <div className="auth-card" style={{ display: "flex", flexDirection: "column", gap: "16px", borderLeft: "4px solid var(--color-primary)" }}>
                <p style={{ margin: 0, fontSize: "15px", lineHeight: "1.6", color: "var(--color-text)" }}>
                  If you are a warehouse agent, please check your SMS messages for your invitation link, or contact your warehouse manager.
                </p>
                <Link href="/invites/accept" style={{ width: "100%" }}>
                  <button type="button" className="btn btn-primary" style={{ width: "100%" }}>
                    Go to invite acceptance
                  </button>
                </Link>
              </div>
            </>
          )}

          {/* STEP 3: PROFILE SETUP */}
          {step === "profile_setup" && verifiedUser !== null && (
            <>
              <header className="auth-head">
                <span className="eyebrow">Step 3 of 3</span>
                <h1>Complete your profile</h1>
                <p className="auth-sub">
                  Provide your details to complete setup for your <strong>{role}</strong> profile.
                </p>
              </header>

              <div className="auth-card" style={{ marginBottom: "20px", display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderLeft: "4px solid var(--color-success)" }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, color: "var(--color-ink)", fontSize: "14px" }}>
                    Phone Verified
                  </p>
                  <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: "13px" }}>
                    {verifiedUser.phoneNumber || "Verified Phone"}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ padding: "8px 12px", fontSize: "13px" }}
                  onClick={() => {
                    setVerifiedUser(null);
                    setStep("phone_verify");
                  }}
                >
                  Change account
                </button>
              </div>

              <form
                className="auth-card"
                onSubmit={(event) => {
                  void saveProfile(event);
                }}
              >
                <div className="field-stack">
                  <label htmlFor="fullName">Full name</label>
                  <input
                    id="fullName"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="John Doe"
                    required
                    disabled={isSaving}
                  />
                </div>

                {role === "farmer" && (
                  <>
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={claimExistingFarmer}
                        onChange={(event) => setClaimExistingFarmer(event.target.checked)}
                        disabled={isSaving}
                      />
                      Claim an agent-created farmer profile
                    </label>
                    {!claimExistingFarmer && (
                      <div className="field-stack">
                        <label htmlFor="community">Community</label>
                        <input
                          id="community"
                          value={community}
                          onChange={(event) => setCommunity(event.target.value)}
                          placeholder="e.g. Ejura"
                          required
                          disabled={isSaving}
                        />
                      </div>
                    )}
                  </>
                )}

                {role === "buyer" && (
                  <>
                    <div className="field-stack">
                      <label htmlFor="buyerType">Buyer type</label>
                      <select
                        id="buyerType"
                        value={buyerType}
                        onChange={(event) => setBuyerType(event.target.value as BuyerType)}
                        disabled={isSaving}
                      >
                        {buyerTypes.map((type) => (
                          <option key={type} value={type}>
                            {type.replace(/_/g, " ")}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field-stack">
                      <label htmlFor="organizationName">Organization</label>
                      <input
                        id="organizationName"
                        value={organizationName}
                        onChange={(event) => setOrganizationName(event.target.value)}
                        placeholder="Optional"
                        disabled={isSaving}
                      />
                    </div>
                    <div className="field-stack">
                      <label htmlFor="destinationMarket">Destination market</label>
                      <input
                        id="destinationMarket"
                        value={destinationMarket}
                        onChange={(event) => setDestinationMarket(event.target.value)}
                        placeholder="Optional"
                        disabled={isSaving}
                      />
                    </div>
                  </>
                )}

                {role === "transporter" && (
                  <>
                    <div className="field-stack">
                      <label htmlFor="vehicleType">Vehicle type</label>
                      <input
                        id="vehicleType"
                        value={vehicleType}
                        onChange={(event) => setVehicleType(event.target.value)}
                        placeholder="e.g. 10-ton Truck"
                        required
                        disabled={isSaving}
                      />
                    </div>
                    <div className="field-stack">
                      <label htmlFor="baseLocation">Base location</label>
                      <input
                        id="baseLocation"
                        value={baseLocation}
                        onChange={(event) => setBaseLocation(event.target.value)}
                        placeholder="e.g. Kumasi"
                        required
                        disabled={isSaving}
                      />
                    </div>
                    <div className="field-stack">
                      <label htmlFor="routesServed">Routes served</label>
                      <input
                        id="routesServed"
                        value={routesServed}
                        onChange={(event) => setRoutesServed(event.target.value)}
                        placeholder="e.g. Kumasi-Accra, Ejura-Kumasi (comma separated)"
                        disabled={isSaving}
                      />
                    </div>
                    <div className="field-stack">
                      <label htmlFor="transporterDestinations">Destinations served</label>
                      <input
                        id="transporterDestinations"
                        value={destinationMarket}
                        onChange={(event) => setDestinationMarket(event.target.value)}
                        placeholder="e.g. Techiman, Kejetia (comma separated)"
                        required
                        disabled={isSaving}
                      />
                    </div>
                  </>
                )}

                <button type="submit" className="btn btn-primary" style={{ marginTop: "10px" }} disabled={isSaving}>
                  {isSaving ? "Saving profile..." : "Save profile"}
                </button>
              </form>
            </>
          )}

          {result !== undefined && <p className="auth-success" style={{ marginTop: "12px" }}>{result}</p>}
          {error !== undefined && <p className="auth-error" style={{ marginTop: "12px" }}>{error}</p>}

          <p className="auth-legal">
            By continuing you agree to our{" "}
            <Link href="/terms">Terms</Link> &{" "}
            <Link href="/privacy">Privacy Policy</Link>.
          </p>
        </div>
      </main>
    </div>
  );
}
