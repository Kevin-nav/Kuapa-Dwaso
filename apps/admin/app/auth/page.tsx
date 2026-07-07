"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import type { MultiFactorError, MultiFactorResolver } from "firebase/auth";
import {
  getMultiFactorResolver,
  getIdToken,
  multiFactor,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  RecaptchaVerifier,
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
  const [mfaVerificationId, setMfaVerificationId] = useState("");
  const [mfaPhoneNumber, setMfaPhoneNumber] = useState("");
  const [mfaEnrollmentCode, setMfaEnrollmentCode] = useState("");
  const [mfaEnrollmentVerificationId, setMfaEnrollmentVerificationId] = useState("");
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;

  const getRecaptchaVerifier = () => {
    if (recaptchaVerifierRef.current === null) {
      recaptchaVerifierRef.current = new RecaptchaVerifier(firebaseAuth, "admin-mfa-recaptcha", {
        size: "invisible",
      });
    }
    return recaptchaVerifierRef.current;
  };

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
        setMfaResolver(getMultiFactorResolver(firebaseAuth, err as MultiFactorError));
        setStatus("Firebase MFA is required. Send a second-factor challenge to continue.");
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

  const sendMfaSignInChallenge = async () => {
    setError(undefined);
    setIsWorking(true);
    try {
      if (mfaResolver === undefined) {
        throw new Error("No pending Firebase MFA sign-in challenge is available.");
      }
      const hint = mfaResolver.hints[0];
      if (hint === undefined || hint.factorId !== PhoneMultiFactorGenerator.FACTOR_ID) {
        throw new Error("The configured Firebase second factor is not an SMS phone factor.");
      }
      const provider = new PhoneAuthProvider(firebaseAuth);
      const verificationId = await provider.verifyPhoneNumber(
        {
          multiFactorHint: hint,
          session: mfaResolver.session,
        },
        getRecaptchaVerifier(),
      );
      setMfaVerificationId(verificationId);
      setStatus("MFA challenge sent. Enter the code to complete sign-in.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send MFA challenge.");
    } finally {
      setIsWorking(false);
    }
  };

  const completeMfaSignIn = async () => {
    setError(undefined);
    setIsWorking(true);
    try {
      if (mfaResolver === undefined || mfaVerificationId.length === 0) {
        throw new Error("Send the Firebase MFA challenge before completing sign-in.");
      }
      const credential = PhoneAuthProvider.credential(mfaVerificationId, mfaCode.trim());
      const assertion = PhoneMultiFactorGenerator.assertion(credential);
      await mfaResolver.resolveSignIn(assertion);
      setMfaResolver(undefined);
      setMfaVerificationId("");
      setMfaCode("");
      setStatus("MFA sign-in complete.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete MFA sign-in.");
    } finally {
      setIsWorking(false);
    }
  };

  const sendMfaEnrollmentChallenge = async () => {
    setError(undefined);
    setIsWorking(true);
    try {
      if (firebaseUser === null) {
        throw new Error("Sign in before enrolling a Firebase MFA phone factor.");
      }
      if (!firebaseUser.emailVerified) {
        await sendEmailVerification(firebaseUser);
        throw new Error("Verify email before enrolling MFA. A verification email was sent.");
      }
      if (mfaPhoneNumber.trim().length === 0) {
        throw new Error("Enter the phone number to enroll as a second factor.");
      }
      const session = await multiFactor(firebaseUser).getSession();
      const provider = new PhoneAuthProvider(firebaseAuth);
      const verificationId = await provider.verifyPhoneNumber(
        {
          phoneNumber: mfaPhoneNumber.trim(),
          session,
        },
        getRecaptchaVerifier(),
      );
      setMfaEnrollmentVerificationId(verificationId);
      setStatus("MFA enrollment challenge sent. Enter the code to finish enrollment.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start MFA enrollment.");
    } finally {
      setIsWorking(false);
    }
  };

  const completeMfaEnrollment = async () => {
    setError(undefined);
    setIsWorking(true);
    try {
      if (firebaseUser === null || mfaEnrollmentVerificationId.length === 0) {
        throw new Error("Send the enrollment challenge before completing MFA enrollment.");
      }
      const credential = PhoneAuthProvider.credential(mfaEnrollmentVerificationId, mfaEnrollmentCode.trim());
      const assertion = PhoneMultiFactorGenerator.assertion(credential);
      await multiFactor(firebaseUser).enroll(assertion, "Admin SMS");
      setMfaEnrollmentCode("");
      setMfaEnrollmentVerificationId("");
      setStatus("Firebase SMS MFA factor enrolled. Refresh the token before accepting an MFA-required invite.");
      await getIdToken(firebaseUser, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete MFA enrollment.");
    } finally {
      setIsWorking(false);
    }
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

      {mfaResolver !== undefined && (
        <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: "8px", padding: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <strong>Second factor required</strong>
          <span style={{ color: "#7c2d12" }}>Use the enrolled Firebase SMS factor to finish sign-in.</span>
          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontWeight: 700 }}>
            MFA code
            <input
              value={mfaCode}
              onChange={(event) => setMfaCode(event.target.value)}
              inputMode="numeric"
              style={{ border: "1px solid #fdba74", borderRadius: "6px", font: "inherit", padding: "10px 12px" }}
            />
          </label>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button type="button" disabled={isWorking} onClick={() => void sendMfaSignInChallenge()} style={{ background: "#9a3412", border: 0, borderRadius: "6px", color: "white", cursor: "pointer", fontWeight: 800, padding: "10px 14px" }}>
              Send MFA code
            </button>
            <button type="button" disabled={isWorking || mfaVerificationId.length === 0} onClick={() => void completeMfaSignIn()} style={{ background: "white", border: "1px solid #fdba74", borderRadius: "6px", color: "#7c2d12", cursor: "pointer", fontWeight: 700, padding: "10px 14px" }}>
              Complete MFA sign-in
            </button>
          </div>
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
        <p style={{ color: "#6b7280", margin: 0 }}>
          Accept after signing in with the exact invited email, verifying email, and satisfying any Firebase MFA requirement.
        </p>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button type="submit" disabled={isWorking || firebaseUser === null} style={{ background: "#2d8a4e", border: 0, borderRadius: "6px", color: "white", cursor: "pointer", fontWeight: 800, padding: "10px 14px" }}>
            Accept invite
          </button>
        </div>
      </form>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void sendMfaEnrollmentChallenge();
        }}
        style={{ background: "white", border: "1px solid #e2e6ea", borderRadius: "8px", display: "flex", flexDirection: "column", gap: "14px", padding: "20px" }}
      >
        <h2 style={{ fontSize: "1.05rem", fontWeight: 800, margin: 0 }}>Enroll SMS MFA</h2>
        <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontWeight: 700 }}>
          MFA phone number
          <input
            value={mfaPhoneNumber}
            onChange={(event) => setMfaPhoneNumber(event.target.value)}
            placeholder="+233..."
            style={{ border: "1px solid #c2c8d0", borderRadius: "6px", font: "inherit", padding: "10px 12px" }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontWeight: 700 }}>
          MFA code
          <input
            value={mfaEnrollmentCode}
            onChange={(event) => setMfaEnrollmentCode(event.target.value)}
            inputMode="numeric"
            style={{ border: "1px solid #c2c8d0", borderRadius: "6px", font: "inherit", padding: "10px 12px" }}
          />
        </label>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button type="submit" disabled={isWorking || firebaseUser === null} style={{ background: "#2d8a4e", border: 0, borderRadius: "6px", color: "white", cursor: "pointer", fontWeight: 800, padding: "10px 14px" }}>
            Send enrollment code
          </button>
          <button type="button" disabled={isWorking || mfaEnrollmentVerificationId.length === 0} onClick={() => void completeMfaEnrollment()} style={{ background: "white", border: "1px solid #c2c8d0", borderRadius: "6px", color: "#3a4048", cursor: "pointer", fontWeight: 700, padding: "10px 14px" }}>
            Complete enrollment
          </button>
        </div>
      </form>

      <div id="admin-mfa-recaptcha" />
    </div>
  );
}
