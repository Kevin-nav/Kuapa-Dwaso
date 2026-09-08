import {
  CommercialTermsSummary,
  EvidenceStatusList,
  FinancialBreakdown,
  NextActionPanel,
  QuantityProgress,
  TransactionTimeline,
  type CommercialTerm,
  type EvidenceItem,
  type FinancialLine,
  type PresentationTone,
  type QuantityProgressValue,
  type TimelineItem,
} from "@kuapa-dwaso/ui/pilot";

export type PilotTransactionSummaryProps = {
  nextAction: {
    title: string;
    detail: string;
    deadline?: string;
    statusLabel?: string;
    tone?: PresentationTone;
  };
  terms: { revisionLabel: string; items: readonly CommercialTerm[] };
  quantities: readonly QuantityProgressValue[];
  evidence: readonly EvidenceItem[];
  finances: {
    lines: readonly FinancialLine[];
    totalLabel: string;
    totalPesewas?: number;
    complete: boolean;
  };
  timeline: readonly TimelineItem[];
};

export function PilotTransactionSummary({
  nextAction,
  terms,
  quantities,
  evidence,
  finances,
  timeline,
}: PilotTransactionSummaryProps) {
  return (
    <section
      aria-label="Pilot transaction summary"
      style={{ display: "grid", gap: 16 }}
    >
      <NextActionPanel {...nextAction} />
      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 310px), 1fr))",
        }}
      >
        <CommercialTermsSummary
          revisionLabel={terms.revisionLabel}
          terms={terms.items}
        />
        <QuantityProgress values={quantities} />
      </div>
      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(100%, 310px), 1fr))",
        }}
      >
        <EvidenceStatusList items={evidence} />
        <FinancialBreakdown {...finances} />
      </div>
      <TransactionTimeline items={timeline} />
    </section>
  );
}
