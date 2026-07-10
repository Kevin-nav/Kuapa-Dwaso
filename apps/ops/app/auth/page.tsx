"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { getAuthErrorCode, getAuthErrorMessage } from "@kuapa-dwaso/utils";
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
  const [isWorking, setIsWorking] = useState(false);
  const recaptchaRef = useRef<RecaptchaVerifierType | null>(null);

  const clearVerifier = useCallback(() => {
    recaptchaRef.current?.clear();
    recaptchaRef.current = null;
  }, []);

  useEffect(() => clearVerifier, [clearVerifier]);

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
    setIsWorking(true);
    try {
      const result = await signInWithPhoneNumber(firebaseAuth, phoneNumber.trim(), verifier());
      clearVerifier();
      setConfirmation(result);
      setStatus("OTP sent. Enter the SMS code to sign in.");
    } catch (err) {
      clearVerifier();
      setError(getAuthErrorMessage(err, "send-phone-code"));
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
    setIsWorking(true);
    try {
      await confirmation.confirm(otp.trim());
      setStatus("Signed in. The ops console will use your platform principal when it resolves.");
    } catch (err) {
      const code = getAuthErrorCode(err);
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
    <div className="section-card" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div>
        <h1 style={{ fontSize: "24px", marginBottom: "4px" }}>Ops sign in</h1>
        <p style={{ color: "var(--gray-600)" }}>Use the phone identity accepted from a warehouse-agent invite.</p>
      </div>

      {firebaseUser !== null && (
        <div className="offline-banner" style={{ margin: 0 }}>
          Signed in as {firebaseUser.phoneNumber ?? firebaseUser.uid}. Principal: {principal?.role ?? "not linked yet"}.
        </div>
      )}

      <form
        className="step-container"
        onSubmit={(event) => {
          void (confirmation === null ? sendOtp(event) : verifyOtp(event));
        }}
      >
        <div className="form-group">
          <label className="form-label" htmlFor="opsPhone">Phone number</label>
          <input
            id="opsPhone"
            className="form-input"
            type="tel"
            autoComplete="tel"
            value={phoneNumber}
            onChange={(event) => setPhoneNumber(event.target.value)}
            disabled={confirmation !== null || isWorking}
            required
          />
        </div>
        {confirmation !== null && (
          <div className="form-group">
            <label className="form-label" htmlFor="opsOtp">OTP code</label>
            <input
              id="opsOtp"
              className="form-input"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              value={otp}
              onChange={(event) => setOtp(event.target.value)}
              required
            />
          </div>
        )}
        <div id="ops-phone-recaptcha" />
        <p style={{ color: "var(--gray-600)" }}>{status}</p>
        {error !== undefined && <p className="form-error">{error}</p>}
        <div className="sticky-actions-bar">
          <button className="btn btn-primary" type="submit" disabled={isWorking}>
            {confirmation === null ? "Send OTP" : "Verify OTP"}
          </button>
          {firebaseUser !== null && (
            <button className="btn btn-outline" type="button" onClick={() => void signOut()}>
              Sign out
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
