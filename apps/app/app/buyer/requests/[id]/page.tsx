"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, ArrowLeft, FileCheck2, RefreshCw } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
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
import { useToast } from "@kuapa-dwaso/ui/toast";
import { useAuth } from "@/app/auth/AuthProvider";
import { uploadPrivateEvidence } from "@/app/uploads/client";

type RequestDetail = {
  request: {
    requestId: Id<"pilotBuyerRequests">;
    programmeId: Id<"pilotProgrammes">;
    maizeType: string;
    requestedGrams: number;
    confirmedGrams?: number;
    destination: { label: string };
    deliveryWindowStartAt: number;
    deliveryWindowEndAt: number;
    status: string;
    version: number;
  };
  commitmentSummary: {
    provisionalGrams: number;
    committedGrams: number;
    clearedGrams: number;
  };
  agreement: null | {
    revisionId: Id<"pilotBuyerAgreementRevisions">;
    revision: number;
    quantityGrams: number;
    producePriceRate: { numerator: number; scale: number; unit: string };
    chargeTerms: Array<{
      label: string;
      payer: string;
      calculation: string;
      rate: { numerator: number; scale: number; unit: string };
    }>;
    paymentTerms: Array<{ trigger: string; offsetCalendarDays: number }>;
    expiresAt: number;
    state: string;
    isExpired: boolean;
  };
};
type PlanDetail = null | {
  plan: {
    planId: Id<"pilotFulfilmentPlans">;
    buyerAgreementRevisionId: Id<"pilotBuyerAgreementRevisions">;
    status: string;
    plannedGrams: number;
    destination: { label: string };
  };
  stops: Array<{
    stopId: string;
    lots: Array<{
      id: Id<"pilotProcurementLots">;
      lotCode: string;
      sourceGrams: number;
      qualityStatus: string;
    }>;
  }>;
};
type Statement = {
  totals: {
    obligationPesewas: number;
    settledPesewas: number;
    outstandingPesewas: number;
  };
  entries: unknown[];
};
type Activity = {
  page: Array<{
    eventId: string;
    eventName: string;
    createdAt: number;
    views: Array<{ title: string; detail: string }>;
  }>;
};
type PaymentClaim = null | {
  id: Id<"pilotBuyerPaymentClaims">;
  amountPesewas: number;
  status: "pending_verification" | "verified" | "rejected";
  buyerReference?: string;
  reviewReason?: string;
  claimedAt: number;
  version: number;
};

function nextAction(detail: RequestDetail) {
  const { request, agreement } = detail;
  if (request.status === "draft")
    return {
      title: "Submit this draft",
      detail: "Sourcing starts only after the request is submitted.",
      tone: "warning" as const,
    };
  if (["submitted", "under_review"].includes(request.status))
    return {
      title: "Operations is checking supply",
      detail:
        "No quantity or price is confirmed yet. You will be asked to review any quotation.",
      tone: "info" as const,
    };
  if (request.status === "quoted" && agreement?.isExpired)
    return {
      title: "Quotation expired",
      detail: "Ask operations for current terms before making a decision.",
      tone: "warning" as const,
    };
  if (request.status === "quoted" && agreement?.state === "proposed")
    return {
      title: "Review the current quotation",
      detail:
        "Confirm the quantity, price, charges, quality rules, and payment responsibility below.",
      tone: "warning" as const,
    };
  if (request.status === "delivered")
    return {
      title: "Record delivery acceptance",
      detail:
        "Arrival is recorded separately. Check each identified lot before accepting or rejecting it.",
      tone: "warning" as const,
    };
  if (request.status === "disputed")
    return {
      title: "An issue is being reviewed",
      detail:
        "The accepted and rejected quantities remain on the record while operations resolves the issue.",
      tone: "danger" as const,
    };
  return {
    title: "Follow sourcing progress",
    detail:
      "Committed, quality-cleared, and delivered quantities are shown separately.",
    tone: "success" as const,
  };
}

