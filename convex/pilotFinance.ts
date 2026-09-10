import {
  calculatePilotAmountPesewas,
  calculatePilotOfferAmounts,
  pilotPurchasingBudgetAvailablePesewas,
  reconcilePilotLineAmounts,
} from "@kuapa-dwaso/utils/pilot";
import {
  pilotActualContribution,
  pilotObligationStatus,
  pilotPaymentDueAt,
} from "@kuapa-dwaso/utils/pilot-finance";
import {
  assertExpectedVersion,
  assertPilotMoneyPesewas,
} from "@kuapa-dwaso/validators/pilot";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import {
  requirePilotAdminPermission,
  requirePilotFinancialEntryRead,
  requirePilotPrincipal,
  requirePilotRequestRead,
} from "./pilotAccess";
import {
  beginPilotIdempotency,
  completePilotIdempotency,
  replayEntityId,
} from "./pilotIdempotency";
import { assertAllowed } from "./workflowHelpers";
import { assertPaymentServiceSecret } from "./paymentServiceAuth";
import { insertPilotActivityEvent } from "./pilotActivity";

const datasetProvenance = v.union(v.literal("live"), v.literal("sample_only"));
const budgetStatus = v.union(
  v.literal("draft"),
  v.literal("active"),
  v.literal("suspended"),
  v.literal("closed"),
);
const costPurpose = v.union(
  v.literal("transport_cost"),
  v.literal("handling_cost"),
  v.literal("other_agreed_cost"),
);
const paymentProvider = v.union(v.literal("mock"), v.literal("paystack"));
const paymentPurpose = v.union(
  v.literal("buyer_produce"),
  v.literal("buyer_transport"),
);
const providerPaymentStatus = v.union(
  v.literal("pending"),
  v.literal("processing"),
  v.literal("successful"),
  v.literal("failed"),
  v.literal("abandoned"),
  v.literal("reversed"),
  v.literal("manual_review"),
);
const genericRecord = v.record(v.string(), v.any());
const partyRef = v.object({
  kind: v.union(
    v.literal("buyer"),
    v.literal("farmer"),
    v.literal("kuapa_dwaso"),
    v.literal("transporter"),
    v.literal("facility"),
    v.literal("external_provider"),
  ),
  id: v.optional(v.string()),
  displayNameSnapshot: v.string(),
});

type FinancialEntryId = Id<"pilotFinancialEntries">;
type FinancialEntry = Doc<"pilotFinancialEntries">;

function cleanText(value: string, label: string): string {
  const cleaned = value.trim();
  assertAllowed(cleaned.length > 0, `${label} is required.`);
  return cleaned;
}

function assertPositivePesewas(value: number, fieldName: string): void {
  assertPilotMoneyPesewas(value, fieldName);
  assertAllowed(value > 0, `${fieldName} must be positive.`);
}

function budgetProjection(budget: Doc<"pilotPurchasingBudgets">) {
  return {
    budgetId: budget._id,
    programmeId: budget.programmeId,
    fundingSourceLabel: budget.fundingSourceLabel,
    fundingSourceReference: budget.fundingSourceReference,
    fundingEvidenceUploadAssetIds: budget.fundingEvidenceUploadAssetIds,
    datasetProvenance: budget.datasetProvenance,
    currency: budget.currency,
    approvedCapacityPesewas: budget.approvedCapacityPesewas,
    availablePesewas: pilotPurchasingBudgetAvailablePesewas(budget),
    reservedPesewas: budget.reservedPesewas,
    committedPesewas: budget.committedPesewas,
    spentPesewas: budget.spentPesewas,
    status: budget.status,
    approvedAt: budget.approvedAt,
    version: budget.version,
  };
}

function reservationProjection(reservation: Doc<"pilotFundingReservations">) {
  return {
    reservationId: reservation._id,
    programmeId: reservation.programmeId,
    budgetId: reservation.budgetId,
    requestId: reservation.requestId,
    buyerAgreementRevisionId: reservation.buyerAgreementRevisionId,
    farmerOfferRevisionId: reservation.farmerOfferRevisionId,
    produceAmountPesewas: reservation.produceAmountPesewas,
    knownCostAmountPesewas: reservation.knownCostAmountPesewas,
    consumedPesewas: reservation.consumedPesewas,
    releasedPesewas: reservation.releasedPesewas,
    unusedPesewas:
      reservation.produceAmountPesewas +
      reservation.knownCostAmountPesewas -
      reservation.consumedPesewas -
      reservation.releasedPesewas,
    status: reservation.status,
    expiresAt: reservation.expiresAt,
    version: reservation.version,
  };
}

async function requireFinance(
  ctx: QueryCtx | MutationCtx,
  programmeId: Id<"pilotProgrammes">,
  permission: "pilotFinance:read" | "pilotFinance:manage",
) {
  const principal = await requirePilotPrincipal(ctx);
  await requirePilotAdminPermission(ctx, principal, programmeId, permission);
  return principal;
}

async function validateFinancialEvidence(
  ctx: MutationCtx,
  input: {
    assetIds: Id<"uploadAssets">[];
    actorUserId: Id<"users">;
    programmeId: Id<"pilotProgrammes">;
    requestId?: Id<"pilotBuyerRequests">;
    financialEntryId?: FinancialEntryId;
  },
): Promise<void> {
  assertAllowed(
    input.assetIds.length > 0 &&
      input.assetIds.length <= 20 &&
      new Set(input.assetIds).size === input.assetIds.length,
    "Financial action requires one to twenty distinct evidence files.",
  );
  for (const assetId of input.assetIds) {
    const asset = await ctx.db.get(assetId);
    const correctlyScoped =
      asset?.relatedEntityType === "pilotProgrammes"
        ? asset.relatedEntityId === input.programmeId
        : asset?.relatedEntityType === "pilotBuyerRequests"
          ? input.requestId !== undefined &&
            asset.relatedEntityId === input.requestId
          : asset?.relatedEntityType === "pilotFinancialEntries"
            ? input.financialEntryId !== undefined &&
              asset.relatedEntityId === input.financialEntryId
            : false;
    assertAllowed(
      asset !== null &&
        asset.ownerUserId === input.actorUserId &&
        asset.pilotProgrammeId === input.programmeId &&
        asset.purpose === "pilot_financial_evidence" &&
        asset.accessLevel === "private" &&
        ["uploaded", "attached", "verified"].includes(asset.status) &&
        correctlyScoped,
      "Financial evidence must be completed, private, actor-owned, and staged against this programme, request, or entry.",
    );
  }
}

async function assertPostingKeyAvailable(
  ctx: MutationCtx,
  postingKey: string,
): Promise<void> {
  const existing = await ctx.db
    .query("pilotFinancialEntries")
    .withIndex("by_posting_key", (q) => q.eq("postingKey", postingKey))
    .unique();
  assertAllowed(existing === null, "Financial posting key already exists.");
}

async function insertBudgetEvent(
  ctx: MutationCtx,
  input: Omit<Doc<"pilotBudgetEvents">, "_id" | "_creationTime">,
) {
  const existing = await ctx.db
    .query("pilotBudgetEvents")
    .withIndex("by_posting_key", (q) => q.eq("postingKey", input.postingKey))
    .unique();
  assertAllowed(existing === null, "Budget event posting key already exists.");
  return await ctx.db.insert("pilotBudgetEvents", input);
}

export const createBudget = mutation({
  args: {
    programmeId: v.id("pilotProgrammes"),
    fundingSourceLabel: v.string(),
    fundingSourceReference: v.string(),
    fundingEvidenceUploadAssetIds: v.array(v.id("uploadAssets")),
    approvedCapacityPesewas: v.number(),
    datasetProvenance,
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const principal = await requireFinance(
      ctx,
      args.programmeId,
      "pilotFinance:manage",
    );
    const receipt = await beginPilotIdempotency(ctx, {
      programmeId: args.programmeId,
      actorUserId: principal._id,
      operationName: "pilotFinance.createBudget",
      idempotencyKey: args.idempotencyKey,
      requestHash: JSON.stringify(args),
    });
    if (receipt.kind === "replay") {
      const budget = await ctx.db.get(
        replayEntityId<"pilotPurchasingBudgets">(
          receipt.receipt,
          "pilotPurchasingBudgets",
        ),
      );
      assertAllowed(budget !== null, "Budget replay was not found.");
      return budgetProjection(budget);
    }
    const programme = await ctx.db.get(args.programmeId);
    assertAllowed(programme !== null, "Pilot programme was not found.");
    assertAllowed(
      programme.datasetProvenance === args.datasetProvenance,
      "Budget provenance must match the programme.",
    );
    assertPositivePesewas(
      args.approvedCapacityPesewas,
      "approvedCapacityPesewas",
    );
    const fundingSourceLabel = cleanText(
      args.fundingSourceLabel,
      "Funding source label",
    );
    const fundingSourceReference = cleanText(
      args.fundingSourceReference,
      "Funding source reference",
    );
    const sameReference = await ctx.db
      .query("pilotPurchasingBudgets")
      .withIndex("by_funding_reference", (q) =>
        q.eq("fundingSourceReference", fundingSourceReference),
      )
      .collect();
    assertAllowed(
      sameReference.every((budget) => budget.programmeId !== args.programmeId),
      "Funding source reference already exists in this programme.",
    );
    await validateFinancialEvidence(ctx, {
      assetIds: args.fundingEvidenceUploadAssetIds,
      actorUserId: principal._id,
      programmeId: args.programmeId,
    });
    const now = Date.now();
    const budgetId = await ctx.db.insert("pilotPurchasingBudgets", {
      programmeId: args.programmeId,
      fundingSourceLabel,
      fundingSourceReference,
      fundingEvidenceUploadAssetIds: args.fundingEvidenceUploadAssetIds,
      datasetProvenance: args.datasetProvenance,
      currency: "GHS",
      approvedCapacityPesewas: args.approvedCapacityPesewas,
      reservedPesewas: 0,
      committedPesewas: 0,
      spentPesewas: 0,
      status: "active",
      approvedByUserId: principal._id,
      approvedAt: now,
      version: 0,
      createdAt: now,
      updatedAt: now,
    });
    await insertBudgetEvent(ctx, {
      programmeId: args.programmeId,
      budgetId,
      eventType: "capacity_added",
      amountPesewas: args.approvedCapacityPesewas,
      postingKey: `budget:${budgetId}:initial-capacity`,
      reasonCode: "funding_source_approved",
      recordedByUserId: principal._id,
      createdAt: now,
    });
    await completePilotIdempotency(ctx, receipt.receiptId, [
      { entityType: "pilotPurchasingBudgets", entityId: budgetId },
    ]);
    return budgetProjection((await ctx.db.get(budgetId))!);
  },
});

