import { v } from "convex/values";
import {
  canTransitionPilotRequest,
  getPilotConfirmationBlockers,
} from "@kuapa-dwaso/permissions/pilot";
import {
  assertExpectedVersion,
  assertPilotChargeTerm,
  assertPilotLocation,
  assertPilotMaizeSpecification,
  assertPilotPaymentTerm,
  assertPilotQuantityGrams,
  assertPilotRate,
  assertPilotRequestTerms,
  assertPilotWindow,
} from "@kuapa-dwaso/validators/pilot";
import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { assertAllowed } from "./workflowHelpers";
import { insertPilotActivityEvent } from "./pilotActivity";
import {
  requirePilotCapability,
  requirePilotPrincipal,
  requirePilotRequestRead,
  type PilotPrincipal,
} from "./pilotAccess";
import {
  beginPilotIdempotency,
  completePilotIdempotency,
  getPilotIdempotencyReplay,
  replayEntityId,
} from "./pilotIdempotency";

const commercialMode = v.union(
  v.literal("coordination"),
  v.literal("kuapa_purchase"),
);
const requestStatus = v.union(
  v.literal("draft"),
  v.literal("submitted"),
  v.literal("under_review"),
  v.literal("quoted"),
  v.literal("confirmed"),
  v.literal("fulfilling"),
  v.literal("delivered"),
  v.literal("closed"),
  v.literal("cancelled"),
  v.literal("disputed"),
);
const location = v.object({
  label: v.string(),
  region: v.optional(v.string()),
  district: v.optional(v.string()),
  address: v.optional(v.string()),
  latitudeE6: v.optional(v.number()),
  longitudeE6: v.optional(v.number()),
});
const rate = v.object({
  numerator: v.number(),
  scale: v.number(),
  unit: v.union(v.literal("per_kg"), v.literal("percent"), v.literal("fixed")),
});
const specification = v.object({
  maizeType: v.string(),
  moistureMaximumPermille: v.optional(v.number()),
  contaminationCheckRequired: v.boolean(),
  additionalCriteria: v.array(
    v.object({ code: v.string(), label: v.string(), required: v.boolean() }),
  ),
  policyProvenance: v.union(v.literal("live"), v.literal("sample_only")),
});
const paymentTerm = v.object({
  trigger: v.union(
    v.literal("buyer_acceptance"),
    v.literal("cleared_buyer_funds"),
    v.literal("purchase_collection_acceptance"),
    v.literal("fixed_date"),
  ),
  offsetCalendarDays: v.number(),
  fixedDueAt: v.optional(v.number()),
  timezone: v.literal("Africa/Accra"),
});
const chargeTerm = v.object({
  code: v.string(),
  label: v.string(),
  payer: v.union(
    v.literal("buyer"),
    v.literal("farmer"),
    v.literal("kuapa_dwaso"),
  ),
  calculation: v.union(
    v.literal("fixed"),
    v.literal("per_kg"),
    v.literal("percent_of_produce"),
  ),
  rate,
});
const termClause = v.object({
  code: v.string(),
  label: v.string(),
  detail: v.string(),
});

function requestSummary(request: Doc<"pilotBuyerRequests">) {
  return {
    requestId: request._id,
    programmeId: request.programmeId,
    buyerId: request.buyerId,
    requestedGrams: request.requestedGrams,
    confirmedGrams: request.confirmedGrams,
    commercialMode: request.commercialMode,
    status: request.status,
    cancellationState: request.cancellationState,
    currentAgreementRevisionId: request.currentAgreementRevisionId,
    version: request.version,
  };
}

function assertVersion(
  request: Doc<"pilotBuyerRequests">,
  expectedVersion: number,
) {
  assertExpectedVersion(expectedVersion);
  assertAllowed(
    request.version === expectedVersion,
    "Pilot request changed. Refresh and retry with its current version.",
  );
}

async function requireOwnedBuyer(
  ctx: QueryCtx | MutationCtx,
  principal: PilotPrincipal,
  request?: Doc<"pilotBuyerRequests">,
) {
  assertAllowed(principal.role === "buyer", "A buyer identity is required.");
  const buyer = await ctx.db
    .query("buyers")
    .withIndex("by_user", (q) => q.eq("userId", principal._id))
    .unique();
  assertAllowed(
    buyer !== null && buyer.status === "active",
    "Active buyer profile was not found.",
  );
  if (request !== undefined)
    assertAllowed(
      request.buyerId === buyer._id,
      "Pilot request belongs to another buyer.",
    );
  return buyer;
}

async function requireRequestManager(
  ctx: QueryCtx | MutationCtx,
  principal: PilotPrincipal,
  programmeId: Id<"pilotProgrammes">,
) {
  await requirePilotCapability(ctx, principal, programmeId, "requests:review");
}

function validateClauses(
  clauses: Array<{ code: string; label: string; detail: string }>,
  label: string,
) {
  assertAllowed(clauses.length > 0, `${label} are required.`);
  const codes = new Set<string>();
  for (const clause of clauses) {
    assertAllowed(
      clause.code.trim().length > 0 &&
        clause.label.trim().length > 0 &&
        clause.detail.trim().length > 0 &&
        !codes.has(clause.code),
      `${label} require unique codes, labels, and detail.`,
    );
    codes.add(clause.code);
  }
}

async function emit(
  ctx: MutationCtx,
  request: Doc<"pilotBuyerRequests">,
  eventName: string,
  actorUserId: Id<"users">,
  detail: string,
) {
  await insertPilotActivityEvent(ctx, {
    programmeId: request.programmeId,
    requestId: request._id,
    entityType: "pilotBuyerRequests",
    entityId: request._id,
    entityRevision: request.version,
    eventName,
    actorUserId,
    recipientViews: [
      {
        audience: "buyer",
        targetId: request.buyerId,
        title: eventName.replaceAll(".", " "),
        detail,
      },
      { audience: "pilot_ops", title: eventName.replaceAll(".", " "), detail },
    ],
    createdAt: Date.now(),
  });
}

