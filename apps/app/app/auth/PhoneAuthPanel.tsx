"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { AUTH_CODE_VALIDITY_MS, getAuthErrorCode, getAuthErrorMessage, normalizeGhanaPhoneNumber } from "@kuapa-dwaso/utils";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
  type RecaptchaVerifier as RecaptchaVerifierType,
  type User,
} from "firebase/auth";
import { firebaseAuth } from "./firebase";
import { OtpExpiryCountdown, OtpInput } from "@kuapa-dwaso/ui";

type PhoneAuthPanelProps = {
  onVerified: (user: User) => Promise<void> | void;
  submitLabel?: string;
};

export function PhoneAuthPanel({ onVerified, submitLabel = "Verify phone" }: PhoneAuthPanelProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [codeExpiresAt, setCodeExpiresAt] = useState<number>();
  const [isCodeExpired, setIsCodeExpired] = useState(false);
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

  const sendOtp = async (event?: FormEvent) => {
    event?.preventDefault();
    setError(undefined);
    setIsCodeExpired(false);
    setIsSending(true);
    try {
      const formattedPhone = normalizeGhanaPhoneNumber(phoneNumber);
      const result = await signInWithPhoneNumber(firebaseAuth, formattedPhone, getVerifier());
      clearVerifier();
      setPhoneNumber(formattedPhone);
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
      setIsSending(false);
    }
  };

  const verifyOtp = async (event: FormEvent) => {
    event.preventDefault();
    if (confirmation === null) {
      await sendOtp();
      return;
    }
    if (isCodeExpired) {
      setError("This code has expired. Request a new code to continue.");
      return;
    }
    setError(undefined);
    setIsVerifying(true);
    try {
      const credential = await confirmation.confirm(otp.trim());
      await onVerified(credential.user);
    } catch (err) {
      const code = getAuthErrorCode(err);
      if (code === "auth/code-expired" || code === "auth/session-expired") {
        setIsCodeExpired(true);
        clearVerifier();
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
            <span className="phone-cc">GH</span>
            <input
              id="phoneNumber"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="054 123 4567"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              disabled={isSending}
              required
            />
          </div>
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
                  setCodeExpiresAt(undefined);
                  setIsCodeExpired(false);
                  clearVerifier();
                }}
              >
                Change number
              </button>
            </div>
            <div className="phone-input" style={{ background: "var(--color-neutral-bg)", opacity: 0.8 }}>
              <span className="phone-cc">GH</span>
              <input
                type="tel"
                value={phoneNumber}
                disabled
              />
            </div>
          </div>

          <div className="field">
            <span className="field-label">Verification code</span>
            <OtpInput
              id="otp"
              value={otp}
              onChange={setOtp}
              length={6}
              disabled={isVerifying || isCodeExpired}
              aria-label="Phone verification code"
            />
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
        </>
      )}

      <div id="phone-auth-recaptcha" />
      {error !== undefined && <p className="auth-error">{error}</p>}

      <div className="btn-row">
        <button type="submit" className="btn btn-primary" disabled={isSending || isVerifying || (confirmation !== null && (isCodeExpired || otp.length !== 6))}>
          {isSending ? "Sending..." : isVerifying ? "Verifying..." : confirmation === null ? "Send code" : isCodeExpired ? "Code expired" : submitLabel}
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