function paymentTriggerLabel(trigger: string) {
  const labels: Record<string, string> = {
    buyer_acceptance: "delivery acceptance",
    cleared_buyer_funds: "cleared buyer funds",
    purchase_collection_acceptance: "collection acceptance",
    fixed_date: "the agreed date",
  };
  return labels[trigger] ?? trigger.replaceAll("_", " ");
}

function chargePayerLabel(payer: string) {
  return payer === "buyer" ? "You pay" : "Handled by Kuapa Dwaso";
}

export default function BuyerRequestDetailPage() {
  const previewAccess =
    process.env.NEXT_PUBLIC_PREVIEW_ACCESS_ENABLED === "true";
  const { id } = useParams<{ id: string }>();
  const requestId = id as Id<"pilotBuyerRequests">;
  const { firebaseUser, principal } = useAuth();
  const detail = useQuery(api.pilotRequests.get, { requestId }) as
    | RequestDetail
    | null
    | undefined;
  const plan = useQuery(api.pilotFulfilment.getForRequest, { requestId }) as
    | PlanDetail
    | undefined;
  const statement = useQuery(api.pilotFinance.getRequestStatement, {
    requestId,
  }) as Statement | undefined;
  const activity = useQuery(api.pilotActivity.listForRequest, {
    requestId,
    limit: 30,
  }) as Activity | undefined;
  const paymentClaim = useQuery(api.pilotFinance.getBuyerPaymentClaim, {
    requestId,
  }) as PaymentClaim | undefined;
  const acknowledge = useMutation(api.pilotRequests.acknowledgeAgreement);
  const reject = useMutation(api.pilotRequests.rejectAgreement);
  const acceptDelivery = useMutation(api.pilotFulfilment.acceptDelivery);
  const claimPayment = useMutation(api.pilotFinance.claimBuyerPayment);
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [rejectedLotId, setRejectedLotId] = useState<string>("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [evidenceFile, setEvidenceFile] = useState<File>();
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNote, setPaymentNote] = useState("");

  if (detail === undefined)
    return (
      <div className="skeleton" style={{ height: 420, borderRadius: 16 }} />
    );
  if (detail === null)
    return (
      <div className="pilot-buyer-empty">
        <AlertTriangle size={30} />
        <h1>Request unavailable</h1>
        <p>This request does not exist or belongs to another buyer.</p>
        <Link className="btn btn-secondary" href="/buyer/requests">
          Return to requests
        </Link>
      </div>
    );

  const action = nextAction(detail);
  const deliveredGrams =
    plan?.plan.status === "delivered" ||
    detail.request.status === "delivered" ||
    detail.request.status === "closed"
      ? (plan?.plan.plannedGrams ?? 0)
      : 0;
  const agreement = detail.agreement;
  const lots = plan?.stops.flatMap((stop) => stop.lots) ?? [];
  const canAccept =
    detail.request.status === "delivered" &&
    plan?.plan.status === "delivered" &&
    agreement !== null;

  async function run(task: () => Promise<unknown>, successMessage?: string) {
    setBusy(true);
    setError(undefined);
    try {
      await task();
      if (successMessage !== undefined) showToast(successMessage);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The decision was not recorded.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function reportPayment() {
    await claimPayment({
      requestId,
      ...(paymentReference.trim()
        ? { buyerReference: paymentReference.trim() }
        : {}),
      ...(paymentNote.trim() ? { buyerNote: paymentNote.trim() } : {}),
      idempotencyKey: crypto.randomUUID(),
    });
    showToast({
      message:
        "Payment reported. Finance will confirm when the funds have cleared.",
      tone: "success",
    });
  }

  async function recordAcceptance(acknowledgedAt: number) {
    if (!canAccept || plan === null || plan === undefined || agreement === null)
      return;
    let evidenceId: Id<"uploadAssets"> | undefined;
    if (rejectedLotId !== "") {
      if (
        evidenceFile === undefined ||
        rejectionReason.trim().length === 0 ||
        firebaseUser === null ||
        principal == null
      ) {
        setError(
          "A rejected lot needs a reason and a photo or document as evidence.",
        );
        return;
      }
      const uploaded = await uploadPrivateEvidence({
        user: firebaseUser,
        file: evidenceFile,
        purpose: "pilot_acceptance_evidence",
        ownerProfileType: "buyer",
        ...(principal.profiles?.find(
          (profile) => profile.profileType === "buyer",
        )?.profileId === undefined
          ? {}
          : {
              ownerProfileId: principal.profiles.find(
                (profile) => profile.profileType === "buyer",
              )!.profileId,
            }),
        relatedEntityType: "pilotProcurementLots",
        relatedEntityId: rejectedLotId,
      });
      evidenceId = uploaded.uploadAssetId as Id<"uploadAssets">;
    }
    await acceptDelivery({
      requestId,
      planId: plan.plan.planId,
      buyerAgreementRevisionId: agreement.revisionId,
      lines: lots.map((lot) => ({
        lotId: lot.id,
        deliveredGrams: lot.sourceGrams,
        acceptedGrams: rejectedLotId === lot.id ? 0 : lot.sourceGrams,
        rejectedGrams: rejectedLotId === lot.id ? lot.sourceGrams : 0,
        ...(rejectedLotId === lot.id
          ? {
              reasonCode: rejectionReason.trim(),
              evidenceUploadAssetIds: [evidenceId!],
            }
          : { evidenceUploadAssetIds: [] }),
      })),
      acknowledgedAt,
      idempotencyKey: crypto.randomUUID(),
    });
    showToast({
      message:
        rejectedLotId === ""
          ? "Delivery decision recorded. The delivered lots were accepted."
          : "Delivery decision recorded. The accepted and rejected quantities are now on record.",
      tone: "success",
    });
  }

  const grossQuote =
    agreement === null
      ? undefined
      : Math.round(
          (agreement.quantityGrams * agreement.producePriceRate.numerator) /
            agreement.producePriceRate.scale /
            1000,
        );

  return (
    <div className="pilot-buyer-stack">
      <Link className="pilot-back" href="/buyer/requests">
        <ArrowLeft size={18} /> All requests
      </Link>
      <header className="pilot-request-heading">
        <div>
          <span className="pilot-buyer-kicker">
            Maize request · {String(requestId).slice(-8).toUpperCase()}
          </span>
          <h1>
            {detail.request.maizeType} for {detail.request.destination.label}
          </h1>
        </div>
        <PilotStatus
          label={detail.request.status.replaceAll("_", " ")}
          tone={action.tone}
        />
      </header>
      {error === undefined ? null : (
        <div className="attention-card" role="alert">
          <AlertTriangle size={20} />
          <div className="attention-body">
            <span className="attention-title">Nothing changed</span>
            <span className="attention-text">{error}</span>
          </div>
        </div>
      )}
      <NextActionPanel
        title={action.title}
        detail={action.detail}
        tone={action.tone}
        statusLabel={detail.request.status.replaceAll("_", " ")}
      />
      <QuantityProgress
        values={[
          { stage: "requested", grams: detail.request.requestedGrams },
          {
            stage: "committed",
            grams: detail.commitmentSummary.committedGrams,
          },
          { stage: "cleared", grams: detail.commitmentSummary.clearedGrams },
          { stage: "delivered", grams: deliveredGrams },
        ]}
      />

      {agreement === null ? (
        <section className="pilot-buyer-empty">
          <FileCheck2 size={28} />
          <h2>No quotation yet</h2>
          <p>
            Kuapa Dwaso will send a quotation when sourcing terms are ready.
          </p>
        </section>
      ) : (
        <>
          <CommercialTermsSummary
            revisionLabel={`Quotation ${agreement.revision}${agreement.isExpired ? " · expired" : ""}`}
            terms={[
              {
                label: "Confirmed quantity",
                value: formatPilotQuantity(agreement.quantityGrams),
              },
              {
                label: "Produce value",
                value:
                  grossQuote === undefined
                    ? "Pending"
                    : formatPilotMoney(grossQuote),
              },
              {
                label: "Supply and delivery",
                value: previewAccess
                  ? "Kuapa Dwaso connects the parties and coordinates collection"
                  : "Managed by Kuapa Dwaso",
              },
              {
                label: "Payment",
                value: agreement.paymentTerms
                  .map(
                    (term) =>
                      `${term.offsetCalendarDays} ${term.offsetCalendarDays === 1 ? "day" : "days"} after ${paymentTriggerLabel(term.trigger)}`,
                  )
                  .join(", "),
              },
              ...agreement.chargeTerms.map((term) => ({
                label: term.label,
                value: `${chargePayerLabel(term.payer)} · ${term.calculation.replaceAll("_", " ")}`,
              })),
            ]}
          />
          {detail.request.status === "quoted" &&
          agreement.state === "proposed" ? (
            <div className="pilot-decision-grid">
              <MaterialDecision
                actionLabel="Approve current terms"
                title="Approve this quotation?"
                detail="Approval applies only to this revision. A later price or quantity change requires fresh approval."
                confirmLabel="Approve revision"
                {...(agreement.isExpired
                  ? { disabledReason: "This quotation has expired." }
                  : {})}
                isSubmitting={busy}
                onConfirm={() =>
                  run(
                    () =>
                      acknowledge({
                        requestId,
                        agreementRevisionId: agreement.revisionId,
                        expectedRequestVersion: detail.request.version,
                        idempotencyKey: crypto.randomUUID(),
                      }),
                    "Quotation approved. Sourcing can continue.",
                  )
                }
              />
              <MaterialDecision
                actionLabel="Request a revision"
                title="Reject these terms?"
                detail="Explain what must change. The current quotation will close and operations can issue a new revision."
                confirmLabel="Send reason"
                requireReason
                isSubmitting={busy}
                onConfirm={(reason) =>
                  run(
                    () =>
                      reject({
                        requestId,
                        agreementRevisionId: agreement.revisionId,
                        expectedRequestVersion: detail.request.version,
                        reason: reason ?? "Terms need revision",
                        idempotencyKey: crypto.randomUUID(),
                      }),
                    "Revision request sent to operations.",
                  )
                }
              />
            </div>
          ) : null}
        </>
      )}

      {canAccept ? (
        <section className="pilot-acceptance-panel">
          <span className="pilot-buyer-kicker">Buyer acceptance</span>
          <h2>Check the delivered lots</h2>
          <p>
            Accept all delivered lots or reject one with a reason and evidence.
          </p>
          <label className="form-group">
            <span className="form-label">Delivery outcome</span>
            <select
              className="form-input"
              value={rejectedLotId}
              onChange={(event) => setRejectedLotId(event.target.value)}
            >
              <option value="">Accept every delivered lot</option>
              {lots.map((lot) => (
                <option key={lot.id} value={lot.id}>
                  Reject {lot.lotCode} · {formatPilotQuantity(lot.sourceGrams)}
                </option>
              ))}
            </select>
          </label>
          {rejectedLotId === "" ? null : (
            <div className="pilot-rejection-fields">
              <label className="form-group">
                <span className="form-label">Contractual rejection reason</span>
                <textarea
                  className="form-input"
                  required
                  value={rejectionReason}
                  onChange={(event) => setRejectionReason(event.target.value)}
                />
              </label>
              <label className="form-group">
                <span className="form-label">Rejection evidence</span>
                <input
                  accept="image/*,application/pdf"
                  className="form-input"
                  onChange={(event) => setEvidenceFile(event.target.files?.[0])}
                  type="file"
                />
              </label>
            </div>
          )}
          <MaterialDecision
            actionLabel="Record delivery decision"
            title="Confirm this delivery?"
            detail="This records the outcome for each delivered lot. Contact Kuapa Dwaso if something needs correcting."
            confirmLabel={
              rejectedLotId === ""
                ? "Accept delivered lots"
                : "Record acceptance and rejection"
            }
            isSubmitting={busy}
            onConfirm={() => run(() => recordAcceptance(Date.now()))}
          />
        </section>
      ) : null}

      {statement !== undefined &&
      (statement.totals.outstandingPesewas > 0 ||
        paymentClaim?.status === "verified") &&
      detail.request.status === "delivered" ? (
        <section className="pilot-acceptance-panel">
          <span className="pilot-buyer-kicker">Payment</span>
          {paymentClaim?.status === "pending_verification" ? (
            <>
              <h2>Payment reported</h2>
              <p>
                Your report for {formatPilotMoney(paymentClaim.amountPesewas)}
                {paymentClaim.buyerReference
                  ? ` (${paymentClaim.buyerReference})`
                  : ""}{" "}
                is waiting for finance to confirm cleared funds.
              </p>
            </>
          ) : paymentClaim?.status === "verified" ? (
            <>
              <h2>Payment confirmed</h2>
              <p>
                Finance confirmed the buyer payment. This sale is recorded;
                farmer settlement continues as a separate step.
              </p>
            </>
          ) : (
            <>
              <h2>Have you paid for this delivery?</h2>
              <p>
                Report the transfer after you have paid. This does not mark the
                order paid until finance verifies cleared funds.
              </p>
              {paymentClaim?.status === "rejected" ? (
                <div className="attention-card" role="status">
                  <AlertTriangle size={20} />
                  <div className="attention-body">
                    <span className="attention-title">
                      Previous report was not confirmed
                    </span>
                    <span className="attention-text">
                      {paymentClaim.reviewReason ??
                        "Check the transfer details and report it again."}
                    </span>
                  </div>
                </div>
              ) : null}
              <label className="form-group">
                <span className="form-label">
                  Transfer reference (optional)
                </span>
                <input
                  className="form-input"
                  maxLength={120}
                  value={paymentReference}
                  onChange={(event) => setPaymentReference(event.target.value)}
                  placeholder="e.g. mobile money or bank reference"
                />
              </label>
              <label className="form-group">
                <span className="form-label">Note (optional)</span>
                <textarea
                  className="form-input"
                  maxLength={500}
                  value={paymentNote}
                  onChange={(event) => setPaymentNote(event.target.value)}
                />
              </label>
              <button
                className="btn btn-primary"
                disabled={busy}
                onClick={() => void run(reportPayment)}
                type="button"
              >
                {busy ? "Reporting payment…" : "I have paid"}
              </button>
            </>
          )}
        </section>
      ) : null}

      <section
        className="pilot-finance-strip"
        aria-label="Buyer financial status"
      >
        <span>
          <small>Order total</small>
          <b>{formatPilotMoney(statement?.totals.obligationPesewas ?? 0)}</b>
        </span>
        <span>
          <small>Paid</small>
          <b>{formatPilotMoney(statement?.totals.settledPesewas ?? 0)}</b>
        </span>
        <span>
          <small>Outstanding</small>
          <b>{formatPilotMoney(statement?.totals.outstandingPesewas ?? 0)}</b>
        </span>
      </section>
      <section className="pilot-buyer-section">
        <div className="section-title-row">
          <h2 className="section-title">Request activity</h2>
          <RefreshCw size={17} />
        </div>
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
              tone: event.eventName.includes("rejected")
                ? ("danger" as const)
                : ("info" as const),
              source: "live" as const,
            })),
          )}
        />
      </section>
      <Link className="btn btn-secondary btn-full" href="/buyer/requests/new">
        Create a fresh reorder
      </Link>
      <p className="pilot-legal-note">
        A reorder is always a new request. Prices, supply, and payment terms are
        reviewed again.
      </p>
    </div>
  );
}
