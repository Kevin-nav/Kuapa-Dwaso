"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { getAuthErrorMessage } from "@kuapa-dwaso/utils";
import type { MultiFactorError, MultiFactorResolver, TotpSecret, User } from "firebase/auth";
import {
  GoogleAuthProvider,
  getMultiFactorResolver,
  getIdToken,
  multiFactor,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  RecaptchaVerifier,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  TotpMultiFactorGenerator,
} from "firebase/auth";
import { firebaseAuth } from "./firebase";
import { useAdminAuth } from "./AdminAuthProvider";

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export default function AdminAuthPage() {
  const { firebaseUser, principal, signOut } = useAdminAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("Admins and warehouse managers can sign in with Google or email/password.");
  const [error, setError] = useState<string | undefined>();
  const [isWorking, setIsWorking] = useState(false);
  const [inviteToken, setInviteToken] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [mfaResolver, setMfaResolver] = useState<MultiFactorResolver | undefined>();
  const [selectedMfaFactorIndex, setSelectedMfaFactorIndex] = useState(0);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaVerificationId, setMfaVerificationId] = useState("");
  const [mfaPhoneNumber, setMfaPhoneNumber] = useState("");
  const [mfaEnrollmentCode, setMfaEnrollmentCode] = useState("");
  const [mfaEnrollmentVerificationId, setMfaEnrollmentVerificationId] = useState("");
  const [totpSecret, setTotpSecret] = useState<TotpSecret | undefined>();
  const [totpEnrollmentUri, setTotpEnrollmentUri] = useState("");
  const [totpEnrollmentCode, setTotpEnrollmentCode] = useState("");
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;

  const clearRecaptchaVerifier = useCallback(() => {
    recaptchaVerifierRef.current?.clear();
    recaptchaVerifierRef.current = null;
  }, []);

  useEffect(() => clearRecaptchaVerifier, [clearRecaptchaVerifier]);

  const getRecaptchaVerifier = () => {
    if (recaptchaVerifierRef.current === null) {
      recaptchaVerifierRef.current = new RecaptchaVerifier(firebaseAuth, "admin-mfa-recaptcha", {
        size: "invisible",
      });
    }
    return recaptchaVerifierRef.current;
  };

  const finishPrimarySignIn = async (user: User) => {
    if (!user.emailVerified) {
      await sendEmailVerification(user);
      setStatus("Email verification is required. A verification email was sent.");
      return;
    }
    const factors = multiFactor(user).enrolledFactors;
    setStatus(
      factors.length === 0
        ? "Signed in. Enroll an authenticator-app or SMS factor before accepting an MFA-protected invite."
        : `Signed in with ${factors.length} enrolled MFA factor${factors.length === 1 ? "" : "s"}.`,
    );
  };

  const handleSignInError = (err: unknown) => {
    if (typeof err === "object" && err !== null && "code" in err && err.code === "auth/multi-factor-auth-required") {
      const resolver = getMultiFactorResolver(firebaseAuth, err as MultiFactorError);
      const preferredFactorIndex = resolver.hints.findIndex(
        (hint) => hint.factorId === TotpMultiFactorGenerator.FACTOR_ID,
      );
      setMfaResolver(resolver);
      setSelectedMfaFactorIndex(preferredFactorIndex >= 0 ? preferredFactorIndex : 0);
      setMfaVerificationId("");
      setStatus("Firebase MFA is required. Choose an enrolled factor to continue.");
      return;
    }
    setError(getAuthErrorMessage(err, "sign-in"));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(undefined);
    setIsWorking(true);
    try {
      const credential = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      await finishPrimarySignIn(credential.user);
    } catch (err) {
      handleSignInError(err);
    } finally {
      setIsWorking(false);
    }
  };

  const signInWithGoogle = async () => {
    setError(undefined);
    setIsWorking(true);
    try {
      const credential = await signInWithPopup(firebaseAuth, googleProvider);
      await finishPrimarySignIn(credential.user);
    } catch (err) {
      handleSignInError(err);
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
        throw new Error("Sign in with the invited Firebase email/password or Google identity before accepting the invite.");
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
      const hint = mfaResolver.hints[selectedMfaFactorIndex];
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
      clearRecaptchaVerifier();
      setMfaVerificationId(verificationId);
      setStatus("MFA challenge sent. Enter the code to complete sign-in.");
    } catch (err) {
      clearRecaptchaVerifier();
      setError(getAuthErrorMessage(err, "send-mfa-code"));
    } finally {
      setIsWorking(false);
    }
  };

  const completeMfaSignIn = async () => {
    setError(undefined);
    setIsWorking(true);
    try {
      if (mfaResolver === undefined) {
        throw new Error("No pending Firebase MFA sign-in challenge is available.");
      }
      const hint = mfaResolver.hints[selectedMfaFactorIndex];
      if (hint === undefined) {
        throw new Error("Choose an enrolled MFA factor.");
      }
      const assertion =
        hint.factorId === TotpMultiFactorGenerator.FACTOR_ID
          ? TotpMultiFactorGenerator.assertionForSignIn(hint.uid, mfaCode.trim())
          : (() => {
              if (hint.factorId !== PhoneMultiFactorGenerator.FACTOR_ID || mfaVerificationId.length === 0) {
                throw new Error("Send the SMS challenge before completing sign-in.");
              }
              return PhoneMultiFactorGenerator.assertion(
                PhoneAuthProvider.credential(mfaVerificationId, mfaCode.trim()),
              );
            })();
      await mfaResolver.resolveSignIn(assertion);
      setMfaResolver(undefined);
      setMfaVerificationId("");
      setMfaCode("");
      setStatus("MFA sign-in complete.");
    } catch (err) {
      setError(getAuthErrorMessage(err, "verify-mfa-code"));
    } finally {
      setIsWorking(false);
    }
  };

  const beginTotpEnrollment = async () => {
    setError(undefined);
    setIsWorking(true);
    try {
      if (firebaseUser === null) {
        throw new Error("Sign in before enrolling an authenticator-app factor.");
      }
      if (!firebaseUser.emailVerified) {
        await sendEmailVerification(firebaseUser);
        throw new Error("Verify email before enrolling MFA. A verification email was sent.");
      }
      const session = await multiFactor(firebaseUser).getSession();
      const secret = await TotpMultiFactorGenerator.generateSecret(session);
      setTotpSecret(secret);
      setTotpEnrollmentUri(
        secret.generateQrCodeUrl(firebaseUser.email ?? firebaseUser.uid, "Kuapa Dwaso Admin"),
      );
      setStatus("Authenticator setup generated. Add the key to your app, then enter its current code.");
    } catch (err) {
      setError(getAuthErrorMessage(err, "enroll-mfa"));
    } finally {
      setIsWorking(false);
    }
  };

  const completeTotpEnrollment = async () => {
    setError(undefined);
    setIsWorking(true);
    try {
      if (firebaseUser === null || totpSecret === undefined) {
        throw new Error("Generate an authenticator setup before completing enrollment.");
      }
      const assertion = TotpMultiFactorGenerator.assertionForEnrollment(
        totpSecret,
        totpEnrollmentCode.trim(),
      );
      await multiFactor(firebaseUser).enroll(assertion, "Admin authenticator app");
      await getIdToken(firebaseUser, true);
      setTotpSecret(undefined);
      setTotpEnrollmentUri("");
      setTotpEnrollmentCode("");
      setStatus("Authenticator-app MFA enrolled. Sign out and sign in again before accepting an invite.");
    } catch (err) {
      setError(getAuthErrorMessage(err, "enroll-mfa"));
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
      clearRecaptchaVerifier();
      setMfaEnrollmentVerificationId(verificationId);
      setStatus("MFA enrollment challenge sent. Enter the code to finish enrollment.");
    } catch (err) {
      clearRecaptchaVerifier();
      setError(getAuthErrorMessage(err, "enroll-mfa"));
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
      setError(getAuthErrorMessage(err, "enroll-mfa"));
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: "560px" }}>
      <div>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 800, margin: 0 }}>Admin sign in</h1>
        <p style={{ color: "#6b7280", marginTop: "6px" }}>Secure Firebase sign-in for admin and warehouse-manager identities.</p>
      </div>

      {firebaseUser !== null && (
        <div style={{ background: "#e7f4ec", border: "1px solid #bfe3ca", borderRadius: "8px", padding: "12px" }}>
          Signed in as {firebaseUser.email ?? firebaseUser.uid}. Principal: {principal?.role ?? "not linked yet"}.
        </div>
      )}

      {mfaResolver !== undefined && (
        <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: "8px", padding: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <strong>Second factor required</strong>
          <span style={{ color: "#7c2d12" }}>Use an enrolled authenticator app or SMS factor to finish sign-in.</span>
          {mfaResolver.hints.length > 1 && (
            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontWeight: 700 }}>
              MFA method
              <select
                value={selectedMfaFactorIndex}
                onChange={(event) => {
                  setSelectedMfaFactorIndex(Number(event.target.value));
                  setMfaVerificationId("");
                }}
                style={{ border: "1px solid #fdba74", borderRadius: "6px", font: "inherit", padding: "10px 12px" }}
              >
                {mfaResolver.hints.map((hint, index) => (
                  <option key={hint.uid} value={index}>
                    {hint.factorId === TotpMultiFactorGenerator.FACTOR_ID
                      ? hint.displayName ?? "Authenticator app"
                      : hint.displayName ?? "SMS"}
                  </option>
                ))}
              </select>
            </label>
          )}
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
            {mfaResolver.hints[selectedMfaFactorIndex]?.factorId === PhoneMultiFactorGenerator.FACTOR_ID && (
              <button type="button" disabled={isWorking} onClick={() => void sendMfaSignInChallenge()} style={{ background: "#9a3412", border: 0, borderRadius: "6px", color: "white", cursor: "pointer", fontWeight: 800, padding: "10px 14px" }}>
                Send SMS code
              </button>
            )}
            <button
              type="button"
              disabled={
                isWorking ||
                mfaCode.trim().length === 0 ||
                (mfaResolver.hints[selectedMfaFactorIndex]?.factorId === PhoneMultiFactorGenerator.FACTOR_ID &&
                  mfaVerificationId.length === 0)
              }
              onClick={() => void completeMfaSignIn()}
              style={{ background: "white", border: "1px solid #fdba74", borderRadius: "6px", color: "#7c2d12", cursor: "pointer", fontWeight: 700, padding: "10px 14px" }}
            >
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
        <button
          type="button"
          disabled={isWorking}
          onClick={() => void signInWithGoogle()}
          style={{ background: "white", border: "1px solid #c2c8d0", borderRadius: "6px", color: "#202124", cursor: "pointer", fontWeight: 800, padding: "10px 14px" }}
        >
          Continue with Google
        </button>
        <div style={{ alignItems: "center", color: "#6b7280", display: "flex", gap: "10px" }}>
          <span style={{ background: "#e2e6ea", height: "1px", flex: 1 }} />
          <span>or use email and password</span>
          <span style={{ background: "#e2e6ea", height: "1px", flex: 1 }} />
        </div>
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
          event.preventDefault();
          if (totpSecret === undefined) {
            void beginTotpEnrollment();
          } else {
            void completeTotpEnrollment();
          }
        }}
        style={{ background: "white", border: "1px solid #e2e6ea", borderRadius: "8px", display: "flex", flexDirection: "column", gap: "14px", padding: "20px" }}
      >
        <h2 style={{ fontSize: "1.05rem", fontWeight: 800, margin: 0 }}>Enroll authenticator-app MFA</h2>
        <p style={{ color: "#6b7280", margin: 0 }}>
          Recommended for platform owners. Works with Google Authenticator, Microsoft Authenticator, 1Password, and other TOTP apps.
        </p>
        {totpSecret !== undefined && (
          <>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontWeight: 700 }}>
              Setup key
              <input
                readOnly
                value={totpSecret.secretKey}
                autoComplete="off"
                style={{ border: "1px solid #c2c8d0", borderRadius: "6px", font: "inherit", padding: "10px 12px" }}
              />
            </label>
            <a href={totpEnrollmentUri} style={{ color: "#166534", fontWeight: 700 }}>
              Open setup in an authenticator app
            </a>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontWeight: 700 }}>
              Current authenticator code
              <input
                value={totpEnrollmentCode}
                onChange={(event) => setTotpEnrollmentCode(event.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                style={{ border: "1px solid #c2c8d0", borderRadius: "6px", font: "inherit", padding: "10px 12px" }}
              />
            </label>
          </>
        )}
        <button
          type="submit"
          disabled={isWorking || firebaseUser === null || (totpSecret !== undefined && totpEnrollmentCode.trim().length === 0)}
          style={{ background: "#2d8a4e", border: 0, borderRadius: "6px", color: "white", cursor: "pointer", fontWeight: 800, padding: "10px 14px" }}
        >
          {totpSecret === undefined ? "Set up authenticator" : "Complete authenticator enrollment"}
        </button>
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
