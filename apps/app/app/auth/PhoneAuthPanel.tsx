"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { getAuthErrorCode, getAuthErrorMessage } from "@kuapa-dwaso/utils";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
  type RecaptchaVerifier as RecaptchaVerifierType,
  type User,
} from "firebase/auth";
import { firebaseAuth } from "./firebase";

type PhoneAuthPanelProps = {
  onVerified: (user: User) => Promise<void> | void;
  submitLabel?: string;
};

export function PhoneAuthPanel({ onVerified, submitLabel = "Verify phone" }: PhoneAuthPanelProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [status, setStatus] = useState<string>("Enter a phone number to receive an OTP.");
  const [error, setError] = useState<string | undefined>();
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const recaptchaRef = useRef<RecaptchaVerifierType | null>(null);

  const clearVerifier = useCallback(() => {
    recaptchaRef.current?.clear();
    recaptchaRef.current = null;
  }, []);

  useEffect(() => clearVerifier, [clearVerifier]);

  const getVerifier = useCallback(() => {
    if (recaptchaRef.current !== null) {
      return recaptchaRef.current;
    }
    recaptchaRef.current = new RecaptchaVerifier(firebaseAuth, "phone-auth-recaptcha", {
      size: "invisible",
    });
    return recaptchaRef.current;
  }, []);

  const formatGhanaPhoneNumber = (num: string) => {
    let cleaned = num.trim().replace(/\s+/g, "");
    if (cleaned.startsWith("+")) {
      return cleaned;
    }
    if (cleaned.startsWith("0")) {
      cleaned = cleaned.slice(1);
    }
    return `+233${cleaned}`;
  };

  const sendOtp = async (event?: FormEvent) => {
    event?.preventDefault();
    setError(undefined);
    setIsSending(true);
    try {
      const formattedPhone = formatGhanaPhoneNumber(phoneNumber);
      const result = await signInWithPhoneNumber(firebaseAuth, formattedPhone, getVerifier());
      clearVerifier();
      setConfirmation(result);
      setStatus("OTP sent. Enter the code from SMS.");
    } catch (err) {
      clearVerifier();
      setError(getAuthErrorMessage(err, "send-phone-code"));
      setStatus("No code was sent. You can try again.");
    } finally {
      setIsSending(false);
    }
  };

  const verifyOtp = async (event: FormEvent) => {
    event.preventDefault();
    if (confirmation === null) {
      await sendOtp();
      return;
    }
    setError(undefined);
    setIsVerifying(true);
    try {
      const credential = await confirmation.confirm(otp.trim());
      setStatus("Phone verified.");
      await onVerified(credential.user);
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
      setIsVerifying(false);
    }
  };

  return (
    <form
      className="auth-card"
      onSubmit={(event) => {
        void (confirmation === null ? sendOtp(event) : verifyOtp(event));
      }}
    >
      {confirmation === null ? (
        <div className="field">
          <span className="field-label">Phone number</span>
          <div className="phone-input">
            <span className="phone-cc">🇬🇭 +233</span>
            <input
              id="phoneNumber"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="24 123 4567"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              disabled={isSending}
              required
            />
          </div>
          <span className="field-help">Standard SMS rates may apply.</span>
        </div>
      ) : (
        <>
          <div className="field">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="field-label">Phone number</span>
              <button
                type="button"
                style={{ background: "none", border: "none", color: "var(--color-primary)", fontSize: "13px", fontWeight: 600, cursor: "pointer", padding: 0 }}
                onClick={() => {
                  setConfirmation(null);
                  setOtp("");
                  clearVerifier();
                  setStatus("Enter a phone number to receive an OTP.");
                }}
              >
                Change number
              </button>
            </div>
            <div className="phone-input" style={{ background: "var(--color-neutral-bg)", opacity: 0.8 }}>
              <span className="phone-cc">🇬🇭 +233</span>
              <input
                type="tel"
                value={phoneNumber}
                disabled
              />
            </div>
          </div>

          <div className="field">
            <span className="field-label">Verification code</span>
            <input
              id="otp"
              className="otp-input"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="• • • • • •"
              value={otp}
              onChange={(event) => setOtp(event.target.value)}
              required
              disabled={isVerifying}
            />
            <span className="field-help">Enter the 6-digit code we sent you.</span>
          </div>
        </>
      )}

      <div id="phone-auth-recaptcha" />
      {status && <p className="auth-status">{status}</p>}
      {error !== undefined && <p className="auth-error">{error}</p>}

      <div className="btn-row">
        <button type="submit" className="btn btn-primary" disabled={isSending || isVerifying}>
          {isSending ? "Sending..." : isVerifying ? "Verifying..." : confirmation === null ? "Send code" : submitLabel}
        </button>
        {confirmation !== null && (
          <button type="button" className="btn btn-ghost" onClick={() => void sendOtp()} disabled={isSending || isVerifying}>
            Resend
          </button>
        )}
      </div>
    </form>
  );
}
