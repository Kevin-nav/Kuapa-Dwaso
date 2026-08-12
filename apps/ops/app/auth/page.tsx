"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AUTH_CODE_VALIDITY_MS, getAuthErrorCode, getAuthErrorMessage, normalizeGhanaPhoneNumber } from "@kuapa-dwaso/utils";
import { OtpExpiryCountdown, OtpInput } from "@kuapa-dwaso/ui";
import { ArrowRight, CheckCircle2, PackageCheck, ShieldCheck, Smartphone, Warehouse } from "lucide-react";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
  type RecaptchaVerifier as RecaptchaVerifierType,
} from "firebase/auth";
import { firebaseAuth } from "./firebase";
import { useOpsAuth } from "./OpsAuthProvider";

export default function OpsAuthPage() {
  const { principal, firebaseUser, signOut } = useOpsAuth();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [codeExpiresAt, setCodeExpiresAt] = useState<number>();
  const [isCodeExpired, setIsCodeExpired] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const recaptchaRef = useRef<RecaptchaVerifierType | null>(null);
  const router = useRouter();

  const clearVerifier = useCallback(() => {
    recaptchaRef.current?.clear();
    recaptchaRef.current = null;
  }, []);

  useEffect(() => clearVerifier, [clearVerifier]);

  useEffect(() => {
    if (principal?.role === "warehouse_agent") {
      router.replace("/");
    }
  }, [principal?.role, router]);

  const verifier = () => {
    if (recaptchaRef.current !== null) {
      return recaptchaRef.current;
    }
    recaptchaRef.current = new RecaptchaVerifier(firebaseAuth, "ops-phone-recaptcha", { size: "invisible" });
    return recaptchaRef.current;
  };

  const sendOtp = async (event?: FormEvent) => {
    event?.preventDefault();
    setError(undefined);
    setIsCodeExpired(false);
    setIsWorking(true);
    try {
      const normalizedPhoneNumber = normalizeGhanaPhoneNumber(phoneNumber);
      const result = await signInWithPhoneNumber(firebaseAuth, normalizedPhoneNumber, verifier());
      clearVerifier();
      setPhoneNumber(normalizedPhoneNumber);
      setConfirmation(result);
      setOtp("");
      setCodeExpiresAt(Date.now() + AUTH_CODE_VALIDITY_MS);
    } catch (err) {
      clearVerifier();
      const code = getAuthErrorCode(err);
      setError(err instanceof Error && code === undefined && err.message.startsWith("Ghana phone number")
        ? "Enter a valid Ghana phone number, such as 054 123 4567."
        : getAuthErrorMessage(err, "send-phone-code"));
    } finally {
      setIsWorking(false);
    }
  };

  const verifyOtp = async (event: FormEvent) => {
    event.preventDefault();
    if (confirmation === null) {
      return;
    }
    if (isCodeExpired) {
      setError("This code has expired. Request a new code to continue.");
      return;
    }
    setError(undefined);
    setIsWorking(true);
    try {
      await confirmation.confirm(otp.trim());
    } catch (err) {
      const code = getAuthErrorCode(err);
      if (code === "auth/code-expired" || code === "auth/session-expired") {
        setIsCodeExpired(true);
        clearVerifier();
      }
      setError(getAuthErrorMessage(err, "verify-phone-code"));
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <main className="ops-auth-layout">
      <aside className="ops-auth-story">
        <div className="ops-auth-brand"><span className="ops-auth-brand-mark"><Warehouse size={22} /></span><span>KuapaDwaso Ops</span></div>
        <div className="ops-auth-story-copy">
          <p className="ops-auth-kicker">Warehouse operations</p>
          <h1>Every bag received.<br />Every movement accounted for.</h1>
          <p>Secure access for approved warehouse agents handling produce intake, receipts, inventory condition, and dispatch.</p>
          <div className="ops-auth-trust-grid">
            <span><PackageCheck size={18} /> Verified intake records</span>
            <span><ShieldCheck size={18} /> Invite-linked access</span>
            <span><CheckCircle2 size={18} /> Low-bandwidth sync</span>
          </div>
        </div>
        <p className="ops-auth-story-foot">Built for the warehouse floor, not the office desk.</p>
      </aside>

      <section className="ops-auth-main">
        <div className="ops-auth-card-wrap">
          <div className="ops-auth-mobile-brand"><span className="ops-auth-brand-mark"><Warehouse size={20} /></span><strong>KuapaDwaso Ops</strong></div>
          <header className="ops-auth-head">
            <p className="ops-auth-kicker">Agent sign in</p>
            <h2>{confirmation === null ? "Open your warehouse console" : "Enter the code we sent"}</h2>
            <p>{confirmation === null ? "Use the phone number linked to your approved warehouse-agent invitation." : `A one-time code was sent to ${phoneNumber}.`}</p>
          </header>

          {firebaseUser !== null && principal?.role !== "warehouse_agent" ? (
            <div className="ops-auth-notice" role="alert"><ShieldCheck size={20} /><div><strong>Account not linked for warehouse access</strong><p>Sign out and use the phone number that accepted the warehouse-agent invitation.</p></div></div>
          ) : null}

          <form className="ops-auth-card" onSubmit={(event) => void (confirmation === null ? sendOtp(event) : verifyOtp(event))}>
            <div className="ops-auth-field">
              <label htmlFor="opsPhone">Warehouse-agent phone</label>
              <div className="ops-auth-input-wrap"><Smartphone size={19} /><input id="opsPhone" type="tel" inputMode="tel" autoComplete="tel" placeholder="Enter phone number" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} disabled={confirmation !== null || isWorking} required /></div>
            </div>
            {confirmation !== null ? (
              <div className="ops-auth-field">
                <label>Six-digit verification code</label>
                <OtpInput value={otp} onChange={setOtp} disabled={isWorking || isCodeExpired} />
                {codeExpiresAt === undefined ? null : (
                  <OtpExpiryCountdown
                    key={codeExpiresAt}
                    expiresAt={codeExpiresAt}
                    onExpire={() => {
                      setIsCodeExpired(true);
                      setError("This code has expired. Request a new code to continue.");
                    }}
                  />
                )}
              </div>
            ) : null}
            <div id="ops-phone-recaptcha" />
            {error !== undefined ? <div className="ops-auth-error" role="alert"><span>!</span><p>{error}</p></div> : null}
            <button className="ops-auth-submit" type="submit" disabled={isWorking || (confirmation !== null && (isCodeExpired || otp.length !== 6))}>{isWorking ? "Please wait…" : confirmation === null ? <>Send secure code <ArrowRight size={18} /></> : isCodeExpired ? "Code expired" : <>Verify and enter console <ArrowRight size={18} /></>}</button>
            {confirmation !== null ? <button className="ops-auth-secondary" type="button" disabled={isWorking} onClick={() => void sendOtp()}>Resend code</button> : null}
            {confirmation !== null ? <button className="ops-auth-secondary" type="button" disabled={isWorking} onClick={() => { setConfirmation(null); setOtp(""); setCodeExpiresAt(undefined); setIsCodeExpired(false); setError(undefined); }}>Use a different number</button> : null}
            {firebaseUser !== null ? <button className="ops-auth-secondary" type="button" onClick={() => void signOut()}>Sign out current account</button> : null}
          </form>
        </div>
      </section>
    </main>
  );
}
