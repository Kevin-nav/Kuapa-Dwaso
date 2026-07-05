// packages/dashboard-ui/src/components/ConfirmModal.tsx
"use client";

import React, { useState } from "react";
import { gray, status } from "@kuapa-dwaso/design-tokens";

export type ConfirmModalProps = {
  isOpen: boolean;
  title: string;
  impactMessage: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: (reason?: string) => void;
  onCancel: () => void;
  requireReason?: boolean;
  reasonPlaceholder?: string;
};

export function ConfirmModal({
  isOpen,
  title,
  impactMessage,
  confirmText = "Confirm Action",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  requireReason = false,
  reasonPlaceholder = "Please provide a reason for this action...",
}: ConfirmModalProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (requireReason && !reason.trim()) {
      setError("Reason is required.");
      return;
    }
    setError("");
    onConfirm(reason);
    setReason("");
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(15, 31, 20, 0.4)", // transparent ink
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "16px",
      }}
    >
      <div
        style={{
          backgroundColor: gray[0],
          border: `1px solid ${gray[100]}`,
          borderRadius: "12px",
          width: "100%",
          maxWidth: "480px",
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: `1px solid ${gray[50]}`,
            backgroundColor: gray[25],
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: "1.25rem",
              fontWeight: 700,
              color: gray[900],
            }}
          >
            {title}
          </h3>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Content */}
          <div
            style={{
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            {/* Impact Box */}
            <div
              style={{
                backgroundColor: status.dangerBg,
                borderLeft: `4px solid ${status.danger}`,
                borderRadius: "6px",
                padding: "16px",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: "0.875rem",
                  color: status.danger,
                  fontWeight: 600,
                  lineHeight: 1.5,
                }}
              >
                ⚠️ Impact Warning
              </p>
              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: "0.875rem",
                  color: gray[700],
                  lineHeight: 1.5,
                  fontWeight: 500,
                }}
              >
                {impactMessage}
              </p>
            </div>

            {requireReason && (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    color: gray[700],
                  }}
                >
                  Reason / Notes <span style={{ color: status.danger }}>*</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    if (e.target.value.trim()) setError("");
                  }}
                  placeholder={reasonPlaceholder}
                  rows={3}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "6px",
                    border: `1px solid ${error ? status.danger : gray[300]}`,
                    fontFamily: "inherit",
                    fontSize: "0.875rem",
                    resize: "vertical",
                    outline: "none",
                  }}
                />
                {error && (
                  <span style={{ fontSize: "0.75rem", color: status.danger, fontWeight: 500 }}>
                    {error}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div
            style={{
              padding: "16px 24px",
              borderTop: `1px solid ${gray[50]}`,
              backgroundColor: gray[25],
              display: "flex",
              justifyContent: "flex-end",
              gap: "12px",
            }}
          >
            <button
              type="button"
              onClick={onCancel}
              style={{
                background: "transparent",
                border: `1px solid ${gray[300]}`,
                borderRadius: "6px",
                color: gray[700],
                padding: "8px 16px",
                fontWeight: 600,
                fontSize: "0.875rem",
                cursor: "pointer",
              }}
            >
              {cancelText}
            </button>
            <button
              type="submit"
              style={{
                background: status.danger,
                border: 0,
                borderRadius: "6px",
                color: "white",
                padding: "8px 16px",
                fontWeight: 700,
                fontSize: "0.875rem",
                cursor: "pointer",
                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
              }}
            >
              {confirmText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
