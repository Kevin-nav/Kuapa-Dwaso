import { v } from "convex/values";
import { assertExpectedVersion } from "@kuapa-dwaso/validators/pilot";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import {
  projectPilotLotForPrincipal,
  requirePilotCapability,
  requirePilotLotRead,
  requirePilotPrincipal,
} from "./pilotAccess";
import {
  beginPilotIdempotency,
  completePilotIdempotency,
  replayEntityId,
} from "./pilotIdempotency";
import { assertAllowed } from "./workflowHelpers";

const location = v.object({
  label: v.string(),
  region: v.optional(v.string()),
  district: v.optional(v.string()),
  address: v.optional(v.string()),
  latitudeE6: v.optional(v.number()),
  longitudeE6: v.optional(v.number()),
});
const disposition = v.union(
  v.literal("available_for_plan"),
  v.literal("held"),
  v.literal("returned"),
  v.literal("disposed"),
  v.literal("closed"),
);
const qualityStatus = v.union(
  v.literal("pending"),
  v.literal("passed"),
  v.literal("partial"),
  v.literal("failed"),
  v.literal("superseded"),
);

function lotSummary(lot: Doc<"pilotProcurementLots">) {
  return {
    lotId: lot._id,
    programmeId: lot.programmeId,
    requestId: lot.requestId,
    allocationId: lot.allocationId,
    offerRevisionId: lot.offerRevisionId,
    farmerId: lot.farmerId,
    commercialMode: lot.commercialMode,
    lotCode: lot.lotCode,
    parentLotId: lot.parentLotId,
    sourceGrams: lot.sourceGrams,
    qualityStatus: lot.qualityStatus,
    clearedGrams: lot.clearedGrams,
    rejectedGrams: lot.rejectedGrams,
    titleOwnerKind: lot.titleOwnerKind,
    titleOwnerFarmerId: lot.titleOwnerFarmerId,
    currentCustodianKind: lot.currentCustodianKind,
    currentCustodianId: lot.currentCustodianId,
    currentLocation: lot.currentLocation,
    facilityId: lot.facilityId,
    dispositionStatus: lot.dispositionStatus,
    version: lot.version,
  };
}

async function validateDispositionEvidence(
  ctx: MutationCtx,
  actorUserId: Id<"users">,
  lot: Doc<"pilotProcurementLots">,
  assetIds: Id<"uploadAssets">[],
) {
  assertAllowed(
    new Set(assetIds).size === assetIds.length,
    "Disposition evidence cannot contain duplicate uploads.",
  );
  for (const assetId of assetIds) {
    const asset = await ctx.db.get(assetId);
    assertAllowed(asset !== null, "Disposition evidence upload was not found.");
    assertAllowed(
      asset.ownerUserId === actorUserId &&
        asset.purpose === "pilot_custody_evidence" &&
        asset.accessLevel === "private" &&
        (asset.status === "uploaded" || asset.status === "verified") &&
        asset.pilotProgrammeId === lot.programmeId &&
        asset.relatedEntityType === "pilotProcurementLots" &&
        asset.relatedEntityId === lot._id,
      "Disposition evidence must be a private, completed upload owned by the operator and scoped to this lot.",
    );
  }
}

async function replayLot(
  ctx: MutationCtx,
  receipt: Doc<"pilotIdempotencyKeys">,
) {
  const lot = await ctx.db.get(
    replayEntityId<"pilotProcurementLots">(receipt, "pilotProcurementLots"),
  );
  assertAllowed(lot !== null, "Lot replay was not found.");
  return lot;
}

