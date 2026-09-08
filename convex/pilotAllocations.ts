import { v } from "convex/values";
import { pilotAllocationFits } from "@kuapa-dwaso/utils/pilot";
import {
  assertExpectedVersion,
  assertPilotQuantityGrams,
} from "@kuapa-dwaso/validators/pilot";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, type MutationCtx } from "./_generated/server";
import { requirePilotPrincipal } from "./pilotAccess";
import {
  beginPilotIdempotency,
  completePilotIdempotency,
  replayEntityId,
} from "./pilotIdempotency";
import { requireOfferManager } from "./pilotOffers";
import {
  activeAllocatedGrams,
  activeRequestAllocatedGrams,
} from "./pilotSupply";
import { assertAllowed } from "./workflowHelpers";

function allocationSummary(allocation: Doc<"pilotAllocations">) {
  return {
    allocationId: allocation._id,
    programmeId: allocation.programmeId,
    requestId: allocation.requestId,
    declarationId: allocation.declarationId,
    offerId: allocation.offerId,
    offerRevisionId: allocation.offerRevisionId,
    farmerId: allocation.farmerId,
    commercialMode: allocation.commercialMode,
    allocatedGrams: allocation.allocatedGrams,
    clearedGrams: allocation.clearedGrams,
    releasedGrams: allocation.releasedGrams,
    activeGrams: allocation.allocatedGrams - allocation.releasedGrams,
    status: allocation.status,
    holdExpiresAt: allocation.holdExpiresAt,
    releaseReason: allocation.releaseReason,
    version: allocation.version,
  };
}

async function replayAllocation(
  ctx: MutationCtx,
  receipt: Doc<"pilotIdempotencyKeys">,
) {
  const allocation = await ctx.db.get(
    replayEntityId<"pilotAllocations">(receipt, "pilotAllocations"),
  );
  assertAllowed(allocation !== null, "Idempotent allocation was not found.");
  return allocation;
}

async function emitAllocationEvent(
  ctx: MutationCtx,
  allocation: Doc<"pilotAllocations">,
  eventName: string,
  actorUserId: Id<"users">,
  detail: string,
) {
  await ctx.db.insert("pilotActivityEvents", {
    programmeId: allocation.programmeId,
    requestId: allocation.requestId,
    entityType: "pilotAllocations",
    entityId: allocation._id,
    entityRevision: allocation.version,
    eventName,
    actorUserId,
    recipientViews: [
      {
        audience: "farmer",
        targetId: allocation.farmerId,
        title: eventName.replaceAll(".", " "),
        detail,
      },
      { audience: "pilot_ops", title: eventName.replaceAll(".", " "), detail },
    ],
    createdAt: Date.now(),
  });
}

export const hold = mutation({
  args: {
    offerId: v.id("pilotFarmerOffers"),
    offerRevisionId: v.id("pilotFarmerOfferRevisions"),
    grams: v.number(),
    expiresAt: v.number(),
    expectedOfferVersion: v.number(),
    expectedDeclarationVersion: v.number(),
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
      operationName: "pilotAllocations.hold",
      idempotencyKey: args.idempotencyKey,
      requestHash: JSON.stringify(args),
    });
    if (receipt.kind === "replay")
      return allocationSummary(await replayAllocation(ctx, receipt.receipt));
    assertExpectedVersion(args.expectedOfferVersion);
    assertExpectedVersion(args.expectedDeclarationVersion);
    assertPilotQuantityGrams(args.grams, "holdGrams");
    const revision = await ctx.db.get(args.offerRevisionId);
    const declaration = await ctx.db.get(offer.declarationId);
    assertAllowed(
      revision !== null &&
        declaration !== null &&
        offer.version === args.expectedOfferVersion &&
        declaration.version === args.expectedDeclarationVersion &&
        offer.currentRevisionId === revision._id &&
        ["draft", "sent"].includes(offer.status) &&
        declaration.status === "active" &&
        args.grams <= revision.offeredGrams &&
        args.expiresAt > Date.now() &&
        args.expiresAt <= revision.expiresAt,
      "Hold is stale, too large, expired, or no longer eligible.",
    );
    assertAllowed(
      (
        await ctx.db
          .query("pilotAllocations")
          .withIndex("by_offer", (q) => q.eq("offerId", offer._id))
          .collect()
      ).every(
        (allocation) =>
          !(
            (allocation.status === "provisional" &&
              (allocation.holdExpiresAt === undefined ||
                allocation.holdExpiresAt > Date.now())) ||
            allocation.status === "committed" ||
            allocation.status === "quality_cleared"
          ),
      ),
      "Offer already has an active allocation.",
    );
    assertAllowed(
      pilotAllocationFits({
        declaredGrams: declaration.availableGrams,
        activeAllocatedGrams: await activeAllocatedGrams(ctx, declaration._id),
        proposedGrams: args.grams,
      }),
      "Declared quantity is already allocated to another request.",
    );
    const agreement = await ctx.db.get(revision.buyerAgreementRevisionId);
    assertAllowed(
      agreement !== null &&
        pilotAllocationFits({
          declaredGrams: agreement.quantityGrams,
          activeAllocatedGrams: await activeRequestAllocatedGrams(
            ctx,
            offer.requestId,
          ),
          proposedGrams: args.grams,
        }),
      "Hold would exceed the current buyer agreement quantity.",
    );
    const now = Date.now();
    const allocationId = await ctx.db.insert("pilotAllocations", {
      programmeId: offer.programmeId,
      requestId: offer.requestId,
      declarationId: offer.declarationId,
      offerId: offer._id,
      offerRevisionId: revision._id,
      farmerId: offer.farmerId,
      commercialMode: offer.commercialMode,
      allocatedGrams: args.grams,
      clearedGrams: 0,
      releasedGrams: 0,
      status: "provisional",
      holdExpiresAt: args.expiresAt,
      version: 0,
      createdAt: now,
      updatedAt: now,
    });
    const allocation = (await ctx.db.get(allocationId))!;
    await emitAllocationEvent(
      ctx,
      allocation,
      "pilot.allocation.held",
      principal._id,
      `${args.grams} grams held provisionally until ${args.expiresAt}.`,
    );
    await completePilotIdempotency(ctx, receipt.receiptId, [
      { entityType: "pilotAllocations", entityId: allocationId },
    ]);
    return allocationSummary(allocation);
  },
});