async function replayRequest(
  ctx: MutationCtx,
  receipt: Doc<"pilotIdempotencyKeys">,
) {
  const request = await ctx.db.get(
    replayEntityId<"pilotBuyerRequests">(receipt, "pilotBuyerRequests"),
  );
  assertAllowed(
    request !== null,
    "Idempotent pilot request result was not found.",
  );
  return request;
}

async function replayAgreement(
  ctx: MutationCtx,
  receipt: Doc<"pilotIdempotencyKeys">,
) {
  const revision = await ctx.db.get(
    replayEntityId<"pilotBuyerAgreementRevisions">(
      receipt,
      "pilotBuyerAgreementRevisions",
    ),
  );
  assertAllowed(
    revision !== null,
    "Idempotent agreement revision was not found.",
  );
  return revision;
}

async function evaluateCancellation(
  ctx: QueryCtx | MutationCtx,
  request: Doc<"pilotBuyerRequests">,
) {
  const [allocations, lots, plans, reservations, entries, issues] =
    await Promise.all([
      ctx.db
        .query("pilotAllocations")
        .withIndex("by_request_status", (q) => q.eq("requestId", request._id))
        .collect(),
      ctx.db
        .query("pilotProcurementLots")
        .withIndex("by_request_disposition", (q) =>
          q.eq("requestId", request._id),
        )
        .collect(),
      ctx.db
        .query("pilotFulfilmentPlans")
        .withIndex("by_request", (q) => q.eq("requestId", request._id))
        .collect(),
      ctx.db
        .query("pilotFundingReservations")
        .withIndex("by_request_status", (q) => q.eq("requestId", request._id))
        .collect(),
      ctx.db
        .query("pilotFinancialEntries")
        .withIndex("by_request_created_at", (q) =>
          q.eq("requestId", request._id),
        )
        .collect(),
      ctx.db
        .query("pilotIssues")
        .withIndex("by_request_status", (q) => q.eq("requestId", request._id))
        .collect(),
    ]);
  const lotAllocationIds = new Set(lots.map((lot) => lot.allocationId));
  const releasableAllocations = allocations.filter(
    (allocation) =>
      ["provisional", "committed", "quality_cleared"].includes(
        allocation.status,
      ) &&
      allocation.releasedGrams < allocation.allocatedGrams &&
      !lotAllocationIds.has(allocation._id),
  );
  const activePlans = plans.filter((plan) => plan.status !== "cancelled");
  const activeReservations = reservations.filter((reservation) =>
    ["active", "partly_consumed"].includes(reservation.status),
  );
  const blockingIssues = issues.filter(
    (issue) => issue.status !== "resolved" && issue.status !== "closed",
  );
  const blockers: string[] = [];
  if (lots.length > 0) blockers.push("lot_disposition_required");
  if (activePlans.length > 0) blockers.push("fulfilment_resolution_required");
  if (activeReservations.length > 0)
    blockers.push("funding_resolution_required");
  if (entries.length > 0) blockers.push("financial_resolution_required");
  if (blockingIssues.length > 0) blockers.push("issue_resolution_required");
  return {
    releasableAllocations,
    blockers,
    consequences: {
      allocationsReleased: releasableAllocations.length,
      reservationsReleased: activeReservations.filter(
        (reservation) => reservation.consumedPesewas === 0,
      ).length,
      preservedLots: lots.length,
      issuesRequired: lots.length > 0 ? 1 : 0,
    },
  };
}

async function closeAgreement(
  ctx: MutationCtx,
  input: {
    requestId: Id<"pilotBuyerRequests">;
    agreementRevisionId: Id<"pilotBuyerAgreementRevisions">;
    expectedRequestVersion: number;
    reason: string;
    idempotencyKey: string;
    operationName:
      | "pilotRequests.rejectAgreement"
      | "pilotRequests.withdrawAgreement";
    actor: PilotPrincipal;
    actorKind: "buyer" | "manager";
  },
) {
  const request = await ctx.db.get(input.requestId);
  assertAllowed(request !== null, "Pilot request was not found.");
  if (input.actorKind === "buyer")
    await requireOwnedBuyer(ctx, input.actor, request);
  else await requireRequestManager(ctx, input.actor, request.programmeId);
  assertAllowed(input.reason.trim().length > 0, "A reason is required.");
  const receipt = await beginPilotIdempotency(ctx, {
    programmeId: request.programmeId,
    actorUserId: input.actor._id,
    operationName: input.operationName,
    idempotencyKey: input.idempotencyKey,
    requestHash: JSON.stringify({
      requestId: input.requestId,
      agreementRevisionId: input.agreementRevisionId,
      expectedRequestVersion: input.expectedRequestVersion,
      reason: input.reason,
    }),
  });
  if (receipt.kind === "replay")
    return {
      request: requestSummary(await replayRequest(ctx, receipt.receipt)),
      revisionId: (await replayAgreement(ctx, receipt.receipt))._id,
      revisionState: "withdrawn" as const,
    };
  assertVersion(request, input.expectedRequestVersion);
  const revision = await ctx.db.get(input.agreementRevisionId);
  assertAllowed(
    revision !== null &&
      revision.requestId === request._id &&
      request.currentAgreementRevisionId === revision._id,
    "Agreement revision is not current for this request.",
  );
  assertAllowed(
    revision.state === "proposed" || revision.state === "acknowledged",
    "Agreement revision is no longer open.",
  );
  assertAllowed(
    canTransitionPilotRequest(request.status, "under_review"),
    `Pilot request cannot move from ${request.status} to under_review.`,
  );
  const now = Date.now();
  await invalidateSupplyForAgreement(ctx, request, revision._id);
  await ctx.db.patch(revision._id, { state: "withdrawn" });
  await ctx.db.patch(request._id, {
    status: "under_review",
    currentAgreementRevisionId: undefined,
    confirmedGrams: undefined,
    confirmedAt: undefined,
    version: request.version + 1,
    updatedAt: now,
  });
  const updated = (await ctx.db.get(request._id))!;
  await emit(
    ctx,
    updated,
    "pilot.request.agreement_revised",
    input.actor._id,
    input.reason.trim(),
  );
  await completePilotIdempotency(ctx, receipt.receiptId, [
    { entityType: "pilotBuyerRequests", entityId: request._id },
    { entityType: "pilotBuyerAgreementRevisions", entityId: revision._id },
  ]);
  return {
    request: requestSummary(updated),
    revisionId: revision._id,
    revisionState: "withdrawn" as const,
  };
}