export const recordDisposition = mutation({
  args: {
    lotId: v.id("pilotProcurementLots"),
    disposition,
    location,
    reason: v.string(),
    evidenceUploadAssetIds: v.array(v.id("uploadAssets")),
    ownerConsentEvidenceUploadAssetIds: v.array(v.id("uploadAssets")),
    expectedVersion: v.number(),
    occurredAt: v.number(),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const principal = await requirePilotPrincipal(ctx);
    const lot = await ctx.db.get(args.lotId);
    assertAllowed(lot !== null, "Pilot lot was not found.");
    await requirePilotCapability(
      ctx,
      principal,
      lot.programmeId,
      "custody:record",
    );
    const receipt = await beginPilotIdempotency(ctx, {
      programmeId: lot.programmeId,
      actorUserId: principal._id,
      operationName: "pilotLots.recordDisposition",
      idempotencyKey: args.idempotencyKey,
      requestHash: JSON.stringify(args),
    });
    if (receipt.kind === "replay")
      return lotSummary(await replayLot(ctx, receipt.receipt));
    assertExpectedVersion(args.expectedVersion);
    assertAllowed(
      lot.version === args.expectedVersion,
      "Lot changed before disposition was recorded.",
    );
    assertAllowed(
      args.reason.trim().length > 0,
      "Disposition reason is required.",
    );
    assertAllowed(
      Number.isSafeInteger(args.occurredAt) && args.occurredAt <= Date.now(),
      "Disposition time must be valid and not in the future.",
    );
    const allowed: Record<
      Doc<"pilotProcurementLots">["dispositionStatus"],
      readonly string[]
    > = {
      available_for_plan: ["held", "closed"],
      allocated_to_plan: ["held"],
      held: ["available_for_plan", "returned", "disposed", "closed"],
      delivered: ["held", "closed"],
      returned: ["closed"],
      disposed: ["closed"],
      closed: [],
    };
    assertAllowed(
      allowed[lot.dispositionStatus].includes(args.disposition),
      `Lot cannot move from ${lot.dispositionStatus} to ${args.disposition}.`,
    );
    if (args.disposition === "available_for_plan")
      assertAllowed(
        lot.clearedGrams > 0 &&
          (lot.qualityStatus === "passed" || lot.qualityStatus === "partial"),
        "Rejected or uncleared quantity cannot be released for dispatch.",
      );
    const ownerConsentRequired =
      lot.titleOwnerKind === "farmer" &&
      (args.disposition === "disposed" || args.disposition === "closed");
    if (ownerConsentRequired)
      assertAllowed(
        args.ownerConsentEvidenceUploadAssetIds.length > 0,
        "Farmer-owned quantity requires recorded owner consent before disposal or closure.",
      );
    const allEvidence = [
      ...args.evidenceUploadAssetIds,
      ...args.ownerConsentEvidenceUploadAssetIds,
    ];
    await validateDispositionEvidence(ctx, principal._id, lot, allEvidence);
    const farmer = await ctx.db.get(lot.farmerId);
    assertAllowed(farmer !== null, "Lot farmer was not found.");
    const now = Date.now();
    const returning = args.disposition === "returned";
    const toCustodianKind = returning
      ? ("farmer" as const)
      : lot.currentCustodianKind;
    const toCustodianId = returning ? lot.farmerId : lot.currentCustodianId;
    const eventType =
      args.disposition === "returned"
        ? ("returned" as const)
        : args.disposition === "available_for_plan"
          ? ("released" as const)
          : ("held" as const);
    const custodyEventId = await ctx.db.insert("pilotCustodyEvents", {
      programmeId: lot.programmeId,
      requestId: lot.requestId,
      lotId: lot._id,
      eventType,
      grams: lot.sourceGrams,
      fromCustodian: {
        kind: lot.currentCustodianKind,
        ...(lot.currentCustodianId === undefined
          ? {}
          : { id: lot.currentCustodianId }),
        displayNameSnapshot: lot.currentCustodianKind.replaceAll("_", " "),
      },
      toCustodian: {
        kind: toCustodianKind,
        ...(toCustodianId === undefined ? {} : { id: toCustodianId }),
        displayNameSnapshot: returning
          ? "Farmer owner"
          : toCustodianKind.replaceAll("_", " "),
      },
      location: args.location,
      evidenceUploadAssetIds: allEvidence,
      reasonCode: args.reason.trim(),
      recordedByUserId: principal._id,
      occurredAt: args.occurredAt,
      createdAt: now,
    });
    await ctx.db.patch(lot._id, {
      dispositionStatus: args.disposition,
      currentCustodianKind: toCustodianKind,
      currentCustodianId: toCustodianId,
      currentLocation: args.location,
      version: lot.version + 1,
      updatedAt: now,
    });
    const updated = (await ctx.db.get(lot._id))!;
    await ctx.db.insert("pilotActivityEvents", {
      programmeId: lot.programmeId,
      requestId: lot.requestId,
      entityType: "pilotProcurementLots",
      entityId: lot._id,
      entityRevision: updated.version,
      eventName: "pilot.lot.disposition_recorded",
      actorUserId: principal._id,
      reasonCode: args.reason.trim(),
      recipientViews: [
        {
          audience: "farmer",
          targetId: lot.farmerId,
          title: "Lot disposition recorded",
          detail: `${lot.lotCode} is now ${args.disposition.replaceAll("_", " ")}.`,
        },
        {
          audience: "pilot_ops",
          title: "Lot disposition recorded",
          detail: `${lot.lotCode} is now ${args.disposition.replaceAll("_", " ")}.`,
        },
      ],
      createdAt: now,
    });
    await completePilotIdempotency(ctx, receipt.receiptId, [
      { entityType: "pilotProcurementLots", entityId: lot._id },
      { entityType: "pilotCustodyEvents", entityId: custodyEventId },
    ]);
    return lotSummary(updated);
  },
});

