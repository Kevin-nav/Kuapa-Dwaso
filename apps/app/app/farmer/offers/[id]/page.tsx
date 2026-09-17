"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  MapPin,
  Printer,
} from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useToast } from "@kuapa-dwaso/ui/toast";
import {
  CommercialTermsSummary,
  formatPilotMoney,
  formatPilotQuantity,
  MaterialDecision,
  NextActionPanel,
  PilotStatus,
  QuantityProgress,
  TransactionTimeline,
} from "@kuapa-dwaso/ui/pilot";

type Offer = {
  offerId: Id<"pilotFarmerOffers">;
  programmeId: Id<"pilotProgrammes">;
  requestId: Id<"pilotBuyerRequests">;
  commercialMode: "coordination" | "kuapa_purchase";
  status: string;
  version: number;
  expiresAt: number;
  currentRevision: {
    revisionId: Id<"pilotFarmerOfferRevisions">;
    revision: number;
    offeredGrams: number;
    priceBasis: string;
    priceRate: { numerator: number; scale: number; unit: string };
    chargeTerms: Array<{
      label: string;
      payer: string;
      calculation: string;
      rate: { numerator: number; scale: number; unit: string };
    }>;
    expectedGrossPesewas: number;
    expectedChargesPesewas: number;
    expectedNetPesewas: number;
    inspectionTerms: Array<{ label: string; detail: string }>;
    paymentTerms: Array<{ trigger: string; offsetCalendarDays: number }>;
    titleTransferTerms: Array<{ label: string; detail: string }>;
    custodyTransferTerms: Array<{ label: string; detail: string }>;
    cancellationTerms: Array<{ label: string; detail: string }>;
    expiresAt: number;
  };
  allocation: null | {
    status: string;
    activeGrams: number;
    clearedGrams: number;
  };
  finalAmounts: null | {
    expectedGrossPesewas: number;
    expectedChargesPesewas: number;
    expectedNetPesewas: number;
  };
};
type Lot = {
  id: Id<"pilotProcurementLots">;
  requestId: string;
  lotCode: string;
  sourceGrams: number;
  clearedGrams: number;
  rejectedGrams: number;
  qualityStatus: string;
  currentLocation: { label: string };
  latestInspectionId?: Id<"pilotInspections">;
};
type ReceiptModel = {
  receiptCode: string;
  inspection: {
    acceptedGrams: number;
    rejectedGrams: number;
    qualityStatus: string;
    reasonCode?: string;
    inspectedAt: number;
  };
  lot: { lotCode: string };
};
type Plan = null | {
  plan: {
    status: string;
    collectionWindowStartAt: number;
    collectionWindowEndAt: number;
  };
  stops: Array<{
    location: { label: string };
    windowStartAt: number;
    windowEndAt: number;
    status: string;
  }>;
};
type Statement = {
  totals: {
    obligationPesewas: number;
    settledPesewas: number;
    outstandingPesewas: number;
  };
};
type Activity = {
  page: Array<{
    eventId: string;
    eventName: string;
    createdAt: number;
    views: Array<{ title: string; detail: string }>;
  }>;
};

