"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import type { FormEvent } from "react";
import { CheckCircle2, MailCheck, ShieldCheck } from "lucide-react";
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

type InviteMode = "admin_email" | "warehouse_manager_email" | "warehouse_agent_phone";

function InviteAcceptContent() {
  const searchParams = useSearchParams();
  const requestedMode = searchParams.get("mode");
  const [mode, setMode] = useState<InviteMode>(
    requestedMode === "warehouse_manager_email" || requestedMode === "warehouse_agent_phone"
      ? requestedMode
      : "admin_email",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [status, setStatus] = useState<string>("Choose the invite type and sign in with the invited identity.");
  const [error, setError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState<string | undefined>();

  const token = searchParams.get("token") ?? "";
  const roleLabel = mode === "admin_email" ? "admin" : mode === "warehouse_manager_email" ? "warehouse manager" : "warehouse agent";

  const sendVerification = async (user: User) => {
    const continueUrl = new URL(window.location.href);
    continueUrl.searchParams.set("mode", mode);
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
    const idToken = await user.getIdToken();
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/invitations/accept`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${idToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        token,
        displayName: displayName.trim() || undefined,
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(readApiErrorMessage(body, response.status));
    }
    const accepted = (await response.json()) as { profileType: string; userId: string; mfaRequired: boolean };
    setStatus(
      accepted.mfaRequired
        ? `Invite accepted for ${accepted.profileType}. MFA was satisfied by Firebase before acceptance.`
        : `Invite accepted for ${accepted.profileType}. User ${accepted.userId} is linked.`,
    );
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
              : "Could not resend the verification email.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="page-shell auth-page">
      <section className="auth-panel">
        <p className="eyebrow">Invite acceptance</p>
        <h1>Accept platform invite</h1>
        <p>Choose the role named in your invitation. Your sign-in method and security steps will match that role.</p>

        <div className="role-grid">
          {([
            ["admin_email", "admin"],
            ["warehouse_manager_email", "warehouse manager"],
            ["warehouse_agent_phone", "warehouse agent"],
          ] as const).map(([value, label]) => (
            <button key={value} type="button" className={mode === value ? "selected" : ""} onClick={() => { setMode(value); setVerificationEmail(undefined); setError(undefined); }}>
              {label}
            </button>
          ))}
        </div>

        {mode === "warehouse_agent_phone" ? (
          <PhoneAuthPanel
            submitLabel="Accept invite"
            onVerified={async (user) => {
              setError(undefined);
              await acceptInvite(user);
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
              <label htmlFor="displayName">Display name</label>
              <input id="displayName" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
            </div>
            <div className="field-stack">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </div>
            <div className="field-stack">
              <label htmlFor="password">Password</label>
              <input id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </div>
            <p className="auth-status">
              {mode === "warehouse_manager_email" ? "Warehouse manager invites require SMS MFA messaging." : "Admin invites require email verification and MFA."}
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