async function invalidateSupplyForAgreement(
  ctx: MutationCtx,
  request: Doc<"pilotBuyerRequests">,
  agreementRevisionId: Id<"pilotBuyerAgreementRevisions">,
) {
  const revisions = await ctx.db
    .query("pilotFarmerOfferRevisions")
    .withIndex("by_request_created_at", (q) => q.eq("requestId", request._id))
    .collect();
  const affectedRevisions = revisions.filter(
    (revision) => revision.buyerAgreementRevisionId === agreementRevisionId,
  );
  for (const revision of affectedRevisions) {
    const reservations = await ctx.db
      .query("pilotFundingReservations")
      .withIndex("by_offer_revision", (q) =>
        q.eq("farmerOfferRevisionId", revision._id),
      )
      .collect();
    assertAllowed(
      reservations.every(
        (reservation) =>
          reservation.status !== "active" &&
          reservation.status !== "partly_consumed",
      ),
      "Funded purchase terms require cancellation and finance resolution.",
    );
  }
  const offerIds = new Set(
    affectedRevisions.map((revision) => revision.offerId),
  );
  const now = Date.now();
  for (const offerId of offerIds) {
    const allocations = await ctx.db
      .query("pilotAllocations")
      .withIndex("by_offer", (q) => q.eq("offerId", offerId))
      .collect();
    for (const allocation of allocations) {
      if (
        !["provisional", "committed", "quality_cleared"].includes(
          allocation.status,
        )
      )
        continue;
      const lots = await ctx.db
        .query("pilotProcurementLots")
        .withIndex("by_allocation", (q) => q.eq("allocationId", allocation._id))
        .collect();
      assertAllowed(
        lots.length === 0,
        "Buyer terms cannot change after collection without cancellation disposition.",
      );
      await ctx.db.patch(allocation._id, {
        releasedGrams: allocation.allocatedGrams,
        status: "released",
        releaseReason: "buyer_agreement_superseded",
        version: allocation.version + 1,
        updatedAt: now,
      });
      const declaration = await ctx.db.get(allocation.declarationId);
      if (declaration !== null && declaration.status === "exhausted")
        await ctx.db.patch(declaration._id, {
          status: "active",
          version: declaration.version + 1,
          updatedAt: now,
        });
    }
    const offer = await ctx.db.get(offerId);
    if (offer !== null && ["draft", "sent", "accepted"].includes(offer.status))
      await ctx.db.patch(offer._id, {
        status: "withdrawn",
        version: offer.version + 1,
        updatedAt: now,
      });
  }
}

export const createDraft = mutation({
  args: {
    programmeId: v.id("pilotProgrammes"),
    maizeType: v.string(),
    requestedGrams: v.number(),
    destination: location,
    deliveryWindowStartAt: v.number(),
    deliveryWindowEndAt: v.number(),
    requestedSpecification: specification,
    paymentExpectation: paymentTerm,
    commercialMode,
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const principal = await requirePilotPrincipal(ctx);
    const buyer = await requireOwnedBuyer(ctx, principal);
    const programme = await ctx.db.get(args.programmeId);
    assertAllowed(programme !== null, "Pilot programme was not found.");
    assertPilotRequestTerms(args);
    assertPilotLocation(args.destination);
    assertAllowed(
      args.maizeType.trim() === args.requestedSpecification.maizeType.trim(),
      "Request and specification maize types must match.",
    );
    const requestHash = JSON.stringify(args);
    const receipt = await beginPilotIdempotency(ctx, {
      programmeId: args.programmeId,
      actorUserId: principal._id,
      operationName: "pilotRequests.createDraft",
      idempotencyKey: args.idempotencyKey,
      requestHash,
    });
    if (receipt.kind === "replay")
      return requestSummary(await replayRequest(ctx, receipt.receipt));
    assertAllowed(
      programme.status === "active",
      "Pilot programme must be active.",
    );
    const now = Date.now();
    const requestId = await ctx.db.insert("pilotBuyerRequests", {
      programmeId: args.programmeId,
      buyerId: buyer._id,
      cropCode: "maize",
      maizeType: args.maizeType.trim(),
      requestedGrams: args.requestedGrams,
      destination: {
        ...args.destination,
        label: args.destination.label.trim(),
      },
      deliveryWindowStartAt: args.deliveryWindowStartAt,
      deliveryWindowEndAt: args.deliveryWindowEndAt,
      requestedSpecification: {
        ...args.requestedSpecification,
        maizeType: args.requestedSpecification.maizeType.trim(),
      },
      paymentExpectation: args.paymentExpectation,
      commercialMode: args.commercialMode,
      status: "draft",
      cancellationState: "none",
      version: 0,
      createdByUserId: principal._id,
      createdAt: now,
      updatedAt: now,
    });
    const request = (await ctx.db.get(requestId))!;
    await emit(
      ctx,
      request,
      "pilot.request.created",
      principal._id,
      "Buyer saved a pilot request draft.",
    );
    await completePilotIdempotency(ctx, receipt.receiptId, [
      { entityType: "pilotBuyerRequests", entityId: requestId },
    ]);
    return requestSummary(request);
  },
});