export const adjustBudget = mutation({
  args: {
    budgetId: v.id("pilotPurchasingBudgets"),
    adjustmentType: v.union(v.literal("addition"), v.literal("correction")),
    direction: v.union(v.literal("increase"), v.literal("decrease")),
    amountPesewas: v.number(),
    reasonCode: v.string(),
    evidenceUploadAssetIds: v.array(v.id("uploadAssets")),
    expectedVersion: v.number(),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const budget = await ctx.db.get(args.budgetId);
    assertAllowed(budget !== null, "Purchasing budget was not found.");
    const principal = await requireFinance(
      ctx,
      budget.programmeId,
      "pilotFinance:manage",
    );
    const receipt = await beginPilotIdempotency(ctx, {
      programmeId: budget.programmeId,
      actorUserId: principal._id,
      operationName: "pilotFinance.adjustBudget",
      idempotencyKey: args.idempotencyKey,
      requestHash: JSON.stringify(args),
    });
    if (receipt.kind === "replay") {
      const replayed = await ctx.db.get(
        replayEntityId<"pilotPurchasingBudgets">(
          receipt.receipt,
          "pilotPurchasingBudgets",
        ),
      );
      assertAllowed(replayed !== null, "Budget replay was not found.");
      return budgetProjection(replayed);
    }
    assertExpectedVersion(args.expectedVersion);
    assertPositivePesewas(args.amountPesewas, "amountPesewas");
    assertAllowed(
      budget.version === args.expectedVersion && budget.status !== "closed",
      "Purchasing budget changed or is closed.",
    );
    assertAllowed(
      args.adjustmentType === "correction" || args.direction === "increase",
      "A budget addition can only increase capacity.",
    );
    await validateFinancialEvidence(ctx, {
      assetIds: args.evidenceUploadAssetIds,
      actorUserId: principal._id,
      programmeId: budget.programmeId,
    });
    const approvedCapacityPesewas =
      budget.approvedCapacityPesewas +
      (args.direction === "increase"
        ? args.amountPesewas
        : -args.amountPesewas);
    assertAllowed(
      approvedCapacityPesewas >=
        budget.reservedPesewas + budget.committedPesewas + budget.spentPesewas,
      "Capacity correction cannot remove reserved, committed, or spent funds.",
    );
    const now = Date.now();
    await ctx.db.patch(budget._id, {
      approvedCapacityPesewas,
      version: budget.version + 1,
      updatedAt: now,
    });
    await insertBudgetEvent(ctx, {
      programmeId: budget.programmeId,
      budgetId: budget._id,
      eventType:
        args.direction === "increase" ? "capacity_added" : "reversed",
      amountPesewas: args.amountPesewas,
      postingKey: `budget:${budget._id}:adjustment:${receipt.receiptId}`,
      reasonCode: cleanText(args.reasonCode, "Adjustment reason"),
      recordedByUserId: principal._id,
      createdAt: now,
    });
    await completePilotIdempotency(ctx, receipt.receiptId, [
      { entityType: "pilotPurchasingBudgets", entityId: budget._id },
    ]);
    return budgetProjection((await ctx.db.get(budget._id))!);
  },
});

export const setBudgetStatus = mutation({
  args: {
    budgetId: v.id("pilotPurchasingBudgets"),
    status: budgetStatus,
    reasonCode: v.string(),
    expectedVersion: v.number(),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const budget = await ctx.db.get(args.budgetId);
    assertAllowed(budget !== null, "Purchasing budget was not found.");
    const principal = await requireFinance(
      ctx,
      budget.programmeId,
      "pilotFinance:manage",
    );
    const receipt = await beginPilotIdempotency(ctx, {
      programmeId: budget.programmeId,
      actorUserId: principal._id,
      operationName: "pilotFinance.setBudgetStatus",
      idempotencyKey: args.idempotencyKey,
      requestHash: JSON.stringify(args),
    });
    if (receipt.kind === "replay") {
      const replayed = await ctx.db.get(
        replayEntityId<"pilotPurchasingBudgets">(
          receipt.receipt,
          "pilotPurchasingBudgets",
        ),
      );
      assertAllowed(replayed !== null, "Budget replay was not found.");
      return budgetProjection(replayed);
    }
    assertExpectedVersion(args.expectedVersion);
    cleanText(args.reasonCode, "Status reason");
    assertAllowed(
      budget.version === args.expectedVersion && budget.status !== "closed",
      "Purchasing budget changed or is already closed.",
    );
    if (args.status === "closed")
      assertAllowed(
        budget.reservedPesewas === 0 && budget.committedPesewas === 0,
        "A budget with reserved or committed funds cannot close.",
      );
    await ctx.db.patch(budget._id, {
      status: args.status,
      version: budget.version + 1,
      updatedAt: Date.now(),
    });
    await completePilotIdempotency(ctx, receipt.receiptId, [
      { entityType: "pilotPurchasingBudgets", entityId: budget._id },
    ]);
    return budgetProjection((await ctx.db.get(budget._id))!);
  },
});

export const reserveFunding = mutation({
  args: {
    budgetId: v.id("pilotPurchasingBudgets"),
    requestId: v.id("pilotBuyerRequests"),
    buyerAgreementRevisionId: v.id("pilotBuyerAgreementRevisions"),
    farmerOfferRevisionId: v.id("pilotFarmerOfferRevisions"),
    produceAmountPesewas: v.number(),
    knownCostAmountPesewas: v.number(),
    expiresAt: v.number(),
    expectedBudgetVersion: v.number(),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const budget = await ctx.db.get(args.budgetId);
    assertAllowed(budget !== null, "Purchasing budget was not found.");
    const principal = await requireFinance(
      ctx,
      budget.programmeId,
      "pilotFinance:manage",
    );
    const receipt = await beginPilotIdempotency(ctx, {
      programmeId: budget.programmeId,
      actorUserId: principal._id,
      operationName: "pilotFinance.reserveFunding",
      idempotencyKey: args.idempotencyKey,
      requestHash: JSON.stringify(args),
    });
    if (receipt.kind === "replay") {
      const reservation = await ctx.db.get(
        replayEntityId<"pilotFundingReservations">(
          receipt.receipt,
          "pilotFundingReservations",
        ),
      );
      assertAllowed(reservation !== null, "Funding reservation replay was not found.");
      return reservationProjection(reservation);
    }
    assertExpectedVersion(args.expectedBudgetVersion);
    assertPositivePesewas(args.produceAmountPesewas, "produceAmountPesewas");
    assertPilotMoneyPesewas(args.knownCostAmountPesewas, "knownCostAmountPesewas");
    const now = Date.now();
    assertAllowed(
      Number.isSafeInteger(args.expiresAt) && args.expiresAt > now,
      "Funding reservation expiry must be in the future.",
    );
    const [request, agreement, revision] = await Promise.all([
      ctx.db.get(args.requestId),
      ctx.db.get(args.buyerAgreementRevisionId),
      ctx.db.get(args.farmerOfferRevisionId),
    ]);
    assertAllowed(
      request !== null &&
        agreement !== null &&
        revision !== null &&
        request.programmeId === budget.programmeId &&
        request.commercialMode === "kuapa_purchase" &&
        request.currentAgreementRevisionId === agreement._id &&
        agreement.requestId === request._id &&
        agreement.state === "acknowledged" &&
        agreement.commercialMode === "kuapa_purchase" &&
        revision.requestId === request._id &&
        revision.buyerAgreementRevisionId === agreement._id &&
        revision.commercialMode === "kuapa_purchase",
      "Funding reservation requires matching current purchase terms.",
    );
    const offer = await ctx.db.get(revision.offerId);
    assertAllowed(
      offer !== null &&
        offer.currentRevisionId === revision._id &&
        offer.acceptedRevisionId === revision._id &&
        offer.status === "accepted",
      "Farmer purchase offer is not currently accepted.",
    );
    assertAllowed(
      budget.version === args.expectedBudgetVersion &&
        budget.status === "active" &&
        pilotPurchasingBudgetAvailablePesewas(budget) >=
          args.produceAmountPesewas + args.knownCostAmountPesewas,
      "Purchasing budget changed, is inactive, or lacks available capacity.",
    );
    assertAllowed(
      args.produceAmountPesewas >= revision.expectedNetPesewas,
      "Reserved produce capacity is below the accepted farmer proceeds.",
    );
    const reservationId = await ctx.db.insert("pilotFundingReservations", {
      programmeId: budget.programmeId,
      budgetId: budget._id,
      requestId: request._id,
      buyerAgreementRevisionId: agreement._id,
      farmerOfferRevisionId: revision._id,
      produceAmountPesewas: args.produceAmountPesewas,
      knownCostAmountPesewas: args.knownCostAmountPesewas,
      status: "active",
      consumedPesewas: 0,
      releasedPesewas: 0,
      expiresAt: args.expiresAt,
      approvedByUserId: principal._id,
      version: 0,
      createdAt: now,
      updatedAt: now,
    });
    const amountPesewas =
      args.produceAmountPesewas + args.knownCostAmountPesewas;
    await ctx.db.patch(budget._id, {
      reservedPesewas: budget.reservedPesewas + amountPesewas,
      version: budget.version + 1,
      updatedAt: now,
    });
    await insertBudgetEvent(ctx, {
      programmeId: budget.programmeId,
      budgetId: budget._id,
      reservationId,
      eventType: "reserved",
      amountPesewas,
      postingKey: `reservation:${reservationId}:reserved`,
      reasonCode: "purchase_exposure_approved",
      recordedByUserId: principal._id,
      createdAt: now,
    });
    await completePilotIdempotency(ctx, receipt.receiptId, [
      { entityType: "pilotFundingReservations", entityId: reservationId },
    ]);
    return reservationProjection((await ctx.db.get(reservationId))!);
  },
});

export const releaseFunding = mutation({
  args: {
    reservationId: v.id("pilotFundingReservations"),
    unusedAmountPesewas: v.number(),
    reasonCode: v.string(),
    expectedReservationVersion: v.number(),
    expectedBudgetVersion: v.number(),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const reservation = await ctx.db.get(args.reservationId);
    assertAllowed(reservation !== null, "Funding reservation was not found.");
    const principal = await requireFinance(
      ctx,
      reservation.programmeId,
      "pilotFinance:manage",
    );
    const receipt = await beginPilotIdempotency(ctx, {
      programmeId: reservation.programmeId,
      actorUserId: principal._id,
      operationName: "pilotFinance.releaseFunding",
      idempotencyKey: args.idempotencyKey,
      requestHash: JSON.stringify(args),
    });
    if (receipt.kind === "replay") {
      const replayed = await ctx.db.get(
        replayEntityId<"pilotFundingReservations">(
          receipt.receipt,
          "pilotFundingReservations",
        ),
      );
      assertAllowed(replayed !== null, "Funding release replay was not found.");
      return reservationProjection(replayed);
    }
    assertExpectedVersion(args.expectedReservationVersion);
    assertExpectedVersion(args.expectedBudgetVersion);
    assertPositivePesewas(args.unusedAmountPesewas, "unusedAmountPesewas");
    const reasonCode = cleanText(args.reasonCode, "Release reason");
    const budget = await ctx.db.get(reservation.budgetId);
    assertAllowed(budget !== null, "Purchasing budget was not found.");
    const unusedPesewas =
      reservation.produceAmountPesewas +
      reservation.knownCostAmountPesewas -
      reservation.consumedPesewas -
      reservation.releasedPesewas;
    assertAllowed(
      reservation.version === args.expectedReservationVersion &&
        budget.version === args.expectedBudgetVersion &&
        ["active", "partly_consumed"].includes(reservation.status) &&
        args.unusedAmountPesewas <= unusedPesewas &&
        args.unusedAmountPesewas <= budget.reservedPesewas,
      "Funding release is stale or exceeds unused reserved capacity.",
    );
    const releasedPesewas =
      reservation.releasedPesewas + args.unusedAmountPesewas;
    const remainingPesewas = unusedPesewas - args.unusedAmountPesewas;
    const status =
      remainingPesewas === 0
        ? reservation.consumedPesewas === 0
          ? ("released" as const)
          : ("consumed" as const)
        : reservation.consumedPesewas > 0
          ? ("partly_consumed" as const)
          : ("active" as const);
    const now = Date.now();
    await ctx.db.patch(reservation._id, {
      releasedPesewas,
      status,
      version: reservation.version + 1,
      updatedAt: now,
    });
    await ctx.db.patch(budget._id, {
      reservedPesewas: budget.reservedPesewas - args.unusedAmountPesewas,
      version: budget.version + 1,
      updatedAt: now,
    });
    await insertBudgetEvent(ctx, {
      programmeId: reservation.programmeId,
      budgetId: budget._id,
      reservationId: reservation._id,
      eventType: "released",
      amountPesewas: args.unusedAmountPesewas,
      postingKey: `reservation:${reservation._id}:release:${receipt.receiptId}`,
      reasonCode,
      recordedByUserId: principal._id,
      createdAt: now,
    });
    await completePilotIdempotency(ctx, receipt.receiptId, [
      { entityType: "pilotFundingReservations", entityId: reservation._id },
    ]);
    return reservationProjection((await ctx.db.get(reservation._id))!);
  },
});

