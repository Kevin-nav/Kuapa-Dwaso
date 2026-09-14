import { v } from "convex/values";
import {
  canTransitionPilotOffer,
  pilotSettlementReservationCoversOffer,
} from "@kuapa-dwaso/permissions/pilot";
import {
  calculatePilotOfferAmounts,
  pilotAllocationFits,
} from "@kuapa-dwaso/utils/pilot";
import {
  assertExpectedVersion,
  assertPilotChargeTerm,
  assertPilotFarmerPaymentCommitment,
  assertPilotPaymentTerm,
  assertPilotQuantityGrams,
  assertPilotRate,
} from "@kuapa-dwaso/validators/pilot";
import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import {
  requirePilotCapability,
  requirePilotPrincipal,
  type PilotPrincipal,
} from "./pilotAccess";
import {
  beginPilotIdempotency,
  completePilotIdempotency,
  getPilotIdempotencyReplay,
  replayEntityId,
} from "./pilotIdempotency";
import {
  activeAllocatedGrams,
  activeRequestAllocatedGrams,
  requireOwnFarmer,
} from "./pilotSupply";
import { assertAllowed } from "./workflowHelpers";
import { insertPilotActivityEvent } from "./pilotActivity";

const commercialMode = v.union(
  v.literal("coordination"),
  v.literal("kuapa_purchase"),
);
const rate = v.object({
  numerator: v.number(),
  scale: v.number(),
  unit: v.union(v.literal("per_kg"), v.literal("percent"), v.literal("fixed")),
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
const termClause = v.object({
  code: v.string(),
  label: v.string(),
  detail: v.string(),
});

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

async function requireOfferManager(
  ctx: QueryCtx | MutationCtx,
  principal: PilotPrincipal,
  programmeId: Id<"pilotProgrammes">,
) {
  await requirePilotCapability(ctx, principal, programmeId, "offers:manage");
}

async function getOfferRevision(
  ctx: QueryCtx | MutationCtx,
  offer: Doc<"pilotFarmerOffers">,
) {
  assertAllowed(
    offer.currentRevisionId !== undefined,
    "Offer has no current revision.",
  );
  const revision = await ctx.db.get(offer.currentRevisionId);
  assertAllowed(revision !== null, "Current offer revision was not found.");
  return revision;
}

async function getOfferAllocation(
  ctx: QueryCtx | MutationCtx,
  offerId: Id<"pilotFarmerOffers">,
) {
  const allocations = await ctx.db
    .query("pilotAllocations")
    .withIndex("by_offer", (q) => q.eq("offerId", offerId))
    .collect();
  const active = allocations.filter(
    (allocation) =>
      (allocation.status === "provisional" &&
        (allocation.holdExpiresAt === undefined ||
          allocation.holdExpiresAt > Date.now())) ||
      allocation.status === "committed" ||
      allocation.status === "quality_cleared",
  );
  assertAllowed(
    active.length <= 1,
    "Offer has conflicting active allocations.",
  );
  return active[0] ?? null;
}

async function hasCurrentSettlementReservation(
  ctx: QueryCtx | MutationCtx,
  revision: Doc<"pilotFarmerOfferRevisions">,
): Promise<boolean> {
  const reservations = await ctx.db
    .query("pilotFundingReservations")
    .withIndex("by_offer_revision", (query) =>
      query.eq("farmerOfferRevisionId", revision._id),
    )
    .collect();
  for (const reservation of reservations) {
    if (
      reservation.programmeId !== revision.programmeId ||
      reservation.requestId !== revision.requestId ||
      reservation.buyerAgreementRevisionId !== revision.buyerAgreementRevisionId
    )
      continue;
    const budget = await ctx.db.get(reservation.budgetId);
    if (
      budget !== null &&
      budget.programmeId === revision.programmeId &&
      pilotSettlementReservationCoversOffer({
        expectedNetPesewas: revision.expectedNetPesewas,
        offerExpiresAt: revision.expiresAt,
        now: Date.now(),
        reservation,
        budget,
      })
    )
      return true;
  }
  return false;
}

async function offerSummary(
  ctx: QueryCtx | MutationCtx,
  offer: Doc<"pilotFarmerOffers">,
) {
  const revision = await getOfferRevision(ctx, offer);
  const allocation = await getOfferAllocation(ctx, offer._id);
  const finalAmounts =
    allocation?.status === "quality_cleared"
      ? calculatePilotOfferAmounts({
          offeredGrams: allocation.clearedGrams,
          priceRate: revision.priceRate,
          chargeTerms: revision.chargeTerms,
        })
      : null;
  return {
    offerId: offer._id,
    programmeId: offer.programmeId,
    requestId: offer.requestId,
    declarationId: offer.declarationId,
    farmerId: offer.farmerId,
    commercialMode: offer.commercialMode,
    status: offer.status,
    version: offer.version,
    expiresAt: offer.expiresAt,
    currentRevision: {
      revisionId: revision._id,
      revision: revision.revision,
      buyerAgreementRevisionId: revision.buyerAgreementRevisionId,
      offeredGrams: revision.offeredGrams,
      priceBasis: revision.priceBasis,
      priceRate: revision.priceRate,
      chargeTerms: revision.chargeTerms,
      expectedGrossPesewas: revision.expectedGrossPesewas,
      expectedChargesPesewas: revision.expectedChargesPesewas,
      expectedNetPesewas: revision.expectedNetPesewas,
      inspectionTerms: revision.inspectionTerms,
      paymentTerms: revision.paymentTerms,
      titleTransferTerms: revision.titleTransferTerms,
      custodyTransferTerms: revision.custodyTransferTerms,
      cancellationTerms: revision.cancellationTerms,
      expiresAt: revision.expiresAt,
    },
    allocation:
      allocation === null
        ? null
        : {
            allocationId: allocation._id,
            status: allocation.status,
            allocatedGrams: allocation.allocatedGrams,
            releasedGrams: allocation.releasedGrams,
            activeGrams: allocation.allocatedGrams - allocation.releasedGrams,
            clearedGrams: allocation.clearedGrams,
            version: allocation.version,
          },
    finalAmounts,
  };
}

async function emitOfferEvent(
  ctx: MutationCtx,
  offer: Doc<"pilotFarmerOffers">,
  eventName: string,
  actorUserId: Id<"users">,
  detail: string,
) {
  await insertPilotActivityEvent(ctx, {
    programmeId: offer.programmeId,
    requestId: offer.requestId,
    entityType: "pilotFarmerOffers",
    entityId: offer._id,
    entityRevision: offer.version,
    eventName,
    actorUserId,
    recipientViews: [
      {
        audience: "farmer",
        targetId: offer.farmerId,
        title: eventName.replaceAll(".", " "),
        detail,
      },
      { audience: "pilot_ops", title: eventName.replaceAll(".", " "), detail },
    ],
    createdAt: Date.now(),
  });
}

async function releaseProvisionalAllocations(
  ctx: MutationCtx,
  offerId: Id<"pilotFarmerOffers">,
  reason: string,
) {
  const allocations = await ctx.db
    .query("pilotAllocations")
    .withIndex("by_offer", (q) => q.eq("offerId", offerId))
    .collect();
  const released: Id<"pilotAllocations">[] = [];
  const now = Date.now();
  for (const allocation of allocations) {
    if (allocation.status !== "provisional") continue;
    await ctx.db.patch(allocation._id, {
      releasedGrams: allocation.allocatedGrams,
      status: "released",
      releaseReason: reason,
      version: allocation.version + 1,
      updatedAt: now,
    });
    released.push(allocation._id);
  }
  return released;
}

async function releaseUncollectedAllocations(
  ctx: MutationCtx,
  offerId: Id<"pilotFarmerOffers">,
  reason: string,
) {
  const allocations = await ctx.db
    .query("pilotAllocations")
    .withIndex("by_offer", (q) => q.eq("offerId", offerId))
    .collect();
  const released: Id<"pilotAllocations">[] = [];
  const now = Date.now();
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
      "Collected supply requires cancellation and lot disposition.",
    );
    await ctx.db.patch(allocation._id, {
      releasedGrams: allocation.allocatedGrams,
      status: "released",
      releaseReason: reason,
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
    released.push(allocation._id);
  }
  return released;
}

async function replayOffer(
  ctx: MutationCtx,
  receipt: Doc<"pilotIdempotencyKeys">,
) {
  const offer = await ctx.db.get(
    replayEntityId<"pilotFarmerOffers">(receipt, "pilotFarmerOffers"),
  );
  assertAllowed(offer !== null, "Idempotent offer was not found.");
  return offer;
}

export const createRevision = mutation({
  args: {
    requestId: v.id("pilotBuyerRequests"),
    declarationId: v.id("pilotSupplyDeclarations"),
    buyerAgreementRevisionId: v.id("pilotBuyerAgreementRevisions"),
    commercialMode,
    offeredGrams: v.number(),
    priceBasis: v.union(v.literal("per_kg"), v.literal("fixed_lot")),
    priceRate: rate,
    chargeTerms: v.array(chargeTerm),
    inspectionTerms: v.array(termClause),
    paymentTerms: v.array(paymentTerm),
    titleTransferTerms: v.array(termClause),
    custodyTransferTerms: v.array(termClause),
    cancellationTerms: v.array(termClause),
    expiresAt: v.number(),
    expectedRequestVersion: v.number(),
    expectedDeclarationVersion: v.number(),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const principal = await requirePilotPrincipal(ctx);
    const request = await ctx.db.get(args.requestId);
    const declaration = await ctx.db.get(args.declarationId);
    assertAllowed(
      request !== null && declaration !== null,
      "Request or declaration was not found.",
    );
    assertAllowed(
      request.programmeId === declaration.programmeId,
      "Request and declaration belong to different programmes.",
    );
    await requireOfferManager(ctx, principal, request.programmeId);
    const operation = {
      programmeId: request.programmeId,
      actorUserId: principal._id,
      operationName: "pilotOffers.createRevision",
      idempotencyKey: args.idempotencyKey,
      requestHash: JSON.stringify(args),
    };
    const replay = await getPilotIdempotencyReplay(ctx, operation);
    if (replay !== null) {
      const offer = await replayOffer(ctx, replay);
      const revisionId = replayEntityId<"pilotFarmerOfferRevisions">(
        replay,
        "pilotFarmerOfferRevisions",
      );
      return { offerId: offer._id, revisionId, version: offer.version };
    }
    assertExpectedVersion(args.expectedRequestVersion);
    assertExpectedVersion(args.expectedDeclarationVersion);
    assertAllowed(
      request.version === args.expectedRequestVersion,
      "Request changed. Refresh and retry.",
    );
    assertAllowed(
      declaration.version === args.expectedDeclarationVersion,
      "Declaration changed. Refresh and retry.",
    );
    assertAllowed(
      request.status === "quoted" || request.status === "confirmed",
      "Request must have current buyer terms before a farmer offer is prepared.",
    );
    assertAllowed(
      declaration.status === "active" &&
        declaration.verificationStatus === "reviewed",
      "Supply declaration must be active and reviewed.",
    );
    assertAllowed(
      declaration.maizeType === request.maizeType,
      "Declaration maize type does not match the request.",
    );
    assertAllowed(
      request.commercialMode === args.commercialMode,
      "Offer mode must match the request.",
    );
    const agreement = await ctx.db.get(args.buyerAgreementRevisionId);
    assertAllowed(
      agreement !== null &&
        agreement._id === request.currentAgreementRevisionId &&
        agreement.requestId === request._id &&
        agreement.state === "acknowledged" &&
        agreement.expiresAt > Date.now(),
      "Buyer agreement revision is not current and acknowledged.",
    );
    assertPilotQuantityGrams(args.offeredGrams, "offeredGrams");
    assertAllowed(
      args.offeredGrams <= declaration.availableGrams,
      "Offer exceeds declared supply.",
    );
    assertPilotRate(args.priceRate);
    assertAllowed(
      (args.priceBasis === "per_kg" && args.priceRate.unit === "per_kg") ||
        (args.priceBasis === "fixed_lot" && args.priceRate.unit === "fixed"),
      "Price basis and rate unit do not match.",
    );
    for (const term of args.chargeTerms) assertPilotChargeTerm(term);
    for (const term of args.paymentTerms) assertPilotPaymentTerm(term);
    assertPilotFarmerPaymentCommitment(args.commercialMode, args.paymentTerms);
    validateClauses(args.inspectionTerms, "Inspection terms");
    validateClauses(args.titleTransferTerms, "Title transfer terms");
    validateClauses(args.custodyTransferTerms, "Custody transfer terms");
    validateClauses(args.cancellationTerms, "Cancellation terms");
    assertAllowed(
      args.expiresAt > Date.now() && args.expiresAt <= agreement.expiresAt,
      "Offer expiry must be in the future and no later than buyer terms.",
    );
    const farmerPaymentTerm = args.paymentTerms[0]!;
    if (farmerPaymentTerm.trigger === "fixed_date")
      assertAllowed(
        farmerPaymentTerm.fixedDueAt !== undefined &&
          farmerPaymentTerm.fixedDueAt >= args.expiresAt,
        "A fixed farmer payment date cannot fall before the offer expires.",
      );
    const totals = calculatePilotOfferAmounts(args);
    const candidates = await ctx.db
      .query("pilotFarmerOffers")
      .withIndex("by_declaration_status", (q) =>
        q.eq("declarationId", declaration._id),
      )
      .collect();
    const openOffers = candidates.filter(
      (candidate) =>
        candidate.requestId === request._id &&
        !["declined", "expired", "withdrawn"].includes(candidate.status),
    );
    assertAllowed(
      openOffers.length <= 1,
      "Declaration has conflicting open offers for this request.",
    );
    let offer = openOffers[0];
    if (offer !== undefined)
      assertAllowed(
        offer.status !== "accepted",
        "Accepted offer terms cannot be revised while committed.",
      );
    if (offer?.currentRevisionId !== undefined) {
      const reservations = await ctx.db
        .query("pilotFundingReservations")
        .withIndex("by_offer_revision", (query) =>
          query.eq("farmerOfferRevisionId", offer!.currentRevisionId!),
        )
        .collect();
      assertAllowed(
        reservations.every(
          (reservation) =>
            reservation.status !== "active" &&
            reservation.status !== "partly_consumed",
        ),
        "Release the current settlement reservation before revising this offer.",
      );
    }
    const receipt = await beginPilotIdempotency(ctx, operation);
    assertAllowed(
      receipt.kind === "started",
      "Offer revision replay was not resolved.",
    );
    const now = Date.now();
    if (offer === undefined) {
      const offerId = await ctx.db.insert("pilotFarmerOffers", {
        programmeId: request.programmeId,
        requestId: request._id,
        declarationId: declaration._id,
        farmerId: declaration.farmerId,
        commercialMode: args.commercialMode,
        status: "draft",
        expiresAt: args.expiresAt,
        version: 0,
        createdAt: now,
        updatedAt: now,
      });
      offer = (await ctx.db.get(offerId))!;
    } else {
      await releaseProvisionalAllocations(
        ctx,
        offer._id,
        "offer_terms_superseded",
      );
    }
    const current =
      offer.currentRevisionId === undefined
        ? null
        : await ctx.db.get(offer.currentRevisionId);
    const revisionId = await ctx.db.insert("pilotFarmerOfferRevisions", {
      offerId: offer._id,
      programmeId: request.programmeId,
      requestId: request._id,
      declarationId: declaration._id,
      buyerAgreementRevisionId: agreement._id,
      revision: (current?.revision ?? 0) + 1,
      ...(current === null ? {} : { supersedesRevisionId: current._id }),
      commercialMode: args.commercialMode,
      offeredGrams: args.offeredGrams,
      priceBasis: args.priceBasis,
      priceRate: args.priceRate,
      chargeTerms: args.chargeTerms,
      ...totals,
      inspectionTerms: args.inspectionTerms,
      paymentTerms: args.paymentTerms,
      titleTransferTerms: args.titleTransferTerms,
      custodyTransferTerms: args.custodyTransferTerms,
      cancellationTerms: args.cancellationTerms,
      expiresAt: args.expiresAt,
      createdByUserId: principal._id,
      createdAt: now,
    });
    await ctx.db.patch(offer._id, {
      currentRevisionId: revisionId,
      acceptedRevisionId: undefined,
      decisionAt: undefined,
      status: "draft",
      expiresAt: args.expiresAt,
      version: offer.version + 1,
      updatedAt: now,
    });
    await completePilotIdempotency(ctx, receipt.receiptId, [
      { entityType: "pilotFarmerOffers", entityId: offer._id },
      { entityType: "pilotFarmerOfferRevisions", entityId: revisionId },
    ]);
    return { offerId: offer._id, revisionId, version: offer.version + 1 };
  },
});

export const send = mutation({
  args: {
    offerId: v.id("pilotFarmerOffers"),
    revisionId: v.id("pilotFarmerOfferRevisions"),
    expectedOfferVersion: v.number(),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const principal = await requirePilotPrincipal(ctx);
    const offer = await ctx.db.get(args.offerId);
    assertAllowed(offer !== null, "Offer was not found.");
    await requireOfferManager(ctx, principal, offer.programmeId);
    const receipt = await beginPilotIdempotency(ctx, {
      programmeId: offer.programmeId,
      actorUserId: principal._id,
      operationName: "pilotOffers.send",
      idempotencyKey: args.idempotencyKey,
      requestHash: JSON.stringify(args),
    });
    if (receipt.kind === "replay")
      return offerSummary(ctx, await replayOffer(ctx, receipt.receipt));
    assertExpectedVersion(args.expectedOfferVersion);
    const revision = await ctx.db.get(args.revisionId);
    const request = await ctx.db.get(offer.requestId);
    assertAllowed(
      revision !== null && request !== null,
      "Offer terms were not found.",
    );
    assertAllowed(
      offer.version === args.expectedOfferVersion &&
        canTransitionPilotOffer(offer.status, "sent") &&
        offer.currentRevisionId === revision._id &&
        revision.expiresAt > Date.now() &&
        request.currentAgreementRevisionId ===
          revision.buyerAgreementRevisionId,
      "Offer changed, expired, or no longer matches current buyer terms.",
    );
    await ctx.db.patch(offer._id, {
      status: "sent",
      version: offer.version + 1,
      updatedAt: Date.now(),
    });
    const updated = (await ctx.db.get(offer._id))!;
    await emitOfferEvent(
      ctx,
      updated,
      "pilot.offer.sent",
      principal._id,
      "Farmer offer sent for review.",
    );
    await completePilotIdempotency(ctx, receipt.receiptId, [
      { entityType: "pilotFarmerOffers", entityId: offer._id },
    ]);
    return offerSummary(ctx, updated);
  },
});

export const decide = mutation({
  args: {
    offerId: v.id("pilotFarmerOffers"),
    revisionId: v.id("pilotFarmerOfferRevisions"),
    decision: v.union(v.literal("accepted"), v.literal("declined")),
    expectedOfferVersion: v.number(),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const principal = await requirePilotPrincipal(ctx);
    const farmer = await requireOwnFarmer(ctx, principal);
    const offer = await ctx.db.get(args.offerId);
    assertAllowed(
      offer !== null && offer.farmerId === farmer._id,
      "Offer belongs to another farmer.",
    );
    const operation = {
      programmeId: offer.programmeId,
      actorUserId: principal._id,
      operationName: "pilotOffers.decide",
      idempotencyKey: args.idempotencyKey,
      requestHash: JSON.stringify(args),
    };
    const replay = await getPilotIdempotencyReplay(ctx, operation);
    if (replay !== null)
      return offerSummary(ctx, await replayOffer(ctx, replay));
    assertExpectedVersion(args.expectedOfferVersion);
    const revision = await ctx.db.get(args.revisionId);
    const request = await ctx.db.get(offer.requestId);
    const declaration = await ctx.db.get(offer.declarationId);
    assertAllowed(
      revision !== null && request !== null && declaration !== null,
      "Offer terms, request, or declaration were not found.",
    );
    assertAllowed(
      offer.version === args.expectedOfferVersion &&
        canTransitionPilotOffer(offer.status, args.decision) &&
        offer.currentRevisionId === revision._id,
      "Offer changed or this is not its current sent revision.",
    );
    let agreement: Doc<"pilotBuyerAgreementRevisions"> | null = null;
    if (args.decision === "accepted") {
      assertAllowed(
        revision.expiresAt > Date.now() &&
          declaration.status === "active" &&
          request.currentAgreementRevisionId ===
            revision.buyerAgreementRevisionId &&
          request.commercialMode === revision.commercialMode,
        "Offer expired or no longer matches current terms and supply.",
      );
      agreement = await ctx.db.get(revision.buyerAgreementRevisionId);
      assertAllowed(
        agreement !== null &&
          agreement.state === "acknowledged" &&
          agreement.expiresAt > Date.now(),
        "Buyer terms are no longer acknowledged and current.",
      );
      assertAllowed(
        await hasCurrentSettlementReservation(ctx, revision),
        "Offer acceptance requires reserved farmer payment capacity.",
      );
    }
    const receipt = await beginPilotIdempotency(ctx, operation);
    assertAllowed(
      receipt.kind === "started",
      "Offer decision replay was not resolved.",
    );
    const now = Date.now();
    let allocation = await getOfferAllocation(ctx, offer._id);
    if (args.decision === "declined") {
      await releaseProvisionalAllocations(
        ctx,
        offer._id,
        "farmer_declined_offer",
      );
    } else {
      assertAllowed(agreement !== null, "Buyer terms were not found.");
      const currentlyAllocated = await activeAllocatedGrams(
        ctx,
        declaration._id,
      );
      const currentOfferGrams =
        allocation === null
          ? 0
          : allocation.allocatedGrams - allocation.releasedGrams;
      assertAllowed(
        pilotAllocationFits({
          declaredGrams: declaration.availableGrams,
          activeAllocatedGrams: currentlyAllocated,
          proposedGrams: revision.offeredGrams,
          replacingActiveGrams: currentOfferGrams,
        }),
        "Declared quantity is already committed to another request.",
      );
      assertAllowed(
        pilotAllocationFits({
          declaredGrams: agreement.quantityGrams,
          activeAllocatedGrams: await activeRequestAllocatedGrams(
            ctx,
            request._id,
          ),
          proposedGrams: revision.offeredGrams,
          replacingActiveGrams: currentOfferGrams,
        }),
        "Offer would commit more than the current buyer agreement quantity.",
      );
      if (allocation === null) {
        const allocationId = await ctx.db.insert("pilotAllocations", {
          programmeId: offer.programmeId,
          requestId: offer.requestId,
          declarationId: offer.declarationId,
          offerId: offer._id,
          offerRevisionId: revision._id,
          farmerId: offer.farmerId,
          commercialMode: offer.commercialMode,
          allocatedGrams: revision.offeredGrams,
          clearedGrams: 0,
          releasedGrams: 0,
          status: "committed",
          version: 0,
          createdAt: now,
          updatedAt: now,
        });
        allocation = (await ctx.db.get(allocationId))!;
      } else {
        assertAllowed(
          allocation.status === "provisional" &&
            allocation.offerRevisionId === revision._id,
          "Only the current provisional allocation can be committed.",
        );
        await ctx.db.patch(allocation._id, {
          allocatedGrams: revision.offeredGrams,
          releasedGrams: 0,
          status: "committed",
          holdExpiresAt: undefined,
          version: allocation.version + 1,
          updatedAt: now,
        });
        allocation = (await ctx.db.get(allocation._id))!;
      }
      const totalAfter =
        currentlyAllocated - currentOfferGrams + revision.offeredGrams;
      if (totalAfter === declaration.availableGrams)
        await ctx.db.patch(declaration._id, {
          status: "exhausted",
          version: declaration.version + 1,
          updatedAt: now,
        });
    }
    await ctx.db.patch(offer._id, {
      status: args.decision,
      ...(args.decision === "accepted"
        ? { acceptedRevisionId: revision._id }
        : {}),
      decisionAt: now,
      version: offer.version + 1,
      updatedAt: now,
    });
    const updated = (await ctx.db.get(offer._id))!;
    await emitOfferEvent(
      ctx,
      updated,
      args.decision === "accepted"
        ? "pilot.offer.accepted"
        : "pilot.offer.declined",
      principal._id,
      args.decision === "accepted"
        ? `Farmer accepted ${revision.offeredGrams} grams at expected net ${revision.expectedNetPesewas} pesewas.`
        : "Farmer declined the offer; no charge or penalty was recorded.",
    );
    await completePilotIdempotency(ctx, receipt.receiptId, [
      { entityType: "pilotFarmerOffers", entityId: offer._id },
      ...(allocation === null
        ? []
        : [
            {
              entityType: "pilotAllocations" as const,
              entityId: allocation._id,
            },
          ]),
    ]);
    return offerSummary(ctx, updated);
  },
});

export const get = query({
  args: { offerId: v.id("pilotFarmerOffers") },
  handler: async (ctx, args) => {
    const principal = await requirePilotPrincipal(ctx);
    const farmer = await requireOwnFarmer(ctx, principal);
    const offer = await ctx.db.get(args.offerId);
    assertAllowed(
      offer !== null && offer.farmerId === farmer._id,
      "Offer belongs to another farmer.",
    );
    return await offerSummary(ctx, offer);
  },
});

async function closeOffer(
  ctx: MutationCtx,
  input: {
    offerId: Id<"pilotFarmerOffers">;
    expectedOfferVersion: number;
    reason: string;
    idempotencyKey: string;
    outcome: "expired" | "withdrawn";
    principal: PilotPrincipal;
  },
) {
  const offer = await ctx.db.get(input.offerId);
  assertAllowed(offer !== null, "Offer was not found.");
  if (input.outcome === "withdrawn") {
    const farmer = await requireOwnFarmer(ctx, input.principal);
    assertAllowed(
      offer.farmerId === farmer._id,
      "Offer belongs to another farmer.",
    );
  } else if (input.principal.role === "farmer") {
    const farmer = await requireOwnFarmer(ctx, input.principal);
    assertAllowed(
      offer.farmerId === farmer._id,
      "Offer belongs to another farmer.",
    );
  } else await requireOfferManager(ctx, input.principal, offer.programmeId);
  assertAllowed(input.reason.trim().length > 0, "A reason is required.");
  const receipt = await beginPilotIdempotency(ctx, {
    programmeId: offer.programmeId,
    actorUserId: input.principal._id,
    operationName: `pilotOffers.${input.outcome}`,
    idempotencyKey: input.idempotencyKey,
    requestHash: JSON.stringify({
      offerId: input.offerId,
      expectedOfferVersion: input.expectedOfferVersion,
      reason: input.reason,
      outcome: input.outcome,
    }),
  });
  if (receipt.kind === "replay")
    return offerSummary(ctx, await replayOffer(ctx, receipt.receipt));
  assertExpectedVersion(input.expectedOfferVersion);
  assertAllowed(
    offer.version === input.expectedOfferVersion,
    "Offer changed. Refresh and retry.",
  );
  assertAllowed(
    canTransitionPilotOffer(offer.status, input.outcome),
    "Offer can no longer be closed.",
  );
  if (input.outcome === "expired")
    assertAllowed(offer.expiresAt <= Date.now(), "Offer has not expired.");
  const released =
    input.outcome === "withdrawn"
      ? await releaseUncollectedAllocations(ctx, offer._id, input.reason.trim())
      : await releaseProvisionalAllocations(
          ctx,
          offer._id,
          input.reason.trim(),
        );
  await ctx.db.patch(offer._id, {
    status: input.outcome,
    decisionAt: Date.now(),
    version: offer.version + 1,
    updatedAt: Date.now(),
  });
  const updated = (await ctx.db.get(offer._id))!;
  await emitOfferEvent(
    ctx,
    updated,
    input.outcome === "expired"
      ? "pilot.offer.expired"
      : "pilot.offer.declined",
    input.principal._id,
    input.reason.trim(),
  );
  await completePilotIdempotency(ctx, receipt.receiptId, [
    { entityType: "pilotFarmerOffers", entityId: offer._id },
    ...released.map((entityId) => ({
      entityType: "pilotAllocations" as const,
      entityId,
    })),
  ]);
  return offerSummary(ctx, updated);
}

export const expire = mutation({
  args: {
    offerId: v.id("pilotFarmerOffers"),
    expectedOfferVersion: v.number(),
    reason: v.string(),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) =>
    closeOffer(ctx, {
      ...args,
      outcome: "expired",
      principal: await requirePilotPrincipal(ctx),
    }),
});

export const withdraw = mutation({
  args: {
    offerId: v.id("pilotFarmerOffers"),
    expectedOfferVersion: v.number(),
    reason: v.string(),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) =>
    closeOffer(ctx, {
      ...args,
      outcome: "withdrawn",
      principal: await requirePilotPrincipal(ctx),
    }),
});

export { offerSummary, releaseProvisionalAllocations, requireOfferManager };
