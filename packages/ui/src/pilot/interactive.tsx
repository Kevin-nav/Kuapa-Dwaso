"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { gray, palette, status } from "@kuapa-dwaso/design-tokens";

export function AsyncStatePanel({
  state,
  empty,
  children,
  onRetry,
}: {
  state: "loading" | "ready" | "empty" | "error";
  empty: { title: string; detail: string };
  children: ReactNode;
  onRetry?: () => void;
}) {
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state === "error") errorRef.current?.focus();
  }, [state]);
  if (state === "loading")
    return (
      <div
        aria-busy="true"
        aria-label="Loading"
        style={{ display: "grid", gap: 10 }}
      >
        <span
          style={{
            background: gray[100],
            borderRadius: 6,
            height: 18,
            width: "42%",
          }}
        />
        <span style={{ background: gray[50], borderRadius: 8, height: 86 }} />
      </div>
    );
  if (state === "empty")
    return (
      <div
        style={{
          border: `1px dashed ${gray[300]}`,
          borderRadius: 8,
          padding: 18,
          textAlign: "center",
        }}
      >
        <strong>{empty.title}</strong>
        <p style={{ color: gray[600], margin: "5px 0 0" }}>{empty.detail}</p>
      </div>
    );
  if (state === "error")
    return (
      <div
        ref={errorRef}
        role="alert"
        tabIndex={-1}
        style={{
          background: status.dangerBg,
          border: `1px solid ${status.dangerBorder}`,
          borderRadius: 8,
          color: status.danger,
          padding: 16,
        }}
      >
        <strong>Could not load this transaction</strong>
        <p style={{ margin: "5px 0 10px" }}>
          Check your connection and try again. No decision has been recorded.
        </p>
        {onRetry === undefined ? null : (
          <button
            onClick={onRetry}
            style={{
              background: "white",
              border: `1px solid ${status.danger}`,
              borderRadius: 6,
              color: status.danger,
              font: "inherit",
              fontWeight: 800,
              padding: "8px 12px",
            }}
            type="button"
          >
            Try again
          </button>
        )}
      </div>
    );
  return <>{children}</>;
}

export function MaterialDecision({
  actionLabel,
  title,
  detail,
  confirmLabel,
  requireReason = false,
  disabledReason,
  isSubmitting = false,
  onConfirm,
}: {
  actionLabel: string;
  title: string;
  detail: string;
  confirmLabel: string;
  requireReason?: boolean;
  disabledReason?: string;
  isSubmitting?: boolean;
  onConfirm: (reason?: string) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const titleId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (open) titleRef.current?.focus();
  }, [open]);
  useEffect(() => {
    if (error !== undefined) errorRef.current?.focus();
  }, [error]);
  if (!open)
    return (
      <div>
        <button
          disabled={disabledReason !== undefined}
          onClick={() => setOpen(true)}
          style={{
            background: palette.ink,
            border: 0,
            borderRadius: 7,
            color: "white",
            cursor: disabledReason === undefined ? "pointer" : "not-allowed",
            font: "inherit",
            fontWeight: 850,
            padding: "11px 15px",
          }}
          type="button"
        >
          {actionLabel}
        </button>
        {disabledReason === undefined ? null : (
          <p style={{ color: gray[600], fontSize: 12, margin: "6px 0 0" }}>
            {disabledReason}
          </p>
        )}
      </div>
    );
  return (
    <section
      aria-labelledby={titleId}
      style={{
        background: "white",
        border: `2px solid ${palette.ink}`,
        borderRadius: 9,
        display: "grid",
        gap: 12,
        padding: 16,
      }}
    >
      <h3
        id={titleId}
        ref={titleRef}
        tabIndex={-1}
        style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: 19,
          margin: 0,
        }}
      >
        {title}
      </h3>
      <p style={{ color: gray[700], lineHeight: 1.5, margin: 0 }}>{detail}</p>
      {requireReason ? (
        <label
          style={{ display: "grid", fontSize: 13, fontWeight: 750, gap: 5 }}
        >
          Reason
          <textarea
            onChange={(event) => {
              setReason(event.target.value);
              setError(undefined);
            }}
            rows={3}
            value={reason}
          />
        </label>
      ) : null}
      <label
        style={{ alignItems: "start", display: "flex", fontSize: 13, gap: 8 }}
      >
        <input
          checked={confirmed}
          onChange={(event) => {
            setConfirmed(event.target.checked);
            setError(undefined);
          }}
          type="checkbox"
        />
        I reviewed the current quantities, terms and evidence.
      </label>
      {error === undefined ? null : (
        <p
          ref={errorRef}
          role="alert"
          tabIndex={-1}
          style={{ color: status.danger, margin: 0 }}
        >
          {error}
        </p>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button
          disabled={isSubmitting}
          onClick={() => {
            if (!confirmed || (requireReason && reason.trim().length === 0)) {
              setError(
                requireReason
                  ? "Confirm the review and enter a reason."
                  : "Confirm that you reviewed the current record.",
              );
              return;
            }
            void onConfirm(requireReason ? reason.trim() : undefined);
          }}
          style={{
            background: palette.fieldDark,
            border: 0,
            borderRadius: 7,
            color: "white",
            font: "inherit",
            fontWeight: 850,
            padding: "10px 14px",
          }}
          type="button"
        >
          {isSubmitting ? "Recording…" : confirmLabel}
        </button>
        <button
          disabled={isSubmitting}
          onClick={() => {
            setOpen(false);
            setConfirmed(false);
            setReason("");
            setError(undefined);
          }}
          style={{
            background: "white",
            border: `1px solid ${gray[300]}`,
            borderRadius: 7,
            color: gray[800],
            font: "inherit",
            fontWeight: 750,
            padding: "10px 14px",
          }}
          type="button"
        >
          Go back
        </button>
      </div>
    </section>
  );
}
