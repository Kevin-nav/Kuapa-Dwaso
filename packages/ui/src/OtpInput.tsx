import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
  type CSSProperties,
  type ReactNode,
} from "react";
import { palette, interaction, status as statusTokens, gray } from "@kuapa-dwaso/design-tokens";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface OtpInputProps {
  /** Number of digit slots (default: 6). */
  length?: number;
  /** Current value — controlled mode. Pass "" to clear. */
  value?: string;
  /** Called on every digit change with the full string so far. */
  onChange?: (value: string) => void;
  /** Called once all slots are filled. */
  onComplete?: (code: string) => void;
  /** Show error styling (red border + subtle shake). */
  hasError?: boolean;
  /** Disable all inputs. */
  disabled?: boolean;
  /** Visual separator after this many digits (e.g. 3 → "___-___"). */
  separatorAfter?: number;
  /** autoComplete hint – defaults to "one-time-code". */
  autoComplete?: string;
  /** aria-label for the wrapper group. */
  "aria-label"?: string;
  /** Optional id prefix for each input. */
  id?: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const DIGIT_RE = /^\d$/;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/* ------------------------------------------------------------------ */
/*  Styles (inline — zero CSS deps)                                   */
/* ------------------------------------------------------------------ */

const wrapperStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
};

function slotStyle(
  isFocused: boolean,
  hasError: boolean,
  disabled: boolean,
  filled: boolean,
): CSSProperties {
  let borderColor: string = gray[300];
  let boxShadow: string = "0 1px 3px rgba(0,0,0,0.06)";

  if (hasError) {
    borderColor = statusTokens.danger;
    boxShadow = `0 0 0 2.5px ${statusTokens.dangerBg}, 0 1px 3px rgba(0,0,0,0.06)`;
  } else if (isFocused) {
    borderColor = interaction.focusRing;
    boxShadow = `0 0 0 2.5px ${palette.sky}33, 0 1px 3px rgba(0,0,0,0.06)`;
  } else if (filled) {
    borderColor = gray[400];
  }

  return {
    width: 48,
    height: 56,
    border: `1.5px solid ${borderColor}`,
    borderRadius: 10,
    background: disabled ? gray[50] : palette.surfaceRaised,
    color: disabled ? gray[400] : palette.ink,
    fontSize: 22,
    fontWeight: 700,
    fontFamily:
      "'Inter', 'Roboto', ui-monospace, SFMono-Regular, Menlo, monospace",
    fontVariantNumeric: "tabular-nums",
    textAlign: "center" as const,
    outline: "none",
    caretColor: "transparent",
    cursor: disabled ? "not-allowed" : "text",
    boxShadow,
    transition: "border-color 0.18s ease, box-shadow 0.18s ease, transform 0.15s ease",
    WebkitAppearance: "none" as const,
    MozAppearance: "textfield" as const,
    /* prevent iOS zoom */
    maxWidth: 48,
  };
}

const separatorDotStyle: CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: "50%",
  background: gray[300],
  flexShrink: 0,
};

/* ------------------------------------------------------------------ */
/*  Cursor blink keyframe – injected once                             */
/* ------------------------------------------------------------------ */

const CURSOR_CLASS = "kd-otp-cursor";
const SHAKE_CLASS = "kd-otp-shake";
let stylesInjected = false;

