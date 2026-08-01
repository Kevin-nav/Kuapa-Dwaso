"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState, useEffect } from "react";
import type { FormEvent } from "react";
import { CheckCircle2, MailCheck, ShieldCheck, Loader2 } from "lucide-react";
import {
  getAuthErrorCode,
  getAuthErrorMessage,
  shouldCreateInvitedEmailAccountAfterSignInFailure,
} from "@kuapa-dwaso/utils";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  type User,
} from "firebase/auth";
import { firebaseAuth } from "../../auth/firebase";
import { PhoneAuthPanel } from "../../auth/PhoneAuthPanel";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;

function InviteAcceptContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  
  const [inviteDetails, setInviteDetails] = useState<{
    type: string;
    channel: string;
    targetEmail?: string;
    targetPhoneNumber?: string;
    status: string;
    expiresAt: number;
  } | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [inviteError, setInviteError] = useState<string | undefined>();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState<string | undefined>();

  useEffect(() => {
    if (token.trim().length === 0) {
      void Promise.resolve().then(() => {
        setLoadingInvite(false);
        setInviteError("Invite token is missing from the URL.");
      });
      return;
    }
    const fetchInvite = async () => {
      try {
        if (apiBaseUrl === undefined || apiBaseUrl.trim().length === 0) {
          throw new Error("NEXT_PUBLIC_API_URL is required to load invitations.");
        }
        const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/invitations/pending/${encodeURIComponent(token.trim())}`);
        if (!response.ok) {
          throw new Error("This invitation is invalid, has expired, or was already accepted.");
        }
        const data = await response.json();
        setInviteDetails(data);
        if (data.targetEmail) {
          setEmail(data.targetEmail);
        }
      } catch (err) {
        setInviteError(err instanceof Error ? err.message : "Could not load invitation details.");
      } finally {
        setLoadingInvite(false);
      }
    };
    void fetchInvite();
  }, [token]);

  const roleLabel = inviteDetails
    ? inviteDetails.type.replace("_invite", "").replace("_", " ")
    : "user";

  const getOpsRedirectUrl = () => {
    if (typeof window !== "undefined") {
      const hostname = window.location.hostname;
      if (hostname === "localhost" || hostname === "127.0.0.1") {
        return "http://localhost:3003/";
      }
      if (hostname.includes("staging")) {
        return "https://ops.staging.kuapadwaso.com/";
      }
      return "https://ops.kuapadwaso.com/";
    }
    return "https://ops.kuapadwaso.com/";
  };
  const getAdminRedirectUrl = () => {
    if (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) return "http://localhost:3002/";
    return typeof window !== "undefined" && window.location.hostname.includes("staging") ? "https://admin.staging.kuapadwaso.com/" : "https://admin.kuapadwaso.com/";
  };

  const sendVerification = async (user: User) => {
    const continueUrl = new URL(window.location.href);
    await sendEmailVerification(user, {
      url: continueUrl.toString(),
      handleCodeInApp: false,
    });
  };

  const acceptInvite = async (user: User) => {
    if (apiBaseUrl === undefined || apiBaseUrl.trim().length === 0) {
      throw new Error("NEXT_PUBLIC_API_URL is required to accept invites.");
    }
    if (token.trim().length === 0) {
      throw new Error("Invite token is missing from the URL.");
    }
    const idToken = await user.getIdToken(true);
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/invitations/accept`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${idToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        token: token.trim(),
        displayName: displayName.trim() || undefined,
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(readApiErrorMessage(body, response.status));
    }
    const accepted = (await response.json()) as { profileType: string; userId: string; mfaRequired: boolean };
    setStatus(
      `Invite accepted! Redirecting you to the portal...`
    );
    setTimeout(() => {
      if (accepted.profileType === "warehouse_agent") {
        window.location.href = getOpsRedirectUrl();
      } else if (accepted.profileType === "admin") {
        window.location.href = getAdminRedirectUrl();
      } else {
        window.location.href = "/";
      }
    }, 1500);
  };

  const submitEmail = async (event: FormEvent) => {
    event.preventDefault();
    setError(undefined);
    setIsSubmitting(true);
    try {
      let credential;
      try {
        credential = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      } catch (signInError) {
        if (shouldCreateInvitedEmailAccountAfterSignInFailure(signInError)) {
          credential = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
          setVerificationEmail(credential.user.email ?? email.trim());
          await sendVerification(credential.user);
          setStatus("Your account is ready. Open the verification email before signing in to continue.");
          return;
        }
        throw signInError;
      }
      if (!credential.user.emailVerified) {
        setVerificationEmail(credential.user.email ?? email.trim());
        setStatus("Your email still needs verification. Check your inbox or resend the email below.");
        return;
      }
      await acceptInvite(credential.user);
    } catch (err) {
      if (getAuthErrorCode(err) === "auth/multi-factor-auth-required") {
        setError("Firebase requires a second factor. Complete the configured MFA challenge, then retry acceptance.");
      } else if (getAuthErrorCode(err) !== undefined) {
        setError(getAuthErrorMessage(err, "sign-in"));
      } else {
        setError(err instanceof Error ? err.message : "Could not accept invite.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const resendVerification = async () => {
    setError(undefined);
    setIsSubmitting(true);
    try {
      const user = firebaseAuth.currentUser;
      if (user === null || user.email?.toLowerCase() !== email.trim().toLowerCase()) {
        throw new Error(`Sign in with the invited ${roleLabel} email before resending verification.`);
      }
      await sendVerification(user);
      setVerificationEmail(user.email ?? email.trim());
      setStatus("A fresh verification email was sent. Check your inbox and spam or junk folder.");
    } catch (err) {
      setError(
        getAuthErrorCode(err) === "auth/too-many-requests"
          ? "Firebase has temporarily limited verification emails. Check your inbox and spam folder first, then wait a few minutes before resending."
          : getAuthErrorCode(err) !== undefined
            ? getAuthErrorMessage(err, "sign-in")
            : err instanceof Error
              ? err.message
              : "Could not resend the verification email."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingInvite) {
    return (
      <main className="page-shell auth-page">
        <section className="auth-panel" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "300px" }}>
          <Loader2 className="animate-spin" size={36} style={{ color: "var(--color-primary)" }} />
          <p style={{ marginLeft: "12px" }}>Loading invitation details...</p>
        </section>
      </main>
    );
  }

  if (inviteError !== undefined) {
    return (
      <main className="page-shell auth-page">
        <section className="auth-panel">
          <p className="eyebrow">Invite acceptance</p>
          <h1>Invitation Error</h1>
          <div className="auth-error-card" role="alert" style={{ marginTop: "20px" }}>
            <span aria-hidden="true">!</span>
            <p>{inviteError}</p>
          </div>
        </section>
      </main>
    );
  }

  const isPhoneAuthRequired = inviteDetails?.type === "warehouse_agent_invite" || inviteDetails?.type === "transporter_invite";

  return (
    <main className="page-shell auth-page">
      <section className="auth-panel">
        <p className="eyebrow">Invite acceptance</p>
        <h1>Accept platform invite</h1>
        <p style={{ marginBottom: "24px" }}>
          You have been invited to join Kuapa Dwaso as a <strong style={{ textTransform: "capitalize" }}>{roleLabel}</strong>.
        </p>

        <div className="field-stack" style={{ marginBottom: "16px" }}>
          <label htmlFor="displayName">Display name</label>
          <input id="displayName" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Enter your display name" disabled={isSubmitting} />
        </div>

        {inviteDetails?.targetEmail && (
          <div className="field-stack" style={{ marginBottom: "20px" }}>
            <label>Invited Email Address</label>
            <div style={{ padding: "10px 14px", background: "var(--color-neutral-bg, #f3f4f6)", borderRadius: "8px", border: "1px solid var(--color-border, #e5e7eb)", fontSize: "15px", fontWeight: 500 }}>
              {inviteDetails.targetEmail}
            </div>
            <span className="field-help" style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
              This is the email address that received the invitation.
            </span>
          </div>
        )}

        {isPhoneAuthRequired ? (
          <PhoneAuthPanel
            submitLabel="Verify Phone"
            onVerified={async (user) => {
              setError(undefined);
              setIsSubmitting(true);
              try {
                await acceptInvite(user);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Accepting invite failed.");
              } finally {
                setIsSubmitting(false);
              }
            }}
          />
        ) : (
          <form
            className="auth-card"
            onSubmit={(event) => {
              void submitEmail(event);
            }}
          >
            <div className="field-stack">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" autoComplete="email" value={email} disabled required />
            </div>
            <div className="field-stack">
              <label htmlFor="password">Password</label>
              <input id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={isSubmitting} />
            </div>
            <p className="auth-status">
              Privileged invitations require verified email and the configured Firebase authenticator MFA challenge.
            </p>
            <button type="submit" disabled={isSubmitting}>
              {verificationEmail === undefined ? `Continue as ${roleLabel}` : `I've verified — sign in as ${roleLabel}`}
            </button>
          </form>
        )}

        {verificationEmail !== undefined ? (
          <section className="verification-callout" aria-live="polite">
            <div className="verification-callout-icon"><MailCheck size={24} /></div>
            <div className="verification-callout-body">
              <p className="eyebrow">Check your email</p>
              <h2>Verify {verificationEmail}</h2>
              <p>Open the message from KuapaDwaso and select the verification link. If it is not in your inbox, check your spam, junk, or promotions folder.</p>
              <div className="verification-steps">
                <span><CheckCircle2 size={16} /> Verify your email</span>
                <span><ShieldCheck size={16} /> Return here and sign in as {roleLabel}</span>
              </div>
              <button type="button" className="verification-resend" disabled={isSubmitting} onClick={() => void resendVerification()}>
                Resend verification email
              </button>
            </div>
          </section>
        ) : <p className="auth-status">{status}</p>}
        {error !== undefined && <div className="auth-error-card" role="alert"><span aria-hidden="true">!</span><p>{error}</p></div>}
      </section>
    </main>
  );
}

function readApiErrorMessage(body: string, status: number): string {
  if (body.trim().length === 0) {
    return `Invite acceptance failed with ${status}.`;
  }
  try {
    const parsed = JSON.parse(body) as { message?: unknown };
    if (typeof parsed.message === "string") {
      return parsed.message;
    }
    if (Array.isArray(parsed.message)) {
      return parsed.message.filter((item): item is string => typeof item === "string").join(", ");
    }
  } catch {
    // The API may return a plain-text error from an upstream provider.
  }
  return body;
}

export default function InviteAcceptPage() {
  return (
    <Suspense fallback={<main className="page-shell auth-page"><div className="skeleton" style={{ width: "100%", height: "360px", borderRadius: "16px" }} /></main>}>
      <InviteAcceptContent />
    </Suspense>
  );
}