export const updateDraft = mutation({
  args: {
    requestId: v.id("pilotBuyerRequests"),
    maizeType: v.string(),
    requestedGrams: v.number(),
    destination: location,
    deliveryWindowStartAt: v.number(),
    deliveryWindowEndAt: v.number(),
    requestedSpecification: specification,
    paymentExpectation: paymentTerm,
    commercialMode,
    expectedVersion: v.number(),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const principal = await requirePilotPrincipal(ctx);
    const request = await ctx.db.get(args.requestId);
    assertAllowed(request !== null, "Pilot request was not found.");
    await requireOwnedBuyer(ctx, principal, request);
    assertPilotRequestTerms(args);
    assertPilotLocation(args.destination);
    assertAllowed(
      args.maizeType.trim() === args.requestedSpecification.maizeType.trim(),
      "Request and specification maize types must match.",
    );
    const receipt = await beginPilotIdempotency(ctx, {
      programmeId: request.programmeId,
      actorUserId: principal._id,
      operationName: "pilotRequests.updateDraft",
      idempotencyKey: args.idempotencyKey,
      requestHash: JSON.stringify(args),
    });
    if (receipt.kind === "replay")
      return requestSummary(await replayRequest(ctx, receipt.receipt));
    assertVersion(request, args.expectedVersion);
    assertAllowed(
      request.status === "draft",
      "Only a draft request can be edited.",
    );
    await ctx.db.patch(request._id, {
      maizeType: args.maizeType.trim(),
      requestedGrams: args.requestedGrams,
      destination: {
        ...args.destination,
        label: args.destination.label.trim(),
      },
      deliveryWindowStartAt: args.deliveryWindowStartAt,
      deliveryWindowEndAt: args.deliveryWindowEndAt,
      requestedSpecification: {
        ...args.requestedSpecification,
        maizeType: args.requestedSpecification.maizeType.trim(),
      },
      paymentExpectation: args.paymentExpectation,
      commercialMode: args.commercialMode,
      version: request.version + 1,
      updatedAt: Date.now(),
    });
    const updated = (await ctx.db.get(request._id))!;
    await emit(
      ctx,
      updated,
      "pilot.request.draft_updated",
      principal._id,
      "Buyer updated the pilot request draft.",
    );
    await completePilotIdempotency(ctx, receipt.receiptId, [
      { entityType: "pilotBuyerRequests", entityId: request._id },
    ]);
    return requestSummary(updated);
  },
});

async function transitionRequest(
  ctx: MutationCtx,
  input: {
    requestId: Id<"pilotBuyerRequests">;
    expectedVersion: number;
    idempotencyKey: string;
    nextStatus: "submitted" | "under_review";
    operationName: string;
    eventName: string;
    actor: PilotPrincipal;
  },
) {
  const request = await ctx.db.get(input.requestId);
  assertAllowed(request !== null, "Pilot request was not found.");
  if (input.nextStatus === "submitted")
    await requireOwnedBuyer(ctx, input.actor, request);
  else await requireRequestManager(ctx, input.actor, request.programmeId);
  const receipt = await beginPilotIdempotency(ctx, {
    programmeId: request.programmeId,
    actorUserId: input.actor._id,
    operationName: input.operationName,
    idempotencyKey: input.idempotencyKey,
    requestHash: JSON.stringify({
      requestId: input.requestId,
      expectedVersion: input.expectedVersion,
    }),
  });
  if (receipt.kind === "replay")
    return requestSummary(await replayRequest(ctx, receipt.receipt));
  assertVersion(request, input.expectedVersion);
  assertAllowed(
    canTransitionPilotRequest(request.status, input.nextStatus),
    `Pilot request cannot move from ${request.status} to ${input.nextStatus}.`,
  );
  await ctx.db.patch(request._id, {
    status: input.nextStatus,
    ...(input.nextStatus === "submitted" ? { submittedAt: Date.now() } : {}),
    version: request.version + 1,
    updatedAt: Date.now(),
  });
  const updated = (await ctx.db.get(request._id))!;
  await emit(
    ctx,
    updated,
    input.eventName,
    input.actor._id,
    `Request moved to ${input.nextStatus}.`,
  );
  await completePilotIdempotency(ctx, receipt.receiptId, [
    { entityType: "pilotBuyerRequests", entityId: request._id },
  ]);
  return requestSummary(updated);
}

export const submit = mutation({
  args: {
    requestId: v.id("pilotBuyerRequests"),
    expectedVersion: v.number(),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) =>
    transitionRequest(ctx, {
      ...args,
      nextStatus: "submitted",
      operationName: "pilotRequests.submit",
      eventName: "pilot.request.submitted",
      actor: await requirePilotPrincipal(ctx),
    }),
});
export const beginReview = mutation({
  args: {
    requestId: v.id("pilotBuyerRequests"),
    expectedVersion: v.number(),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) =>
    transitionRequest(ctx, {
      ...args,
      nextStatus: "under_review",
      operationName: "pilotRequests.beginReview",
      eventName: "pilot.request.review_started",
      actor: await requirePilotPrincipal(ctx),
    }),
});

