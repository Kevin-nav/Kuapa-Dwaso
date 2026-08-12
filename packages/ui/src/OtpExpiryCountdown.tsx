"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

export interface OtpExpiryCountdownProps {
  expiresAt: number;
  onExpire?: () => void;
  className?: string;
}

const timerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  color: "#526052",
  fontSize: 13,
  fontWeight: 650,
  fontVariantNumeric: "tabular-nums",
  lineHeight: 1.4,
};

const timeStyle: CSSProperties = {
  color: "#1f6b3a",
  fontWeight: 850,
  letterSpacing: "0.04em",
};

function remainingSeconds(expiresAt: number) {
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
}

function formatCountdown(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function OtpExpiryCountdown({ expiresAt, onExpire, className }: OtpExpiryCountdownProps) {
  const [secondsLeft, setSecondsLeft] = useState(() => remainingSeconds(expiresAt));
  const onExpireRef = useRef(onExpire);
  const expiryReportedRef = useRef(false);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    expiryReportedRef.current = false;
    const update = () => {
      const next = remainingSeconds(expiresAt);
      setSecondsLeft(next);
      if (next === 0 && !expiryReportedRef.current) {
        expiryReportedRef.current = true;
        onExpireRef.current?.();
      }
    };
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [expiresAt]);

  const expired = secondsLeft === 0;
  return (
    <div className={className} style={{ ...timerStyle, color: expired ? "#b42318" : timerStyle.color }}>
      <span>{expired ? "This code has expired" : "Code expires in"}</span>
      <time role="timer" aria-live="off" style={{ ...timeStyle, color: expired ? "#b42318" : timeStyle.color }}>
        {formatCountdown(secondsLeft)}
      </time>
    </div>
  );
}