function injectGlobalStyles() {
  if (stylesInjected || typeof document === "undefined") return;
  stylesInjected = true;

  const sheet = document.createElement("style");
  sheet.textContent = `
@keyframes kd-otp-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
.${CURSOR_CLASS}::after {
  content: "";
  position: absolute;
  left: 50%;
  top: 25%;
  transform: translateX(-50%);
  width: 2px;
  height: 50%;
  background: ${palette.ink};
  border-radius: 1px;
  animation: kd-otp-blink 1s steps(1) infinite;
}
@keyframes kd-otp-shake {
  0%, 100% { transform: translateX(0); }
  15% { transform: translateX(-4px); }
  30% { transform: translateX(4px); }
  45% { transform: translateX(-3px); }
  60% { transform: translateX(3px); }
  75% { transform: translateX(-1px); }
  90% { transform: translateX(1px); }
}
.${SHAKE_CLASS} {
  animation: kd-otp-shake 0.4s ease-in-out;
}
/* Hide number input spinners */
.kd-otp-slot::-webkit-inner-spin-button,
.kd-otp-slot::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
`;
  document.head.appendChild(sheet);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function OtpInput({
  length = 6,
  value: controlledValue,
  onChange,
  onComplete,
  hasError = false,
  disabled = false,
  separatorAfter = 3,
  autoComplete = "one-time-code",
  "aria-label": ariaLabel = "Verification code",
  id: idPrefix,
}: OtpInputProps) {
  /* Inject once */
  useEffect(() => {
    injectGlobalStyles();
  }, []);

  /* Internal state */
  const [digits, setDigitsState] = useState<string[]>(() =>
    Array.from({ length }, (_, i) => controlledValue?.[i] ?? ""),
  );
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [shaking, setShaking] = useState(false);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const prevErrorRef = useRef(hasError);

  /* Sync controlled value → internal digits */
  const currentDigits = controlledValue === undefined
    ? digits
    : Array.from({ length }, (_, i) => controlledValue[i] ?? "");

  useEffect(() => {
    if (hasError && !prevErrorRef.current) {
      setShaking(true);
      const t = setTimeout(() => setShaking(false), 420);
      prevErrorRef.current = hasError;
      return () => clearTimeout(t);
    }
    prevErrorRef.current = hasError;
    return undefined;
  }, [hasError]);

  /* Helpers */
  const setDigits = useCallback(
    (next: string[]) => {
      if (controlledValue === undefined) setDigitsState(next);
      const joined = next.join("");
      onChange?.(joined);
      if (joined.length === length && next.every((d) => DIGIT_RE.test(d))) {
        onComplete?.(joined);
      }
    },
    [controlledValue, length, onChange, onComplete],
  );

  const focusSlot = useCallback(
    (i: number) => {
      const idx = clamp(i, 0, length - 1);
      inputsRef.current[idx]?.focus();
    },
    [length],
  );

  /* Event handlers */
  const handleKeyDown = useCallback(
    (index: number) => (e: KeyboardEvent<HTMLInputElement>) => {
      if (disabled) return;

      if (e.key === "Backspace") {
        e.preventDefault();
        const next = [...currentDigits];
        if (next[index] !== "") {
          next[index] = "";
          setDigits(next);
        } else if (index > 0) {
          next[index - 1] = "";
          setDigits(next);
          focusSlot(index - 1);
        }
        return;
      }

      if (e.key === "Delete") {
        e.preventDefault();
        const next = [...currentDigits];
        next[index] = "";
        setDigits(next);
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (index > 0) focusSlot(index - 1);
        return;
      }

      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (index < length - 1) focusSlot(index + 1);
        return;
      }

      if (DIGIT_RE.test(e.key)) {
        e.preventDefault();
        const next = [...currentDigits];
        next[index] = e.key;
        setDigits(next);
        if (index < length - 1) {
          focusSlot(index + 1);
        }
      }
    },
    [currentDigits, disabled, focusSlot, length, setDigits],
  );

  const handlePaste = useCallback(
    (index: number) => (e: ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      if (disabled) return;
      const pasted = e.clipboardData
        .getData("text/plain")
        .replace(/\D/g, "")
        .slice(0, length);
      if (pasted.length === 0) return;

      const next = [...currentDigits];
      let cursor = index;
      for (const ch of pasted) {
        if (cursor >= length) break;
        next[cursor] = ch;
        cursor++;
      }
      setDigits(next);
      focusSlot(Math.min(cursor, length - 1));
    },
    [currentDigits, disabled, focusSlot, length, setDigits],
  );

  const handleFocus = useCallback(
    (index: number) => () => {
      setFocusedIndex(index);
      /* select the text so the next keystroke replaces it */
      inputsRef.current[index]?.select();
    },
    [],
  );

  const handleBlur = useCallback(() => setFocusedIndex(-1), []);

  /* Render */
  const slots: ReactNode[] = [];

  for (let i = 0; i < length; i++) {
    const isFocused = focusedIndex === i;
    const filled = DIGIT_RE.test(currentDigits[i] ?? "");
    const showCursor = isFocused && !filled && !disabled;

    slots.push(
      <div
        key={`slot-${i}`}
        style={{ position: "relative", display: "inline-flex" }}
        className={showCursor ? CURSOR_CLASS : undefined}
      >
        <input
          ref={(el) => {
            inputsRef.current[i] = el;
          }}
          id={idPrefix ? `${idPrefix}-${i}` : undefined}
          className="kd-otp-slot"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          autoComplete={i === 0 ? autoComplete : "off"}
          aria-label={`Digit ${i + 1} of ${length}`}
          value={currentDigits[i] ?? ""}
          disabled={disabled}
          readOnly={disabled}
          style={slotStyle(isFocused, hasError, disabled, filled)}
          onKeyDown={handleKeyDown(i)}
          onPaste={handlePaste(i)}
          onFocus={handleFocus(i)}
          onBlur={handleBlur}
          onChange={() => {
            /* controlled via onKeyDown / onPaste */
          }}
        />
      </div>,
    );

    /* Separator dot */
    if (
      separatorAfter > 0 &&
      i === separatorAfter - 1 &&
      i < length - 1
    ) {
      slots.push(
        <span key="sep" style={separatorDotStyle} aria-hidden="true" />,
      );
    }
  }

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      style={wrapperStyle}
      className={shaking ? SHAKE_CLASS : undefined}
    >
      {slots}
    </div>
  );
}

OtpInput.displayName = "OtpInput";