export const createAgreementRevision = mutation({
  args: {
    requestId: v.id("pilotBuyerRequests"),
    quantityGrams: v.number(),
    commercialMode,
    specification,
    producePriceRate: rate,
    chargeTerms: v.array(chargeTerm),
    acceptanceRules: v.array(termClause),
    deliveryWindowStartAt: v.number(),
    deliveryWindowEndAt: v.number(),
    paymentTerms: v.array(paymentTerm),
    cancellationTerms: v.array(termClause),
    expiresAt: v.number(),
    expectedRequestVersion: v.number(),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const principal = await requirePilotPrincipal(ctx);
    const request = await ctx.db.get(args.requestId);
    assertAllowed(request !== null, "Pilot request was not found.");
    await requireRequestManager(ctx, principal, request.programmeId);
    const receipt = await beginPilotIdempotency(ctx, {
      programmeId: request.programmeId,
      actorUserId: principal._id,
      operationName: "pilotRequests.createAgreementRevision",
      idempotencyKey: args.idempotencyKey,
      requestHash: JSON.stringify(args),
    });
    if (receipt.kind === "replay") {
      const revision = await ctx.db.get(
        replayEntityId<"pilotBuyerAgreementRevisions">(
          receipt.receipt,
          "pilotBuyerAgreementRevisions",
        ),
      );
      assertAllowed(
        revision !== null,
        "Idempotent agreement result was not found.",
      );
      return {
        revisionId: revision._id,
        revision: revision.revision,
        requestVersion: (await ctx.db.get(request._id))!.version,
      };
    }
    assertVersion(request, args.expectedRequestVersion);
    assertAllowed(
      request.status === "under_review" || request.status === "quoted",
      "Request must be under review or quoted.",
    );
    assertPilotQuantityGrams(args.quantityGrams);
    assertAllowed(
      args.quantityGrams <= request.requestedGrams,
      "Agreement quantity cannot exceed requested quantity.",
    );
    assertPilotMaizeSpecification(args.specification);
    assertAllowed(
      args.specification.maizeType.trim() === request.maizeType,
      "Agreement maize type must match the request.",
    );
    assertPilotRate(args.producePriceRate);
    assertAllowed(
      args.producePriceRate.unit === "per_kg" ||
        args.producePriceRate.unit === "fixed",
      "Produce price must be per kg or fixed.",
    );
    args.chargeTerms.forEach(assertPilotChargeTerm);
    assertAllowed(args.paymentTerms.length > 0, "Payment terms are required.");
    args.paymentTerms.forEach(assertPilotPaymentTerm);
    validateClauses(args.acceptanceRules, "Acceptance rules");
    validateClauses(args.cancellationTerms, "Cancellation terms");
    assertPilotWindow(
      args.deliveryWindowStartAt,
      args.deliveryWindowEndAt,
      "deliveryWindow",
    );
    assertAllowed(
      args.expiresAt > Date.now(),
      "Agreement expiry must be in the future.",
    );
    assertAllowed(
      args.commercialMode === request.commercialMode,
      "Agreement commercial mode must match the request.",
    );
    const current =
      request.currentAgreementRevisionId === undefined
        ? null
        : await ctx.db.get(request.currentAgreementRevisionId);
    if (
      current !== null &&
      (current.state === "proposed" || current.state === "acknowledged")
    ) {
      await invalidateSupplyForAgreement(ctx, request, current._id);
      await ctx.db.patch(current._id, { state: "superseded" });
    }
    const latestRevision = await ctx.db
      .query("pilotBuyerAgreementRevisions")
      .withIndex("by_request_revision", (q) => q.eq("requestId", request._id))
      .order("desc")
      .first();
    const revisionNumber = (latestRevision?.revision ?? 0) + 1;
    const revisionId = await ctx.db.insert("pilotBuyerAgreementRevisions", {
      requestId: request._id,
      programmeId: request.programmeId,
      revision: revisionNumber,
      ...(current === null ? {} : { supersedesRevisionId: current._id }),
      quantityGrams: args.quantityGrams,
      commercialMode: args.commercialMode,
      specification: {
        ...args.specification,
        maizeType: args.specification.maizeType.trim(),
      },
      producePriceRate: args.producePriceRate,
      chargeTerms: args.chargeTerms,
      acceptanceRules: args.acceptanceRules,
      deliveryWindowStartAt: args.deliveryWindowStartAt,
      deliveryWindowEndAt: args.deliveryWindowEndAt,
      paymentTerms: args.paymentTerms,
      cancellationTerms: args.cancellationTerms,
      expiresAt: args.expiresAt,
      state: "proposed",
      createdByUserId: principal._id,
      createdAt: Date.now(),
    });
    await ctx.db.patch(request._id, {
      status: "quoted",
      currentAgreementRevisionId: revisionId,
      confirmedGrams: undefined,
      confirmedAt: undefined,
      version: request.version + 1,
      updatedAt: Date.now(),
    });
    const updated = (await ctx.db.get(request._id))!;
    await emit(
      ctx,
      updated,
      "pilot.request.agreement_revised",
      principal._id,
      `Agreement revision ${revisionNumber} proposed.`,
    );
    await completePilotIdempotency(ctx, receipt.receiptId, [
      { entityType: "pilotBuyerRequests", entityId: request._id },
      { entityType: "pilotBuyerAgreementRevisions", entityId: revisionId },
    ]);
    return {
      revisionId,
      revision: revisionNumber,
      requestVersion: updated.version,
    };
  },
});

