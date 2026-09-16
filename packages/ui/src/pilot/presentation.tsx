import type { ReactNode } from "react";
import { gray, palette, pilotLedger, status } from "@kuapa-dwaso/design-tokens";
import {
  formatPilotMoney,
  formatPilotQuantity,
  pilotEventSourceLabel,
  quantityPercent,
  validateQuantityProgress,
  type PilotEventSource,
  type QuantityProgressValue,
} from "./model.js";

const cardStyle = {
  background: pilotLedger.paper,
  border: `1px solid ${pilotLedger.rule}`,
  borderRadius: 10,
  color: palette.ink,
  padding: "18px",
} as const;

export type PresentationTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger";

const toneStyles: Record<
  PresentationTone,
  { color: string; background: string; border: string; symbol: string }
> = {
  neutral: {
    color: status.neutral,
    background: status.neutralBg,
    border: status.neutralBorder,
    symbol: "•",
  },
  info: {
    color: status.info,
    background: status.infoBg,
    border: status.infoBorder,
    symbol: "i",
  },
  success: {
    color: status.success,
    background: status.successBg,
    border: status.successBorder,
    symbol: "✓",
  },
  warning: {
    color: status.warning,
    background: status.warningBg,
    border: status.warningBorder,
    symbol: "!",
  },
  danger: {
    color: status.danger,
    background: status.dangerBg,
    border: status.dangerBorder,
    symbol: "×",
  },
};

export function PilotStatus({
  label,
  tone,
}: {
  label: string;
  tone: PresentationTone;
}) {
  const visual = toneStyles[tone];
  return (
    <span
      style={{
        alignItems: "center",
        background: visual.background,
        border: `1px solid ${visual.border}`,
        borderRadius: 999,
        color: visual.color,
        display: "inline-flex",
        fontSize: 12,
        fontWeight: 800,
        gap: 6,
        lineHeight: 1,
        padding: "6px 9px",
      }}
    >
      <span aria-hidden="true">{visual.symbol}</span>
      {label}
    </span>
  );
}

export function SampleDataBanner({
  programmes,
}: {
  programmes: readonly {
    programmeId: string;
    programmeName: string;
    datasetId?: string;
  }[];
}) {
  if (programmes.length === 0) return null;
  const names = programmes
    .map((programme) => programme.programmeName)
    .join(", ");
  return (
    <aside
      aria-label="Sample data notice"
      style={{
        background: pilotLedger.maizeSoft,
        borderBlock: `1px solid ${pilotLedger.maize}`,
        color: pilotLedger.stamp,
        fontSize: 13,
        fontWeight: 700,
        padding: "9px 16px",
      }}
    >
      <span aria-hidden="true" style={{ marginRight: 8 }}>
        ◇
      </span>
      Demo data — {names}. Payment, SMS and inspection simulations are
      labelled at each event.
    </aside>
  );
}

export function NextActionPanel({
  eyebrow = "Next action",
  title,
  detail,
  deadline,
  statusLabel,
  tone = "info",
  action,
}: {
  eyebrow?: string;
  title: string;
  detail: string;
  deadline?: string;
  statusLabel?: string;
  tone?: PresentationTone;
  action?: ReactNode;
}) {
  return (
    <section
      aria-labelledby="pilot-next-action"
      style={{
        ...cardStyle,
        borderLeft: `5px solid ${toneStyles[tone].color}`,
        display: "grid",
        gap: 12,
      }}
    >
      <div
        style={{
          alignItems: "start",
          display: "flex",
          gap: 12,
          justifyContent: "space-between",
        }}
      >
        <div>
          <p
            style={{
              color: pilotLedger.inkMuted,
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: ".12em",
              margin: "0 0 5px",
              textTransform: "uppercase",
            }}
          >
            {eyebrow}
          </p>
          <h2
            id="pilot-next-action"
            style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: 22,
              lineHeight: 1.15,
              margin: 0,
            }}
          >
            {title}
          </h2>
        </div>
        {statusLabel === undefined ? null : (
          <PilotStatus label={statusLabel} tone={tone} />
        )}
      </div>
      <p style={{ color: gray[700], lineHeight: 1.55, margin: 0 }}>{detail}</p>
      {deadline === undefined ? null : (
        <p
          style={{
            color: toneStyles[tone].color,
            fontSize: 13,
            fontWeight: 800,
            margin: 0,
          }}
        >
          Due {deadline}
        </p>
      )}
      {action}
    </section>
  );
}

export type CommercialTerm = {
  label: string;
  value: string;
  note?: string;
  state?: "current" | "changed" | "missing";
};

