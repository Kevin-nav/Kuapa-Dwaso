"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { getAuthErrorCode, getAuthErrorMessage, normalizeGhanaPhoneNumber } from "@kuapa-dwaso/utils";
import type {
  MultiFactorError,
  MultiFactorResolver,
  TotpSecret,
  User,
} from "firebase/auth";
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
import {
  ShieldCheck,
  KeyRound,
  Smartphone,
  ArrowLeft,
  AlertTriangle,
  LogOut,
  ChevronRight,
  QrCode,
  Copy,
  CheckCircle2,
} from "lucide-react";
import { OtpInput } from "@kuapa-dwaso/ui";
import { firebaseAuth } from "./firebase";
import { useAdminAuth } from "./AdminAuthProvider";

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

const QRCodeSVG = dynamic(
  () => import("qrcode.react").then((module) => module.QRCodeSVG),
  {
    ssr: false,
    loading: () => <div className="totp-qr-loading">Preparing QR code…</div>,
  },
);

function LogoIcon({ style }: { style?: CSSProperties }) {
  return (
    <svg
      viewBox="0 0 120 120"
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

const GoogleIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    xmlns="http://www.w3.org/2000/svg"
    style={{ flexShrink: 0 }}
  >
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      fill="#EA4335"
    />
  </svg>
);

export default function AdminAuthPage() {
  const { firebaseUser, principal, signOut } = useAdminAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState(
    "Admins and warehouse managers can sign in with Google or email/password.",
  );
  const [error, setError] = useState<string | undefined>();
  const [isWorking, setIsWorking] = useState(false);
  const [inviteToken, setInviteToken] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [mfaResolver, setMfaResolver] = useState<
    MultiFactorResolver | undefined
  >();
  const [selectedMfaFactorIndex, setSelectedMfaFactorIndex] = useState(0);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaVerificationId, setMfaVerificationId] = useState("");
  const [mfaPhoneNumber, setMfaPhoneNumber] = useState("");
  const [mfaEnrollmentCode, setMfaEnrollmentCode] = useState("");
  const [mfaEnrollmentVerificationId, setMfaEnrollmentVerificationId] =
    useState("");
  const [totpSecret, setTotpSecret] = useState<TotpSecret | undefined>();
  const [totpEnrollmentUri, setTotpEnrollmentUri] = useState("");
  const [totpEnrollmentCode, setTotpEnrollmentCode] = useState("");
  const [isTotpKeyCopied, setIsTotpKeyCopied] = useState(false);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;

  const [selectedSetupTab, setSelectedSetupTab] = useState<
    "invite" | "totp" | "sms" | "none" | null
  >(null);

  // Derive activeSetupTab without calling setState in an effect
  const activeSetupTab = (() => {
    if (selectedSetupTab !== null) return selectedSetupTab;
    if (firebaseUser !== null) {
      if (principal === null || (principal !== undefined && !principal.role)) {
        return "invite";
      }
    }
    return "none";
  })();

  const clearRecaptchaVerifier = useCallback(() => {
    recaptchaVerifierRef.current?.clear();
    recaptchaVerifierRef.current = null;
  }, []);

  useEffect(() => clearRecaptchaVerifier, [clearRecaptchaVerifier]);

  const getRecaptchaVerifier = () => {
    if (recaptchaVerifierRef.current === null) {
      recaptchaVerifierRef.current = new RecaptchaVerifier(
        firebaseAuth,
        "admin-mfa-recaptcha",
        {
          size: "invisible",
        },
      );
    }
    return recaptchaVerifierRef.current;
  };

  const finishPrimarySignIn = async (user: User) => {
    if (!user.emailVerified) {
      await sendEmailVerification(user);
      setStatus(
        "Email verification is required. A verification email was sent.",
      );
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
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      err.code === "auth/multi-factor-auth-required"
    ) {
      const resolver = getMultiFactorResolver(
        firebaseAuth,
        err as MultiFactorError,
      );
      const preferredFactorIndex = resolver.hints.findIndex(
        (hint) => hint.factorId === TotpMultiFactorGenerator.FACTOR_ID,
      );
      setMfaResolver(resolver);
      setSelectedMfaFactorIndex(
        preferredFactorIndex >= 0 ? preferredFactorIndex : 0,
      );
      setMfaVerificationId("");
      setStatus(
        "Firebase MFA is required. Choose an enrolled factor to continue.",
      );
      return;
    }
    setError(getAuthErrorMessage(err, "sign-in"));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(undefined);
    setIsWorking(true);
    try {
      const credential = await signInWithEmailAndPassword(
        firebaseAuth,
        email.trim(),
        password,
      );
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
        throw new Error(
          "NEXT_PUBLIC_API_URL is required to accept admin invitations.",
        );
      }
      if (firebaseUser === null) {
        throw new Error(
          "Sign in with the invited Firebase email/password or Google identity before accepting the invite.",
        );
      }
      if (!firebaseUser.emailVerified) {
        await sendEmailVerification(firebaseUser);
        throw new Error(
          "Email verification is required. A verification email was sent; verify it, refresh, then accept the invite.",
        );
      }
      const factors = multiFactor(firebaseUser).enrolledFactors;
      if (factors.length === 0) {
        setStatus(
          "No Firebase MFA factor is enrolled. If this invite requires MFA, enable/enroll SMS or TOTP MFA in Firebase before accepting.",
        );
      }
      const idToken = await getIdToken(firebaseUser, true);
      const response = await fetch(
        `${apiBaseUrl.replace(/\/$/, "")}/invitations/accept`,
        {
          body: JSON.stringify({
            token: inviteToken.trim(),
            displayName:
              displayName.trim() ||
              firebaseUser.displayName ||
              firebaseUser.email,
          }),
          headers: {
            authorization: `Bearer ${idToken}`,
            "content-type": "application/json",
          },
          method: "POST",
        },
      );
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const result = (await response.json()) as {
        profileType: string;
        mfaRequired: boolean;
      };
      setStatus(
        result.mfaRequired
          ? `Invite accepted for ${result.profileType}. MFA was required and accepted by the backend token state.`
          : `Invite accepted for ${result.profileType}.`,
      );
      setInviteToken("");
    } catch (err) {
      let rawMessage = "Could not accept invite.";
      if (err instanceof Error) {
        rawMessage = err.message;
      } else if (typeof err === "string") {
        rawMessage = err;
      }

      if (rawMessage.startsWith("{") && rawMessage.endsWith("}")) {
        try {
          const parsed = JSON.parse(rawMessage);
          if (parsed && typeof parsed === "object" && typeof parsed.message === "string") {
            rawMessage = parsed.message;
          } else if (parsed && typeof parsed === "object" && Array.isArray(parsed.message)) {
            rawMessage = parsed.message.join(", ");
          }
        } catch {
          // Ignore
        }
      }

      const match = rawMessage.match(/(?:Uncaught Error|ConvexError):\s*([^\n]+)/);
      if (match && match[1]) {
        rawMessage = match[1].trim();
      }

      setError(rawMessage);
    } finally {
      setIsWorking(false);
    }
  };

  const sendMfaSignInChallenge = async () => {
    setError(undefined);
    setIsWorking(true);
    try {
      if (mfaResolver === undefined) {
        throw new Error(
          "No pending Firebase MFA sign-in challenge is available.",
        );
      }
      const hint = mfaResolver.hints[selectedMfaFactorIndex];
      if (
        hint === undefined ||
        hint.factorId !== PhoneMultiFactorGenerator.FACTOR_ID
      ) {
        throw new Error(
          "The configured Firebase second factor is not an SMS phone factor.",
        );
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
        throw new Error(
          "No pending Firebase MFA sign-in challenge is available.",
        );
      }
      const hint = mfaResolver.hints[selectedMfaFactorIndex];
      if (hint === undefined) {
        throw new Error("Choose an enrolled MFA factor.");
      }
      const assertion =
        hint.factorId === TotpMultiFactorGenerator.FACTOR_ID
          ? TotpMultiFactorGenerator.assertionForSignIn(
              hint.uid,
              mfaCode.trim(),
            )
          : (() => {
              if (
                hint.factorId !== PhoneMultiFactorGenerator.FACTOR_ID ||
                mfaVerificationId.length === 0
              ) {
                throw new Error(
                  "Send the SMS challenge before completing sign-in.",
                );
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
        throw new Error(
          "Sign in before enrolling an authenticator-app factor.",
        );
      }
      if (!firebaseUser.emailVerified) {
        await sendEmailVerification(firebaseUser);
        throw new Error(
          "Verify email before enrolling MFA. A verification email was sent.",
        );
      }
      const session = await multiFactor(firebaseUser).getSession();
      const secret = await TotpMultiFactorGenerator.generateSecret(session);
      setTotpSecret(secret);
      setIsTotpKeyCopied(false);
      setTotpEnrollmentUri(
        secret.generateQrCodeUrl(
          firebaseUser.email ?? firebaseUser.uid,
          "Kuapa Dwaso Admin",
        ),
      );
      setStatus(
        "Authenticator setup generated. Add the key to your app, then enter its current code.",
      );
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
        throw new Error(
          "Generate an authenticator setup before completing enrollment.",
        );
      }
      const assertion = TotpMultiFactorGenerator.assertionForEnrollment(
        totpSecret,
        totpEnrollmentCode.trim(),
      );
      await multiFactor(firebaseUser).enroll(
        assertion,
        "Admin authenticator app",
      );
      await getIdToken(firebaseUser, true);
      setTotpSecret(undefined);
      setTotpEnrollmentUri("");
      setTotpEnrollmentCode("");
      setIsTotpKeyCopied(false);
      setStatus(
        "Authenticator-app MFA enrolled. Sign out and sign in again before accepting an invite.",
      );
    } catch (err) {
      setError(getAuthErrorMessage(err, "enroll-mfa"));
    } finally {
      setIsWorking(false);
    }
  };

  const copyTotpSetupKey = async () => {
    if (totpSecret === undefined) {
      return;
    }
    setError(undefined);
    try {
      await navigator.clipboard.writeText(totpSecret.secretKey);
      setIsTotpKeyCopied(true);
    } catch {
      setError(
        "Could not copy the setup key. Select the key and copy it manually.",
      );
    }
  };

  const sendMfaEnrollmentChallenge = async () => {
    setError(undefined);
    setIsWorking(true);
    try {
      if (firebaseUser === null) {
        throw new Error(
          "Sign in before enrolling a Firebase MFA phone factor.",
        );
      }
      if (!firebaseUser.emailVerified) {
        await sendEmailVerification(firebaseUser);
        throw new Error(
          "Verify email before enrolling MFA. A verification email was sent.",
        );
      }
      if (mfaPhoneNumber.trim().length === 0) {
        throw new Error("Enter the phone number to enroll as a second factor.");
      }
      const session = await multiFactor(firebaseUser).getSession();
      const provider = new PhoneAuthProvider(firebaseAuth);
      const verificationId = await provider.verifyPhoneNumber(
        {
          phoneNumber: normalizeGhanaPhoneNumber(mfaPhoneNumber),
          session,
        },
        getRecaptchaVerifier(),
      );
      clearRecaptchaVerifier();
      setMfaEnrollmentVerificationId(verificationId);
      setStatus(
        "MFA enrollment challenge sent. Enter the code to finish enrollment.",
      );
    } catch (err) {
      clearRecaptchaVerifier();
      setError(err instanceof Error && getAuthErrorCode(err) === undefined
        ? "Enter a Ghana phone number such as 054 123 4567 or +233 54 123 4567."
        : getAuthErrorMessage(err, "enroll-mfa"));
    } finally {
      setIsWorking(false);
    }
  };

  const completeMfaEnrollment = async () => {
    setError(undefined);
    setIsWorking(true);
    try {
      if (firebaseUser === null || mfaEnrollmentVerificationId.length === 0) {
        throw new Error(
          "Send the enrollment challenge before completing MFA enrollment.",
        );
      }
      const credential = PhoneAuthProvider.credential(
        mfaEnrollmentVerificationId,
        mfaEnrollmentCode.trim(),
      );
      const assertion = PhoneMultiFactorGenerator.assertion(credential);
      await multiFactor(firebaseUser).enroll(assertion, "Admin SMS");
      setMfaEnrollmentCode("");
      setMfaEnrollmentVerificationId("");
      setStatus(
        "Firebase SMS MFA factor enrolled. Refresh the token before accepting an MFA-required invite.",
      );
      await getIdToken(firebaseUser, true);
    } catch (err) {
      setError(getAuthErrorMessage(err, "enroll-mfa"));
    } finally {
      setIsWorking(false);
    }
  };

  // Determine current screen state
  const isMfaChallengeActive = mfaResolver !== undefined;
  const isAuthenticated = firebaseUser !== null && !isMfaChallengeActive;

  return (
    <div className="auth-layout">
      {/* Brand / Hero Side (Desktop only) */}
      <aside className="auth-hero">
        <div className="brand-lockup">
          <span className="brand-mark">
            <LogoIcon style={{ width: "24px", height: "24px" }} />
          </span>
          <span className="brand-name">KuapaDwaso Admin</span>
        </div>

        <div className="auth-hero-body">
          <h2>Control the market. Verify the harvest.</h2>
          <p>
            Secure portal for platform administrators, inspectors, and warehouse
            managers to oversee operations, verify stock, and manage logistics.
          </p>

          <ul className="auth-trust">
            <li>
              <ShieldCheck size={20} />
              Role-based access control (RBAC) security
            </li>
            <li>
              <KeyRound size={20} />
              Mandatory Multi-factor authentication (MFA)
            </li>
            <li>
              <Smartphone size={20} />
              Audit-logged administration oversight
            </li>
          </ul>
        </div>

        <p className="auth-hero-foot">
          © {new Date().getFullYear()} KuapaDwaso Admin. Secure Identity
          Platform.
        </p>
      </aside>

      {/* Form / Content Side */}
      <main className="auth-main">
        <div className="auth-inner">
          {/* Mobile Top Navbar (Hidden on desktop) */}
          <header className="brand-lockup brand-lockup--mobile">
            <span className="brand-mark">
              <LogoIcon style={{ width: "20px", height: "20px" }} />
            </span>
            <span className="brand-name">KuapaDwaso Admin</span>
          </header>

          {/* SCREEN 1: UNAUTHENTICATED SIGN IN */}
          {!isAuthenticated && !isMfaChallengeActive && (
            <>
              <header className="auth-head">
                <span className="eyebrow">Secure Gateway</span>
                <h1>Admin sign in</h1>
                <p className="auth-sub">
                  Secure Firebase sign-in for admin and warehouse-manager
                  identities.
                </p>
              </header>

              <div className="auth-card">
                <button
                  type="button"
                  disabled={isWorking}
                  onClick={() => void signInWithGoogle()}
                  className="auth-btn-google"
                >
                  <GoogleIcon />
                  <span>Continue with Google</span>
                </button>

                <div className="auth-divider">or use email and password</div>

                <form
                  onSubmit={(event) => {
                    void submit(event);
                  }}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                  }}
                >
                  <div className="auth-input-group">
                    <label htmlFor="email">Email</label>
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                      className="auth-input"
                      placeholder="admin@kuapadwaso.com"
                    />
                  </div>

                  <div className="auth-input-group">
                    <label htmlFor="password">Password</label>
                    <input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                      className="auth-input"
                      placeholder="••••••••"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isWorking}
                    className="auth-btn-primary"
                  >
                    {isWorking ? "Signing in..." : "Sign in"}
                  </button>
                </form>
              </div>
            </>
          )}

          {/* SCREEN 2: MFA CHALLENGE */}
          {isMfaChallengeActive && (
            <>
              <header className="auth-head">
                <button
                  type="button"
                  onClick={() => {
                    setMfaResolver(undefined);
                    setError(undefined);
                  }}
                  className="auth-btn-ghost"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: 0,
                    marginBottom: "12px",
                  }}
                >
                  <ArrowLeft size={16} />
                  <span>Back to Sign In</span>
                </button>
                <span className="eyebrow">Verification Required</span>
                <h1>Second factor required</h1>
                <p className="auth-sub">
                  Use an enrolled authenticator app or SMS factor to finish
                  sign-in.
                </p>
              </header>

              <div className="auth-card">
                {mfaResolver.hints.length > 1 && (
                  <div className="auth-input-group">
                    <label htmlFor="mfa-method">MFA Method</label>
                    <select
                      id="mfa-method"
                      value={selectedMfaFactorIndex}
                      onChange={(event) => {
                        setSelectedMfaFactorIndex(Number(event.target.value));
                        setMfaVerificationId("");
                      }}
                      className="auth-input"
                    >
                      {mfaResolver.hints.map((hint, index) => (
                        <option key={hint.uid} value={index}>
                          {hint.factorId === TotpMultiFactorGenerator.FACTOR_ID
                            ? (hint.displayName ?? "Authenticator app")
                            : (hint.displayName ??
                              `SMS (${hint.displayName || "Phone"})`)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="auth-input-group">
                  <label htmlFor="mfa-code">MFA Verification Code</label>
                  <OtpInput
                    id="mfa-code"
                    value={mfaCode}
                    onChange={setMfaCode}
                    length={6}
                    disabled={isWorking}
                    aria-label="MFA verification code"
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  {mfaResolver.hints[selectedMfaFactorIndex]?.factorId ===
                    PhoneMultiFactorGenerator.FACTOR_ID && (
                    <button
                      type="button"
                      disabled={isWorking}
                      onClick={() => void sendMfaSignInChallenge()}
                      className="auth-btn-secondary"
                    >
                      Send SMS code
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={
                      isWorking ||
                      mfaCode.trim().length === 0 ||
                      (mfaResolver.hints[selectedMfaFactorIndex]?.factorId ===
                        PhoneMultiFactorGenerator.FACTOR_ID &&
                        mfaVerificationId.length === 0)
                    }
                    onClick={() => void completeMfaSignIn()}
                    className="auth-btn-primary"
                  >
                    Complete MFA sign-in
                  </button>
                </div>
              </div>
            </>
          )}

          {/* SCREEN 3: AUTHENTICATED CONTROL CENTER & ONBOARDING */}
          {isAuthenticated && (
            <>
              <header className="auth-head">
                <span className="eyebrow">Access Granted</span>
                <h1>Admin Control Center</h1>
                <p className="auth-sub">
                  Signed in as{" "}
                  <strong>{firebaseUser.email ?? firebaseUser.uid}</strong>
                </p>
              </header>

              {/* principal details */}
              <div className="auth-card">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: "15px",
                        fontWeight: 700,
                        color: "#20242a",
                      }}
                    >
                      Convex Identity Link
                    </h3>
                    {principal === undefined ? (
                      <p
                        style={{
                          margin: "4px 0 0",
                          fontSize: "13px",
                          color: "#6b7280",
                        }}
                      >
                        Resolving Convex profile...
                      </p>
                    ) : principal === null ? (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          marginTop: "4px",
                        }}
                      >
                        <span
                          style={{
                            display: "inline-block",
                            width: "8px",
                            height: "8px",
                            borderRadius: "50%",
                            background: "#b91c1c",
                          }}
                        />
                        <span
                          style={{
                            fontSize: "13px",
                            fontWeight: 600,
                            color: "#b91c1c",
                          }}
                        >
                          Not linked yet (Invite Required)
                        </span>
                      </div>
                    ) : (
                      <div style={{ marginTop: "4px" }}>
                        <span
                          style={{
                            fontSize: "13px",
                            color: "#2d8a4e",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            background: "rgba(45, 138, 78, 0.1)",
                            padding: "2px 8px",
                            borderRadius: "4px",
                          }}
                        >
                          {principal.role === "admin"
                            ? "Administrator"
                            : principal.role}
                        </span>
                        <p
                          style={{
                            margin: "6px 0 0",
                            fontSize: "13px",
                            color: "#6b7280",
                          }}
                        >
                          Name: {principal.name || "N/A"}
                        </p>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSetupTab(null);
                      void signOut();
                    }}
                    className="auth-btn-ghost"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <LogOut size={15} />
                    <span>Sign out</span>
                  </button>
                </div>

                {principal !== undefined &&
                  principal !== null &&
                  principal.status === "active" && (
                    <Link
                      href="/"
                      className="auth-btn-primary"
                      style={{ textDecoration: "none", marginTop: "8px" }}
                    >
                      <span>Enter Dashboard</span>
                      <ChevronRight size={18} />
                    </Link>
                  )}
              </div>

              {/* tabbed configuration views for onboarding and mfa */}
              <div className="auth-card" style={{ gap: "12px" }}>
                <h3
                  style={{
                    margin: 0,
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "#20242a",
                  }}
                >
                  Security & Invite Setup
                </h3>

                {/* tab selector */}
                <div className="auth-tabs">
                  <button
                    type="button"
                    onClick={() => setSelectedSetupTab("invite")}
                    className={`auth-tab-btn ${activeSetupTab === "invite" ? "is-active" : ""}`}
                  >
                    Accept Invite
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSetupTab("totp")}
                    className={`auth-tab-btn ${activeSetupTab === "totp" ? "is-active" : ""}`}
                  >
                    Authenticator App
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSetupTab("sms")}
                    className={`auth-tab-btn ${activeSetupTab === "sms" ? "is-active" : ""}`}
                  >
                    SMS MFA
                  </button>
                </div>

                {/* Tab 1: Accept invite */}
                {activeSetupTab === "invite" && (
                  <form
                    onSubmit={(event) => {
                      void acceptInvite(event);
                    }}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "14px",
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: "13px",
                        color: "#6b7280",
                        lineHeight: 1.5,
                      }}
                    >
                      Accept an invite token to link this authenticated
                      email/Google account to your admin profile.
                    </p>
                    <div className="auth-input-group">
                      <label htmlFor="invite-token">Invite Token</label>
                      <input
                        id="invite-token"
                        value={inviteToken}
                        onChange={(event) => setInviteToken(event.target.value)}
                        required
                        className="auth-input"
                        placeholder="inv_..."
                      />
                    </div>
                    <div className="auth-input-group">
                      <label htmlFor="display-name">Display Name</label>
                      <input
                        id="display-name"
                        value={displayName}
                        onChange={(event) => setDisplayName(event.target.value)}
                        className="auth-input"
                        placeholder={firebaseUser.displayName || "Admin User"}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isWorking}
                      className="auth-btn-primary"
                    >
                      Accept invite
                    </button>
                  </form>
                )}

                {/* Tab 2: Authenticator TOTP */}
                {activeSetupTab === "totp" && (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (totpSecret === undefined) {
                        void beginTotpEnrollment();
                      } else {
                        void completeTotpEnrollment();
                      }
                    }}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "14px",
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: "13px",
                        color: "#6b7280",
                        lineHeight: 1.5,
                      }}
                    >
                      Use an authenticator app for time-based codes that work
                      even when mobile service is unavailable. Google
                      Authenticator, Microsoft Authenticator, 1Password, and
                      other standard TOTP apps are supported.
                    </p>
                    {totpSecret !== undefined && (
                      <div className="totp-setup">
                        <ol
                          className="totp-steps"
                          aria-label="Authenticator setup steps"
                        >
                          <li>
                            Open your authenticator app and add a new account.
                          </li>
                          <li>
                            Scan the QR code below, or use the manual setup key.
                          </li>
                          <li>
                            Enter the current six-digit code to confirm
                            enrollment.
                          </li>
                        </ol>

                        <div className="totp-qr-panel">
                          <div
                            className="totp-qr"
                            aria-label="Authenticator setup QR code"
                          >
                            <QRCodeSVG
                              value={totpEnrollmentUri}
                              size={184}
                              level="M"
                              marginSize={2}
                              title="Scan to add KuapaDwaso Admin to your authenticator app"
                            />
                          </div>
                          <div>
                            <strong>Scan with your authenticator app</strong>
                            <p>
                              This QR code is generated in your browser. Your
                              setup secret is not sent to a QR-code service.
                            </p>
                            <a
                              href={totpEnrollmentUri}
                              className="totp-open-link"
                            >
                              <QrCode aria-hidden="true" size={16} />
                              Open directly on this device
                            </a>
                          </div>
                        </div>

                        <details className="totp-manual">
                          <summary>
                            Cannot scan? Use the manual setup key
                          </summary>
                          <p>
                            In your authenticator app, choose the option to
                            enter a setup key. Use a time-based key if the app
                            asks.
                          </p>
                          <div className="totp-secret-row">
                            <input
                              id="totp-secret"
                              aria-label="Manual authenticator setup key"
                              readOnly
                              value={totpSecret.secretKey}
                              autoComplete="off"
                              className="auth-input"
                            />
                            <button
                              type="button"
                              onClick={() => void copyTotpSetupKey()}
                              className="auth-btn-secondary totp-copy-button"
                            >
                              {isTotpKeyCopied ? (
                                <CheckCircle2 aria-hidden="true" size={16} />
                              ) : (
                                <Copy aria-hidden="true" size={16} />
                              )}
                              {isTotpKeyCopied ? "Copied" : "Copy key"}
                            </button>
                          </div>
                          <span className="totp-copy-status" aria-live="polite">
                            {isTotpKeyCopied
                              ? "Setup key copied to clipboard."
                              : ""}
                          </span>
                        </details>

                        <div className="auth-input-group">
                          <label htmlFor="totp-code">
                            Current authenticator code
                          </label>
                          <OtpInput
                            id="totp-code"
                            value={totpEnrollmentCode}
                            onChange={setTotpEnrollmentCode}
                            length={6}
                            disabled={isWorking}
                            aria-label="Current authenticator code"
                          />
                          <span id="totp-code-help" className="auth-field-help">
                            Codes refresh about every 30 seconds. If one
                            expires, enter the next code shown in the app.
                          </span>
                        </div>
                        <p className="totp-security-note">
                          Keep this setup key private. After enrollment, it will
                          not be shown again. If you lose access to all enrolled
                          factors, contact another platform owner for recovery.
                        </p>
                      </div>
                    )}
                    <div className="auth-form-actions">
                      {totpSecret !== undefined && (
                        <button
                          type="button"
                          onClick={() => {
                            setTotpSecret(undefined);
                            setTotpEnrollmentUri("");
                            setTotpEnrollmentCode("");
                            setIsTotpKeyCopied(false);
                          }}
                          className="auth-btn-secondary"
                          style={{ flex: 1 }}
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        type="submit"
                        disabled={
                          isWorking ||
                          (totpSecret !== undefined &&
                            totpEnrollmentCode.trim().length === 0)
                        }
                        className="auth-btn-primary"
                        style={{ flex: 2 }}
                      >
                        {totpSecret === undefined
                          ? "Set up authenticator"
                          : "Complete enrollment"}
                      </button>
                    </div>
                  </form>
                )}

                {/* Tab 3: SMS Phone MFA */}
                {activeSetupTab === "sms" && (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void sendMfaEnrollmentChallenge();
                    }}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "14px",
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: "13px",
                        color: "#6b7280",
                        lineHeight: 1.5,
                      }}
                    >
                      Link your phone number to receive secure one-time
                      verification codes via SMS text messages.
                    </p>
                    <div className="auth-input-group">
                      <label htmlFor="sms-phone">MFA Phone Number</label>
                      <input
                        id="sms-phone"
                        value={mfaPhoneNumber}
                        onChange={(event) =>
                          setMfaPhoneNumber(event.target.value)
                        }
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="054 123 4567 or +233 54 123 4567"
                        className="auth-input"
                      />
                      <small style={{ color: "#6b7280" }}>You can enter the number with or without +233.</small>
                    </div>
                    {mfaEnrollmentVerificationId.length > 0 && (
                      <div className="auth-input-group">
                        <label htmlFor="sms-code">MFA Verification Code</label>
                        <OtpInput
                          id="sms-code"
                          value={mfaEnrollmentCode}
                          onChange={setMfaEnrollmentCode}
                          length={6}
                          disabled={isWorking}
                          aria-label="SMS MFA verification code"
                        />
                      </div>
                    )}
                    <div style={{ display: "flex", gap: "10px" }}>
                      <button
                        type="submit"
                        disabled={isWorking}
                        className="auth-btn-secondary"
                        style={{ flex: 1 }}
                      >
                        Send SMS code
                      </button>
                      {mfaEnrollmentVerificationId.length > 0 && (
                        <button
                          type="button"
                          disabled={
                            isWorking || mfaEnrollmentCode.trim().length === 0
                          }
                          onClick={() => void completeMfaEnrollment()}
                          className="auth-btn-primary"
                          style={{ flex: 1 }}
                        >
                          Complete enrollment
                        </button>
                      )}
                    </div>
                  </form>
                )}
              </div>
            </>
          )}

          {/* Status Message Display */}
          {status && (
            <div
              className="auth-status-box info"
              style={{ marginBottom: "16px" }}
            >
              <AlertTriangle
                size={18}
                style={{ flexShrink: 0, marginTop: "2px" }}
              />
              <span>{status}</span>
            </div>
          )}

          {/* Error Message Display */}
          {error && (
            <div
              className="auth-status-box error"
              style={{ marginBottom: "16px" }}
            >
              <AlertTriangle
                size={18}
                style={{ flexShrink: 0, marginTop: "2px" }}
              />
              <span>{error}</span>
            </div>
          )}

          <div id="admin-mfa-recaptcha" />
        </div>
      </main>
    </div>
  );
}
