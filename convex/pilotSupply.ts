import { v } from "convex/values";
import { calculatePilotOfferAmounts } from "@kuapa-dwaso/utils/pilot";
import {
  assertExpectedVersion,
  assertPilotLocation,
  assertPilotQuantityGrams,
  assertPilotWindow,
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
  replayEntityId,
} from "./pilotIdempotency";
import { assertAllowed } from "./workflowHelpers";
import { insertPilotActivityEvent } from "./pilotActivity";

const location = v.object({
  label: v.string(),
  region: v.optional(v.string()),
  district: v.optional(v.string()),
  address: v.optional(v.string()),
  latitudeE6: v.optional(v.number()),
  longitudeE6: v.optional(v.number()),
});
const declarationStatus = v.union(
  v.literal("active"),
  v.literal("exhausted"),
  v.literal("withdrawn"),
  v.literal("expired"),
);
const offerStatus = v.union(
  v.literal("draft"),
  v.literal("sent"),
  v.literal("accepted"),
  v.literal("declined"),
  v.literal("expired"),
  v.literal("withdrawn"),
);

async function requireOwnFarmer(
  ctx: QueryCtx | MutationCtx,
  principal: PilotPrincipal,
) {
  assertAllowed(principal.role === "farmer", "A farmer identity is required.");
  const farmer = await ctx.db
    .query("farmers")
    .withIndex("by_user", (q) => q.eq("userId", principal._id))
    .unique();
  assertAllowed(
    farmer !== null && farmer.status === "active",
    "Active farmer profile was not found.",
  );
  return farmer;
}

async function resolveDeclarationFarmer(
  ctx: QueryCtx | MutationCtx,
  principal: PilotPrincipal,
  programmeId: Id<"pilotProgrammes">,
  farmerId: Id<"farmers"> | undefined,
  assistanceReason: string | undefined,
) {
  if (principal.role === "farmer") {
    const farmer = await requireOwnFarmer(ctx, principal);
    assertAllowed(
      farmerId === undefined || farmerId === farmer._id,
      "A farmer cannot declare supply for another farmer.",
    );
    assertAllowed(
      assistanceReason === undefined,
      "Self-service declarations cannot claim operations assistance.",
    );
    return { farmer, assisted: false } as const;
  }
  await requirePilotCapability(ctx, principal, programmeId, "supply:manage");
  assertAllowed(
    farmerId !== undefined,
    "Assisted declaration requires a farmer.",
  );
  assertAllowed(
    assistanceReason !== undefined && assistanceReason.trim().length > 0,
    "Assisted declaration requires an attribution reason.",
  );
  const farmer = await ctx.db.get(farmerId);
  assertAllowed(
    farmer !== null && farmer.status === "active",
    "Active farmer profile was not found.",
  );
  return { farmer, assisted: true } as const;
}

async function activeAllocatedGrams(
  ctx: QueryCtx | MutationCtx,
  declarationId: Id<"pilotSupplyDeclarations">,
) {
  const allocations = await ctx.db
    .query("pilotAllocations")
    .withIndex("by_declaration_status", (q) =>
      q.eq("declarationId", declarationId),
    )
    .collect();
  return allocations
    .filter(
      (allocation) =>
        (allocation.status === "provisional" &&
          (allocation.holdExpiresAt === undefined ||
            allocation.holdExpiresAt > Date.now())) ||
        allocation.status === "committed" ||
        allocation.status === "quality_cleared",
    )
    .reduce(
      (sum, allocation) =>
        sum + allocation.allocatedGrams - allocation.releasedGrams,
      0,
    );
}

async function activeRequestAllocatedGrams(
  ctx: QueryCtx | MutationCtx,
  requestId: Id<"pilotBuyerRequests">,
) {
  const allocations = await ctx.db
    .query("pilotAllocations")
    .withIndex("by_request_status", (q) => q.eq("requestId", requestId))
    .collect();
  return allocations
    .filter(
      (allocation) =>
        (allocation.status === "provisional" &&
          (allocation.holdExpiresAt === undefined ||
            allocation.holdExpiresAt > Date.now())) ||
        allocation.status === "committed" ||
        allocation.status === "quality_cleared",
    )
    .reduce(
      (sum, allocation) =>
        sum + allocation.allocatedGrams - allocation.releasedGrams,
      0,
    );
}