export const expireFunding = mutation({
  args: {
    reservationId: v.id("pilotFundingReservations"),
    expectedReservationVersion: v.number(),
    expectedBudgetVersion: v.number(),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const reservation = await ctx.db.get(args.reservationId);
    assertAllowed(reservation !== null, "Funding reservation was not found.");
    const principal = await requireFinance(
      ctx,
      reservation.programmeId,
      "pilotFinance:manage",
    );
    const receipt = await beginPilotIdempotency(ctx, {
      programmeId: reservation.programmeId,
      actorUserId: principal._id,
      operationName: "pilotFinance.expireFunding",
      idempotencyKey: args.idempotencyKey,
      requestHash: JSON.stringify(args),
    });
    if (receipt.kind === "replay") {
      const replayed = await ctx.db.get(
        replayEntityId<"pilotFundingReservations">(
          receipt.receipt,
          "pilotFundingReservations",
        ),
      );
      assertAllowed(replayed !== null, "Funding expiry replay was not found.");
      return reservationProjection(replayed);
    }
    assertExpectedVersion(args.expectedReservationVersion);
    assertExpectedVersion(args.expectedBudgetVersion);
    const budget = await ctx.db.get(reservation.budgetId);
    assertAllowed(budget !== null, "Purchasing budget was not found.");
    const now = Date.now();
    const unusedPesewas =
      reservation.produceAmountPesewas +
      reservation.knownCostAmountPesewas -
      reservation.consumedPesewas -
      reservation.releasedPesewas;
    assertAllowed(
      reservation.version === args.expectedReservationVersion &&
        budget.version === args.expectedBudgetVersion &&
        ["active", "partly_consumed"].includes(reservation.status) &&
        reservation.expiresAt <= now,
      "Funding reservation is not currently eligible for expiry.",
    );
    await ctx.db.patch(reservation._id, {
      releasedPesewas: reservation.releasedPesewas + unusedPesewas,
      status: "expired",
      version: reservation.version + 1,
      updatedAt: now,
    });
    if (unusedPesewas > 0) {
      await ctx.db.patch(budget._id, {
        reservedPesewas: budget.reservedPesewas - unusedPesewas,
        version: budget.version + 1,
        updatedAt: now,
      });
      await insertBudgetEvent(ctx, {
        programmeId: reservation.programmeId,
        budgetId: budget._id,
        reservationId: reservation._id,
        eventType: "released",
        amountPesewas: unusedPesewas,
        postingKey: `reservation:${reservation._id}:expired`,
        reasonCode: "reservation_expired_unused_only",
        recordedByUserId: principal._id,
        createdAt: now,
      });
    }
    await completePilotIdempotency(ctx, receipt.receiptId, [
      { entityType: "pilotFundingReservations", entityId: reservation._id },
    ]);
    return reservationProjection((await ctx.db.get(reservation._id))!);
  },
});

function amountForAcceptedQuantity(input: {
  rate: Doc<"pilotBuyerAgreementRevisions">["producePriceRate"];
  acceptedGrams: number;
  agreedGrams: number;
}): number {
  if (input.rate.unit === "per_kg")
    return calculatePilotAmountPesewas({
      quantityGrams: input.acceptedGrams,
      rate: input.rate,
    });
  assertAllowed(
    input.rate.unit === "fixed",
    "Produce price must be per kilogram or a fixed amount.",
  );
  const numerator =
    BigInt(input.rate.numerator) * BigInt(input.acceptedGrams);
  const denominator = BigInt(input.rate.scale) * BigInt(input.agreedGrams);
  return Number((numerator * 2n + denominator) / (denominator * 2n));
}

function chargeAmount(input: {
  term: Doc<"pilotBuyerAgreementRevisions">["chargeTerms"][number];
  acceptedGrams: number;
  produceAmountPesewas: number;
}): number {
  if (input.term.calculation === "percent_of_produce")
    return calculatePilotAmountPesewas({
      basisPesewas: input.produceAmountPesewas,
      rate: input.term.rate,
    });
  if (input.term.calculation === "per_kg")
    return calculatePilotAmountPesewas({
      quantityGrams: input.acceptedGrams,
      rate: input.term.rate,
    });
  return calculatePilotAmountPesewas({ rate: input.term.rate });
}

type BuyerAcceptancePostingInput = {
  requestId: Id<"pilotBuyerRequests">;
  acceptanceId: Id<"pilotBuyerAcceptances">;
  buyerAgreementRevisionId: Id<"pilotBuyerAgreementRevisions">;
  lines: ReadonlyArray<{
    lotId: Id<"pilotProcurementLots">;
    sublotId?: Id<"pilotProcurementLots">;
    acceptedGrams: number;
  }>;
  actorUserId: Id<"users">;
  triggerAt: number;
};

/** Called by pilotFulfilment.acceptDelivery inside its existing transaction. */
export async function postBuyerAcceptanceFinancialEntries(
  ctx: MutationCtx,
  input: BuyerAcceptancePostingInput,
): Promise<{
  buyerObligationEntryIds: FinancialEntryId[];
  farmerPayableEntryIds: FinancialEntryId[];
  revenueEntryIds: FinancialEntryId[];
}> {
  const [request, acceptance, agreement] = await Promise.all([
    ctx.db.get(input.requestId),
    ctx.db.get(input.acceptanceId),
    ctx.db.get(input.buyerAgreementRevisionId),
  ]);
  assertAllowed(
    request !== null &&
      acceptance !== null &&
      agreement !== null &&
      acceptance.requestId === request._id &&
      acceptance.buyerAgreementRevisionId === agreement._id &&
      agreement.requestId === request._id &&
      request.currentAgreementRevisionId === agreement._id &&
      agreement.state === "acknowledged",
    "Buyer acceptance financial posting requires current matching records.",
  );
  const programme = await ctx.db.get(request.programmeId);
  assertAllowed(programme !== null, "Pilot programme was not found.");
  assertAllowed(
    Number.isSafeInteger(input.triggerAt) &&
      input.triggerAt >= acceptance.createdAt &&
      input.triggerAt <= Date.now(),
    "Buyer acceptance financial trigger time must be server controlled.",
  );
  const acceptedLines = input.lines.filter((line) => line.acceptedGrams > 0);
  if (acceptedLines.length === 0)
    return {
      buyerObligationEntryIds: [],
      farmerPayableEntryIds: [],
      revenueEntryIds: [],
    };
  const buyerTerms = agreement.paymentTerms.filter(
    (term) => term.trigger === "buyer_acceptance" || term.trigger === "fixed_date",
  );
  assertAllowed(
    buyerTerms.length === 1,
    "Buyer acceptance needs one explicit buyer payment deadline.",
  );
  const buyerDueAt = pilotPaymentDueAt(buyerTerms[0]!, input.triggerAt);
  const detail: Array<{
    key: string;
    lot: Doc<"pilotProcurementLots">;
    revision: Doc<"pilotFarmerOfferRevisions">;
    acceptedGrams: number;
  }> = [];
  for (const line of acceptedLines) {
    assertAllowed(
      Number.isSafeInteger(line.acceptedGrams) && line.acceptedGrams > 0,
      "Accepted financial quantity must be a positive integer.",
    );
    const lot = await ctx.db.get(line.sublotId ?? line.lotId);
    assertAllowed(
      lot !== null &&
        lot.requestId === request._id &&
        line.acceptedGrams <= lot.sourceGrams,
      "Accepted financial line does not match a request lot.",
    );
    const revision = await ctx.db.get(lot.offerRevisionId);
    assertAllowed(
      revision !== null &&
        revision.requestId === request._id &&
        revision.buyerAgreementRevisionId === agreement._id,
      "Accepted lot farmer terms were not found.",
    );
    detail.push({
      key: String(lot._id),
      lot,
      revision,
      acceptedGrams: line.acceptedGrams,
    });
  }
  const acceptedGrams = detail.reduce(
    (sum, line) => sum + line.acceptedGrams,
    0,
  );
  const produceAmountPesewas = amountForAcceptedQuantity({
    rate: agreement.producePriceRate,
    acceptedGrams,
    agreedGrams: agreement.quantityGrams,
  });
  const buyerLineAmounts = reconcilePilotLineAmounts(
    detail.map((line) => ({
      id: line.key,
      exact: {
        numerator:
          BigInt(produceAmountPesewas) * BigInt(line.acceptedGrams),
        denominator: BigInt(acceptedGrams),
      },
    })),
  );
  const buyerObligationEntryIds: FinancialEntryId[] = [];
  const farmerPayableEntryIds: FinancialEntryId[] = [];
  const revenueEntryIds: FinancialEntryId[] = [];
  const now = Date.now();
  for (const line of detail) {
    const amountPesewas = buyerLineAmounts.find(
      (amount) => amount.id === line.key,
    )!.amountPesewas;
    const postingKey = `acceptance:${acceptance._id}:lot:${line.lot._id}:buyer-produce`;
    await assertPostingKeyAvailable(ctx, postingKey);
    buyerObligationEntryIds.push(
      await ctx.db.insert("pilotFinancialEntries", {
        programmeId: request.programmeId,
        requestId: request._id,
        lotId: line.lot._id,
        offerRevisionId: line.revision._id,
        acceptanceId: acceptance._id,
        postingKind: "obligation",
        purpose: "buyer_produce",
        basis: "actual",
        payer: {
          kind: "buyer",
          id: String(request.buyerId),
          displayNameSnapshot: "Buyer",
        },
        payee: {
          kind: "kuapa_dwaso",
          displayNameSnapshot: "Kuapa Dwaso",
        },
        amountPesewas,
        currency: "GHS",
        dueAt: buyerDueAt,
        postingKey,
        evidenceUploadAssetIds: [],
        provenance: programme.datasetProvenance,
        reasonCode: "buyer_acceptance",
        recordedByUserId: input.actorUserId,
        createdAt: now,
      }),
    );
  }
  if (request.commercialMode === "coordination") {
    const byRevision = new Map<
      string,
      { revision: Doc<"pilotFarmerOfferRevisions">; lines: typeof detail }
    >();
    for (const line of detail) {
      const key = String(line.revision._id);
      const group = byRevision.get(key) ?? {
        revision: line.revision,
        lines: [],
      };
      group.lines.push(line);
      byRevision.set(key, group);
    }
    for (const group of byRevision.values()) {
    const groupGrams = group.lines.reduce(
      (sum, line) => sum + line.acceptedGrams,
      0,
    );
    const amounts =
      groupGrams === group.revision.offeredGrams
        ? {
            expectedGrossPesewas: group.revision.expectedGrossPesewas,
            expectedChargesPesewas: group.revision.expectedChargesPesewas,
            expectedNetPesewas: group.revision.expectedNetPesewas,
          }
        : group.revision.priceBasis === "per_kg"
          ? calculatePilotOfferAmounts({
              offeredGrams: groupGrams,
              priceRate: group.revision.priceRate,
              chargeTerms: group.revision.chargeTerms,
            })
          : {
              expectedGrossPesewas: Math.round(
                (group.revision.expectedGrossPesewas * groupGrams) /
                  group.revision.offeredGrams,
              ),
              expectedChargesPesewas: Math.round(
                (group.revision.expectedChargesPesewas * groupGrams) /
                  group.revision.offeredGrams,
              ),
              expectedNetPesewas: Math.round(
                (group.revision.expectedNetPesewas * groupGrams) /
                  group.revision.offeredGrams,
              ),
            };
    const payableAmounts = reconcilePilotLineAmounts(
      group.lines.map((line) => ({
        id: line.key,
        exact: {
          numerator:
            BigInt(amounts.expectedNetPesewas) * BigInt(line.acceptedGrams),
          denominator: BigInt(groupGrams),
        },
      })),
    );
    const revenueAmounts = reconcilePilotLineAmounts(
      group.lines.map((line) => ({
        id: line.key,
        exact: {
          numerator:
            BigInt(amounts.expectedChargesPesewas) *
            BigInt(line.acceptedGrams),
          denominator: BigInt(groupGrams),
        },
      })),
    );
    const farmerTerms = group.revision.paymentTerms.filter(
      (term) =>
        term.trigger === "cleared_buyer_funds" || term.trigger === "fixed_date",
    );
    assertAllowed(
      farmerTerms.length === 1,
      "Coordination offer needs one farmer settlement deadline.",
    );
    const fixedFarmerDueAt =
      farmerTerms[0]!.trigger === "fixed_date"
        ? pilotPaymentDueAt(farmerTerms[0]!, input.triggerAt)
        : undefined;
    for (const line of group.lines) {
      const payable = payableAmounts.find((amount) => amount.id === line.key)!;
      const payableKey = `acceptance:${acceptance._id}:lot:${line.lot._id}:farmer-proceeds`;
      await assertPostingKeyAvailable(ctx, payableKey);
      farmerPayableEntryIds.push(
        await ctx.db.insert("pilotFinancialEntries", {
          programmeId: request.programmeId,
          requestId: request._id,
          lotId: line.lot._id,
          offerRevisionId: group.revision._id,
          acceptanceId: acceptance._id,
          postingKind: "obligation",
          purpose: "farmer_proceeds",
          basis: "actual",
          payer: {
            kind: "kuapa_dwaso",
            displayNameSnapshot: "Kuapa Dwaso",
          },
          payee: {
            kind: "farmer",
            id: String(line.lot.farmerId),
            displayNameSnapshot: "Farmer",
          },
          amountPesewas: payable.amountPesewas,
          currency: "GHS",
          ...(fixedFarmerDueAt === undefined
            ? {}
            : { dueAt: fixedFarmerDueAt }),
          postingKey: payableKey,
          evidenceUploadAssetIds: [],
          provenance: programme.datasetProvenance,
          reasonCode: "buyer_acceptance",
          recordedByUserId: input.actorUserId,
          createdAt: now,
        }),
      );
      const revenue = revenueAmounts.find((amount) => amount.id === line.key)!;
      if (revenue.amountPesewas > 0) {
        const revenueKey = `acceptance:${acceptance._id}:lot:${line.lot._id}:coordination-fee`;
        await assertPostingKeyAvailable(ctx, revenueKey);
        revenueEntryIds.push(
          await ctx.db.insert("pilotFinancialEntries", {
            programmeId: request.programmeId,
            requestId: request._id,
            lotId: line.lot._id,
            offerRevisionId: group.revision._id,
            acceptanceId: acceptance._id,
            postingKind: "revenue",
            purpose: "coordination_fee",
            basis: "actual",
            payer: {
              kind: "farmer",
              id: String(line.lot.farmerId),
              displayNameSnapshot: "Farmer",
            },
            payee: {
              kind: "kuapa_dwaso",
              displayNameSnapshot: "Kuapa Dwaso",
            },
            amountPesewas: revenue.amountPesewas,
            currency: "GHS",
            postingKey: revenueKey,
            evidenceUploadAssetIds: [],
            provenance: programme.datasetProvenance,
            reasonCode: "buyer_acceptance",
            recordedByUserId: input.actorUserId,
            createdAt: now,
          }),
        );
      }
    }
    }
  }
  for (const term of agreement.chargeTerms.filter(
    (charge) => charge.payer === "buyer",
  )) {
    const amountPesewas = chargeAmount({
      term,
      acceptedGrams,
      produceAmountPesewas,
    });
    if (amountPesewas === 0) continue;
    const isTransport = /transport|delivery|haul/i.test(`${term.code} ${term.label}`);
    const postingKey = `acceptance:${acceptance._id}:buyer-charge:${term.code}`;
    await assertPostingKeyAvailable(ctx, postingKey);
    buyerObligationEntryIds.push(
      await ctx.db.insert("pilotFinancialEntries", {
        programmeId: request.programmeId,
        requestId: request._id,
        acceptanceId: acceptance._id,
        postingKind: "obligation",
        purpose: isTransport ? "buyer_transport" : "other_agreed_cost",
        basis: "actual",
        payer: {
          kind: "buyer",
          id: String(request.buyerId),
          displayNameSnapshot: "Buyer",
        },
        payee: {
          kind: "kuapa_dwaso",
          displayNameSnapshot: "Kuapa Dwaso",
        },
        amountPesewas,
        currency: "GHS",
        dueAt: buyerDueAt,
        postingKey,
        evidenceUploadAssetIds: [],
        provenance: programme.datasetProvenance,
        reasonCode: term.code,
        recordedByUserId: input.actorUserId,
        createdAt: now,
      }),
    );
  }
  return {
    buyerObligationEntryIds,
    farmerPayableEntryIds,
    revenueEntryIds,
  };
}