export const acknowledgeAgreement = mutation({
  args: {
    requestId: v.id("pilotBuyerRequests"),
    agreementRevisionId: v.id("pilotBuyerAgreementRevisions"),
    expectedRequestVersion: v.number(),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const principal = await requirePilotPrincipal(ctx);
    const request = await ctx.db.get(args.requestId);
    assertAllowed(request !== null, "Pilot request was not found.");
    await requireOwnedBuyer(ctx, principal, request);
    const receipt = await beginPilotIdempotency(ctx, {
      programmeId: request.programmeId,
      actorUserId: principal._id,
      operationName: "pilotRequests.acknowledgeAgreement",
      idempotencyKey: args.idempotencyKey,
      requestHash: JSON.stringify(args),
    });
    if (receipt.kind === "replay")
      return {
        request: requestSummary(await replayRequest(ctx, receipt.receipt)),
        revisionId: args.agreementRevisionId,
        revisionState: "acknowledged" as const,
      };
    assertVersion(request, args.expectedRequestVersion);
    const revision = await ctx.db.get(args.agreementRevisionId);
    assertAllowed(
      revision !== null &&
        revision.requestId === request._id &&
        request.currentAgreementRevisionId === revision._id,
      "Agreement revision is not current for this request.",
    );
    assertAllowed(
      revision.state === "proposed" && revision.expiresAt > Date.now(),
      "Agreement revision is not available for acknowledgement.",
    );
    const now = Date.now();
    await ctx.db.patch(revision._id, {
      state: "acknowledged",
      buyerAcknowledgedByUserId: principal._id,
      buyerAcknowledgedAt: now,
    });
    await ctx.db.patch(request._id, {
      version: request.version + 1,
      updatedAt: now,
    });
    const updated = (await ctx.db.get(request._id))!;
    await emit(
      ctx,
      updated,
      "pilot.request.agreement_acknowledged",
      principal._id,
      `Buyer acknowledged agreement revision ${revision.revision}.`,
    );
    await completePilotIdempotency(ctx, receipt.receiptId, [
      { entityType: "pilotBuyerRequests", entityId: request._id },
      { entityType: "pilotBuyerAgreementRevisions", entityId: revision._id },
    ]);
    return {
      request: requestSummary(updated),
      revisionId: revision._id,
      revisionState: "acknowledged" as const,
    };
  },
});

export const rejectAgreement = mutation({
  args: {
    requestId: v.id("pilotBuyerRequests"),
    agreementRevisionId: v.id("pilotBuyerAgreementRevisions"),
    expectedRequestVersion: v.number(),
    reason: v.string(),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) =>
    closeAgreement(ctx, {
      ...args,
      operationName: "pilotRequests.rejectAgreement",
      actor: await requirePilotPrincipal(ctx),
      actorKind: "buyer",
    }),
});

export const withdrawAgreement = mutation({
  args: {
    requestId: v.id("pilotBuyerRequests"),
    agreementRevisionId: v.id("pilotBuyerAgreementRevisions"),
    expectedRequestVersion: v.number(),
    reason: v.string(),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) =>
    closeAgreement(ctx, {
      ...args,
      operationName: "pilotRequests.withdrawAgreement",
      actor: await requirePilotPrincipal(ctx),
      actorKind: "manager",
    }),
});

export const confirm = mutation({
  args: {
    requestId: v.id("pilotBuyerRequests"),
    agreementRevisionId: v.id("pilotBuyerAgreementRevisions"),
    confirmedGrams: v.number(),
    expectedRequestVersion: v.number(),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const principal = await requirePilotPrincipal(ctx);
    const request = await ctx.db.get(args.requestId);
    assertAllowed(request !== null, "Pilot request was not found.");
    await requireRequestManager(ctx, principal, request.programmeId);
    const operation = {
      programmeId: request.programmeId,
      actorUserId: principal._id,
      operationName: "pilotRequests.confirm",
      idempotencyKey: args.idempotencyKey,
      requestHash: JSON.stringify(args),
    };
    const replay = await getPilotIdempotencyReplay(ctx, operation);
    if (replay !== null)
      return {
        request: requestSummary(await replayRequest(ctx, replay)),
        committedGrams: args.confirmedGrams,
        readinessBlockers: [] as string[],
      };
    assertVersion(request, args.expectedRequestVersion);
    assertPilotQuantityGrams(args.confirmedGrams);
    const revision = await ctx.db.get(args.agreementRevisionId);
    assertAllowed(
      revision !== null &&
        revision._id === request.currentAgreementRevisionId &&
        revision.requestId === request._id,
      "Agreement revision is not current.",
    );
    const allocations = await ctx.db
      .query("pilotAllocations")
      .withIndex("by_request_status", (q) => q.eq("requestId", request._id))
      .collect();
    let committedGrams = 0;
    for (const allocation of allocations) {
      if (
        allocation.status !== "committed" &&
        allocation.status !== "quality_cleared"
      )
        continue;
      const [offer, offerRevision] = await Promise.all([
        ctx.db.get(allocation.offerId),
        ctx.db.get(allocation.offerRevisionId),
      ]);
      if (
        offer?.status !== "accepted" ||
        offer.acceptedRevisionId !== allocation.offerRevisionId ||
        offerRevision?.buyerAgreementRevisionId !== revision._id
      )
        continue;
      committedGrams += allocation.allocatedGrams - allocation.releasedGrams;
    }
    const blockers = getPilotConfirmationBlockers({
      revisionState: revision.state,
      expiresAt: revision.expiresAt,
      revisionGrams: revision.quantityGrams,
      confirmedGrams: args.confirmedGrams,
      committedGrams,
      now: Date.now(),
    });
    if (blockers.length > 0)
      return {
        request: requestSummary(request),
        committedGrams,
        readinessBlockers: blockers,
      };
    assertAllowed(
      canTransitionPilotRequest(request.status, "confirmed"),
      `Pilot request cannot move from ${request.status} to confirmed.`,
    );
    const receipt = await beginPilotIdempotency(ctx, operation);
    assertAllowed(
      receipt.kind === "started",
      "Confirmation replay was not resolved.",
    );
    const now = Date.now();
    await ctx.db.patch(request._id, {
      status: "confirmed",
      confirmedGrams: args.confirmedGrams,
      confirmedAt: now,
      version: request.version + 1,
      updatedAt: now,
    });
    const updated = (await ctx.db.get(request._id))!;
    await emit(
      ctx,
      updated,
      "pilot.request.confirmed",
      principal._id,
      `${args.confirmedGrams} grams confirmed against accepted commitments.`,
    );
    await completePilotIdempotency(ctx, receipt.receiptId, [
      { entityType: "pilotBuyerRequests", entityId: request._id },
    ]);
    return {
      request: requestSummary(updated),
      committedGrams,
      readinessBlockers: [] as string[],
    };
  },
});