export async function pilotDeclarationSummary(
  ctx: QueryCtx | MutationCtx,
  declaration: Doc<"pilotSupplyDeclarations">,
) {
  const allocatedGrams = await activeAllocatedGrams(ctx, declaration._id);
  return {
    declarationId: declaration._id,
    programmeId: declaration.programmeId,
    farmerId: declaration.farmerId,
    maizeType: declaration.maizeType,
    availableGrams: declaration.availableGrams,
    allocatedGrams,
    unallocatedGrams: Math.max(0, declaration.availableGrams - allocatedGrams),
    readinessWindowStartAt: declaration.readinessWindowStartAt,
    readinessWindowEndAt: declaration.readinessWindowEndAt,
    collectionLocation: declaration.collectionLocation,
    verificationStatus: declaration.verificationStatus,
    status: declaration.status,
    version: declaration.version,
  };
}

async function farmerOfferProjection(
  ctx: QueryCtx | MutationCtx,
  offer: Doc<"pilotFarmerOffers">,
) {
  const revision =
    offer.currentRevisionId === undefined
      ? null
      : await ctx.db.get(offer.currentRevisionId);
  const allocations = await ctx.db
    .query("pilotAllocations")
    .withIndex("by_offer", (q) => q.eq("offerId", offer._id))
    .collect();
  const allocation = allocations.find((candidate) =>
    ["provisional", "committed", "quality_cleared"].includes(candidate.status),
  );
  const finalAmounts =
    revision !== null &&
    allocation?.status === "quality_cleared" &&
    allocation.clearedGrams === revision.offeredGrams
      ? calculatePilotOfferAmounts({
          offeredGrams: allocation.clearedGrams,
          priceRate: revision.priceRate,
          chargeTerms: revision.chargeTerms,
        })
      : null;
  return {
    offerId: offer._id,
    requestId: offer.requestId,
    declarationId: offer.declarationId,
    commercialMode: offer.commercialMode,
    status: offer.status,
    expiresAt: offer.expiresAt,
    version: offer.version,
    terms:
      revision === null
        ? null
        : {
            revisionId: revision._id,
            revision: revision.revision,
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
    quantity:
      allocation === undefined
        ? null
        : {
            allocationId: allocation._id,
            status: allocation.status,
            committedGrams:
              allocation.status === "committed" ||
              allocation.status === "quality_cleared"
                ? allocation.allocatedGrams - allocation.releasedGrams
                : 0,
            clearedGrams: allocation.clearedGrams,
            releasedGrams: allocation.releasedGrams,
            version: allocation.version,
          },
    finalAmounts,
  };
}

async function emitSupplyEvent(
  ctx: MutationCtx,
  declaration: Doc<"pilotSupplyDeclarations">,
  eventName: string,
  actorUserId: Id<"users">,
  detail: string,
) {
  await insertPilotActivityEvent(ctx, {
    programmeId: declaration.programmeId,
    entityType: "pilotSupplyDeclarations",
    entityId: declaration._id,
    entityRevision: declaration.version,
    eventName,
    actorUserId,
    recipientViews: [
      {
        audience: "farmer",
        targetId: declaration.farmerId,
        title: eventName.replaceAll(".", " "),
        detail,
      },
      { audience: "pilot_ops", title: eventName.replaceAll(".", " "), detail },
    ],
    createdAt: Date.now(),
  });
}

async function replayDeclaration(
  ctx: MutationCtx,
  receipt: Doc<"pilotIdempotencyKeys">,
) {
  const declaration = await ctx.db.get(
    replayEntityId<"pilotSupplyDeclarations">(
      receipt,
      "pilotSupplyDeclarations",
    ),
  );
  assertAllowed(declaration !== null, "Idempotent declaration was not found.");
  return declaration;
}

export const createDeclaration = mutation({
  args: {
    programmeId: v.id("pilotProgrammes"),
    farmerId: v.optional(v.id("farmers")),
    maizeType: v.string(),
    availableGrams: v.number(),
    readinessWindowStartAt: v.number(),
    readinessWindowEndAt: v.number(),
    collectionLocation: location,
    assistanceReason: v.optional(v.string()),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const principal = await requirePilotPrincipal(ctx);
    const programme = await ctx.db.get(args.programmeId);
    assertAllowed(programme !== null, "Pilot programme was not found.");
    const owner = await resolveDeclarationFarmer(
      ctx,
      principal,
      args.programmeId,
      args.farmerId,
      args.assistanceReason,
    );
    assertPilotQuantityGrams(args.availableGrams, "availableGrams");
    assertPilotWindow(
      args.readinessWindowStartAt,
      args.readinessWindowEndAt,
      "readinessWindow",
    );
    assertPilotLocation(args.collectionLocation);
    assertAllowed(args.maizeType.trim().length > 0, "Maize type is required.");
    const receipt = await beginPilotIdempotency(ctx, {
      programmeId: args.programmeId,
      actorUserId: principal._id,
      operationName: "pilotSupply.createDeclaration",
      idempotencyKey: args.idempotencyKey,
      requestHash: JSON.stringify(args),
    });
    if (receipt.kind === "replay")
      return pilotDeclarationSummary(
        ctx,
        await replayDeclaration(ctx, receipt.receipt),
      );
    assertAllowed(
      programme.status === "active",
      "Pilot programme must be active.",
    );
    const now = Date.now();
    const declarationId = await ctx.db.insert("pilotSupplyDeclarations", {
      programmeId: args.programmeId,
      farmerId: owner.farmer._id,
      cropCode: "maize",
      maizeType: args.maizeType.trim(),
      availableGrams: args.availableGrams,
      readinessWindowStartAt: args.readinessWindowStartAt,
      readinessWindowEndAt: args.readinessWindowEndAt,
      collectionLocation: {
        ...args.collectionLocation,
        label: args.collectionLocation.label.trim(),
      },
      verificationStatus: "self_reported",
      status: "active",
      version: 0,
      createdAt: now,
      updatedAt: now,
    });
    const declaration = (await ctx.db.get(declarationId))!;
    await emitSupplyEvent(
      ctx,
      declaration,
      "pilot.supply.declared",
      principal._id,
      owner.assisted
        ? `Operations recorded this declaration with attribution: ${args.assistanceReason!.trim()}`
        : "Farmer recorded this declaration.",
    );
    await completePilotIdempotency(ctx, receipt.receiptId, [
      { entityType: "pilotSupplyDeclarations", entityId: declarationId },
    ]);
    return pilotDeclarationSummary(ctx, declaration);
  },
});

export const updateDeclaration = mutation({
  args: {
    declarationId: v.id("pilotSupplyDeclarations"),
    availableGrams: v.number(),
    readinessWindowStartAt: v.number(),
    readinessWindowEndAt: v.number(),
    collectionLocation: location,
    assistanceReason: v.optional(v.string()),
    expectedVersion: v.number(),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const principal = await requirePilotPrincipal(ctx);
    const declaration = await ctx.db.get(args.declarationId);
    assertAllowed(declaration !== null, "Supply declaration was not found.");
    await resolveDeclarationFarmer(
      ctx,
      principal,
      declaration.programmeId,
      declaration.farmerId,
      args.assistanceReason,
    );
    assertPilotQuantityGrams(args.availableGrams, "availableGrams");
    assertPilotWindow(
      args.readinessWindowStartAt,
      args.readinessWindowEndAt,
      "readinessWindow",
    );
    assertPilotLocation(args.collectionLocation);
    const receipt = await beginPilotIdempotency(ctx, {
      programmeId: declaration.programmeId,
      actorUserId: principal._id,
      operationName: "pilotSupply.updateDeclaration",
      idempotencyKey: args.idempotencyKey,
      requestHash: JSON.stringify(args),
    });
    if (receipt.kind === "replay")
      return pilotDeclarationSummary(
        ctx,
        await replayDeclaration(ctx, receipt.receipt),
      );
    assertExpectedVersion(args.expectedVersion);
    assertAllowed(
      declaration.version === args.expectedVersion &&
        ["active", "exhausted"].includes(declaration.status),
      "Declaration changed or is no longer editable.",
    );
    const allocatedGrams = await activeAllocatedGrams(ctx, declaration._id);
    assertAllowed(
      args.availableGrams >= allocatedGrams,
      "Available quantity cannot be lower than active allocations.",
    );
    await ctx.db.patch(declaration._id, {
      availableGrams: args.availableGrams,
      readinessWindowStartAt: args.readinessWindowStartAt,
      readinessWindowEndAt: args.readinessWindowEndAt,
      collectionLocation: {
        ...args.collectionLocation,
        label: args.collectionLocation.label.trim(),
      },
      status: args.availableGrams === allocatedGrams ? "exhausted" : "active",
      version: declaration.version + 1,
      updatedAt: Date.now(),
    });
    const updated = (await ctx.db.get(declaration._id))!;
    await emitSupplyEvent(
      ctx,
      updated,
      "pilot.supply.declared",
      principal._id,
      "Supply declaration quantity or readiness was updated.",
    );
    await completePilotIdempotency(ctx, receipt.receiptId, [
      { entityType: "pilotSupplyDeclarations", entityId: declaration._id },
    ]);
    return pilotDeclarationSummary(ctx, updated);
  },
});

export const reviewDeclaration = mutation({
  args: {
    declarationId: v.id("pilotSupplyDeclarations"),
    decision: v.union(v.literal("reviewed"), v.literal("rejected")),
    reason: v.string(),
    expectedVersion: v.number(),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const principal = await requirePilotPrincipal(ctx);
    const declaration = await ctx.db.get(args.declarationId);
    assertAllowed(declaration !== null, "Supply declaration was not found.");
    await requirePilotCapability(
      ctx,
      principal,
      declaration.programmeId,
      "supply:manage",
    );
    assertAllowed(args.reason.trim().length > 0, "Review reason is required.");
    const receipt = await beginPilotIdempotency(ctx, {
      programmeId: declaration.programmeId,
      actorUserId: principal._id,
      operationName: "pilotSupply.reviewDeclaration",
      idempotencyKey: args.idempotencyKey,
      requestHash: JSON.stringify(args),
    });
    if (receipt.kind === "replay")
      return pilotDeclarationSummary(
        ctx,
        await replayDeclaration(ctx, receipt.receipt),
      );
    assertExpectedVersion(args.expectedVersion);
    assertAllowed(
      declaration.version === args.expectedVersion &&
        declaration.status === "active",
      "Declaration changed or is no longer active.",
    );
    if (args.decision === "rejected")
      assertAllowed(
        (await activeAllocatedGrams(ctx, declaration._id)) === 0,
        "A declaration with active allocations cannot be rejected.",
      );
    await ctx.db.patch(declaration._id, {
      verificationStatus: args.decision,
      ...(args.decision === "rejected" ? { status: "withdrawn" as const } : {}),
      version: declaration.version + 1,
      updatedAt: Date.now(),
    });
    const updated = (await ctx.db.get(declaration._id))!;
    await emitSupplyEvent(
      ctx,
      updated,
      "pilot.supply.reviewed",
      principal._id,
      args.reason.trim(),
    );
    await completePilotIdempotency(ctx, receipt.receiptId, [
      { entityType: "pilotSupplyDeclarations", entityId: declaration._id },
    ]);
    return pilotDeclarationSummary(ctx, updated);
  },
});

export const listMine = query({
  args: {
    programmeId: v.id("pilotProgrammes"),
    status: v.optional(declarationStatus),
    cursor: v.optional(v.string()),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const principal = await requirePilotPrincipal(ctx);
    const farmer = await requireOwnFarmer(ctx, principal);
    assertAllowed(
      Number.isSafeInteger(args.limit) && args.limit > 0 && args.limit <= 50,
      "Page limit must be from 1 to 50.",
    );
    const result = await ctx.db
      .query("pilotSupplyDeclarations")
      .withIndex("by_farmer_programme_status", (q) =>
        args.status === undefined
          ? q.eq("farmerId", farmer._id).eq("programmeId", args.programmeId)
          : q
              .eq("farmerId", farmer._id)
              .eq("programmeId", args.programmeId)
              .eq("status", args.status),
      )
      .order("desc")
      .paginate({ cursor: args.cursor ?? null, numItems: args.limit });
    const page = [];
    for (const declaration of result.page) {
      const offers = await ctx.db
        .query("pilotFarmerOffers")
        .withIndex("by_declaration_status", (q) =>
          q.eq("declarationId", declaration._id),
        )
        .collect();
      const projectedOffers = [];
      for (const offer of offers)
        projectedOffers.push(await farmerOfferProjection(ctx, offer));
      page.push({
        declaration: await pilotDeclarationSummary(ctx, declaration),
        offers: projectedOffers,
      });
    }
    return {
      page,
      ...(result.isDone ? {} : { nextCursor: result.continueCursor }),
      isDone: result.isDone,
    };
  },
});

export const listForRequest = query({
  args: {
    requestId: v.id("pilotBuyerRequests"),
    status: v.optional(offerStatus),
    cursor: v.optional(v.string()),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const principal = await requirePilotPrincipal(ctx);
    const request = await ctx.db.get(args.requestId);
    assertAllowed(request !== null, "Pilot request was not found.");
    await requirePilotCapability(
      ctx,
      principal,
      request.programmeId,
      "pilot:read",
    );
    assertAllowed(
      Number.isSafeInteger(args.limit) && args.limit > 0 && args.limit <= 50,
      "Page limit must be from 1 to 50.",
    );
    const result = await ctx.db
      .query("pilotFarmerOffers")
      .withIndex("by_request_status", (q) =>
        args.status === undefined
          ? q.eq("requestId", request._id)
          : q.eq("requestId", request._id).eq("status", args.status),
      )
      .order("desc")
      .paginate({ cursor: args.cursor ?? null, numItems: args.limit });
    const page = [];
    for (const offer of result.page) {
      const declaration = await ctx.db.get(offer.declarationId);
      assertAllowed(declaration !== null, "Offer declaration was not found.");
      const farmer = await ctx.db.get(offer.farmerId);
      assertAllowed(farmer !== null, "Offer farmer was not found.");
      page.push({
        offer: await farmerOfferProjection(ctx, offer),
        declaration: await pilotDeclarationSummary(ctx, declaration),
        farmer: {
          farmerId: farmer._id,
          farmerCode: farmer.farmerCode,
          fullName: farmer.fullName,
          phoneNumber: farmer.phoneNumber,
          community: farmer.community,
        },
      });
    }
    return {
      page,
      ...(result.isDone ? {} : { nextCursor: result.continueCursor }),
      isDone: result.isDone,
    };
  },
});

/**
 * Programme-scoped sourcing queue for assigned operations users. Farmer contact
 * details are deliberately exposed only behind the supply-management grant.
 */
export const listAvailable = query({
  args: {
    programmeId: v.id("pilotProgrammes"),
    maizeType: v.optional(v.string()),
    status: v.optional(declarationStatus),
    cursor: v.optional(v.string()),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const principal = await requirePilotPrincipal(ctx);
    await requirePilotCapability(
      ctx,
      principal,
      args.programmeId,
      "supply:manage",
    );
    assertAllowed(
      Number.isSafeInteger(args.limit) && args.limit > 0 && args.limit <= 50,
      "Page limit must be from 1 to 50.",
    );
    const result = await ctx.db
      .query("pilotSupplyDeclarations")
      .withIndex("by_programme_status", (q) =>
        args.status === undefined
          ? q.eq("programmeId", args.programmeId)
          : q.eq("programmeId", args.programmeId).eq("status", args.status),
      )
      .order("desc")
      .paginate({ cursor: args.cursor ?? null, numItems: args.limit });
    const page = [];
    for (const declaration of result.page) {
      if (
        args.maizeType !== undefined &&
        declaration.maizeType !== args.maizeType.trim()
      )
        continue;
      const farmer = await ctx.db.get(declaration.farmerId);
      if (farmer === null || farmer.status !== "active") continue;
      page.push({
        declaration: await pilotDeclarationSummary(ctx, declaration),
        farmer: {
          farmerId: farmer._id,
          farmerCode: farmer.farmerCode,
          fullName: farmer.fullName,
          phoneNumber: farmer.phoneNumber,
          community: farmer.community,
          region: farmer.region,
          verificationStatus: farmer.verificationStatus,
        },
      });
    }
    return {
      page,
      ...(result.isDone ? {} : { nextCursor: result.continueCursor }),
      isDone: result.isDone,
    };
  },
});

export const listEligibleFarmers = query({
  args: { programmeId: v.id("pilotProgrammes"), limit: v.number() },
  handler: async (ctx, args) => {
    const principal = await requirePilotPrincipal(ctx);
    await requirePilotCapability(
      ctx,
      principal,
      args.programmeId,
      "supply:manage",
    );
    assertAllowed(
      Number.isSafeInteger(args.limit) && args.limit > 0 && args.limit <= 100,
      "Farmer limit must be from 1 to 100.",
    );
    const farmers = await ctx.db.query("farmers").collect();
    return farmers
      .filter(
        (farmer) =>
          farmer.status === "active" &&
          farmer.verificationStatus === "verified" &&
          farmer.userId !== undefined,
      )
      .slice(0, args.limit)
      .map((farmer) => ({
        farmerId: farmer._id,
        farmerCode: farmer.farmerCode,
        fullName: farmer.fullName,
        phoneNumber: farmer.phoneNumber,
        community: farmer.community,
      }));
  },
});

export { activeAllocatedGrams, activeRequestAllocatedGrams, requireOwnFarmer };