function buildPilotProviderReference(input: {
  provider: "mock" | "paystack";
  requestId: Id<"pilotBuyerRequests">;
  idempotencyKey: string;
}): string {
  const request = String(input.requestId).replace(/[^A-Za-z0-9]/g, "").slice(-12);
  const key = input.idempotencyKey.replace(/[^A-Za-z0-9]/g, "").slice(0, 16);
  return `KD-PILOT-${input.provider.toUpperCase()}-${request}-${key}`.slice(0, 60);
}

async function requireBuyerPaymentActor(
  ctx: MutationCtx,
  request: Doc<"pilotBuyerRequests">,
) {
  const principal = await requirePilotPrincipal(ctx);
  if (principal.role === "buyer") {
    const buyer = await ctx.db.get(request.buyerId);
    assertAllowed(
      buyer !== null &&
        buyer.userId === principal._id &&
        buyer.verificationStatus === "verified",
      "Buyers can only pay for their own verified pilot request.",
    );
    return principal;
  }
  assertAllowed(
    principal.role === "admin",
    "Only the request buyer or finance may initialize payment.",
  );
  await requirePilotAdminPermission(
    ctx,
    principal,
    request.programmeId,
    "pilotFinance:manage",
  );
  return principal;
}

export const prepareBuyerPayment = mutation({
  args: {
    requestId: v.id("pilotBuyerRequests"),
    purpose: paymentPurpose,
    amountPesewas: v.number(),
    provider: paymentProvider,
    idempotencyKey: v.string(),
    correlationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    assertAllowed(request !== null, "Pilot request was not found.");
    const principal = await requireBuyerPaymentActor(ctx, request);
    const idempotencyKey = cleanText(args.idempotencyKey, "Idempotency key");
    assertPositivePesewas(args.amountPesewas, "amountPesewas");
    assertAllowed(
      ["delivered", "disputed", "closed"].includes(request.status),
      "Pilot buyer payment starts only after delivery and financial posting.",
    );
    const existing = await ctx.db
      .query("pilotPaymentTransactions")
      .withIndex("by_idempotency_key", (q) =>
        q.eq("idempotencyKey", idempotencyKey),
      )
      .unique();
    if (existing !== null) {
      assertAllowed(
        existing.requestId === request._id &&
          existing.initializedByUserId === principal._id &&
          existing.purpose === args.purpose &&
          existing.amountPesewas === args.amountPesewas &&
          existing.provider === args.provider,
        "Idempotency key belongs to a different pilot payment.",
      );
      return existing;
    }
    const entries = await ctx.db
      .query("pilotFinancialEntries")
      .withIndex("by_request_created_at", (q) => q.eq("requestId", request._id))
      .collect();
    const obligations = entries.filter(
      (entry) =>
        entry.postingKind === "obligation" &&
        entry.purpose === args.purpose &&
        entry.payer.kind === "buyer" &&
        entry.payer.id === request.buyerId,
    );
    let outstandingPesewas = 0;
    for (const obligation of obligations) {
      outstandingPesewas += (
        await financialEntryState(ctx, obligation, Date.now())
      ).outstandingPesewas;
    }
    assertAllowed(
      obligations.length > 0 && args.amountPesewas <= outstandingPesewas,
      "Payment amount exceeds the outstanding buyer obligation.",
    );
    const providerReference = buildPilotProviderReference({
      provider: args.provider,
      requestId: request._id,
      idempotencyKey,
    });
    const duplicateReference = await ctx.db
      .query("pilotPaymentTransactions")
      .withIndex("by_provider_reference", (q) =>
        q.eq("providerReference", providerReference),
      )
      .unique();
    assertAllowed(
      duplicateReference === null,
      "Pilot payment provider reference already exists.",
    );
    const now = Date.now();
    const transactionId = await ctx.db.insert("pilotPaymentTransactions", {
      programmeId: request.programmeId,
      requestId: request._id,
      buyerId: request.buyerId,
      purpose: args.purpose,
      provider: args.provider,
      providerReference,
      amountPesewas: args.amountPesewas,
      currency: "GHS",
      status: "pending",
      idempotencyKey,
      ...(args.correlationId === undefined
        ? {}
        : { correlationId: cleanText(args.correlationId, "Correlation id") }),
      initializedByUserId: principal._id,
      createdAt: now,
      updatedAt: now,
    });
    return (await ctx.db.get(transactionId))!;
  },
});

export const recordProviderInitialization = mutation({
  args: {
    serviceSecret: v.string(),
    provider: paymentProvider,
    providerReference: v.string(),
    providerAccessCode: v.optional(v.string()),
    authorizationUrl: v.optional(v.string()),
    providerStatus: v.optional(v.string()),
    providerMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertPaymentServiceSecret(args.serviceSecret);
    const transaction = await ctx.db
      .query("pilotPaymentTransactions")
      .withIndex("by_provider_reference", (q) =>
        q.eq("providerReference", cleanText(args.providerReference, "Provider reference")),
      )
      .unique();
    assertAllowed(
      transaction !== null && transaction.provider === args.provider,
      "Pilot payment transaction was not found.",
    );
    await ctx.db.patch(transaction._id, {
      ...(args.providerAccessCode === undefined
        ? {}
        : { providerAccessCode: cleanText(args.providerAccessCode, "Provider access code") }),
      ...(args.authorizationUrl === undefined
        ? {}
        : { authorizationUrl: cleanText(args.authorizationUrl, "Authorization URL") }),
      ...(args.providerStatus === undefined
        ? {}
        : { providerStatus: args.providerStatus.trim().slice(0, 100) }),
      ...(args.providerMessage === undefined
        ? {}
        : { providerMessage: args.providerMessage.trim().slice(0, 500) }),
      status: "initialized",
      updatedAt: Date.now(),
    });
    return transaction._id;
  },
});

