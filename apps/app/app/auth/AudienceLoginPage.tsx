"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  ClipboardList,
  Info,
  Search,
  Sprout,
  Truck,
} from "lucide-react";
import { signInWithCustomToken } from "firebase/auth";
import type { ProfileType } from "@kuapa-dwaso/types";
import { PhoneAuthPanel } from "./PhoneAuthPanel";
import { useAuth } from "./AuthProvider";
import { firebaseAuth } from "./firebase";

type LoginAudience = Extract<ProfileType, "farmer" | "buyer" | "transporter">;

type AudienceLoginPageProps = {
  audience: LoginAudience;
};

type AudienceConfig = {
  eyebrow: string;
  title: string;
  description: string;
  successPath: string;
  missingProfileText: string;
  icon: LucideIcon;
  trustItems: string[];
  previewAction: string;
  previewDescription: string;
};

const audienceConfig: Record<LoginAudience, AudienceConfig> = {
  farmer: {
    eyebrow: "Farmer login",
    title: "See maize offers, collection, and payment records.",
    description:
      "Enter the phone number connected to your farmer records. We will send a secure code by SMS.",
    successPath: "/farmer",
    missingProfileText:
      "We could not find a farmer profile for this phone number yet.",
    icon: Sprout,
    trustItems: [
      "Maize offer terms",
      "Collection instructions",
      "Sale and payment updates",
    ],
    previewAction: "Continue as a farmer",
    previewDescription:
      "Open the shared farmer profile to add maize, review offers, and follow collection.",
  },
  buyer: {
    eyebrow: "Buyer login",
    title: "Continue your maize request.",
    description:
      "Use the phone number on your buyer profile to review sourcing, terms, delivery, and payment records.",
    successPath: "/buyer",
    missingProfileText:
      "We could not find a buyer profile for this phone number yet.",
    icon: Search,
    trustItems: [
      "Requested versus confirmed supply",
      "Quality-cleared lots",
      "Delivery and payment status",
    ],
    previewAction: "Continue as a buyer",
    previewDescription:
      "Open the shared buyer profile to request maize and follow sourcing and delivery.",
  },
  transporter: {
    eyebrow: "Transporter login",
    title: "View dispatch assignments and delivery status.",
    description: "Use the phone number connected to your transporter profile.",
    successPath: "/transporter",
    missingProfileText:
      "We could not find a transporter profile for this phone number yet.",
    icon: Truck,
    trustItems: ["Assigned dispatches", "Route details", "Delivery status"],
    previewAction: "Continue as a transporter",
    previewDescription:
      "Open the shared transporter profile to view assigned maize collections.",
  },
};

const previewAccessEnabled =
  process.env.NEXT_PUBLIC_PREVIEW_ACCESS_ENABLED === "true";

type PreviewSession = {
  customToken: string;
  role: LoginAudience;
};

function LogoIcon({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      style={style}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="22" cy="30" r="6" fill="currentColor" opacity="0.5" />
      <circle cx="18" cy="60" r="6" fill="currentColor" opacity="0.65" />
      <circle cx="22" cy="90" r="6" fill="currentColor" opacity="0.8" />
      <circle cx="48" cy="45" r="8" fill="currentColor" opacity="0.85" />
      <circle cx="48" cy="75" r="8" fill="currentColor" opacity="0.9" />
      <circle cx="88" cy="60" r="22" fill="currentColor" />
    </svg>
  );
}