export const requestCancellation = mutation({
  args: {
    requestId: v.id("pilotBuyerRequests"),
    expectedVersion: v.number(),
    reason: v.string(),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const principal = await requirePilotPrincipal(ctx);
    const request = await ctx.db.get(args.requestId);
    assertAllowed(request !== null, "Pilot request was not found.");
    if (principal.role === "buyer")
      await requireOwnedBuyer(ctx, principal, request);
    else await requireRequestManager(ctx, principal, request.programmeId);
    assertAllowed(
      args.reason.trim().length > 0,
      "Cancellation reason is required.",
    );
    const receipt = await beginPilotIdempotency(ctx, {
      programmeId: request.programmeId,
      actorUserId: principal._id,
      operationName: "pilotRequests.requestCancellation",
      idempotencyKey: args.idempotencyKey,
      requestHash: JSON.stringify(args),
    });
    if (receipt.kind === "replay") {
      const replayed = await replayRequest(ctx, receipt.receipt);
      return {
        request: requestSummary(replayed),
        consequences: (await evaluateCancellation(ctx, replayed)).consequences,
      };
    }
    assertVersion(request, args.expectedVersion);
    assertAllowed(
      canTransitionPilotRequest(request.status, "cancelled") &&
        request.cancellationState === "none",
      "Cancellation cannot be requested in the current state.",
    );
    const evaluation = await evaluateCancellation(ctx, request);
    await ctx.db.patch(request._id, {
      cancellationState: "requested",
      version: request.version + 1,
      updatedAt: Date.now(),
    });
    const updated = (await ctx.db.get(request._id))!;
    await emit(
      ctx,
      updated,
      "pilot.request.cancellation_requested",
      principal._id,
      args.reason.trim(),
    );
    await completePilotIdempotency(ctx, receipt.receiptId, [
      { entityType: "pilotBuyerRequests", entityId: request._id },
    ]);
    return {
      request: requestSummary(updated),
      consequences: evaluation.consequences,
    };
  },
});

export const resolveCancellation = mutation({
  args: {
    requestId: v.id("pilotBuyerRequests"),
    expectedVersion: v.number(),
    resolution: v.object({
      outcome: v.literal("cancel"),
      reason: v.string(),
    }),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const principal = await requirePilotPrincipal(ctx);
    const request = await ctx.db.get(args.requestId);
    assertAllowed(request !== null, "Pilot request was not found.");
    await requireRequestManager(ctx, principal, request.programmeId);
    assertAllowed(
      args.resolution.reason.trim().length > 0,
      "Cancellation resolution reason is required.",
    );
    const operation = {
      programmeId: request.programmeId,
      actorUserId: principal._id,
      operationName: "pilotRequests.resolveCancellation",
      idempotencyKey: args.idempotencyKey,
      requestHash: JSON.stringify(args),
    };
    const replay = await getPilotIdempotencyReplay(ctx, operation);
    if (replay !== null)
      return {
        request: requestSummary(await replayRequest(ctx, replay)),
        releasedAllocationIds: replay.resultRefs
          .filter((ref) => ref.entityType === "pilotAllocations")
          .map((ref) => ref.entityId),
        issueIds: [] as string[],
        blockers: [] as string[],
      };
    assertVersion(request, args.expectedVersion);
    assertAllowed(
      request.cancellationState === "requested",
      "Cancellation must be requested before it is resolved.",
    );
    assertAllowed(
      canTransitionPilotRequest(request.status, "cancelled"),
      `Pilot request cannot move from ${request.status} to cancelled.`,
    );
    const evaluation = await evaluateCancellation(ctx, request);
    if (evaluation.blockers.length > 0)
      return {
        request: requestSummary(request),
        releasedAllocationIds: [] as string[],
        issueIds: [] as string[],
        blockers: evaluation.blockers,
      };
    const receipt = await beginPilotIdempotency(ctx, operation);
    assertAllowed(
      receipt.kind === "started",
      "Cancellation replay was not resolved.",
    );
    const now = Date.now();
    const releasedAllocationIds: Id<"pilotAllocations">[] = [];
    for (const allocation of evaluation.releasableAllocations) {
      await ctx.db.patch(allocation._id, {
        releasedGrams: allocation.allocatedGrams,
        status: "cancelled",
        releaseReason: args.resolution.reason.trim(),
        version: allocation.version + 1,
        updatedAt: now,
      });
      releasedAllocationIds.push(allocation._id);
    }
    const offers = await ctx.db
      .query("pilotFarmerOffers")
      .withIndex("by_request_status", (q) => q.eq("requestId", request._id))
      .collect();
    for (const offer of offers) {
      if (["draft", "sent", "accepted"].includes(offer.status))
        await ctx.db.patch(offer._id, {
          status: "withdrawn",
          version: offer.version + 1,
          updatedAt: now,
        });
    }
    if (request.currentAgreementRevisionId !== undefined) {
      const revision = await ctx.db.get(request.currentAgreementRevisionId);
      if (
        revision !== null &&
        (revision.state === "proposed" || revision.state === "acknowledged")
      )
        await ctx.db.patch(revision._id, { state: "withdrawn" });
    }
    await ctx.db.patch(request._id, {
      status: "cancelled",
      cancellationState: "resolved",
      cancelledAt: now,
      version: request.version + 1,
      updatedAt: now,
    });
    const updated = (await ctx.db.get(request._id))!;
    await emit(
      ctx,
      updated,
      "pilot.request.cancelled",
      principal._id,
      args.resolution.reason.trim(),
    );
    await completePilotIdempotency(ctx, receipt.receiptId, [
      { entityType: "pilotBuyerRequests", entityId: request._id },
      ...releasedAllocationIds.map((entityId) => ({
        entityType: "pilotAllocations" as const,
        entityId,
      })),
    ]);
    return {
      request: requestSummary(updated),
      releasedAllocationIds,
      issueIds: [] as string[],
      blockers: [] as string[],
    };
  },
});