async function applyProviderResult(
  ctx: MutationCtx,
  input: {
    transaction: Doc<"pilotPaymentTransactions">;
    status:
      | "pending"
      | "processing"
      | "successful"
      | "failed"
      | "abandoned"
      | "reversed"
      | "manual_review";
    amountPesewas?: number;
    currency?: string;
    providerStatus?: string;
    providerMessage?: string;
  },
) {
  const { transaction } = input;
  const now = Date.now();
  if (input.status === "successful") {
    const verifiedAmountPesewas =
      input.amountPesewas ??
      (transaction.provider === "mock" ? transaction.amountPesewas : undefined);
    assertAllowed(
      verifiedAmountPesewas === transaction.amountPesewas &&
        (input.currency ?? "GHS") === "GHS",
      "Verified payment amount or currency does not match the pilot transaction.",
    );
    if (transaction.status === "succeeded") {
      return { transactionId: transaction._id, duplicate: true, receiptEntryIds: [] };
    }
    assertAllowed(
      !["failed", "reversed"].includes(transaction.status),
      "A failed or reversed pilot payment requires finance review.",
    );
    const entries = await ctx.db
      .query("pilotFinancialEntries")
      .withIndex("by_request_created_at", (q) =>
        q.eq("requestId", transaction.requestId),
      )
      .collect();
    const obligations = entries.filter(
      (entry) =>
        entry.postingKind === "obligation" &&
        entry.purpose === transaction.purpose &&
        entry.payer.kind === "buyer" &&
        entry.payer.id === transaction.buyerId,
    );
    let remaining = transaction.amountPesewas;
    const receiptEntryIds: FinancialEntryId[] = [];
    for (const obligation of obligations) {
      if (remaining === 0) break;
      const state = await financialEntryState(ctx, obligation, now);
      const amountPesewas = Math.min(remaining, state.outstandingPesewas);
      if (amountPesewas === 0) continue;
      const postingKey = `provider:${transaction._id}:obligation:${obligation._id}`;
      await assertPostingKeyAvailable(ctx, postingKey);
      receiptEntryIds.push(
        await ctx.db.insert("pilotFinancialEntries", {
          programmeId: transaction.programmeId,
          requestId: transaction.requestId,
          ...(obligation.lotId === undefined ? {} : { lotId: obligation.lotId }),
          ...(obligation.acceptanceId === undefined
            ? {}
            : { acceptanceId: obligation.acceptanceId }),
          postingKind: "receipt",
          purpose: transaction.purpose,
          basis: "actual",
          payer: obligation.payer,
          payee: obligation.payee,
          amountPesewas,
          currency: "GHS",
          settlesEntryId: obligation._id,
          postingKey,
          evidenceUploadAssetIds: [],
          provenance: obligation.provenance,
          reasonCode: `provider:${transaction.provider}:${transaction._id}`,
          recordedByUserId: transaction.initializedByUserId,
          createdAt: now,
        }),
      );
      remaining -= amountPesewas;
    }
    assertAllowed(
      remaining === 0,
      "Verified payment exceeds the current outstanding buyer obligations.",
    );
    await ctx.db.patch(transaction._id, {
      status: "succeeded",
      verifiedAt: now,
      paidAt: now,
      ...(input.providerStatus === undefined
        ? {}
        : { providerStatus: input.providerStatus.trim().slice(0, 100) }),
      ...(input.providerMessage === undefined
        ? {}
        : { providerMessage: input.providerMessage.trim().slice(0, 500) }),
      updatedAt: now,
    });
    const currentEntries = await ctx.db
      .query("pilotFinancialEntries")
      .withIndex("by_request_created_at", (q) =>
        q.eq("requestId", transaction.requestId),
      )
      .collect();
    const buyerObligations = currentEntries.filter(
      (entry) => entry.postingKind === "obligation" && entry.payer.kind === "buyer",
    );
    let allBuyerFundsCleared = buyerObligations.length > 0;
    for (const obligation of buyerObligations) {
      if ((await financialEntryState(ctx, obligation, now)).outstandingPesewas > 0)
        allBuyerFundsCleared = false;
    }
    const deadlineMarkerIds = allBuyerFundsCleared
      ? await activateFarmerDeadlinesAfterBuyerFunds(ctx, {
          requestId: transaction.requestId,
          actorUserId: transaction.initializedByUserId,
          clearedAt: now,
          sourcePaymentEntryId: receiptEntryIds[0]!,
        })
      : [];
    const activityEventId = await insertPilotActivityEvent(ctx, {
      programmeId: transaction.programmeId,
      requestId: transaction.requestId,
      entityType: "pilotPaymentTransactions",
      entityId: transaction._id,
      eventName: "pilot.payment.recorded",
      actorUserId: transaction.initializedByUserId,
      recipientViews: [
        {
          audience: "buyer",
          targetId: String(transaction.buyerId),
          title: transaction.provider === "mock" ? "Sample payment recorded" : "Payment recorded",
          detail: `GHS ${(transaction.amountPesewas / 100).toFixed(2)} received.`,
        },
        {
          audience: "finance",
          title: "Buyer payment recorded",
          detail: `${transaction.provider} reference ${transaction.providerReference}.`,
        },
      ],
      createdAt: now,
    });
    return {
      transactionId: transaction._id,
      duplicate: false,
      receiptEntryIds,
      deadlineMarkerIds,
      activityEventId,
    };
  }
  if (input.status === "reversed") {
    const entries = await ctx.db
      .query("pilotFinancialEntries")
      .withIndex("by_request_created_at", (q) =>
        q.eq("requestId", transaction.requestId),
      )
      .collect();
    const receipts = entries.filter(
      (entry) =>
        entry.postingKind === "receipt" &&
        entry.reasonCode === `provider:${transaction.provider}:${transaction._id}`,
    );
    for (const receipt of receipts) {
      const postingKey = `provider-reversal:${transaction._id}:${receipt._id}`;
      if (entries.some((entry) => entry.postingKey === postingKey)) continue;
      await ctx.db.insert("pilotFinancialEntries", {
        programmeId: receipt.programmeId,
        requestId: transaction.requestId,
        ...(receipt.lotId === undefined ? {} : { lotId: receipt.lotId }),
        ...(receipt.acceptanceId === undefined
          ? {}
          : { acceptanceId: receipt.acceptanceId }),
        postingKind: "reversal",
        purpose: "correction",
        basis: "actual",
        payer: receipt.payee,
        payee: receipt.payer,
        amountPesewas: receipt.amountPesewas,
        currency: "GHS",
        reversesEntryId: receipt._id,
        postingKey,
        evidenceUploadAssetIds: [],
        provenance: receipt.provenance,
        reasonCode: "provider_payment_reversed",
        recordedByUserId: transaction.initializedByUserId,
        createdAt: now,
      });
    }
    await ctx.db.patch(transaction._id, {
      status: "reversed",
      reversedAt: now,
      updatedAt: now,
    });
    return { transactionId: transaction._id, duplicate: false, receiptEntryIds: [] };
  }
  const status =
    input.status === "failed" || input.status === "abandoned"
      ? "failed"
      : input.status === "manual_review"
        ? transaction.status
        : "initialized";
  await ctx.db.patch(transaction._id, {
    status,
    ...(status === "failed" ? { failedAt: now } : {}),
    ...(input.providerStatus === undefined
      ? {}
      : { providerStatus: input.providerStatus.trim().slice(0, 100) }),
    ...(input.providerMessage === undefined
      ? {}
      : { providerMessage: input.providerMessage.trim().slice(0, 500) }),
    updatedAt: now,
  });
  return { transactionId: transaction._id, duplicate: false, receiptEntryIds: [] };
}

export const reconcileProviderPayment = mutation({
  args: {
    serviceSecret: v.string(),
    provider: paymentProvider,
    providerReference: v.string(),
    status: providerPaymentStatus,
    amountPesewas: v.optional(v.number()),
    currency: v.optional(v.string()),
    providerStatus: v.optional(v.string()),
    providerMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertPaymentServiceSecret(args.serviceSecret);
    const transaction = await ctx.db
      .query("pilotPaymentTransactions")
      .withIndex("by_provider_reference", (q) =>
        q.eq("providerReference", cleanText(args.providerReference, "Provider reference")),
      )
      .unique();
    assertAllowed(
      transaction !== null && transaction.provider === args.provider,
      "Pilot payment transaction was not found.",
    );
    return await applyProviderResult(ctx, {
      transaction,
      status: args.status,
      ...(args.amountPesewas === undefined ? {} : { amountPesewas: args.amountPesewas }),
      ...(args.currency === undefined ? {} : { currency: args.currency }),
      ...(args.providerStatus === undefined ? {} : { providerStatus: args.providerStatus }),
      ...(args.providerMessage === undefined ? {} : { providerMessage: args.providerMessage }),
    });
  },
});

export const recordProviderEvent = mutation({
  args: {
    serviceSecret: v.string(),
    provider: paymentProvider,
    providerEventId: v.string(),
    providerReference: v.optional(v.string()),
    eventType: v.string(),
    normalizedStatus: providerPaymentStatus,
    amountPesewas: v.optional(v.number()),
    currency: v.optional(v.string()),
    providerStatus: v.optional(v.string()),
    providerMessage: v.optional(v.string()),
    rawPayload: genericRecord,
  },
  handler: async (ctx, args) => {
    assertPaymentServiceSecret(args.serviceSecret);
    const providerEventId = cleanText(args.providerEventId, "Provider event id");
    const existing = await ctx.db
      .query("paymentWebhookEvents")
      .withIndex("by_provider_event", (q) =>
        q.eq("provider", args.provider).eq("providerEventId", providerEventId),
      )
      .unique();
    if (existing !== null)
      return { eventId: existing._id, status: existing.status, duplicate: true };
    const now = Date.now();
    const transaction =
      args.providerReference === undefined
        ? null
        : await ctx.db
            .query("pilotPaymentTransactions")
            .withIndex("by_provider_reference", (q) =>
              q.eq("providerReference", args.providerReference!),
            )
            .unique();
    const eventId = await ctx.db.insert("paymentWebhookEvents", {
      provider: args.provider,
      providerEventId,
      ...(args.providerReference === undefined
        ? {}
        : { providerReference: args.providerReference }),
      eventType: cleanText(args.eventType, "Event type"),
      status: transaction === null ? "ignored" : "received",
      ...(transaction === null
        ? {}
        : { pilotPaymentTransactionId: transaction._id }),
      rawPayload: args.rawPayload,
      ...(transaction === null ? { processedAt: now } : {}),
      createdAt: now,
      updatedAt: now,
    });
    if (transaction === null)
      return { eventId, status: "ignored" as const, duplicate: false };
    assertAllowed(
      transaction.provider === args.provider,
      "Pilot payment provider does not match the transaction.",
    );
    const reconciliation = await applyProviderResult(ctx, {
      transaction,
      status: args.normalizedStatus,
      ...(args.amountPesewas === undefined ? {} : { amountPesewas: args.amountPesewas }),
      ...(args.currency === undefined ? {} : { currency: args.currency }),
      ...(args.providerStatus === undefined ? {} : { providerStatus: args.providerStatus }),
      ...(args.providerMessage === undefined ? {} : { providerMessage: args.providerMessage }),
    });
    await ctx.db.patch(eventId, {
      status: "processed",
      processedAt: Date.now(),
      updatedAt: Date.now(),
    });
    return { eventId, status: "processed" as const, duplicate: false, reconciliation };
  },
});