export function AudienceLoginPage({ audience }: AudienceLoginPageProps) {
  const { firebaseUser, principal, isLoading } = useAuth();
  const [hasVerifiedInThisFlow, setHasVerifiedInThisFlow] = useState(false);
  const [status, setStatus] = useState<string | undefined>();
  const router = useRouter();
  const config = audienceConfig[audience];
  const description = previewAccessEnabled
    ? config.previewDescription
    : config.description;

  async function continueWithPreviewProfile() {
    setStatus("Opening the shared profile...");
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
    if (apiBaseUrl === undefined) {
      setStatus(
        "This profile is unavailable right now. Please try again shortly.",
      );
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/preview-access/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: audience }),
      });
      if (!response.ok) throw new Error("Preview access request failed.");
      const session = (await response.json()) as PreviewSession;
      if (
        session.role !== audience ||
        typeof session.customToken !== "string"
      ) {
        throw new Error("Preview access response was invalid.");
      }
      setHasVerifiedInThisFlow(true);
      await signInWithCustomToken(firebaseAuth, session.customToken);
    } catch {
      setStatus("We could not open the shared profile. Please try again.");
    }
  }

  const hasExpectedProfile = useMemo(() => {
    if (principal === null || principal === undefined) {
      return false;
    }
    return (
      principal.role === audience ||
      principal.profiles.some((profile) => profile.profileType === audience)
    );
  }, [audience, principal]);

  useEffect(() => {
    if (!isLoading && firebaseUser !== null && hasExpectedProfile) {
      const previewPath =
        audience === "buyer"
          ? "/buyer/requests"
          : audience === "farmer"
            ? "/farmer/offers"
            : "/transporter/collections";
      router.push(previewAccessEnabled ? previewPath : config.successPath);
    }
  }, [
    audience,
    config.successPath,
    firebaseUser,
    hasExpectedProfile,
    isLoading,
    router,
  ]);

  const followupStatus =
    !isLoading &&
    hasVerifiedInThisFlow &&
    firebaseUser !== null &&
    !hasExpectedProfile
      ? config.missingProfileText
      : status;

  return (
    <div className="auth-layout">
      <aside className="auth-hero">
        <div className="brand-lockup">
          <span className="brand-mark">
            <LogoIcon style={{ width: "24px", height: "24px" }} />
          </span>
          <span className="brand-name">KuapaDwaso</span>
        </div>

        <div className="auth-hero-body">
          <h2>{config.title}</h2>
          <p>{description}</p>
          <ul className="auth-trust">
            {config.trustItems.map((item) => (
              <li key={item}>
                <ClipboardList size={20} />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="auth-hero-foot">
          {previewAccessEnabled
            ? "A prepared profile for exploring the full workflow."
            : "One secure phone login for this workspace."}
        </p>
      </aside>

      <main className="auth-main">
        <div className="auth-inner">
          <div className="brand-lockup brand-lockup--mobile">
            <span className="brand-mark">
              <LogoIcon style={{ width: "20px", height: "20px" }} />
            </span>
            <span className="brand-name">KuapaDwaso</span>
          </div>

          <header className="auth-head">
            <span className="eyebrow">{config.eyebrow}</span>
            <h1>{config.title}</h1>
            <p className="auth-sub">{description}</p>
          </header>

          {previewAccessEnabled ? (
            <div className="auth-card preview-access-card">
              <div className="preview-access-notice">
                <Info size={19} aria-hidden="true" />
                <p>
                  <strong>Shared preview account</strong> Information entered
                  here may be reset. Do not enter personal, payment, or
                  confidential information.
                </p>
              </div>
              <button
                className="btn btn-primary btn-full preview-access-button"
                type="button"
                disabled={status === "Opening the shared profile..."}
                onClick={() => void continueWithPreviewProfile()}
              >
                {status === "Opening the shared profile..."
                  ? "Opening profile..."
                  : config.previewAction}
                <ArrowRight size={18} aria-hidden="true" />
              </button>
              {status !== undefined ? (
                <p className="auth-status" role="status">
                  {status}
                </p>
              ) : null}
            </div>
          ) : (
            <PhoneAuthPanel
              submitLabel="Continue"
              onVerified={() => {
                setHasVerifiedInThisFlow(true);
                setStatus("Phone verified. Checking your profile...");
              }}
            />
          )}

          {!previewAccessEnabled && followupStatus !== undefined && (
            <div className="auth-card auth-followup-card">
              <p className="auth-status">{followupStatus}</p>
              {!isLoading && firebaseUser !== null && !hasExpectedProfile && (
                <Link href="/signup" className="btn btn-primary">
                  Create the right account
                </Link>
              )}
            </div>
          )}

          {!previewAccessEnabled ? (
            <p className="auth-legal">
              New here? <Link href="/signup">Create an account</Link>
            </p>
          ) : null}
        </div>
      </main>
    </div>
  );
}