export const listForActor = query({
  args: {
    programmeId: v.id("pilotProgrammes"),
    requestId: v.optional(v.id("pilotBuyerRequests")),
    qualityStatus: v.optional(qualityStatus),
    dispositionStatus: v.optional(disposition),
    cursor: v.optional(v.string()),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const principal = await requirePilotPrincipal(ctx);
    assertAllowed(
      Number.isSafeInteger(args.limit) && args.limit > 0 && args.limit <= 50,
      "Page limit must be from 1 to 50.",
    );
    let farmerId: Id<"farmers"> | undefined;
    if (principal.role === "farmer") {
      const farmer = await ctx.db
        .query("farmers")
        .withIndex("by_user", (q) => q.eq("userId", principal._id))
        .unique();
      assertAllowed(farmer !== null, "Farmer profile was not found.");
      farmerId = farmer._id;
    } else if (principal.role === "buyer" || principal.role === "transporter") {
      assertAllowed(
        args.requestId !== undefined,
        "This role must select a request.",
      );
      const request = await ctx.db.get(args.requestId);
      assertAllowed(
        request !== null && request.programmeId === args.programmeId,
        "Pilot request was not found in this programme.",
      );
    } else {
      await requirePilotCapability(
        ctx,
        principal,
        args.programmeId,
        "pilot:read",
      );
    }
    const result = await ctx.db
      .query("pilotProcurementLots")
      .withIndex("by_programme_quality", (q) =>
        args.qualityStatus === undefined
          ? q.eq("programmeId", args.programmeId)
          : q
              .eq("programmeId", args.programmeId)
              .eq("qualityStatus", args.qualityStatus),
      )
      .filter((q) =>
        q.and(
          args.requestId === undefined
            ? q.eq(q.field("programmeId"), args.programmeId)
            : q.eq(q.field("requestId"), args.requestId),
          farmerId === undefined
            ? q.eq(q.field("farmerId"), q.field("farmerId"))
            : q.eq(q.field("farmerId"), farmerId),
          args.dispositionStatus === undefined
            ? q.eq(q.field("dispositionStatus"), q.field("dispositionStatus"))
            : q.eq(q.field("dispositionStatus"), args.dispositionStatus),
        ),
      )
      .order("desc")
      .paginate({ cursor: args.cursor ?? null, numItems: args.limit });
    const page = [];
    for (const lot of result.page) {
      await requirePilotLotRead(ctx, principal, lot);
      page.push(
        projectPilotLotForPrincipal(
          principal,
          lot,
          farmerId !== undefined && lot.farmerId === farmerId,
        ),
      );
    }
    return {
      page,
      ...(result.isDone ? {} : { nextCursor: result.continueCursor }),
      isDone: result.isDone,
    };
  },
});
