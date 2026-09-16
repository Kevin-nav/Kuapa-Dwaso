import { v } from "convex/values";
import {
  assertExpectedVersion,
  assertPilotLocation,
  evaluatePilotInspectionQuality,
} from "@kuapa-dwaso/validators/pilot";
import type { PilotAdditionalReading } from "@kuapa-dwaso/types/pilot";
import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import {
  projectPilotLotForPrincipal,
  requirePilotCapability,
  requirePilotLotRead,
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
import { findPilotIssueOwner } from "./pilotIssues";

const location = v.object({
  label: v.string(),
  region: v.optional(v.string()),
  district: v.optional(v.string()),
  address: v.optional(v.string()),
  latitudeE6: v.optional(v.number()),
  longitudeE6: v.optional(v.number()),
});
const contaminationResult = v.union(
  v.literal("passed"),
  v.literal("failed"),
  v.literal("not_recorded"),
);
const additionalReading = v.object({
  code: v.string(),
  label: v.string(),
  value: v.string(),
  passed: v.optional(v.boolean()),
});
const sublotCodes = v.object({
  acceptedLotCode: v.string(),
  rejectedLotCode: v.string(),
});
const inspectionFields = {
  samplingMethod: v.string(),
  testMethod: v.string(),
  sampleCount: v.number(),
  moisturePermille: v.optional(v.number()),
  contaminationResult,
  additionalReadings: v.array(additionalReading),
  grossWeightGrams: v.number(),
  tareWeightGrams: v.number(),
  acceptedGrams: v.number(),
  rejectedGrams: v.number(),
  reasonCode: v.optional(v.string()),
  notes: v.optional(v.string()),
  evidenceUploadAssetIds: v.array(v.id("uploadAssets")),
  inspectedAt: v.number(),
  partialSublots: v.optional(sublotCodes),
};

type InspectionInput = {
  samplingMethod: string;
  testMethod: string;
  sampleCount: number;
  moisturePermille?: number;
  contaminationResult: "passed" | "failed" | "not_recorded";
  additionalReadings: PilotAdditionalReading[];
  grossWeightGrams: number;
  tareWeightGrams: number;
  acceptedGrams: number;
  rejectedGrams: number;
  reasonCode?: string;
  notes?: string;
  evidenceUploadAssetIds: Id<"uploadAssets">[];
  inspectedAt: number;
  partialSublots?: { acceptedLotCode: string; rejectedLotCode: string };
};

function cleanText(value: string, label: string): string {
  const cleaned = value.trim();
  assertAllowed(cleaned.length > 0, `${label} is required.`);
  return cleaned;
}

function cleanLotCode(value: string): string {
  const cleaned = value.trim().toUpperCase();
  assertAllowed(
    /^[A-Z0-9][A-Z0-9-]{2,39}$/.test(cleaned),
    "Lot codes must be 3 to 40 letters, digits, or hyphens.",
  );
  return cleaned;
}

function inspectionSummary(inspection: Doc<"pilotInspections">) {
  return {
    inspectionId: inspection._id,
    programmeId: inspection.programmeId,
    requestId: inspection.requestId,
    lotId: inspection.lotId,
    allocationId: inspection.allocationId,
    buyerAgreementRevisionId: inspection.buyerAgreementRevisionId,
    supersedesInspectionId: inspection.supersedesInspectionId,
    samplingMethod: inspection.samplingMethod,
    testMethod: inspection.testMethod,
    sampleCount: inspection.sampleCount,
    moisturePermille: inspection.moisturePermille,
    contaminationResult: inspection.contaminationResult,
    additionalReadings: inspection.additionalReadings,
    grossWeightGrams: inspection.grossWeightGrams,
    tareWeightGrams: inspection.tareWeightGrams,
    measuredGrams: inspection.measuredGrams,
    acceptedGrams: inspection.acceptedGrams,
    rejectedGrams: inspection.rejectedGrams,
    qualityStatus: inspection.qualityStatus,
    reasonCode: inspection.reasonCode,
    notes: inspection.notes,
    evidenceUploadAssetIds: inspection.evidenceUploadAssetIds,
    inspectedAt: inspection.inspectedAt,
    createdAt: inspection.createdAt,
  };
}

async function requireInspector(
  ctx: QueryCtx | MutationCtx,
  principal: PilotPrincipal,
  programmeId: Id<"pilotProgrammes">,
) {
  await requirePilotCapability(ctx, principal, programmeId, "quality:record");
}

async function assertUniqueLotCode(
  ctx: MutationCtx,
  code: string,
  exceptLotId?: Id<"pilotProcurementLots">,
) {
  const existing = await ctx.db
    .query("pilotProcurementLots")
    .withIndex("by_lot_code", (q) => q.eq("lotCode", code))
    .unique();
  assertAllowed(
    existing === null || existing._id === exceptLotId,
    `Lot code ${code} is already in use.`,
  );
}

async function validateEvidence(
  ctx: MutationCtx,
  principal: PilotPrincipal,
  programmeId: Id<"pilotProgrammes">,
  assetIds: Id<"uploadAssets">[],
  relatedInspectionId?: Id<"pilotInspections">,
) {
  assertAllowed(
    new Set(assetIds).size === assetIds.length,
    "Inspection evidence cannot contain duplicate uploads.",
  );
  for (const assetId of assetIds) {
    const asset = await ctx.db.get(assetId);
    assertAllowed(asset !== null, "Inspection evidence upload was not found.");
    assertAllowed(
      asset.ownerUserId === principal._id &&
        asset.purpose === "pilot_inspection_evidence" &&
        asset.accessLevel === "private" &&
        (asset.status === "uploaded" || asset.status === "verified") &&
        (asset.pilotProgrammeId === undefined ||
          asset.pilotProgrammeId === programmeId) &&
        (asset.relatedEntityId === undefined ||
          (relatedInspectionId !== undefined &&
            asset.relatedEntityType === "pilotInspections" &&
            asset.relatedEntityId === relatedInspectionId)),
      "Inspection evidence must be a private, completed upload owned by the inspector and scoped to this inspection workflow.",
    );
  }
}

async function attachEvidence(
  ctx: MutationCtx,
  programmeId: Id<"pilotProgrammes">,
  inspectionId: Id<"pilotInspections">,
  assetIds: Id<"uploadAssets">[],
) {
  const now = Date.now();
  for (const assetId of assetIds)
    if ((await ctx.db.get(assetId))?.relatedEntityId === undefined)
      await ctx.db.patch(assetId, {
        pilotProgrammeId: programmeId,
        relatedEntityType: "pilotInspections",
        relatedEntityId: inspectionId,
        status: "attached",
        updatedAt: now,
      });
}

async function currentRootLots(
  ctx: QueryCtx | MutationCtx,
  allocationId: Id<"pilotAllocations">,
) {
  const lots = await ctx.db
    .query("pilotProcurementLots")
    .withIndex("by_allocation", (q) => q.eq("allocationId", allocationId))
    .collect();
  return lots.filter(
    (lot) =>
      lot.parentLotId === undefined && lot.qualityStatus !== "superseded",
  );
}

async function refreshAllocationClearance(
  ctx: MutationCtx,
  allocation: Doc<"pilotAllocations">,
) {
  const roots = await currentRootLots(ctx, allocation._id);
  const clearedGrams = roots.reduce((sum, lot) => sum + lot.clearedGrams, 0);
  const activeGrams = allocation.allocatedGrams - allocation.releasedGrams;
  assertAllowed(
    clearedGrams <= activeGrams,
    "Inspected quantity would exceed the active allocation.",
  );
  const now = Date.now();
  await ctx.db.patch(allocation._id, {
    clearedGrams,
    status: clearedGrams > 0 ? "quality_cleared" : "committed",
    version: allocation.version + 1,
    updatedAt: now,
  });
  return (await ctx.db.get(allocation._id))!;
}

async function reopenAffectedPlans(
  ctx: MutationCtx,
  lot: Doc<"pilotProcurementLots">,
  previousClearedGrams: number,
) {
  if (lot.clearedGrams >= previousClearedGrams) return;
  const plans = await ctx.db
    .query("pilotFulfilmentPlans")
    .withIndex("by_request", (q) => q.eq("requestId", lot.requestId))
    .collect();
  const children = await ctx.db
    .query("pilotProcurementLots")
    .withIndex("by_parent", (q) => q.eq("parentLotId", lot._id))
    .collect();
  const affectedLotIds = new Set([
    lot._id,
    ...children.map((child) => child._id),
  ]);
  for (const plan of plans) {
    if (!["ready", "assigned"].includes(plan.status)) continue;
    const stops = await ctx.db
      .query("pilotFulfilmentStops")
      .withIndex("by_plan_sequence", (q) => q.eq("planId", plan._id))
      .collect();
    if (
      !stops.some((stop) =>
        stop.lotIds.some((lotId) => affectedLotIds.has(lotId)),
      )
    )
      continue;
    await ctx.db.patch(plan._id, {
      status: "planning",
      readinessBlockers: [
        ...new Set([...plan.readinessBlockers, "quality_changed"]),
      ],
      version: plan.version + 1,
      updatedAt: Date.now(),
    });
  }
}

async function emitInspectionEvent(
  ctx: MutationCtx,
  inspection: Doc<"pilotInspections">,
  farmerId: Id<"farmers">,
  eventName: "pilot.inspection.recorded" | "pilot.inspection.superseded",
  actorUserId: Id<"users">,
  detail: string,
) {
  await insertPilotActivityEvent(ctx, {
    programmeId: inspection.programmeId,
    requestId: inspection.requestId,
    entityType: "pilotInspections",
    entityId: inspection._id,
    eventName,
    actorUserId,
    recipientViews: [
      {
        audience: "farmer",
        targetId: farmerId,
        title: "Maize inspection updated",
        detail,
      },
      { audience: "pilot_ops", title: "Maize inspection updated", detail },
      { audience: "buyer", title: "Supply quality updated", detail },
    ],
    createdAt: Date.now(),
  });
}

async function createPartialSublots(
  ctx: MutationCtx,
  parent: Doc<"pilotProcurementLots">,
  codes: { acceptedLotCode: string; rejectedLotCode: string },
) {
  const acceptedLotCode = cleanLotCode(codes.acceptedLotCode);
  const rejectedLotCode = cleanLotCode(codes.rejectedLotCode);
  assertAllowed(
    acceptedLotCode !== rejectedLotCode,
    "Sublot codes must be distinct.",
  );
  await assertUniqueLotCode(ctx, acceptedLotCode);
  await assertUniqueLotCode(ctx, rejectedLotCode);
  const common = {
    programmeId: parent.programmeId,
    requestId: parent.requestId,
    allocationId: parent.allocationId,
    offerRevisionId: parent.offerRevisionId,
    farmerId: parent.farmerId,
    commercialMode: parent.commercialMode,
    parentLotId: parent._id,
    titleOwnerKind: "farmer" as const,
    titleOwnerFarmerId: parent.farmerId,
    currentCustodianKind: "farmer" as const,
    currentCustodianId: parent.farmerId,
    currentLocation: parent.currentLocation,
    ...(parent.facilityId === undefined
      ? {}
      : { facilityId: parent.facilityId }),
    version: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const acceptedLotId = await ctx.db.insert("pilotProcurementLots", {
    ...common,
    lotCode: acceptedLotCode,
    sourceGrams: parent.clearedGrams,
    qualityStatus: "passed",
    clearedGrams: parent.clearedGrams,
    rejectedGrams: 0,
    dispositionStatus: "available_for_plan",
  });
  const rejectedLotId = await ctx.db.insert("pilotProcurementLots", {
    ...common,
    lotCode: rejectedLotCode,
    sourceGrams: parent.rejectedGrams,
    qualityStatus: "failed",
    clearedGrams: 0,
    rejectedGrams: parent.rejectedGrams,
    dispositionStatus: "held",
  });
  return [acceptedLotId, rejectedLotId] as const;
}

async function replayRecord(
  ctx: MutationCtx,
  receipt: Doc<"pilotIdempotencyKeys">,
) {
  const inspection = await ctx.db.get(
    replayEntityId<"pilotInspections">(receipt, "pilotInspections"),
  );
  const lot = await ctx.db.get(
    replayEntityId<"pilotProcurementLots">(receipt, "pilotProcurementLots"),
  );
  assertAllowed(
    inspection !== null && lot !== null,
    "Inspection replay was not found.",
  );
  const allocation = await ctx.db.get(inspection.allocationId);
  assertAllowed(allocation !== null, "Inspection allocation was not found.");
  return { inspection: inspectionSummary(inspection), lot, allocation };
}

function validateInspectionInput(
  input: InspectionInput,
  specification: Doc<"pilotBuyerAgreementRevisions">["specification"],
) {
  cleanText(input.samplingMethod, "Sampling method");
  cleanText(input.testMethod, "Test method");
  if (input.rejectedGrams > 0)
    cleanText(input.reasonCode ?? "", "Rejection reason");
  assertAllowed(
    Number.isSafeInteger(input.sampleCount) && input.sampleCount > 0,
    "Sample count must be a positive integer.",
  );
  assertAllowed(
    Number.isSafeInteger(input.inspectedAt) && input.inspectedAt <= Date.now(),
    "Inspection time must be a valid time that is not in the future.",
  );
  const quality = evaluatePilotInspectionQuality({
    specification,
    grossWeightGrams: input.grossWeightGrams,
    tareWeightGrams: input.tareWeightGrams,
    acceptedGrams: input.acceptedGrams,
    rejectedGrams: input.rejectedGrams,
    moisturePermille: input.moisturePermille,
    contaminationResult: input.contaminationResult,
    additionalReadings: input.additionalReadings,
    evidenceCount: input.evidenceUploadAssetIds.length,
  });
  if (quality.qualityStatus === "partial") {
    assertAllowed(
      input.partialSublots !== undefined,
      "Partial inspections require separate accepted and rejected sublot codes.",
    );
  } else {
    assertAllowed(
      input.partialSublots === undefined,
      "Sublot codes are allowed only for a partial inspection.",
    );
  }
  return quality;
}

export const record = mutation({
  args: {
    allocationId: v.id("pilotAllocations"),
    buyerAgreementRevisionId: v.id("pilotBuyerAgreementRevisions"),
    lotCode: v.string(),
    location,
    facilityId: v.optional(v.id("pilotFacilities")),
    expectedAllocationVersion: v.number(),
    ...inspectionFields,
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const principal = await requirePilotPrincipal(ctx);
    const allocation = await ctx.db.get(args.allocationId);
    assertAllowed(allocation !== null, "Allocation was not found.");
    await requireInspector(ctx, principal, allocation.programmeId);
    const operation = {
      programmeId: allocation.programmeId,
      actorUserId: principal._id,
      operationName: "pilotInspections.record",
      idempotencyKey: args.idempotencyKey,
      requestHash: JSON.stringify(args),
    };
    const receipt = await beginPilotIdempotency(ctx, operation);
    if (receipt.kind === "replay") return replayRecord(ctx, receipt.receipt);
    assertExpectedVersion(args.expectedAllocationVersion);
    assertAllowed(
      allocation.version === args.expectedAllocationVersion &&
        ["committed", "quality_cleared"].includes(allocation.status) &&
        allocation.releasedGrams < allocation.allocatedGrams,
      "Allocation is stale or unavailable for inspection.",
    );
    const [agreement, offerRevision] = await Promise.all([
      ctx.db.get(args.buyerAgreementRevisionId),
      ctx.db.get(allocation.offerRevisionId),
    ]);
    assertAllowed(
      agreement !== null &&
        offerRevision !== null &&
        agreement.requestId === allocation.requestId &&
        offerRevision.buyerAgreementRevisionId === agreement._id &&
        agreement.state === "acknowledged",
      "Inspection must use the current acknowledged buyer specification.",
    );
    const request = await ctx.db.get(allocation.requestId);
    assertAllowed(
      request !== null && request.currentAgreementRevisionId === agreement._id,
      "Buyer specification changed before inspection.",
    );
    const quality = validateInspectionInput(args, agreement.specification);
    assertPilotLocation(args.location);
    const facility =
      args.facilityId === undefined ? null : await ctx.db.get(args.facilityId);
    assertAllowed(
      args.facilityId === undefined ||
        (facility !== null &&
          facility.programmeId === allocation.programmeId &&
          facility.status === "active" &&
          (facility.facilityType === "collection_point" ||
            facility.storageAssessed)),
      "Inspection facility must be active, programme-scoped, and assessed when storage is involved.",
    );
    const inspectionLocation = facility?.location ?? args.location;
    await validateEvidence(
      ctx,
      principal,
      allocation.programmeId,
      args.evidenceUploadAssetIds,
    );
    const rootLots = await currentRootLots(ctx, allocation._id);
    const usedGrams = rootLots.reduce((sum, lot) => sum + lot.sourceGrams, 0);
    assertAllowed(
      usedGrams + quality.measuredGrams <=
        allocation.allocatedGrams - allocation.releasedGrams,
      "Inspection would exceed the active allocation quantity.",
    );
    const lotCode = cleanLotCode(args.lotCode);
    await assertUniqueLotCode(ctx, lotCode);
    const now = Date.now();
    const lotId = await ctx.db.insert("pilotProcurementLots", {
      programmeId: allocation.programmeId,
      requestId: allocation.requestId,
      allocationId: allocation._id,
      offerRevisionId: allocation.offerRevisionId,
      farmerId: allocation.farmerId,
      commercialMode: allocation.commercialMode,
      lotCode,
      sourceGrams: quality.measuredGrams,
      qualityStatus: quality.qualityStatus,
      clearedGrams: args.acceptedGrams,
      rejectedGrams: args.rejectedGrams,
      titleOwnerKind: "farmer",
      titleOwnerFarmerId: allocation.farmerId,
      currentCustodianKind: "farmer",
      currentCustodianId: allocation.farmerId,
      currentLocation: inspectionLocation,
      ...(facility === null ? {} : { facilityId: facility._id }),
      dispositionStatus:
        quality.qualityStatus === "passed"
          ? "available_for_plan"
          : quality.qualityStatus === "partial"
            ? "closed"
            : "held",
      version: 0,
      createdAt: now,
      updatedAt: now,
    });
    let lot = (await ctx.db.get(lotId))!;
    const childLotIds =
      quality.qualityStatus === "partial"
        ? await createPartialSublots(ctx, lot, args.partialSublots!)
        : [];
    const inspectionId = await ctx.db.insert("pilotInspections", {
      programmeId: allocation.programmeId,
      requestId: allocation.requestId,
      lotId,
      allocationId: allocation._id,
      buyerAgreementRevisionId: agreement._id,
      samplingMethod: args.samplingMethod.trim(),
      testMethod: args.testMethod.trim(),
      sampleCount: args.sampleCount,
      ...(args.moisturePermille === undefined
        ? {}
        : { moisturePermille: args.moisturePermille }),
      contaminationResult: args.contaminationResult,
      additionalReadings: args.additionalReadings,
      grossWeightGrams: args.grossWeightGrams,
      tareWeightGrams: args.tareWeightGrams,
      measuredGrams: quality.measuredGrams,
      acceptedGrams: args.acceptedGrams,
      rejectedGrams: args.rejectedGrams,
      qualityStatus: quality.qualityStatus,
      ...(args.reasonCode === undefined
        ? {}
        : { reasonCode: args.reasonCode.trim() }),
      ...(args.notes === undefined ? {} : { notes: args.notes.trim() }),
      evidenceUploadAssetIds: args.evidenceUploadAssetIds,
      inspectedByUserId: principal._id,
      inspectedAt: args.inspectedAt,
      createdAt: now,
    });
    const custodyEventId = await ctx.db.insert("pilotCustodyEvents", {
      programmeId: allocation.programmeId,
      requestId: allocation.requestId,
      lotId,
      eventType: "held",
      grams: quality.measuredGrams,
      fromCustodian: {
        kind: "farmer",
        id: allocation.farmerId,
        displayNameSnapshot: "Farmer owner",
      },
      toCustodian: {
        kind: "farmer",
        id: allocation.farmerId,
        displayNameSnapshot: "Farmer owner",
      },
      location: inspectionLocation,
      evidenceUploadAssetIds: [],
      reasonCode: "inspection_recorded_farmer_retains_custody",
      recordedByUserId: principal._id,
      occurredAt: args.inspectedAt,
      createdAt: now,
    });
    await attachEvidence(
      ctx,
      allocation.programmeId,
      inspectionId,
      args.evidenceUploadAssetIds,
    );
    const updatedAllocation = await refreshAllocationClearance(ctx, allocation);
    const inspection = (await ctx.db.get(inspectionId))!;
    lot = (await ctx.db.get(lotId))!;
    await emitInspectionEvent(
      ctx,
      inspection,
      allocation.farmerId,
      "pilot.inspection.recorded",
      principal._id,
      `${lotCode} recorded as ${quality.qualityStatus}; ${args.acceptedGrams}g cleared and ${args.rejectedGrams}g rejected.`,
    );
    await insertPilotActivityEvent(ctx, {
      programmeId: allocation.programmeId,
      requestId: allocation.requestId,
      entityType: "pilotProcurementLots",
      entityId: lotId,
      entityRevision: lot.version,
      eventName: "pilot.lot.created",
      actorUserId: principal._id,
      recipientViews: [
        {
          audience: "farmer",
          targetId: allocation.farmerId,
          title: "Procurement lot recorded",
          detail: `${lotCode} remains farmer-owned and in farmer custody.`,
        },
        {
          audience: "pilot_ops",
          title: "Procurement lot recorded",
          detail: `${lotCode} was created without a warehouse dependency.`,
        },
      ],
      createdAt: now,
    });
    let qualityIssueId: Id<"pilotIssues"> | undefined;
    if (args.rejectedGrams > 0) {
      const assignedToUserId = await findPilotIssueOwner(
        ctx,
        allocation.programmeId,
      );
      qualityIssueId = await ctx.db.insert("pilotIssues", {
        programmeId: allocation.programmeId,
        requestId: allocation.requestId,
        lotId,
        issueType: "quality_shortfall",
        status: "open",
        assignedToUserId,
        reasonCode: args.reasonCode?.trim() || "inspection_quality_shortfall",
        summary: `${args.rejectedGrams}g failed the recorded inspection criteria.`,
        nextStep:
          "Review the inspection evidence and record a disposition for the rejected quantity.",
        responsibleCustodian: {
          kind: "farmer",
          id: allocation.farmerId,
          displayNameSnapshot: "Farmer owner",
        },
        deadlineAt: now + 24 * 60 * 60 * 1000,
        evidenceUploadAssetIds: args.evidenceUploadAssetIds,
        version: 0,
        createdByUserId: principal._id,
        createdAt: now,
        updatedAt: now,
      });
      await insertPilotActivityEvent(ctx, {
        programmeId: allocation.programmeId,
        requestId: allocation.requestId,
        entityType: "pilotProcurementLots",
        entityId: lotId,
        entityRevision: lot.version,
        eventName: "pilot.quality.shortfall",
        actorUserId: principal._id,
        recipientViews: [
          {
            audience: "farmer",
            targetId: allocation.farmerId,
            title: "Quality shortfall recorded",
            detail: `${args.rejectedGrams}g remains farmer-owned and held for disposition.`,
          },
          {
            audience: "pilot_ops",
            targetId: assignedToUserId,
            title: "Quality shortfall recorded",
            detail: `${args.rejectedGrams}g is excluded from cleared supply. Review its disposition within 24 hours.`,
          },
          {
            audience: "buyer",
            title: "Cleared supply changed",
            detail: `${args.rejectedGrams}g was excluded by inspection.`,
          },
        ],
        createdAt: now,
      });
    }
    await completePilotIdempotency(ctx, receipt.receiptId, [
      { entityType: "pilotInspections", entityId: inspectionId },
      { entityType: "pilotProcurementLots", entityId: lotId },
      { entityType: "pilotCustodyEvents", entityId: custodyEventId },
      ...childLotIds.map((entityId) => ({
        entityType: "pilotProcurementLots" as const,
        entityId,
      })),
      { entityType: "pilotAllocations", entityId: allocation._id },
      ...(qualityIssueId === undefined
        ? []
        : [{ entityType: "pilotIssues" as const, entityId: qualityIssueId }]),
    ]);
    return {
      inspection: inspectionSummary(inspection),
      lot,
      childLotIds,
      allocation: updatedAllocation,
      missingRequiredResults: quality.missingRequiredResults,
      purchaseAcceptanceBlocked: allocation.commercialMode === "kuapa_purchase",
    };
  },
});

export const correct = mutation({
  args: {
    inspectionId: v.id("pilotInspections"),
    expectedAllocationVersion: v.number(),
    ...inspectionFields,
    correctionReason: v.string(),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const principal = await requirePilotPrincipal(ctx);
    const previous = await ctx.db.get(args.inspectionId);
    assertAllowed(previous !== null, "Inspection was not found.");
    await requireInspector(ctx, principal, previous.programmeId);
    const receipt = await beginPilotIdempotency(ctx, {
      programmeId: previous.programmeId,
      actorUserId: principal._id,
      operationName: "pilotInspections.correct",
      idempotencyKey: args.idempotencyKey,
      requestHash: JSON.stringify(args),
    });
    if (receipt.kind === "replay") return replayRecord(ctx, receipt.receipt);
    assertAllowed(
      previous.qualityStatus !== "superseded",
      "Only the current inspection can be corrected.",
    );
    cleanText(args.correctionReason, "Correction reason");
    const [lot, allocation, agreement] = await Promise.all([
      ctx.db.get(previous.lotId),
      ctx.db.get(previous.allocationId),
      ctx.db.get(previous.buyerAgreementRevisionId),
    ]);
    assertAllowed(
      lot !== null && allocation !== null && agreement !== null,
      "Inspection links are incomplete.",
    );
    assertAllowed(
      lot.parentLotId === undefined,
      "Correct the parent inspection, not a derived sublot.",
    );
    assertExpectedVersion(args.expectedAllocationVersion);
    assertAllowed(
      allocation.version === args.expectedAllocationVersion,
      "Allocation changed before correction.",
    );
    const request = await ctx.db.get(previous.requestId);
    assertAllowed(
      request !== null &&
        request.currentAgreementRevisionId === agreement._id &&
        agreement.state === "acknowledged",
      "Buyer specification changed; record a new inspection against the current agreement instead.",
    );
    const later = await ctx.db
      .query("pilotInspections")
      .withIndex("by_lot_created_at", (q) => q.eq("lotId", lot._id))
      .collect();
    assertAllowed(
      !later.some(
        (candidate) => candidate.supersedesInspectionId === previous._id,
      ),
      "Inspection already has a correction.",
    );
    const children = await ctx.db
      .query("pilotProcurementLots")
      .withIndex("by_parent", (q) => q.eq("parentLotId", lot._id))
      .collect();
    const custody = (
      await Promise.all(
        [lot._id, ...children.map((child) => child._id)].map((lotId) =>
          ctx.db
            .query("pilotCustodyEvents")
            .withIndex("by_lot_occurred_at", (q) => q.eq("lotId", lotId))
            .collect(),
        ),
      )
    ).flat();
    assertAllowed(
      !custody.some((event) =>
        ["loaded", "handed_over", "delivered"].includes(event.eventType),
      ),
      "Quality cannot be silently corrected after loading or handover; open a discrepancy instead.",
    );
    const quality = validateInspectionInput(args, agreement.specification);
    assertAllowed(
      quality.measuredGrams === lot.sourceGrams,
      "A correction cannot change the lot net weight.",
    );
    await validateEvidence(
      ctx,
      principal,
      previous.programmeId,
      args.evidenceUploadAssetIds,
      previous._id,
    );
    const now = Date.now();
    await ctx.db.patch(previous._id, { qualityStatus: "superseded" });
    for (const child of children)
      await ctx.db.patch(child._id, {
        qualityStatus: "superseded",
        clearedGrams: 0,
        rejectedGrams: 0,
        dispositionStatus: "closed",
        version: child.version + 1,
        updatedAt: now,
      });
    await ctx.db.patch(lot._id, {
      qualityStatus: quality.qualityStatus,
      clearedGrams: args.acceptedGrams,
      rejectedGrams: args.rejectedGrams,
      dispositionStatus:
        quality.qualityStatus === "passed"
          ? "available_for_plan"
          : quality.qualityStatus === "partial"
            ? "closed"
            : "held",
      version: lot.version + 1,
      updatedAt: now,
    });
    const updatedLot = (await ctx.db.get(lot._id))!;
    const childLotIds =
      quality.qualityStatus === "partial"
        ? await createPartialSublots(ctx, updatedLot, args.partialSublots!)
        : [];
    const inspectionId = await ctx.db.insert("pilotInspections", {
      programmeId: previous.programmeId,
      requestId: previous.requestId,
      lotId: previous.lotId,
      allocationId: previous.allocationId,
      buyerAgreementRevisionId: previous.buyerAgreementRevisionId,
      supersedesInspectionId: previous._id,
      samplingMethod: args.samplingMethod.trim(),
      testMethod: args.testMethod.trim(),
      sampleCount: args.sampleCount,
      ...(args.moisturePermille === undefined
        ? {}
        : { moisturePermille: args.moisturePermille }),
      contaminationResult: args.contaminationResult,
      additionalReadings: args.additionalReadings,
      grossWeightGrams: args.grossWeightGrams,
      tareWeightGrams: args.tareWeightGrams,
      measuredGrams: quality.measuredGrams,
      acceptedGrams: args.acceptedGrams,
      rejectedGrams: args.rejectedGrams,
      qualityStatus: quality.qualityStatus,
      reasonCode: args.reasonCode?.trim() || "inspection_correction",
      notes: [
        `Correction: ${args.correctionReason.trim()}`,
        ...(args.notes?.trim() ? [args.notes.trim()] : []),
      ].join("\n"),
      evidenceUploadAssetIds: args.evidenceUploadAssetIds,
      inspectedByUserId: principal._id,
      inspectedAt: args.inspectedAt,
      createdAt: now,
    });
    await attachEvidence(
      ctx,
      previous.programmeId,
      inspectionId,
      args.evidenceUploadAssetIds,
    );
    const updatedAllocation = await refreshAllocationClearance(ctx, allocation);
    await reopenAffectedPlans(ctx, updatedLot, lot.clearedGrams);
    const inspection = (await ctx.db.get(inspectionId))!;
    await emitInspectionEvent(
      ctx,
      inspection,
      lot.farmerId,
      "pilot.inspection.superseded",
      principal._id,
      `${lot.lotCode} inspection was corrected: ${args.correctionReason.trim()}`,
    );
    await completePilotIdempotency(ctx, receipt.receiptId, [
      { entityType: "pilotInspections", entityId: inspectionId },
      { entityType: "pilotProcurementLots", entityId: lot._id },
      ...childLotIds.map((entityId) => ({
        entityType: "pilotProcurementLots" as const,
        entityId,
      })),
      { entityType: "pilotAllocations", entityId: allocation._id },
    ]);
    return {
      inspection: inspectionSummary(inspection),
      supersededInspectionId: previous._id,
      lot: updatedLot,
      childLotIds,
      allocation: updatedAllocation,
      missingRequiredResults: quality.missingRequiredResults,
      purchaseAcceptanceBlocked: allocation.commercialMode === "kuapa_purchase",
    };
  },
});

export const getReceipt = query({
  args: { inspectionId: v.id("pilotInspections") },
  handler: async (ctx, args) => {
    const principal = await requirePilotPrincipal(ctx);
    const inspection = await ctx.db.get(args.inspectionId);
    if (inspection === null) return null;
    const lot = await ctx.db.get(inspection.lotId);
    assertAllowed(lot !== null, "Inspection lot was not found.");
    await requirePilotLotRead(ctx, principal, lot);
    const [request, agreement, farmer, children] = await Promise.all([
      ctx.db.get(inspection.requestId),
      ctx.db.get(inspection.buyerAgreementRevisionId),
      ctx.db.get(lot.farmerId),
      ctx.db
        .query("pilotProcurementLots")
        .withIndex("by_parent", (q) => q.eq("parentLotId", lot._id))
        .collect(),
    ]);
    assertAllowed(
      request !== null && agreement !== null && farmer !== null,
      "Receipt links are incomplete.",
    );
    const ownsFarmer =
      principal.role === "farmer" && farmer.userId === principal._id;
    return {
      receiptCode: `INSP-${lot.lotCode}-${inspection._id.slice(-6).toUpperCase()}`,
      documentKind: "private_pilot_inspection_receipt" as const,
      printable: true,
      inspection: inspectionSummary(inspection),
      lot: projectPilotLotForPrincipal(principal, lot, ownsFarmer),
      sublots: children.map((child) =>
        projectPilotLotForPrincipal(principal, child, ownsFarmer),
      ),
      specification: agreement.specification,
      requestReference: request._id,
      farmerReference: ownsFarmer ? farmer._id : undefined,
      generatedAt: Date.now(),
    };
  },
});

export { refreshAllocationClearance };