export const release = mutation({
  args: {
    allocationId: v.id("pilotAllocations"),
    grams: v.number(),
    reason: v.string(),
    expectedVersion: v.number(),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const principal = await requirePilotPrincipal(ctx);
    const allocation = await ctx.db.get(args.allocationId);
    assertAllowed(allocation !== null, "Allocation was not found.");
    await requireOfferManager(ctx, principal, allocation.programmeId);
    const receipt = await beginPilotIdempotency(ctx, {
      programmeId: allocation.programmeId,
      actorUserId: principal._id,
      operationName: "pilotAllocations.release",
      idempotencyKey: args.idempotencyKey,
      requestHash: JSON.stringify(args),
    });
    if (receipt.kind === "replay")
      return allocationSummary(await replayAllocation(ctx, receipt.receipt));
    assertExpectedVersion(args.expectedVersion);
    assertPilotQuantityGrams(args.grams, "releaseGrams");
    assertAllowed(args.reason.trim().length > 0, "Release reason is required.");
    const activeGrams = allocation.allocatedGrams - allocation.releasedGrams;
    assertAllowed(
      allocation.version === args.expectedVersion &&
        ["provisional", "committed", "quality_cleared"].includes(
          allocation.status,
        ) &&
        args.grams <= activeGrams,
      "Allocation changed or release exceeds active quantity.",
    );
    const lots = await ctx.db
      .query("pilotProcurementLots")
      .withIndex("by_allocation", (q) => q.eq("allocationId", allocation._id))
      .collect();
    assertAllowed(
      lots.length === 0,
      "Collected allocation requires lot disposition instead of release.",
    );
    const releasedGrams = allocation.releasedGrams + args.grams;
    await ctx.db.patch(allocation._id, {
      releasedGrams,
      ...(releasedGrams === allocation.allocatedGrams
        ? { status: "released" as const }
        : {}),
      releaseReason: args.reason.trim(),
      version: allocation.version + 1,
      updatedAt: Date.now(),
    });
    const updated = (await ctx.db.get(allocation._id))!;
    const declaration = await ctx.db.get(allocation.declarationId);
    if (declaration !== null && declaration.status === "exhausted")
      await ctx.db.patch(declaration._id, {
        status: "active",
        version: declaration.version + 1,
        updatedAt: Date.now(),
      });
    await emitAllocationEvent(
      ctx,
      updated,
      "pilot.allocation.released",
      principal._id,
      `${args.grams} grams released: ${args.reason.trim()}`,
    );
    await completePilotIdempotency(ctx, receipt.receiptId, [
      { entityType: "pilotAllocations", entityId: allocation._id },
    ]);
    return allocationSummary(updated);
  },
});

export const expireHold = mutation({
  args: {
    allocationId: v.id("pilotAllocations"),
    expectedVersion: v.number(),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const principal = await requirePilotPrincipal(ctx);
    const allocation = await ctx.db.get(args.allocationId);
    assertAllowed(allocation !== null, "Allocation was not found.");
    await requireOfferManager(ctx, principal, allocation.programmeId);
    const receipt = await beginPilotIdempotency(ctx, {
      programmeId: allocation.programmeId,
      actorUserId: principal._id,
      operationName: "pilotAllocations.expireHold",
      idempotencyKey: args.idempotencyKey,
      requestHash: JSON.stringify(args),
    });
    if (receipt.kind === "replay")
      return allocationSummary(await replayAllocation(ctx, receipt.receipt));
    assertExpectedVersion(args.expectedVersion);
    assertAllowed(
      allocation.version === args.expectedVersion &&
        allocation.status === "provisional" &&
        allocation.holdExpiresAt !== undefined &&
        allocation.holdExpiresAt <= Date.now(),
      "Allocation changed or its hold has not expired.",
    );
    await ctx.db.patch(allocation._id, {
      releasedGrams: allocation.allocatedGrams,
      status: "expired",
      releaseReason: "provisional_hold_expired",
      version: allocation.version + 1,
      updatedAt: Date.now(),
    });
    const updated = (await ctx.db.get(allocation._id))!;
    await emitAllocationEvent(
      ctx,
      updated,
      "pilot.allocation.released",
      principal._id,
      "Provisional allocation hold expired and was released.",
    );
    await completePilotIdempotency(ctx, receipt.receiptId, [
      { entityType: "pilotAllocations", entityId: allocation._id },
    ]);
    return allocationSummary(updated);
  },
});