async function financialEntryState(
  ctx: QueryCtx | MutationCtx,
  entry: FinancialEntry,
  now: number,
) {
  const [settlements, reversals] = await Promise.all([
    ctx.db
      .query("pilotFinancialEntries")
      .withIndex("by_settles_entry", (q) => q.eq("settlesEntryId", entry._id))
      .collect(),
    ctx.db
      .query("pilotFinancialEntries")
      .withIndex("by_reverses_entry", (q) => q.eq("reversesEntryId", entry._id))
      .collect(),
  ]);
  let settledPesewas = 0;
  for (const settlement of settlements) {
    if (settlement.postingKind !== "payment" && settlement.postingKind !== "receipt")
      continue;
    const settlementReversals = await ctx.db
      .query("pilotFinancialEntries")
      .withIndex("by_reverses_entry", (q) =>
        q.eq("reversesEntryId", settlement._id),
      )
      .collect();
    const reversed = settlementReversals.reduce(
      (sum, item) => sum + item.amountPesewas,
      0,
    );
    assertAllowed(
      reversed <= settlement.amountPesewas,
      "Settlement reversals exceed the original payment.",
    );
    settledPesewas += settlement.amountPesewas - reversed;
  }
  const reversedPesewas = reversals
    .filter((item) => item.postingKind === "reversal")
    .reduce((sum, item) => sum + item.amountPesewas, 0);
  const deadlineMarker = settlements.find(
    (item) =>
      item.postingKind === "adjustment" &&
      item.amountPesewas === 0 &&
      item.dueAt !== undefined,
  );
  const dueAt = entry.dueAt ?? deadlineMarker?.dueAt;
  return pilotObligationStatus({
    amountPesewas: entry.amountPesewas,
    settledPesewas,
    reversedPesewas,
    ...(dueAt === undefined ? {} : { dueAt }),
    now,
  });
}

export const recordExternalSettlement = mutation({
  args: {
    obligationId: v.id("pilotFinancialEntries"),
    amountPesewas: v.number(),
    evidenceUploadAssetIds: v.array(v.id("uploadAssets")),
    paidAt: v.number(),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const obligation = await ctx.db.get(args.obligationId);
    assertAllowed(obligation !== null, "Financial obligation was not found.");
    const principal = await requireFinance(
      ctx,
      obligation.programmeId,
      "pilotFinance:manage",
    );
    const receipt = await beginPilotIdempotency(ctx, {
      programmeId: obligation.programmeId,
      actorUserId: principal._id,
      operationName: "pilotFinance.recordExternalSettlement",
      idempotencyKey: args.idempotencyKey,
      requestHash: JSON.stringify(args),
    });
    if (receipt.kind === "replay") {
      const payment = await ctx.db.get(
        replayEntityId<"pilotFinancialEntries">(
          receipt.receipt,
          "pilotFinancialEntries",
        ),
      );
      assertAllowed(payment !== null, "Settlement replay was not found.");
      return { paymentEntryId: payment._id };
    }
    assertAllowed(
      obligation.postingKind === "obligation",
      "Settlement target must be an obligation.",
    );
    assertPositivePesewas(args.amountPesewas, "amountPesewas");
    assertAllowed(
      Number.isSafeInteger(args.paidAt) && args.paidAt <= Date.now(),
      "Settlement time must be a past server timestamp.",
    );
    const state = await financialEntryState(ctx, obligation, Date.now());
    assertAllowed(
      args.amountPesewas <= state.outstandingPesewas,
      "Settlement exceeds the outstanding obligation.",
    );
    await validateFinancialEvidence(ctx, {
      assetIds: args.evidenceUploadAssetIds,
      actorUserId: principal._id,
      programmeId: obligation.programmeId,
      ...(obligation.requestId === undefined
        ? {}
        : { requestId: obligation.requestId }),
      financialEntryId: obligation._id,
    });
    const now = Date.now();
    const postingKey = `external-settlement:${obligation._id}:${receipt.receiptId}`;
    const paymentEntryId = await ctx.db.insert("pilotFinancialEntries", {
      programmeId: obligation.programmeId,
      ...(obligation.requestId === undefined
        ? {}
        : { requestId: obligation.requestId }),
      ...(obligation.lotId === undefined ? {} : { lotId: obligation.lotId }),
      ...(obligation.offerRevisionId === undefined
        ? {}
        : { offerRevisionId: obligation.offerRevisionId }),
      ...(obligation.acceptanceId === undefined
        ? {}
        : { acceptanceId: obligation.acceptanceId }),
      ...(obligation.fundingReservationId === undefined
        ? {}
        : { fundingReservationId: obligation.fundingReservationId }),
      postingKind: "payment",
      purpose: obligation.purpose,
      basis: "actual",
      payer: obligation.payer,
      payee: obligation.payee,
      amountPesewas: args.amountPesewas,
      currency: "GHS",
      settlesEntryId: obligation._id,
      postingKey,
      evidenceUploadAssetIds: args.evidenceUploadAssetIds,
      provenance: obligation.provenance,
      reasonCode: "external_settlement_evidence",
      recordedByUserId: principal._id,
      createdAt: args.paidAt,
    });
    if (obligation.fundingReservationId !== undefined) {
      const reservation = await ctx.db.get(obligation.fundingReservationId);
      assertAllowed(reservation !== null, "Funding reservation was not found.");
      const budget = await ctx.db.get(reservation.budgetId);
      assertAllowed(
        budget !== null && budget.committedPesewas >= args.amountPesewas,
        "Committed purchasing capacity is insufficient for settlement.",
      );
      await ctx.db.patch(budget._id, {
        committedPesewas: budget.committedPesewas - args.amountPesewas,
        spentPesewas: budget.spentPesewas + args.amountPesewas,
        version: budget.version + 1,
        updatedAt: now,
      });
      await insertBudgetEvent(ctx, {
        programmeId: obligation.programmeId,
        budgetId: budget._id,
        reservationId: reservation._id,
        financialEntryId: paymentEntryId,
        eventType: "spent",
        amountPesewas: args.amountPesewas,
        postingKey: `${postingKey}:spent`,
        reasonCode: "external_settlement_evidence",
        recordedByUserId: principal._id,
        createdAt: args.paidAt,
      });
    }
    await completePilotIdempotency(ctx, receipt.receiptId, [
      { entityType: "pilotFinancialEntries", entityId: paymentEntryId },
    ]);
    return {
      paymentEntryId,
      obligationStatus: (
        await financialEntryState(ctx, obligation, Date.now())
      ).status,
    };
  },
});

export const recordActualCost = mutation({
  args: {
    reservationId: v.id("pilotFundingReservations"),
    requestId: v.id("pilotBuyerRequests"),
    lotId: v.optional(v.id("pilotProcurementLots")),
    purpose: costPurpose,
    amountPesewas: v.number(),
    payee: partyRef,
    evidenceUploadAssetIds: v.array(v.id("uploadAssets")),
    dueAt: v.optional(v.number()),
    expectedReservationVersion: v.number(),
    expectedBudgetVersion: v.number(),
    reasonCode: v.string(),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const reservation = await ctx.db.get(args.reservationId);
    assertAllowed(reservation !== null, "Funding reservation was not found.");
    const principal = await requireFinance(
      ctx,
      reservation.programmeId,
      "pilotFinance:manage",
    );
    const receipt = await beginPilotIdempotency(ctx, {
      programmeId: reservation.programmeId,
      actorUserId: principal._id,
      operationName: "pilotFinance.recordActualCost",
      idempotencyKey: args.idempotencyKey,
      requestHash: JSON.stringify(args),
    });
    if (receipt.kind === "replay") {
      const cost = await ctx.db.get(
        replayEntityId<"pilotFinancialEntries">(
          receipt.receipt,
          "pilotFinancialEntries",
        ),
      );
      assertAllowed(cost !== null, "Actual cost replay was not found.");
      const obligation = await ctx.db
        .query("pilotFinancialEntries")
        .withIndex("by_posting_key", (q) =>
          q.eq("postingKey", `${cost.postingKey}:obligation`),
        )
        .unique();
      return { costEntryId: cost._id, obligationEntryId: obligation?._id };
    }
    assertExpectedVersion(args.expectedReservationVersion);
    assertExpectedVersion(args.expectedBudgetVersion);
    assertPositivePesewas(args.amountPesewas, "amountPesewas");
    cleanText(args.payee.displayNameSnapshot, "Payee display name");
    const reasonCode = cleanText(args.reasonCode, "Cost reason");
    const [request, budget] = await Promise.all([
      ctx.db.get(args.requestId),
      ctx.db.get(reservation.budgetId),
    ]);
    assertAllowed(
      request !== null &&
        budget !== null &&
        request.programmeId === reservation.programmeId &&
        reservation.requestId === request._id &&
        reservation.version === args.expectedReservationVersion &&
        budget.version === args.expectedBudgetVersion &&
        ["active", "partly_consumed"].includes(reservation.status),
      "Actual cost funding is stale or belongs to another request.",
    );
    const priorCosts = await ctx.db
      .query("pilotFinancialEntries")
      .withIndex("by_request_created_at", (q) => q.eq("requestId", request._id))
      .collect();
    const knownCostsConsumed = priorCosts
      .filter(
        (entry) =>
          entry.fundingReservationId === reservation._id &&
          entry.postingKind === "cost" &&
          entry.purpose !== "purchase_inventory",
      )
      .reduce((sum, entry) => sum + entry.amountPesewas, 0);
    assertAllowed(
      knownCostsConsumed + args.amountPesewas <=
        reservation.knownCostAmountPesewas &&
        budget.reservedPesewas >= args.amountPesewas,
      "Actual cost exceeds reserved known-cost capacity.",
    );
    if (args.lotId !== undefined) {
      const lot = await ctx.db.get(args.lotId);
      assertAllowed(
        lot !== null && lot.requestId === request._id,
        "Cost lot belongs to another request.",
      );
    }
    await validateFinancialEvidence(ctx, {
      assetIds: args.evidenceUploadAssetIds,
      actorUserId: principal._id,
      programmeId: reservation.programmeId,
      requestId: request._id,
    });
    const now = Date.now();
    const postingKey = `actual-cost:${receipt.receiptId}`;
    const common = {
      programmeId: reservation.programmeId,
      requestId: request._id,
      ...(args.lotId === undefined ? {} : { lotId: args.lotId }),
      fundingReservationId: reservation._id,
      purpose: args.purpose,
      basis: "actual" as const,
      payer: {
        kind: "kuapa_dwaso" as const,
        displayNameSnapshot: "Kuapa Dwaso",
      },
      payee: args.payee,
      amountPesewas: args.amountPesewas,
      currency: "GHS" as const,
      evidenceUploadAssetIds: args.evidenceUploadAssetIds,
      provenance: budget.datasetProvenance,
      reasonCode,
      recordedByUserId: principal._id,
      createdAt: now,
    };
    const costEntryId = await ctx.db.insert("pilotFinancialEntries", {
      ...common,
      postingKind: "cost",
      postingKey,
    });
    const obligationEntryId = await ctx.db.insert("pilotFinancialEntries", {
      ...common,
      postingKind: "obligation",
      ...(args.dueAt === undefined ? {} : { dueAt: args.dueAt }),
      postingKey: `${postingKey}:obligation`,
    });
    const unusedBefore =
      reservation.produceAmountPesewas +
      reservation.knownCostAmountPesewas -
      reservation.consumedPesewas -
      reservation.releasedPesewas;
    await ctx.db.patch(reservation._id, {
      consumedPesewas: reservation.consumedPesewas + args.amountPesewas,
      status:
        unusedBefore === args.amountPesewas ? "consumed" : "partly_consumed",
      version: reservation.version + 1,
      updatedAt: now,
    });
    await ctx.db.patch(budget._id, {
      reservedPesewas: budget.reservedPesewas - args.amountPesewas,
      committedPesewas: budget.committedPesewas + args.amountPesewas,
      version: budget.version + 1,
      updatedAt: now,
    });
    await insertBudgetEvent(ctx, {
      programmeId: reservation.programmeId,
      budgetId: budget._id,
      reservationId: reservation._id,
      financialEntryId: obligationEntryId,
      eventType: "committed",
      amountPesewas: args.amountPesewas,
      postingKey: `${postingKey}:committed`,
      reasonCode,
      recordedByUserId: principal._id,
      createdAt: now,
    });
    await completePilotIdempotency(ctx, receipt.receiptId, [
      { entityType: "pilotFinancialEntries", entityId: costEntryId },
    ]);
    return { costEntryId, obligationEntryId };
  },
});

