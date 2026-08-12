"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { getAuthErrorCode, getAuthErrorMessage, normalizeGhanaPhoneNumber } from "@kuapa-dwaso/utils";
import { ArrowRight, CheckCircle2, KeyRound, PackageCheck, ShieldCheck, Smartphone, Warehouse } from "lucide-react";
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
  const [status, setStatus] = useState("Warehouse agents sign in with the phone number linked by invite acceptance.");
  const [error, setError] = useState<string | undefined>();
  const [errorCode, setErrorCode] = useState<string | undefined>();
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

  const sendOtp = async (event: FormEvent) => {
    event.preventDefault();
    setError(undefined);
    setErrorCode(undefined);
    setIsWorking(true);
    try {
      const normalizedPhoneNumber = normalizeGhanaPhoneNumber(phoneNumber);
      const result = await signInWithPhoneNumber(firebaseAuth, normalizedPhoneNumber, verifier());
      clearVerifier();
      setPhoneNumber(normalizedPhoneNumber);
      setConfirmation(result);
      setStatus("OTP sent. Enter the SMS code to sign in.");
    } catch (err) {
      clearVerifier();
      const code = getAuthErrorCode(err);
      setErrorCode(code);
      setError(err instanceof Error && code === undefined
        ? "Enter a Ghana phone number such as 054 123 4567 or +233 54 123 4567."
        : getAuthErrorMessage(err, "send-phone-code"));
      setStatus("No code was sent. You can try again.");
    } finally {
      setIsWorking(false);
    }
  };

  const verifyOtp = async (event: FormEvent) => {
    event.preventDefault();
    if (confirmation === null) {
      return;
    }
    setError(undefined);
    setErrorCode(undefined);
    setIsWorking(true);
    try {
      await confirmation.confirm(otp.trim());
      setStatus("Signed in. The ops console will use your platform principal when it resolves.");
    } catch (err) {
      const code = getAuthErrorCode(err);
      setErrorCode(code);
      if (code === "auth/code-expired" || code === "auth/session-expired") {
        setConfirmation(null);
        setOtp("");
        clearVerifier();
        setStatus("Request a new verification code to continue.");
      } else {
        setStatus("The code was not verified. Check it and try again.");
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
              <small className="ops-auth-field-help">You can enter the number with or without +233.</small>
            </div>
            {confirmation !== null ? (
              <div className="ops-auth-field">
                <label htmlFor="opsOtp">Six-digit verification code</label>
                <div className="ops-auth-input-wrap"><KeyRound size={19} /><input id="opsOtp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value)} required /></div>
              </div>
            ) : null}
            <div id="ops-phone-recaptcha" />
            <p className="ops-auth-status">{status}</p>
            {error !== undefined ? <div className="ops-auth-error" role="alert"><span>!</span><p>{error}{errorCode !== undefined ? <small style={{ display: "block", marginTop: 5, opacity: 0.78 }}>Reference: {errorCode}</small> : null}</p></div> : null}
            <button className="ops-auth-submit" type="submit" disabled={isWorking}>{isWorking ? "Please wait…" : confirmation === null ? <>Send secure code <ArrowRight size={18} /></> : <>Verify and enter console <ArrowRight size={18} /></>}</button>
            {confirmation !== null ? <button className="ops-auth-secondary" type="button" disabled={isWorking} onClick={() => { setConfirmation(null); setOtp(""); setError(undefined); }}>Use a different number</button> : null}
            {firebaseUser !== null ? <button className="ops-auth-secondary" type="button" onClick={() => void signOut()}>Sign out current account</button> : null}
          </form>
          <p className="ops-auth-help">No invitation or warehouse assignment? Contact your platform administrator.</p>
        </div>
      </section>
    </main>
  );
}