export default function FarmerOfferDetailPage() {
  const { showToast } = useToast();
  const { id } = useParams<{ id: string }>();
  const offerId = id as Id<"pilotFarmerOffers">;
  const offer = useQuery(api.pilotOffers.get, { offerId }) as Offer | undefined;
  const lots = useQuery(
    api.pilotLots.listForActor,
    offer === undefined
      ? "skip"
      : {
          programmeId: offer.programmeId,
          requestId: offer.requestId,
          limit: 30,
        },
  ) as { page: Lot[] } | undefined;
  const plan = useQuery(
    api.pilotFulfilment.getForRequest,
    offer !== undefined && (offer.allocation?.clearedGrams ?? 0) > 0
      ? { requestId: offer.requestId }
      : "skip",
  ) as Plan | undefined;
  const statement = useQuery(
    api.pilotFinance.getRequestStatement,
    offer === undefined ? "skip" : { requestId: offer.requestId },
  ) as Statement | undefined;
  const activity = useQuery(
    api.pilotActivity.listForRequest,
    offer === undefined ? "skip" : { requestId: offer.requestId, limit: 30 },
  ) as Activity | undefined;
  const receiptId = lots?.page.find(
    (lot) => lot.latestInspectionId !== undefined,
  )?.latestInspectionId;
  const receipt = useQuery(
    api.pilotInspections.getReceipt,
    receiptId === undefined ? "skip" : { inspectionId: receiptId },
  ) as ReceiptModel | null | undefined;
  const decide = useMutation(api.pilotOffers.decide);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [renderedAt] = useState(() => Date.now());

  if (offer === undefined)
    return (
      <div className="skeleton" style={{ minHeight: 420, borderRadius: 18 }} />
    );
  const revision = offer.currentRevision;
  const isExpired = revision.expiresAt <= renderedAt;
  const result = offer.finalAmounts;
  const next =
    offer.status === "sent" && !isExpired
      ? {
          title: "Choose whether to accept this offer",
          detail:
            "Review the quantity, deductions, purchaser, inspection rules, and payment timing below.",
          tone: "warning" as const,
        }
      : offer.status === "accepted" && offer.allocation?.clearedGrams === 0
        ? {
            title: "Prepare for inspection",
            detail:
              "The offer is accepted. Collection and payment are not complete until the server records the next stages.",
            tone: "info" as const,
          }
        : offer.allocation?.clearedGrams
          ? {
              title: "Check your accepted quantity",
              detail:
                "The inspection result and final proceeds use only the quality-cleared quantity.",
              tone: "success" as const,
            }
          : {
              title: "No decision is available",
              detail: isExpired
                ? "This offer expired. Wait for a fresh revision before accepting."
                : `This offer is ${offer.status}.`,
              tone: "neutral" as const,
            };

  async function choose(decision: "accepted" | "declined") {
    if (offer === undefined) return;
    if (!navigator.onLine) {
      setError(
        "You are offline. Your decision was not sent and this offer remains unchanged.",
      );
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await decide({
        offerId,
        revisionId: revision.revisionId,
        decision,
        expectedOfferVersion: offer.version,
        idempotencyKey: crypto.randomUUID(),
      });
      showToast(
        decision === "accepted"
          ? "Offer accepted. Operations can now arrange inspection."
          : "Offer declined.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Your decision was not recorded.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pilot-farmer-stack">
      <Link className="pilot-back" href="/farmer/offers">
        <ArrowLeft size={18} /> All offers
      </Link>
      <header className="pilot-request-heading">
        <div>
          <span className="pilot-buyer-kicker">
            Offer revision {revision.revision}
          </span>
          <h1>{formatPilotQuantity(revision.offeredGrams)} maize offer</h1>
        </div>
        <PilotStatus
          label={
            isExpired && offer.status === "sent" ? "expired" : offer.status
          }
          tone={next.tone}
        />
      </header>
      {error === undefined ? null : (
        <div className="attention-card" role="alert">
          <AlertTriangle size={20} />
          <div className="attention-body">
            <span className="attention-title">Offer unchanged</span>
            <span className="attention-text">{error}</span>
          </div>
        </div>
      )}
      <NextActionPanel
        title={next.title}
        detail={next.detail}
        tone={next.tone}
        deadline={new Date(revision.expiresAt).toLocaleString("en-GH")}
      />
      <section className="pilot-proceeds-card">
        <span>Expected money after listed deductions</span>
        <strong>
          {formatPilotMoney(
            result?.expectedNetPesewas ?? revision.expectedNetPesewas,
          )}
        </strong>
        <small>
          {result === null
            ? "Expected before final inspection"
            : "Final for the quality-cleared quantity"}
        </small>
      </section>
      <CommercialTermsSummary
        revisionLabel={`Revision ${revision.revision}`}
        terms={[
          {
            label: "Quantity",
            value: formatPilotQuantity(revision.offeredGrams),
          },
          {
            label: "Produce value",
            value: formatPilotMoney(
              result?.expectedGrossPesewas ?? revision.expectedGrossPesewas,
            ),
          },
          {
            label: "Listed deductions",
            value: formatPilotMoney(
              result?.expectedChargesPesewas ?? revision.expectedChargesPesewas,
            ),
          },
          {
            label: "Purchaser",
            value:
              offer.commercialMode === "kuapa_purchase"
                ? "Kuapa Dwaso owes your payment after accepted collection"
                : "The named buyer pays you directly. Kuapa Dwaso coordinates the connection.",
          },
          {
            label: "Payment timing",
            value: revision.paymentTerms
              .map(
                (term) =>
                  `${term.offsetCalendarDays} day(s) after ${term.trigger.replaceAll("_", " ")}`,
              )
              .join(", "),
          },
          ...revision.chargeTerms.map((term) => ({
            label: term.label,
            value: `${term.payer} pays · ${term.calculation.replaceAll("_", " ")}`,
          })),
          ...revision.inspectionTerms.map((term) => ({
            label: term.label,
            value: term.detail,
          })),
          ...revision.titleTransferTerms.map((term) => ({
            label: `Ownership — ${term.label}`,
            value: term.detail,
          })),
        ]}
      />
      {offer.status === "sent" ? (
        <div className="pilot-decision-grid">
          <MaterialDecision
            actionLabel="Accept this offer"
            title="Accept the current terms?"
            detail="Only this revision will be accepted. A changed price, quantity, or condition needs your approval again."
            confirmLabel="Accept offer"
            {...(isExpired
              ? { disabledReason: "This offer has expired." }
              : {})}
            isSubmitting={busy}
            onConfirm={() => choose("accepted")}
          />
          <MaterialDecision
            actionLabel="Decline"
            title="Decline this offer?"
            detail="Declining does not create a charge or penalty."
            confirmLabel="Decline offer"
            isSubmitting={busy}
            onConfirm={() => choose("declined")}
          />
        </div>
      ) : null}
      <QuantityProgress
        values={[
          { stage: "requested", grams: revision.offeredGrams },
          { stage: "committed", grams: offer.allocation?.activeGrams ?? 0 },
          { stage: "cleared", grams: offer.allocation?.clearedGrams ?? 0 },
          {
            stage: "delivered",
            grams:
              lots?.page
                .filter((lot) =>
                  lot.currentLocation.label.toLowerCase().includes("buyer"),
                )
                .reduce((sum, lot) => sum + lot.sourceGrams, 0) ?? 0,
          },
        ]}
      />
      {plan === null || plan === undefined ? null : (
        <section className="pilot-buyer-section">
          <div className="section-title-row">
            <h2 className="section-title">Collection instructions</h2>
            <CalendarClock size={19} />
          </div>
          {plan.stops.map((stop, index) => (
            <div
              className="pilot-collection-stop"
              key={`${stop.location.label}-${index}`}
            >
              <MapPin size={19} />
              <div>
                <strong>{stop.location.label}</strong>
                <span>
                  {new Date(stop.windowStartAt).toLocaleString("en-GH")} –{" "}
                  {new Date(stop.windowEndAt).toLocaleString("en-GH")}
                </span>
                <small>{stop.status.replaceAll("_", " ")}</small>
              </div>
            </div>
          ))}
        </section>
      )}
      {receipt === null || receipt === undefined ? null : (
        <section className="pilot-inspection-receipt">
          <div>
            <span className="pilot-buyer-kicker">Inspection receipt</span>
            <h2>{receipt.receiptCode}</h2>
          </div>
          <dl>
            <div>
              <dt>Accepted</dt>
              <dd>{formatPilotQuantity(receipt.inspection.acceptedGrams)}</dd>
            </div>
            <div>
              <dt>Rejected</dt>
              <dd>{formatPilotQuantity(receipt.inspection.rejectedGrams)}</dd>
            </div>
            <div>
              <dt>Result</dt>
              <dd>{receipt.inspection.qualityStatus}</dd>
            </div>
          </dl>
          <button
            className="btn btn-secondary"
            onClick={() => window.print()}
            type="button"
          >
            <Printer size={17} /> Print receipt
          </button>
        </section>
      )}
      <section className="pilot-finance-strip">
        <span>
          <small>Gross maize value</small>
          <b>{formatPilotMoney(statement?.totals.obligationPesewas ?? 0)}</b>
        </span>
        <span>
          <small>Paid</small>
          <b>{formatPilotMoney(statement?.totals.settledPesewas ?? 0)}</b>
        </span>
        <span>
          <small>Still due</small>
          <b>{formatPilotMoney(statement?.totals.outstandingPesewas ?? 0)}</b>
        </span>
      </section>
      <section className="pilot-buyer-section">
        <h2 className="section-title">Your activity only</h2>
        <TransactionTimeline
          items={(activity?.page ?? []).flatMap((event) =>
            event.views.slice(0, 1).map((view) => ({
              id: event.eventId,
              title: view.title,
              detail: view.detail,
              occurredAtLabel: new Date(event.createdAt).toLocaleString(
                "en-GH",
              ),
              statusLabel:
                event.eventName.split(".").at(-1)?.replaceAll("_", " ") ??
                "updated",
              tone: event.eventName.includes("shortfall")
                ? ("danger" as const)
                : ("info" as const),
              source: "live" as const,
            })),
          )}
        />
      </section>
    </div>
  );
}