export const recordCoordinationActualCost = mutation({
  args: {
    requestId: v.id("pilotBuyerRequests"),
    lotId: v.optional(v.id("pilotProcurementLots")),
    purpose: costPurpose,
    amountPesewas: v.number(),
    payee: partyRef,
    evidenceUploadAssetIds: v.array(v.id("uploadAssets")),
    dueAt: v.optional(v.number()),
    reasonCode: v.string(),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    assertAllowed(
      request !== null && request.commercialMode === "coordination",
      "Coordination cost requires a coordination request.",
    );
    const principal = await requireFinance(
      ctx,
      request.programmeId,
      "pilotFinance:manage",
    );
    const receipt = await beginPilotIdempotency(ctx, {
      programmeId: request.programmeId,
      actorUserId: principal._id,
      operationName: "pilotFinance.recordCoordinationActualCost",
      idempotencyKey: args.idempotencyKey,
      requestHash: JSON.stringify(args),
    });
    if (receipt.kind === "replay") {
      const costEntryId = replayEntityId<"pilotFinancialEntries">(
        receipt.receipt,
        "pilotFinancialEntries",
      );
      const cost = await ctx.db.get(costEntryId);
      assertAllowed(cost !== null, "Coordination cost replay was not found.");
      const obligation = await ctx.db
        .query("pilotFinancialEntries")
        .withIndex("by_posting_key", (q) =>
          q.eq("postingKey", `${cost.postingKey}:obligation`),
        )
        .unique();
      return { costEntryId, obligationEntryId: obligation?._id };
    }
    assertPositivePesewas(args.amountPesewas, "amountPesewas");
    const reasonCode = cleanText(args.reasonCode, "Cost reason");
    cleanText(args.payee.displayNameSnapshot, "Payee display name");
    if (args.dueAt !== undefined)
      assertAllowed(
        Number.isSafeInteger(args.dueAt) && args.dueAt >= 0,
        "Cost due time must be a non-negative timestamp.",
      );
    if (args.lotId !== undefined) {
      const lot = await ctx.db.get(args.lotId);
      assertAllowed(
        lot !== null && lot.requestId === request._id,
        "Cost lot belongs to another request.",
      );
    }
    await validateFinancialEvidence(ctx, {
      assetIds: args.evidenceUploadAssetIds,
      actorUserId: principal._id,
      programmeId: request.programmeId,
      requestId: request._id,
    });
    const programme = await ctx.db.get(request.programmeId);
    assertAllowed(programme !== null, "Pilot programme was not found.");
    const now = Date.now();
    const postingKey = `coordination-cost:${receipt.receiptId}`;
    const common = {
      programmeId: request.programmeId,
      requestId: request._id,
      ...(args.lotId === undefined ? {} : { lotId: args.lotId }),
      purpose: args.purpose,
      basis: "actual" as const,
      payer: {
        kind: "kuapa_dwaso" as const,
        displayNameSnapshot: "Kuapa Dwaso",
      },
      payee: args.payee,
      amountPesewas: args.amountPesewas,
      currency: "GHS" as const,
      evidenceUploadAssetIds: args.evidenceUploadAssetIds,
      provenance: programme.datasetProvenance,
      reasonCode,
      recordedByUserId: principal._id,
      createdAt: now,
    };
    const costEntryId = await ctx.db.insert("pilotFinancialEntries", {
      ...common,
      postingKind: "cost",
      postingKey,
    });
    const obligationEntryId = await ctx.db.insert("pilotFinancialEntries", {
      ...common,
      postingKind: "obligation",
      ...(args.dueAt === undefined ? {} : { dueAt: args.dueAt }),
      postingKey: `${postingKey}:obligation`,
    });
    await insertPilotActivityEvent(ctx, {
      programmeId: request.programmeId,
      requestId: request._id,
      entityType: "pilotFinancialEntries",
      entityId: costEntryId,
      eventName: "pilot.financial.entry_posted",
      actorUserId: principal._id,
      recipientViews: [
        {
          audience: "finance",
          title: "Actual coordination cost recorded",
          detail: `GHS ${(args.amountPesewas / 100).toFixed(2)} for ${args.purpose}.`,
        },
      ],
      createdAt: now,
    });
    await completePilotIdempotency(ctx, receipt.receiptId, [
      { entityType: "pilotFinancialEntries", entityId: costEntryId },
    ]);
    return { costEntryId, obligationEntryId };
  },
});

export const reverseFinancialEntry = mutation({
  args: {
    entryId: v.id("pilotFinancialEntries"),
    amountPesewas: v.number(),
    reasonCode: v.string(),
    evidenceUploadAssetIds: v.array(v.id("uploadAssets")),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.entryId);
    assertAllowed(entry !== null, "Financial entry was not found.");
    const principal = await requireFinance(
      ctx,
      entry.programmeId,
      "pilotFinance:manage",
    );
    const receipt = await beginPilotIdempotency(ctx, {
      programmeId: entry.programmeId,
      actorUserId: principal._id,
      operationName: "pilotFinance.reverseFinancialEntry",
      idempotencyKey: args.idempotencyKey,
      requestHash: JSON.stringify(args),
    });
    if (receipt.kind === "replay") {
      return {
        reversalEntryId: replayEntityId<"pilotFinancialEntries">(
          receipt.receipt,
          "pilotFinancialEntries",
        ),
      };
    }
    assertAllowed(
      entry.postingKind !== "reversal" &&
        !(entry.postingKind === "obligation" &&
          entry.fundingReservationId !== undefined),
      "Funded purchase obligations require an issue-backed ownership correction before reversal.",
    );
    assertPositivePesewas(args.amountPesewas, "amountPesewas");
    const reversals = await ctx.db
      .query("pilotFinancialEntries")
      .withIndex("by_reverses_entry", (q) => q.eq("reversesEntryId", entry._id))
      .collect();
    assertAllowed(
      reversals.reduce((sum, reversal) => sum + reversal.amountPesewas, 0) +
        args.amountPesewas <=
        entry.amountPesewas,
      "Reversal exceeds the unreversed entry amount.",
    );
    await validateFinancialEvidence(ctx, {
      assetIds: args.evidenceUploadAssetIds,
      actorUserId: principal._id,
      programmeId: entry.programmeId,
      ...(entry.requestId === undefined ? {} : { requestId: entry.requestId }),
      financialEntryId: entry._id,
    });
    const reasonCode = cleanText(args.reasonCode, "Reversal reason");
    const now = Date.now();
    const postingKey = `reversal:${entry._id}:${receipt.receiptId}`;
    const reversalEntryId = await ctx.db.insert("pilotFinancialEntries", {
      programmeId: entry.programmeId,
      ...(entry.requestId === undefined ? {} : { requestId: entry.requestId }),
      ...(entry.lotId === undefined ? {} : { lotId: entry.lotId }),
      ...(entry.offerRevisionId === undefined
        ? {}
        : { offerRevisionId: entry.offerRevisionId }),
      ...(entry.acceptanceId === undefined
        ? {}
        : { acceptanceId: entry.acceptanceId }),
      ...(entry.fundingReservationId === undefined
        ? {}
        : { fundingReservationId: entry.fundingReservationId }),
      postingKind: "reversal",
      purpose: "correction",
      basis: "actual",
      payer: entry.payee,
      payee: entry.payer,
      amountPesewas: args.amountPesewas,
      currency: "GHS",
      reversesEntryId: entry._id,
      postingKey,
      evidenceUploadAssetIds: args.evidenceUploadAssetIds,
      provenance: entry.provenance,
      reasonCode,
      recordedByUserId: principal._id,
      createdAt: now,
    });
    if (
      entry.postingKind === "payment" &&
      entry.fundingReservationId !== undefined
    ) {
      const reservation = await ctx.db.get(entry.fundingReservationId);
      assertAllowed(reservation !== null, "Funding reservation was not found.");
      const budget = await ctx.db.get(reservation.budgetId);
      assertAllowed(
        budget !== null && budget.spentPesewas >= args.amountPesewas,
        "Spent budget is insufficient for settlement reversal.",
      );
      await ctx.db.patch(budget._id, {
        spentPesewas: budget.spentPesewas - args.amountPesewas,
        committedPesewas: budget.committedPesewas + args.amountPesewas,
        version: budget.version + 1,
        updatedAt: now,
      });
      await insertBudgetEvent(ctx, {
        programmeId: entry.programmeId,
        budgetId: budget._id,
        reservationId: reservation._id,
        financialEntryId: reversalEntryId,
        eventType: "reversed",
        amountPesewas: args.amountPesewas,
        postingKey: `${postingKey}:budget`,
        reasonCode,
        recordedByUserId: principal._id,
        createdAt: now,
      });
    }
    await insertPilotActivityEvent(ctx, {
      programmeId: entry.programmeId,
      ...(entry.requestId === undefined ? {} : { requestId: entry.requestId }),
      entityType: "pilotFinancialEntries",
      entityId: reversalEntryId,
      eventName: "pilot.financial.entry_reversed",
      actorUserId: principal._id,
      recipientViews: [
        {
          audience: "finance",
          title: "Financial entry reversed",
          detail: reasonCode,
        },
      ],
      createdAt: now,
    });
    await completePilotIdempotency(ctx, receipt.receiptId, [
      { entityType: "pilotFinancialEntries", entityId: reversalEntryId },
    ]);
    return { reversalEntryId };
  },
});

export const reverseEntry = reverseFinancialEntry;

