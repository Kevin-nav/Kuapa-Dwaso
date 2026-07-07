"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
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

export default function InviteAcceptPage() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<InviteMode>("admin_email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [status, setStatus] = useState<string>("Choose the invite type and sign in with the invited identity.");
  const [error, setError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const token = searchParams.get("token") ?? "";

  const acceptInvite = async (user: User) => {
    if (apiBaseUrl === undefined || apiBaseUrl.trim().length === 0) {
      throw new Error("NEXT_PUBLIC_API_URL is required to accept invites.");
    }
    if (token.trim().length === 0) {
      throw new Error("Invite token is missing from the URL.");
    }
    const idToken = await user.getIdToken();
    const response = await fetch(`${apiBaseUrl}/invitations/accept`, {
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
      throw new Error(body || `Invite acceptance failed with ${response.status}.`);
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
        if (typeof signInError === "object" && signInError !== null && "code" in signInError && signInError.code === "auth/user-not-found") {
          credential = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
          await sendEmailVerification(credential.user);
          setStatus("Account created. Verify the email, then return to accept this invite.");
          return;
        }
        throw signInError;
      }
      if (!credential.user.emailVerified) {
        await sendEmailVerification(credential.user);
        setStatus("Email verification is required. A verification email was sent.");
        return;
      }
      await acceptInvite(credential.user);
    } catch (err) {
      if (typeof err === "object" && err !== null && "code" in err && err.code === "auth/multi-factor-auth-required") {
        setError("Firebase requires a second factor. Complete the configured MFA challenge, then retry acceptance.");
      } else {
        setError(err instanceof Error ? err.message : "Could not accept invite.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="page-shell auth-page">
      <section className="auth-panel">
        <p className="eyebrow">Invite acceptance</p>
        <h1>Accept platform invite</h1>
        <p>Admin and warehouse manager invites use email/password plus MFA. Warehouse agent invites use phone verification.</p>

        <div className="role-grid">
          {([
            ["admin_email", "admin"],
            ["warehouse_manager_email", "warehouse manager"],
            ["warehouse_agent_phone", "warehouse agent"],
          ] as const).map(([value, label]) => (
            <button key={value} type="button" className={mode === value ? "selected" : ""} onClick={() => setMode(value)}>
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
              Accept invite
            </button>
          </form>
        )}

        <p className="auth-status">{status}</p>
        {error !== undefined && <p className="auth-error">{error}</p>}
      </section>
    </main>
  );
}
