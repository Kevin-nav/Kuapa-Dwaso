"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import type { MultiFactorResolver } from "firebase/auth";
import {
  EmailAuthProvider,
  getIdToken,
  linkWithCredential,
  multiFactor,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  reauthenticateWithCredential,
  sendEmailVerification,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { firebaseAuth } from "./firebase";
import { useAdminAuth } from "./AdminAuthProvider";

export default function AdminAuthPage() {
  const { firebaseUser, principal, signOut } = useAdminAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("Admins and warehouse managers sign in with Firebase email/password.");
  const [error, setError] = useState<string | undefined>();
  const [isWorking, setIsWorking] = useState(false);
  const [inviteToken, setInviteToken] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [mfaResolver, setMfaResolver] = useState<MultiFactorResolver | undefined>();
  const [mfaCode, setMfaCode] = useState("");
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(undefined);
    setIsWorking(true);
    try {
      const credential = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      if (!credential.user.emailVerified) {
        await sendEmailVerification(credential.user);
        setStatus("Email verification is required. A verification email was sent.");
        return;
      }
      const factors = multiFactor(credential.user).enrolledFactors;
      setStatus(
        factors.length === 0
          ? "Signed in. If your invite requires MFA, enroll a Firebase second factor before accepting it."
          : `Signed in with ${factors.length} enrolled MFA factor${factors.length === 1 ? "" : "s"}.`,
      );
    } catch (err) {
      if (typeof err === "object" && err !== null && "code" in err && err.code === "auth/multi-factor-auth-required") {
        setMfaResolver((err as { resolver?: MultiFactorResolver }).resolver);
        setError("Firebase MFA is required. Complete the configured second-factor challenge, then sign in again.");
      } else {
        setError(err instanceof Error ? err.message : "Could not sign in.");
      }
    } finally {
      setIsWorking(false);
    }
  };

  const acceptInvite = async (event: FormEvent) => {
    event.preventDefault();
    setError(undefined);
    setIsWorking(true);
    try {
      if (apiBaseUrl === undefined || apiBaseUrl.trim().length === 0) {
        throw new Error("NEXT_PUBLIC_API_URL is required to accept admin invitations.");
      }
      if (firebaseUser === null) {
        throw new Error("Sign in with the invited Firebase email/password identity before accepting the invite.");
      }
      if (!firebaseUser.emailVerified) {
        await sendEmailVerification(firebaseUser);
        throw new Error("Email verification is required. A verification email was sent; verify it, refresh, then accept the invite.");
      }
      const factors = multiFactor(firebaseUser).enrolledFactors;
      if (factors.length === 0) {
        setStatus("No Firebase MFA factor is enrolled. If this invite requires MFA, enable/enroll SMS or TOTP MFA in Firebase before accepting.");
      }
      const idToken = await getIdToken(firebaseUser, true);
      const response = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/invitations/accept`, {
        body: JSON.stringify({
          token: inviteToken.trim(),
          displayName: displayName.trim() || firebaseUser.displayName || firebaseUser.email,
        }),
        headers: {
          authorization: `Bearer ${idToken}`,
          "content-type": "application/json",
        },
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const result = (await response.json()) as { profileType: string; mfaRequired: boolean };
      setStatus(
        result.mfaRequired
          ? `Invite accepted for ${result.profileType}. MFA was required and accepted by the backend token state.`
          : `Invite accepted for ${result.profileType}.`,
      );
      setInviteToken("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept invite.");
    } finally {
      setIsWorking(false);
    }
  };

  const enrollPlaceholder = () => {
    setStatus(
      "Firebase MFA enrollment is intentionally not fully automated here. Enable Firebase MFA in the project, add a second factor to this user in Firebase Auth, then accept the invite so Convex can record mfaStatus=verified.",
    );
  };

  const completeMfaPlaceholder = async () => {
    if (mfaResolver === undefined) {
      setError("No pending Firebase MFA challenge is available from the latest sign-in attempt.");
      return;
    }
    if (mfaResolver.hints[0]?.factorId !== PhoneMultiFactorGenerator.FACTOR_ID) {
      setError("This Firebase MFA factor is not an SMS factor. Complete the configured Firebase challenge outside this placeholder flow, then sign in again.");
      return;
    }
    setError(
      "Firebase SMS MFA challenge requires a reCAPTCHA verifier bound to this app. Add the verifier setup, call PhoneAuthProvider.verifyPhoneNumber, then resolve sign-in with PhoneMultiFactorGenerator.assertion.",
    );
    void PhoneAuthProvider;
    void EmailAuthProvider;
    void linkWithCredential;
    void reauthenticateWithCredential;
    void mfaCode;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: "560px" }}>
      <div>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 800, margin: 0 }}>Admin sign in</h1>
        <p style={{ color: "#6b7280", marginTop: "6px" }}>Firebase email/password entry path for admin and warehouse-manager identities.</p>
      </div>

      {firebaseUser !== null && (
        <div style={{ background: "#e7f4ec", border: "1px solid #bfe3ca", borderRadius: "8px", padding: "12px" }}>
          Signed in as {firebaseUser.email ?? firebaseUser.uid}. Principal: {principal?.role ?? "not linked yet"}.
        </div>
      )}

      <form
        onSubmit={(event) => {
          void submit(event);
        }}
        style={{ background: "white", border: "1px solid #e2e6ea", borderRadius: "8px", display: "flex", flexDirection: "column", gap: "14px", padding: "20px" }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontWeight: 700 }}>
          Email
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            style={{ border: "1px solid #c2c8d0", borderRadius: "6px", font: "inherit", padding: "10px 12px" }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontWeight: 700 }}>
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            style={{ border: "1px solid #c2c8d0", borderRadius: "6px", font: "inherit", padding: "10px 12px" }}
          />
        </label>
        <p style={{ color: "#6b7280", margin: 0 }}>{status}</p>
        {error !== undefined && <p style={{ color: "#b91c1c", fontWeight: 700, margin: 0 }}>{error}</p>}
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button type="submit" disabled={isWorking} style={{ background: "#2d8a4e", border: 0, borderRadius: "6px", color: "white", cursor: "pointer", fontWeight: 800, padding: "10px 14px" }}>
            Sign in
          </button>
          {firebaseUser !== null && (
            <button type="button" onClick={() => void signOut()} style={{ background: "white", border: "1px solid #c2c8d0", borderRadius: "6px", color: "#3a4048", cursor: "pointer", fontWeight: 700, padding: "10px 14px" }}>
              Sign out
            </button>
          )}
        </div>
      </form>

      <form
        onSubmit={(event) => {
          void acceptInvite(event);
        }}
        style={{ background: "white", border: "1px solid #e2e6ea", borderRadius: "8px", display: "flex", flexDirection: "column", gap: "14px", padding: "20px" }}
      >
        <h2 style={{ fontSize: "1.05rem", fontWeight: 800, margin: 0 }}>Accept admin invite</h2>
        <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontWeight: 700 }}>
          Invite token
          <input
            value={inviteToken}
            onChange={(event) => setInviteToken(event.target.value)}
            required
            style={{ border: "1px solid #c2c8d0", borderRadius: "6px", font: "inherit", padding: "10px 12px" }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontWeight: 700 }}>
          Display name
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            style={{ border: "1px solid #c2c8d0", borderRadius: "6px", font: "inherit", padding: "10px 12px" }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontWeight: 700 }}>
          MFA challenge code
          <input
            value={mfaCode}
            onChange={(event) => setMfaCode(event.target.value)}
            placeholder="Used after Firebase challenge verifier setup"
            style={{ border: "1px solid #c2c8d0", borderRadius: "6px", font: "inherit", padding: "10px 12px" }}
          />
        </label>
        <p style={{ color: "#6b7280", margin: 0 }}>
          Accept after signing in with the exact invited email, verifying email, and satisfying any Firebase MFA requirement.
        </p>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button type="submit" disabled={isWorking || firebaseUser === null} style={{ background: "#2d8a4e", border: 0, borderRadius: "6px", color: "white", cursor: "pointer", fontWeight: 800, padding: "10px 14px" }}>
            Accept invite
          </button>
          <button type="button" onClick={enrollPlaceholder} style={{ background: "white", border: "1px solid #c2c8d0", borderRadius: "6px", color: "#3a4048", cursor: "pointer", fontWeight: 700, padding: "10px 14px" }}>
            MFA enrollment state
          </button>
          <button type="button" onClick={() => void completeMfaPlaceholder()} style={{ background: "white", border: "1px solid #c2c8d0", borderRadius: "6px", color: "#3a4048", cursor: "pointer", fontWeight: 700, padding: "10px 14px" }}>
            MFA challenge state
          </button>
        </div>
      </form>
    </div>
  );
}