export async function activateFarmerDeadlinesAfterBuyerFunds(
  ctx: MutationCtx,
  input: {
    requestId: Id<"pilotBuyerRequests">;
    actorUserId: Id<"users">;
    clearedAt: number;
    sourcePaymentEntryId: FinancialEntryId;
  },
): Promise<FinancialEntryId[]> {
  const request = await ctx.db.get(input.requestId);
  assertAllowed(request !== null, "Pilot request was not found.");
  const entries = await ctx.db
    .query("pilotFinancialEntries")
    .withIndex("by_request_created_at", (q) => q.eq("requestId", request._id))
    .collect();
  const buyerObligations = entries.filter(
    (entry) =>
      entry.postingKind === "obligation" && entry.payer.kind === "buyer",
  );
  for (const obligation of buyerObligations) {
    const state = await financialEntryState(ctx, obligation, input.clearedAt);
    assertAllowed(
      state.outstandingPesewas === 0,
      "Farmer deadlines wait until all buyer obligations have cleared.",
    );
  }
  const markerIds: FinancialEntryId[] = [];
  for (const obligation of entries.filter(
    (entry) =>
      entry.postingKind === "obligation" &&
      entry.purpose === "farmer_proceeds" &&
      entry.dueAt === undefined,
  )) {
    const existing = entries.find(
      (entry) =>
        entry.postingKey === `farmer-deadline:${obligation._id}`,
    );
    if (existing !== undefined) continue;
    assertAllowed(
      obligation.offerRevisionId !== undefined,
      "Farmer payable is missing its accepted offer terms.",
    );
    const revision = await ctx.db.get(obligation.offerRevisionId);
    assertAllowed(revision !== null, "Farmer offer revision was not found.");
    const terms = revision.paymentTerms.filter(
      (term) => term.trigger === "cleared_buyer_funds",
    );
    assertAllowed(
      terms.length === 1,
      "Farmer payable needs one cleared-funds deadline term.",
    );
    markerIds.push(
      await ctx.db.insert("pilotFinancialEntries", {
        programmeId: obligation.programmeId,
        requestId: request._id,
        ...(obligation.lotId === undefined ? {} : { lotId: obligation.lotId }),
        offerRevisionId: revision._id,
        ...(obligation.acceptanceId === undefined
          ? {}
          : { acceptanceId: obligation.acceptanceId }),
        postingKind: "adjustment",
        purpose: "farmer_proceeds",
        basis: "actual",
        payer: obligation.payer,
        payee: obligation.payee,
        amountPesewas: 0,
        currency: "GHS",
        dueAt: pilotPaymentDueAt(terms[0]!, input.clearedAt),
        settlesEntryId: obligation._id,
        postingKey: `farmer-deadline:${obligation._id}`,
        evidenceUploadAssetIds: [],
        provenance: obligation.provenance,
        reasonCode: `cleared_buyer_funds:${input.sourcePaymentEntryId}`,
        recordedByUserId: input.actorUserId,
        createdAt: input.clearedAt,
      }),
    );
  }
  return markerIds;
}

export const getFinancialEntry = query({
  args: { entryId: v.id("pilotFinancialEntries") },
  handler: async (ctx, args) => {
    const principal = await requirePilotPrincipal(ctx);
    const entry = await ctx.db.get(args.entryId);
    if (entry === null) return null;
    await requirePilotFinancialEntryRead(ctx, principal, entry);
    return {
      ...entry,
      id: entry._id,
      ...(entry.postingKind === "obligation"
        ? { obligation: await financialEntryState(ctx, entry, Date.now()) }
        : {}),
    };
  },
});

export const getRequestStatement = query({
  args: { requestId: v.id("pilotBuyerRequests") },
  handler: async (ctx, args) => {
    const principal = await requirePilotPrincipal(ctx);
    const request = await ctx.db.get(args.requestId);
    assertAllowed(request !== null, "Pilot request was not found.");
    const entries = await ctx.db
      .query("pilotFinancialEntries")
      .withIndex("by_request_created_at", (q) => q.eq("requestId", request._id))
      .collect();
    let visible: FinancialEntry[];
    let includeInternalTotals = false;
    if (principal.role === "admin") {
      await requirePilotAdminPermission(
        ctx,
        principal,
        request.programmeId,
        "pilotFinance:read",
      );
      visible = entries;
      includeInternalTotals = true;
    } else if (principal.role === "buyer") {
      await requirePilotRequestRead(ctx, principal, request);
      const buyer = await ctx.db
        .query("buyers")
        .withIndex("by_user", (q) => q.eq("userId", principal._id))
        .unique();
      assertAllowed(buyer !== null, "Buyer profile was not found.");
      visible = entries.filter(
        (entry) =>
          (entry.payer.kind === "buyer" && entry.payer.id === buyer._id) ||
          (entry.payee.kind === "buyer" && entry.payee.id === buyer._id),
      );
    } else if (principal.role === "farmer") {
      const farmer = await ctx.db
        .query("farmers")
        .withIndex("by_user", (q) => q.eq("userId", principal._id))
        .unique();
      assertAllowed(farmer !== null, "Farmer profile was not found.");
      visible = entries.filter(
        (entry) =>
          (entry.payer.kind === "farmer" && entry.payer.id === farmer._id) ||
          (entry.payee.kind === "farmer" && entry.payee.id === farmer._id),
      );
      assertAllowed(
        visible.length > 0,
        "This request has no financial entries for the farmer.",
      );
    } else {
      assertAllowed(false, "This role cannot read pilot financial statements.");
      visible = [];
    }
    const projected = [];
    let obligationPesewas = 0;
    let settledPesewas = 0;
    let outstandingPesewas = 0;
    for (const entry of visible) {
      if (entry.postingKind === "obligation") {
        const obligation = await financialEntryState(ctx, entry, Date.now());
        obligationPesewas += entry.amountPesewas;
        settledPesewas += entry.amountPesewas - obligation.outstandingPesewas;
        outstandingPesewas += obligation.outstandingPesewas;
        projected.push({ ...entry, id: entry._id, obligation });
      } else {
        projected.push({ ...entry, id: entry._id });
      }
    }
    const actualOperatingCosts = entries
      .filter(
        (entry) =>
          entry.postingKind === "cost" &&
          entry.basis === "actual" &&
          ["transport_cost", "handling_cost", "other_agreed_cost"].includes(
            entry.purpose,
          ),
      )
      .reduce((sum, entry) => sum + entry.amountPesewas, 0);
    const buyerTransportObligations = entries
      .filter(
        (entry) =>
          entry.postingKind === "obligation" &&
          entry.purpose === "buyer_transport",
      )
      .reduce((sum, entry) => sum + entry.amountPesewas, 0);
    return {
      requestId: request._id,
      currency: "GHS" as const,
      entries: projected,
      totals: { obligationPesewas, settledPesewas, outstandingPesewas },
      ...(includeInternalTotals
        ? {
            costCompleteness:
              buyerTransportObligations > 0 && actualOperatingCosts === 0
                ? ({ status: "incomplete" } as const)
                : ({ status: "complete" } as const),
          }
        : {}),
    };
  },
});

export const listFinancialEntries = query({
  args: {
    programmeId: v.id("pilotProgrammes"),
    requestId: v.optional(v.id("pilotBuyerRequests")),
    cursor: v.optional(v.string()),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    await requireFinance(ctx, args.programmeId, "pilotFinance:read");
    assertAllowed(
      Number.isSafeInteger(args.limit) && args.limit > 0 && args.limit <= 50,
      "Page limit must be from 1 to 50.",
    );
    const result = await ctx.db
      .query("pilotFinancialEntries")
      .withIndex("by_request_created_at", (q) =>
        args.requestId === undefined
          ? q
          : q.eq("requestId", args.requestId),
      )
      .order("desc")
      .paginate({ cursor: args.cursor ?? null, numItems: args.limit });
    const page = [];
    for (const entry of result.page) {
      if (entry.programmeId !== args.programmeId) continue;
      page.push({
        ...entry,
        id: entry._id,
        ...(entry.postingKind === "obligation"
          ? { obligation: await financialEntryState(ctx, entry, Date.now()) }
          : {}),
      });
    }
    return {
      page,
      ...(result.isDone ? {} : { nextCursor: result.continueCursor }),
      isDone: result.isDone,
    };
  },
});

async function getProgrammeSummaryHandler(
  ctx: QueryCtx,
  args: { programmeId: Id<"pilotProgrammes"> },
) {
    await requireFinance(ctx, args.programmeId, "pilotFinance:read");
    const [budgets, reservations, entries] = await Promise.all([
      ctx.db
        .query("pilotPurchasingBudgets")
        .withIndex("by_programme_status", (q) =>
          q.eq("programmeId", args.programmeId),
        )
        .collect(),
      ctx.db
        .query("pilotFundingReservations")
        .withIndex("by_request_status")
        .collect(),
      ctx.db.query("pilotFinancialEntries").collect(),
    ]);
    const scoped = entries.filter(
      (entry) => entry.programmeId === args.programmeId,
    );
    const reversedById = new Map<string, number>();
    for (const entry of scoped) {
      if (entry.postingKind !== "reversal" || entry.reversesEntryId === undefined)
        continue;
      reversedById.set(
        entry.reversesEntryId,
        (reversedById.get(entry.reversesEntryId) ?? 0) + entry.amountPesewas,
      );
    }
    const active = scoped.filter(
      (entry) => entry.postingKind !== "reversal",
    );
    const sum = (predicate: (entry: FinancialEntry) => boolean) =>
      active
        .filter(predicate)
        .reduce(
          (total, entry) =>
            total +
            Math.max(0, entry.amountPesewas - (reversedById.get(entry._id) ?? 0)),
          0,
        );
    const buyerProducePesewas = sum(
      (entry) =>
        entry.postingKind === "obligation" &&
        entry.purpose === "buyer_produce",
    );
    const coordinationRevenuePesewas = sum(
      (entry) =>
        entry.postingKind === "revenue" &&
        entry.purpose === "coordination_fee",
    );
    const buyerTransportPesewas = sum(
      (entry) =>
        entry.postingKind === "obligation" &&
        entry.purpose === "buyer_transport",
    );
    const purchaseInventoryCostPesewas = sum(
      (entry) =>
        entry.postingKind === "cost" &&
        entry.purpose === "purchase_inventory",
    );
    const operatingCostPesewas = sum(
      (entry) =>
        entry.postingKind === "cost" &&
        ["transport_cost", "handling_cost", "other_agreed_cost"].includes(
          entry.purpose,
        ),
    );
    const farmerPayablesPesewas = sum(
      (entry) =>
        entry.postingKind === "obligation" &&
        entry.purpose === "farmer_proceeds",
    );
    const missingEstimatedActualCosts = active.some(
      (entry) =>
        entry.basis === "estimate" &&
        ["transport_cost", "handling_cost", "other_agreed_cost"].includes(
          entry.purpose,
        ),
    );
    const coordinationCostMissing =
      buyerTransportPesewas > 0 && operatingCostPesewas === 0;
    const purchaseCostMissing = reservations
      .filter(
        (reservation) =>
          reservation.programmeId === args.programmeId &&
          reservation.consumedPesewas > 0 &&
          reservation.knownCostAmountPesewas > 0,
      )
      .some((reservation) => {
        const recorded = sum(
          (entry) =>
            entry.fundingReservationId === reservation._id &&
            entry.postingKind === "cost" &&
            ["transport_cost", "handling_cost", "other_agreed_cost"].includes(
              entry.purpose,
            ),
        );
        return recorded < reservation.knownCostAmountPesewas;
      });
    const missingActualCosts =
      missingEstimatedActualCosts || coordinationCostMissing || purchaseCostMissing;
    return {
      programmeId: args.programmeId,
      budgets: budgets.map(budgetProjection),
      actuals: {
        buyerProducePesewas,
        farmerPayablesPesewas,
        coordinationRevenuePesewas,
        buyerTransportPesewas,
        purchaseInventoryCostPesewas,
        operatingCostPesewas,
        buyerReceiptsPesewas: sum(
          (entry) => entry.postingKind === "receipt",
        ),
        externalPaymentsPesewas: sum(
          (entry) => entry.postingKind === "payment",
        ),
        contribution: pilotActualContribution({
          buyerProducePesewas,
          buyerTransportPesewas,
          farmerPayablesPesewas,
          operatingCostPesewas,
          costsComplete: !missingActualCosts,
        }),
      },
    };
}

export const getFinanceOverview = query({
  args: { programmeId: v.id("pilotProgrammes") },
  handler: getProgrammeSummaryHandler,
});

export const getProgrammeSummary = query({
  args: { programmeId: v.id("pilotProgrammes") },
  handler: getProgrammeSummaryHandler,
});

export { budgetProjection, financialEntryState, reservationProjection };