export function CommercialTermsSummary({
  title = "Commercial terms",
  revisionLabel,
  terms,
}: {
  title?: string;
  revisionLabel: string;
  terms: readonly CommercialTerm[];
}) {
  return (
    <section aria-labelledby="commercial-terms-title" style={cardStyle}>
      <div
        style={{
          alignItems: "baseline",
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          justifyContent: "space-between",
        }}
      >
        <h2
          id="commercial-terms-title"
          style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: 20,
            margin: 0,
          }}
        >
          {title}
        </h2>
        <span
          style={{
            color: pilotLedger.inkMuted,
            fontFamily: "ui-monospace, monospace",
            fontSize: 12,
          }}
        >
          {revisionLabel}
        </span>
      </div>
      <dl style={{ display: "grid", gap: 0, margin: "14px 0 0" }}>
        {terms.map((term) => (
          <div
            key={term.label}
            style={{
              borderTop: `1px solid ${pilotLedger.rule}`,
              display: "grid",
              gap: 4,
              gridTemplateColumns: "minmax(110px, .7fr) minmax(0, 1.3fr)",
              padding: "11px 0",
            }}
          >
            <dt style={{ color: pilotLedger.inkMuted, fontSize: 13 }}>
              {term.label}
            </dt>
            <dd style={{ fontWeight: 750, margin: 0 }}>
              {term.value}
              {term.state === "missing" ? (
                <span
                  style={{
                    color: status.danger,
                    display: "block",
                    fontSize: 12,
                  }}
                >
                  Missing — totals are incomplete
                </span>
              ) : null}
              {term.state === "changed" ? (
                <span
                  style={{
                    color: status.warning,
                    display: "block",
                    fontSize: 12,
                  }}
                >
                  Changed — renewed acknowledgement required
                </span>
              ) : null}
              {term.note === undefined ? null : (
                <small
                  style={{
                    color: gray[600],
                    display: "block",
                    fontWeight: 400,
                    lineHeight: 1.4,
                    marginTop: 3,
                  }}
                >
                  {term.note}
                </small>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

const quantityLabels = {
  requested: "Requested",
  committed: "Committed",
  cleared: "Quality cleared",
  delivered: "Delivered",
} as const;

export function QuantityProgress({
  values,
}: {
  values: readonly QuantityProgressValue[];
}) {
  validateQuantityProgress(values);
  const requested =
    values.find((value) => value.stage === "requested")?.grams ?? 0;
  return (
    <section aria-labelledby="quantity-progress-title" style={cardStyle}>
      <h2
        id="quantity-progress-title"
        style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: 20,
          margin: "0 0 14px",
        }}
      >
        Quantity progress
      </h2>
      <div style={{ display: "grid", gap: 12 }}>
        {values.map((value) => {
          const percent = quantityPercent(value.grams, requested);
          return (
            <div key={value.stage}>
              <div
                style={{
                  display: "flex",
                  fontSize: 13,
                  gap: 10,
                  justifyContent: "space-between",
                  marginBottom: 5,
                }}
              >
                <span>{quantityLabels[value.stage]}</span>
                <strong>
                  {formatPilotQuantity(value.grams)} · {percent}%
                </strong>
              </div>
              <div
                aria-label={`${quantityLabels[value.stage]} ${percent}% of requested quantity`}
                role="img"
                style={{
                  background: pilotLedger.paperMuted,
                  borderRadius: 999,
                  height: 8,
                  overflow: "hidden",
                }}
              >
                <span
                  style={{
                    background:
                      value.stage === "delivered"
                        ? status.success
                        : value.stage === "cleared"
                          ? palette.sky
                          : value.stage === "committed"
                            ? pilotLedger.maize
                            : gray[400],
                    display: "block",
                    height: "100%",
                    width: `${percent}%`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <p
        style={{
          color: gray[600],
          fontSize: 12,
          lineHeight: 1.45,
          margin: "14px 0 0",
        }}
      >
        Committed supply is not the same as quality-cleared or delivered
        quantity.
      </p>
    </section>
  );
}

export type TimelineItem = {
  id: string;
  title: string;
  detail: string;
  occurredAtLabel: string;
  actorLabel?: string;
  statusLabel: string;
  tone: PresentationTone;
  source: PilotEventSource;
};

export function TransactionTimeline({
  items,
  emptyMessage = "No visible activity yet.",
}: {
  items: readonly TimelineItem[];
  emptyMessage?: string;
}) {
  if (items.length === 0)
    return <EmptyState title="No activity" detail={emptyMessage} />;
  return (
    <ol
      aria-label="Transaction timeline"
      style={{ listStyle: "none", margin: 0, padding: 0 }}
    >
      {items.map((item, index) => {
        const sourceLabel = pilotEventSourceLabel(item.source);
        return (
          <li
            key={item.id}
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "22px minmax(0, 1fr)",
              paddingBottom: index === items.length - 1 ? 0 : 18,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                alignItems: "center",
                background: toneStyles[item.tone].background,
                border: `2px solid ${toneStyles[item.tone].border}`,
                borderRadius: 999,
                color: toneStyles[item.tone].color,
                display: "flex",
                fontSize: 11,
                fontWeight: 900,
                height: 22,
                justifyContent: "center",
                position: "relative",
                width: 22,
              }}
            >
              {toneStyles[item.tone].symbol}
            </span>
            <article
              style={{
                borderBottom:
                  index === items.length - 1
                    ? 0
                    : `1px solid ${pilotLedger.rule}`,
                paddingBottom: 16,
              }}
            >
              <div
                style={{
                  alignItems: "start",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  justifyContent: "space-between",
                }}
              >
                <strong>{item.title}</strong>
                <PilotStatus label={item.statusLabel} tone={item.tone} />
              </div>
              <p style={{ color: gray[700], lineHeight: 1.5, margin: "6px 0" }}>
                {item.detail}
              </p>
              <p style={{ color: gray[600], fontSize: 12, margin: 0 }}>
                {item.occurredAtLabel}
                {item.actorLabel === undefined ? "" : ` · ${item.actorLabel}`}
                {sourceLabel === undefined ? "" : ` · ${sourceLabel}`}
              </p>
            </article>
          </li>
        );
      })}
    </ol>
  );
}

export type EvidenceItem = {
  id: string;
  label: string;
  statusLabel: string;
  tone: PresentationTone;
  detail?: string;
};
export function EvidenceStatusList({
  items,
}: {
  items: readonly EvidenceItem[];
}) {
  return (
    <section aria-labelledby="evidence-title" style={cardStyle}>
      <h2
        id="evidence-title"
        style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: 20,
          margin: "0 0 10px",
        }}
      >
        Evidence
      </h2>
      {items.length === 0 ? (
        <EmptyState
          title="No evidence attached"
          detail="Required evidence will be shown here when it is uploaded and attached."
        />
      ) : (
        <ul
          style={{
            display: "grid",
            gap: 8,
            listStyle: "none",
            margin: 0,
            padding: 0,
          }}
        >
          {items.map((item) => (
            <li
              key={item.id}
              style={{
                alignItems: "start",
                background: pilotLedger.paperMuted,
                borderRadius: 7,
                display: "flex",
                gap: 10,
                justifyContent: "space-between",
                padding: 11,
              }}
            >
              <div>
                <strong style={{ fontSize: 14 }}>{item.label}</strong>
                {item.detail === undefined ? null : (
                  <small
                    style={{
                      color: gray[600],
                      display: "block",
                      lineHeight: 1.4,
                      marginTop: 3,
                    }}
                  >
                    {item.detail}
                  </small>
                )}
              </div>
              <PilotStatus label={item.statusLabel} tone={item.tone} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export type FinancialLine = {
  id: string;
  label: string;
  amountPesewas?: number;
  note?: string;
};
export function FinancialBreakdown({
  lines,
  totalLabel,
  totalPesewas,
  complete,
}: {
  lines: readonly FinancialLine[];
  totalLabel: string;
  totalPesewas?: number;
  complete: boolean;
}) {
  return (
    <section aria-labelledby="financial-title" style={cardStyle}>
      <div
        style={{
          alignItems: "center",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <h2
          id="financial-title"
          style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: 20,
            margin: 0,
          }}
        >
          Financial breakdown
        </h2>
        <PilotStatus
          label={complete ? "Complete" : "Incomplete"}
          tone={complete ? "success" : "warning"}
        />
      </div>
      <dl style={{ margin: "12px 0 0" }}>
        {lines.map((line) => (
          <div
            key={line.id}
            style={{
              borderTop: `1px solid ${pilotLedger.rule}`,
              display: "flex",
              gap: 12,
              justifyContent: "space-between",
              padding: "10px 0",
            }}
          >
            <dt>
              {line.label}
              {line.note === undefined ? null : (
                <small style={{ color: gray[600], display: "block" }}>
                  {line.note}
                </small>
              )}
            </dt>
            <dd
              style={{
                fontFamily: "ui-monospace, monospace",
                fontWeight: 800,
                margin: 0,
              }}
            >
              {line.amountPesewas === undefined
                ? "Not recorded"
                : formatPilotMoney(line.amountPesewas)}
            </dd>
          </div>
        ))}
        <div
          style={{
            borderTop: `2px solid ${palette.ink}`,
            display: "flex",
            fontWeight: 900,
            gap: 12,
            justifyContent: "space-between",
            paddingTop: 12,
          }}
        >
          <dt>{totalLabel}</dt>
          <dd style={{ fontFamily: "ui-monospace, monospace", margin: 0 }}>
            {totalPesewas === undefined
              ? "Not available"
              : formatPilotMoney(totalPesewas)}
          </dd>
        </div>
      </dl>
      {complete ? null : (
        <p
          role="note"
          style={{
            color: status.warning,
            fontSize: 13,
            fontWeight: 750,
            margin: "12px 0 0",
          }}
        >
          This is not a final total. One or more costs or postings are still
          missing.
        </p>
      )}
    </section>
  );
}

export function EmptyState({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div
      style={{
        background: gray[25],
        border: `1px dashed ${gray[300]}`,
        borderRadius: 8,
        padding: 18,
        textAlign: "center",
      }}
    >
      <strong>{title}</strong>
      <p
        style={{
          color: gray[600],
          fontSize: 13,
          lineHeight: 1.45,
          margin: "5px 0 0",
        }}
      >
        {detail}
      </p>
    </div>
  );
}
