"use client";

import { useCallback, useRef } from "react";
import type { ClipboardEvent, KeyboardEvent } from "react";

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const OTP_LENGTH = 6;

export function OtpInput({ value, onChange, disabled = false }: OtpInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const digits = value.split("").concat(Array(OTP_LENGTH).fill("")).slice(0, OTP_LENGTH);

  const focusInput = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(index, OTP_LENGTH - 1));
    inputRefs.current[clamped]?.focus();
  }, []);

  const handleChange = useCallback(
    (index: number, char: string) => {
      if (!/^\d$/.test(char)) return;
      const next = digits.slice();
      next[index] = char;
      onChange(next.join(""));
      if (index < OTP_LENGTH - 1) {
        focusInput(index + 1);
      }
    },
    [digits, onChange, focusInput],
  );

  const handleKeyDown = useCallback(
    (index: number, event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Backspace") {
        event.preventDefault();
        if (digits[index] !== "") {
          const next = digits.slice();
          next[index] = "";
          onChange(next.join(""));
        } else if (index > 0) {
          const next = digits.slice();
          next[index - 1] = "";
          onChange(next.join(""));
          focusInput(index - 1);
        }
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        focusInput(index - 1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        focusInput(index + 1);
      }
    },
    [digits, onChange, focusInput],
  );

  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLInputElement>) => {
      event.preventDefault();
      const pasted = event.clipboardData.getData("text/plain").replace(/\D/g, "").slice(0, OTP_LENGTH);
      if (pasted.length > 0) {
        onChange(pasted.padEnd(OTP_LENGTH, "").slice(0, OTP_LENGTH));
        focusInput(Math.min(pasted.length, OTP_LENGTH - 1));
      }
    },
    [onChange, focusInput],
  );

  return (
    <div className="ops-otp-group" role="group" aria-label="One-time verification code">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => { inputRefs.current[index] = el; }}
          className="ops-otp-slot"
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={1}
          pattern="[0-9]"
          value={digit}
          disabled={disabled}
          aria-label={`Digit ${index + 1} of ${OTP_LENGTH}`}
          onChange={(event) => {
            const char = event.target.value.slice(-1);
            handleChange(index, char);
          }}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
          onFocus={(event) => event.target.select()}
        />
      ))}
    </div>
  );
}
