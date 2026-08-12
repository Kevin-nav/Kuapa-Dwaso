"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type CSSProperties,
  type KeyboardEvent,
  Fragment,
} from "react";
import { gray, palette, status as statusTokens } from "@kuapa-dwaso/design-tokens";

export interface OtpInputProps {
  length?: number;
  value?: string;
  onChange?: (value: string) => void;
  onComplete?: (code: string) => void;
  hasError?: boolean;
  disabled?: boolean;
  separatorAfter?: number;
  autoComplete?: string;
  "aria-label"?: string;
  id?: string;
}

const DIGIT_RE = /^\d$/;
const SHAKE_CLASS = "kd-otp-shake";
let stylesInjected = false;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function injectGlobalStyles() {
  if (stylesInjected || typeof document === "undefined") return;
  stylesInjected = true;
  const sheet = document.createElement("style");
  sheet.textContent = `
@keyframes kd-otp-shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-4px); }
  40%, 80% { transform: translateX(4px); }
}
.kd-otp-shake { animation: kd-otp-shake 0.4s ease-in-out; }
.kd-otp-slot::-webkit-inner-spin-button,
.kd-otp-slot::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
`;
  document.head.appendChild(sheet);
}

const groupStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "clamp(4px, 1.8vw, 10px)",
  width: "100%",
  maxWidth: 362,
  minWidth: 0,
};

const separatorStyle: CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: "50%",
  background: gray[300],
  flex: "0 0 6px",
};

function slotStyle(
  isFocused: boolean,
  hasError: boolean,
  disabled: boolean,
  filled: boolean,
): CSSProperties {
  const borderColor = hasError
    ? statusTokens.danger
    : isFocused
      ? palette.field
      : filled
        ? gray[400]
        : palette.line;

  return {
    width: "100%",
    minWidth: 0,
    height: "clamp(44px, 13.5vw, 58px)",
    padding: 0,
    border: `1.5px solid ${borderColor}`,
    borderRadius: "clamp(8px, 2.5vw, 13px)",
    background: disabled ? gray[50] : palette.surfaceRaised,
    color: disabled ? gray[400] : palette.ink,
    font: "inherit",
    fontSize: "clamp(1.1rem, 4.5vw, 1.45rem)",
    fontWeight: 800,
    fontVariantNumeric: "tabular-nums",
    textAlign: "center",
    outline: "none",
    caretColor: palette.field,
    cursor: disabled ? "not-allowed" : "text",
    boxShadow: hasError
      ? `0 0 0 3px ${statusTokens.dangerBg}`
      : isFocused
        ? "0 0 0 3px rgba(45, 138, 78, 0.15)"
        : "none",
    transform: isFocused ? "translateY(-2px)" : "none",
    transition: "border-color 0.15s, box-shadow 0.15s, transform 0.1s",
    WebkitAppearance: "none",
    MozAppearance: "textfield",
  };
}

export function OtpInput({
  length = 6,
  value: controlledValue,
  onChange,
  onComplete,
  hasError = false,
  disabled = false,
  separatorAfter = 0,
  autoComplete = "one-time-code",
  "aria-label": ariaLabel = "One-time verification code",
  id: idPrefix,
}: OtpInputProps) {
  const [internalDigits, setInternalDigits] = useState<string[]>(() =>
    Array.from({ length }, (_, index) => controlledValue?.[index] ?? ""),
  );
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [shaking, setShaking] = useState(false);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const previousErrorRef = useRef(hasError);
  const digits = controlledValue === undefined
    ? internalDigits
    : Array.from({ length }, (_, index) => controlledValue[index] ?? "");

  useEffect(() => {
    injectGlobalStyles();
  }, []);

  useEffect(() => {
    if (hasError && !previousErrorRef.current) {
      setShaking(true);
      const timer = window.setTimeout(() => setShaking(false), 420);
      previousErrorRef.current = hasError;
      return () => window.clearTimeout(timer);
    }
    previousErrorRef.current = hasError;
    return undefined;
  }, [hasError]);

  const focusSlot = useCallback((index: number) => {
    inputsRef.current[clamp(index, 0, length - 1)]?.focus();
  }, [length]);

  const updateDigits = useCallback((next: string[]) => {
    if (controlledValue === undefined) setInternalDigits(next);
    const code = next.join("");
    onChange?.(code);
    if (code.length === length && next.every((digit) => DIGIT_RE.test(digit))) {
      onComplete?.(code);
    }
  }, [controlledValue, length, onChange, onComplete]);

  const insertDigits = useCallback((index: number, rawValue: string) => {
    const incoming = rawValue.replace(/\D/g, "").slice(0, length - index);
    if (incoming.length === 0) return;
    const next = [...digits];
    for (let offset = 0; offset < incoming.length; offset += 1) {
      next[index + offset] = incoming[offset] ?? "";
    }
    updateDigits(next);
    focusSlot(Math.min(index + incoming.length, length - 1));
  }, [digits, focusSlot, length, updateDigits]);

  const handleKeyDown = useCallback((index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (event.key === "Backspace") {
      event.preventDefault();
      const next = [...digits];
      if (next[index] !== "") next[index] = "";
      else if (index > 0) {
        next[index - 1] = "";
        focusSlot(index - 1);
      }
      updateDigits(next);
      return;
    }
    if (event.key === "Delete") {
      event.preventDefault();
      const next = [...digits];
      next[index] = "";
      updateDigits(next);
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      focusSlot(index + (event.key === "ArrowLeft" ? -1 : 1));
      return;
    }
    if (DIGIT_RE.test(event.key)) {
      event.preventDefault();
      const next = [...digits];
      next[index] = event.key;
      updateDigits(next);
      if (index < length - 1) focusSlot(index + 1);
    }
  }, [digits, disabled, focusSlot, length, updateDigits]);

  const handlePaste = useCallback((index: number, event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    if (!disabled) insertDigits(index, event.clipboardData.getData("text/plain"));
  }, [disabled, insertDigits]);

  const slots = Array.from({ length }, (_, index) => {
    const digit = digits[index] ?? "";
    const showSeparator = separatorAfter > 0 && index === separatorAfter - 1 && index < length - 1;
    return (
      <Fragment key={`slot-${index}`}>
        <span style={{ display: "flex", flex: "1 1 0", minWidth: 0, maxWidth: 52 }}>
          <input
            ref={(element) => { inputsRef.current[index] = element; }}
            id={idPrefix ? `${idPrefix}-${index}` : undefined}
            className="kd-otp-slot"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            autoComplete={index === 0 ? autoComplete : "off"}
            aria-label={`Digit ${index + 1} of ${length}`}
            value={digit}
            disabled={disabled}
            style={slotStyle(focusedIndex === index, hasError, disabled, DIGIT_RE.test(digit))}
            onFocus={(event) => { setFocusedIndex(index); event.currentTarget.select(); }}
            onBlur={() => setFocusedIndex(-1)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPaste={(event) => handlePaste(index, event)}
            onChange={(event) => {
              const rawValue = event.target.value;
              if (rawValue === "") {
                const next = [...digits];
                next[index] = "";
                updateDigits(next);
              } else {
                insertDigits(index, rawValue);
              }
            }}
          />
        </span>
        {showSeparator ? <span style={separatorStyle} aria-hidden="true" /> : null}
      </Fragment>
    );
  });

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={shaking ? SHAKE_CLASS : undefined}
      style={groupStyle}
    >
      {slots}
    </div>
  );
}

OtpInput.displayName = "OtpInput";
