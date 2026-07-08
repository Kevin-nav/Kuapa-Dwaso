"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { ClipboardList, Search, Sprout, Truck } from "lucide-react";
import type { ProfileType } from "@kuapa-dwaso/types";
import { PhoneAuthPanel } from "./PhoneAuthPanel";
import { useAuth } from "./AuthProvider";

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
};

const audienceConfig: Record<LoginAudience, AudienceConfig> = {
  farmer: {
    eyebrow: "Farmer login",
    title: "See your produce, receipts, and payments.",
    description: "Enter the phone number connected to your farmer records. We will send a secure code by SMS.",
    successPath: "/farmer",
    missingProfileText: "We could not find a farmer profile for this phone number yet.",
    icon: Sprout,
    trustItems: ["Storage receipts", "Daily fee visibility", "Sale and payment updates"],
  },
  buyer: {
    eyebrow: "Buyer login",
    title: "Continue buying verified warehouse stock.",
    description: "Use the phone number on your buyer profile to continue orders and reservations.",
    successPath: "/buyer",
    missingProfileText: "We could not find a buyer profile for this phone number yet.",
    icon: Search,
    trustItems: ["Verified stock", "Order status", "Dispatch updates"],
  },
  transporter: {
    eyebrow: "Transporter login",
    title: "View dispatch assignments and delivery status.",
    description: "Use the phone number connected to your transporter profile.",
    successPath: "/transporter",
    missingProfileText: "We could not find a transporter profile for this phone number yet.",
    icon: Truck,
    trustItems: ["Assigned dispatches", "Route details", "Delivery status"],
  },
};

export function AudienceLoginPage({ audience }: AudienceLoginPageProps) {
  const { firebaseUser, principal, isLoading } = useAuth();
  const [hasVerifiedInThisFlow, setHasVerifiedInThisFlow] = useState(false);
  const [status, setStatus] = useState<string | undefined>();
  const router = useRouter();
  const config = audienceConfig[audience];
  const Icon = config.icon;

  const hasExpectedProfile = useMemo(() => {
    if (principal === null || principal === undefined) {
      return false;
    }
    return principal.role === audience || principal.profiles.some((profile) => profile.profileType === audience);
  }, [audience, principal]);

  useEffect(() => {
    if (!isLoading && firebaseUser !== null && hasExpectedProfile) {
      router.push(config.successPath);
    }
  }, [config.successPath, firebaseUser, hasExpectedProfile, isLoading, router]);

  const followupStatus =
    !isLoading && hasVerifiedInThisFlow && firebaseUser !== null && !hasExpectedProfile
      ? config.missingProfileText
      : status;

  return (
    <div className="auth-layout">
      <aside className="auth-hero">
        <div className="brand-lockup">
          <span className="brand-mark">
            <Icon size={22} />
          </span>
          <span className="brand-name">KuapaDwaso</span>
        </div>

        <div className="auth-hero-body">
          <h2>{config.title}</h2>
          <p>{config.description}</p>
          <ul className="auth-trust">
            {config.trustItems.map((item) => (
              <li key={item}>
                <ClipboardList size={20} />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="auth-hero-foot">One secure phone login for this workspace.</p>
      </aside>

      <main className="auth-main">
        <div className="auth-inner">
          <div className="brand-lockup brand-lockup--mobile">
            <span className="brand-mark">
              <Icon size={20} />
            </span>
            <span className="brand-name">KuapaDwaso</span>
          </div>

          <header className="auth-head">
            <span className="eyebrow">{config.eyebrow}</span>
            <h1>{config.title}</h1>
            <p className="auth-sub">{config.description}</p>
          </header>

          <PhoneAuthPanel
            submitLabel="Continue"
            onVerified={() => {
              setHasVerifiedInThisFlow(true);
              setStatus("Phone verified. Checking your profile...");
            }}
          />

          {followupStatus !== undefined && (
            <div className="auth-card auth-followup-card">
              <p className="auth-status">{followupStatus}</p>
              {!isLoading && firebaseUser !== null && !hasExpectedProfile && (
                <Link href="/signup" className="btn btn-primary">
                  Create the right account
                </Link>
              )}
            </div>
          )}

          <p className="auth-legal">
            New here? <Link href="/signup">Create an account</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