export const get = query({
  args: { requestId: v.id("pilotBuyerRequests") },
  handler: async (ctx, args) => {
    const principal = await requirePilotPrincipal(ctx);
    const request = await ctx.db.get(args.requestId);
    if (request === null) return null;
    await requirePilotRequestRead(ctx, principal, request);
    const revision =
      request.currentAgreementRevisionId === undefined
        ? null
        : await ctx.db.get(request.currentAgreementRevisionId);
    const allocations = await ctx.db
      .query("pilotAllocations")
      .withIndex("by_request_status", (q) => q.eq("requestId", request._id))
      .collect();
    const commitmentSummary = allocations.reduce(
      (summary, allocation) => {
        const activeGrams = Math.max(
          0,
          allocation.allocatedGrams - allocation.releasedGrams,
        );
        if (allocation.status === "provisional")
          summary.provisionalGrams += activeGrams;
        if (
          allocation.status === "committed" ||
          allocation.status === "quality_cleared"
        )
          summary.committedGrams += activeGrams;
        if (allocation.status === "quality_cleared")
          summary.clearedGrams += Math.max(
            0,
            allocation.clearedGrams - allocation.releasedGrams,
          );
        return summary;
      },
      { provisionalGrams: 0, committedGrams: 0, clearedGrams: 0 },
    );
    return {
      request: requestSummary(request),
      commitmentSummary,
      agreement:
        revision === null
          ? null
          : {
              revisionId: revision._id,
              revision: revision.revision,
              quantityGrams: revision.quantityGrams,
              commercialMode: revision.commercialMode,
              specification: revision.specification,
              producePriceRate: revision.producePriceRate,
              chargeTerms: revision.chargeTerms,
              acceptanceRules: revision.acceptanceRules,
              deliveryWindowStartAt: revision.deliveryWindowStartAt,
              deliveryWindowEndAt: revision.deliveryWindowEndAt,
              paymentTerms: revision.paymentTerms,
              cancellationTerms: revision.cancellationTerms,
              expiresAt: revision.expiresAt,
              state: revision.state,
              isExpired: revision.expiresAt <= Date.now(),
              buyerAcknowledgedAt: revision.buyerAcknowledgedAt,
            },
    };
  },
});

type RequestListInput = {
  programmeId: Id<"pilotProgrammes">;
  status?: Doc<"pilotBuyerRequests">["status"];
  cursor?: string;
  limit: number;
};

async function listRequests(
  ctx: QueryCtx,
  args: RequestListInput,
  audience: "buyer" | "operations",
) {
  const principal = await requirePilotPrincipal(ctx);
  assertAllowed(
    Number.isSafeInteger(args.limit) && args.limit > 0 && args.limit <= 50,
    "Page limit must be from 1 to 50.",
  );
  const pagination = {
    cursor: args.cursor ?? null,
    numItems: args.limit,
  };
  let result;
  if (audience === "buyer") {
    const buyer = await requireOwnedBuyer(ctx, principal);
    result = await ctx.db
      .query("pilotBuyerRequests")
      .withIndex("by_buyer_programme_status", (q) =>
        args.status === undefined
          ? q.eq("buyerId", buyer._id).eq("programmeId", args.programmeId)
          : q
              .eq("buyerId", buyer._id)
              .eq("programmeId", args.programmeId)
              .eq("status", args.status),
      )
      .order("desc")
      .paginate(pagination);
  } else {
    assertAllowed(
      principal.role !== "buyer",
      "Buyer identities cannot list operations requests.",
    );
    await requirePilotCapability(
      ctx,
      principal,
      args.programmeId,
      "pilot:read",
    );
    result = await ctx.db
      .query("pilotBuyerRequests")
      .withIndex("by_programme_status", (q) =>
        args.status === undefined
          ? q.eq("programmeId", args.programmeId)
          : q.eq("programmeId", args.programmeId).eq("status", args.status),
      )
      .order("desc")
      .paginate(pagination);
  }
  return {
    page: result.page.map(requestSummary),
    ...(result.isDone ? {} : { nextCursor: result.continueCursor }),
    isDone: result.isDone,
  };
}

const requestListArgs = {
  programmeId: v.id("pilotProgrammes"),
  status: v.optional(requestStatus),
  cursor: v.optional(v.string()),
  limit: v.number(),
};

export const listMine = query({
  args: requestListArgs,
  handler: async (ctx, args) => listRequests(ctx, args, "buyer"),
});

export const listAssigned = query({
  args: requestListArgs,
  handler: async (ctx, args) => listRequests(ctx, args, "operations"),
});
