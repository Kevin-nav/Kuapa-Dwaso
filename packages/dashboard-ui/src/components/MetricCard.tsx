// packages/dashboard-ui/src/components/MetricCard.tsx
"use client";

import { gray } from "@kuapa-dwaso/design-tokens";

export type MetricCardProps = {
  label: string;
  value: string | number;
  delta?: {
    value: string | number;
    isPositive: boolean;
    label?: string;
  };
  contextLine?: string;
  accentColor?: string;
};

export function MetricCard({ label, value, delta, contextLine, accentColor }: MetricCardProps) {
  return (
    <div
      style={{
        backgroundColor: gray[0],
        border: `1px solid ${gray[100]}`,
        borderRadius: "8px",
        padding: "20px",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
        flex: "1 1 200px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        borderTop: `3px solid ${accentColor ?? gray[100]}`,
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: "0.875rem",
          color: gray[500],
          fontWeight: 500,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </p>
      
      <h3
        style={{
          margin: 0,
          fontSize: "2rem",
          fontWeight: 700,
          color: gray[900],
          lineHeight: 1.1,
        }}
      >
        {value}
      </h3>

      {(delta || contextLine) && (
        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.8125rem", marginTop: "auto" }}>
          {delta && (
            <span
              style={{
                fontWeight: 600,
                color: delta.isPositive ? "#16a34a" : "#dc2626",
              }}
            >
              {delta.isPositive ? "↑" : "↓"} {delta.value}
            </span>
          )}
          {delta?.label && (
            <span style={{ color: gray[500] }}>
              {delta.label}
            </span>
          )}
          {contextLine && (
            <span style={{ color: gray[500], fontStyle: "italic" }}>
              {contextLine}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
