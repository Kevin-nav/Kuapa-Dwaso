import { v } from "convex/values";
import {
  calculatePilotAmountPesewas,
  getPilotReadinessBlockers,
} from "@kuapa-dwaso/utils/pilot";
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
  projectPilotLotForPrincipal,
  requirePilotCapability,
  requirePilotPrincipal,
  requirePilotRequestRead,
  type PilotPrincipal,
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
const stopInput = v.object({
  sequence: v.number(),
  stopType: v.union(
    v.literal("collection"),
    v.literal("facility"),
    v.literal("destination"),
  ),
  location,
  facilityId: v.optional(v.id("pilotFacilities")),
  lotIds: v.array(v.id("pilotProcurementLots")),
  windowStartAt: v.number(),
  windowEndAt: v.number(),
});
const custodyEventType = v.union(
  v.literal("collected"),
  v.literal("loaded"),
  v.literal("handed_over"),
  v.literal("delivered"),
);
const acceptanceLine = v.object({
  lotId: v.id("pilotProcurementLots"),
  sublotId: v.optional(v.id("pilotProcurementLots")),
  deliveredGrams: v.number(),
  acceptedGrams: v.number(),
  rejectedGrams: v.number(),
  reasonCode: v.optional(v.string()),
  evidenceUploadAssetIds: v.array(v.id("uploadAssets")),
});

type StopDraft = {
  sequence: number;
  stopType: "collection" | "facility" | "destination";
  location: Doc<"pilotFulfilmentPlans">["destination"];
  facilityId?: Id<"pilotFacilities">;
  lotIds: Id<"pilotProcurementLots">[];
  windowStartAt: number;
  windowEndAt: number;
};

function planSummary(plan: Doc<"pilotFulfilmentPlans">) {
  return {
    planId: plan._id,
    programmeId: plan.programmeId,
    requestId: plan.requestId,
    buyerAgreementRevisionId: plan.buyerAgreementRevisionId,
    status: plan.status,
    plannedGrams: plan.plannedGrams,
    transporterId: plan.transporterId,
    driverUserId: plan.driverUserId,
    vehicleRegistration: plan.vehicleRegistration,
    ...(plan.vehicleCapacityGrams === undefined
      ? {}
      : { vehicleCapacityGrams: plan.vehicleCapacityGrams }),
    collectionWindowStartAt: plan.collectionWindowStartAt,
    collectionWindowEndAt: plan.collectionWindowEndAt,
    deliveryWindowStartAt: plan.deliveryWindowStartAt,
    deliveryWindowEndAt: plan.deliveryWindowEndAt,
    destination: plan.destination,
    readinessBlockers: plan.readinessBlockers,
    cancellationState: plan.cancellationState,
    version: plan.version,
  };
}

async function requirePlanManager(
  ctx: QueryCtx | MutationCtx,
  principal: PilotPrincipal,
  programmeId: Id<"pilotProgrammes">,
) {
  await requirePilotCapability(
    ctx,
    principal,
    programmeId,
    "fulfilment:manage",
  );
}

async function requireOwnedBuyer(
  ctx: QueryCtx | MutationCtx,
  principal: PilotPrincipal,
  request: Doc<"pilotBuyerRequests">,
) {
  assertAllowed(principal.role === "buyer", "Buyer identity is required.");
  const buyer = await ctx.db.get(request.buyerId);
  assertAllowed(
    buyer !== null && buyer.userId === principal._id,
    "Buyer request belongs to another account.",
  );
  return buyer;
}

async function planStops(
  ctx: QueryCtx | MutationCtx,
  planId: Id<"pilotFulfilmentPlans">,
) {
  return await ctx.db
    .query("pilotFulfilmentStops")
    .withIndex("by_plan_sequence", (q) => q.eq("planId", planId))
    .filter((q) => q.neq(q.field("status"), "cancelled"))
    .collect();
}

async function validateStops(
  ctx: MutationCtx,
  request: Doc<"pilotBuyerRequests">,
  drafts: StopDraft[],
  currentlyPlannedLotIds: ReadonlySet<Id<"pilotProcurementLots">> = new Set(),
) {
  assertAllowed(
    drafts.length >= 2 && drafts.length <= 25,
    "A plan needs 2 to 25 ordered stops.",
  );
  const sorted = [...drafts].sort((a, b) => a.sequence - b.sequence);
  assertAllowed(
    sorted.every((stop, index) => stop.sequence === index + 1),
    "Stop sequence must be contiguous and start at 1.",
  );
  assertAllowed(
    sorted.at(-1)?.stopType === "destination" &&
      sorted.filter((stop) => stop.stopType === "destination").length === 1,
    "The final and only destination stop must end the plan.",
  );
  const lotIds = sorted.flatMap((stop) => stop.lotIds);
  assertAllowed(
    new Set(lotIds).size === lotIds.length,
    "A lot can appear at only one stop.",
  );
  assertAllowed(lotIds.length > 0, "At least one cleared lot is required.");
  let plannedGrams = 0;
  const lots: Doc<"pilotProcurementLots">[] = [];
  for (const stop of sorted) {
    assertPilotLocation(stop.location);
    assertPilotWindow(stop.windowStartAt, stop.windowEndAt, "stopWindow");
    assertAllowed(
      stop.stopType === "collection" || stop.lotIds.length === 0,
      "Lots belong on collection stops only.",
    );
    if (stop.facilityId !== undefined) {
      const facility = await ctx.db.get(stop.facilityId);
      assertAllowed(
        facility !== null &&
          facility.programmeId === request.programmeId &&
          facility.status === "active" &&
          (facility.facilityType === "collection_point" ||
            facility.storageAssessed),
        "Plan facility must be active, programme-scoped, and assessed when storage is involved.",
      );
    }
    for (const lotId of stop.lotIds) {
      const lot = await ctx.db.get(lotId);
      assertAllowed(
        lot !== null &&
          lot.requestId === request._id &&
          lot.qualityStatus === "passed" &&
          lot.clearedGrams === lot.sourceGrams &&
          (lot.dispositionStatus === "available_for_plan" ||
            (lot.dispositionStatus === "allocated_to_plan" &&
              currentlyPlannedLotIds.has(lot._id))),
        "Only current, fully cleared dispatchable sublots may be planned.",
      );
      lots.push(lot);
      plannedGrams += lot.clearedGrams;
    }
  }
  return { sorted, lots, plannedGrams };
}

async function financialReleaseSatisfied(
  ctx: QueryCtx | MutationCtx,
  request: Doc<"pilotBuyerRequests">,
  agreement: Doc<"pilotBuyerAgreementRevisions">,
  lots: Doc<"pilotProcurementLots">[],
) {
  if (request.commercialMode === "kuapa_purchase") {
    for (const lot of lots) {
      const reservations = await ctx.db
        .query("pilotFundingReservations")
        .withIndex("by_offer_revision", (q) =>
          q.eq("farmerOfferRevisionId", lot.offerRevisionId),
        )
        .collect();
      if (
        !reservations.some(
          (reservation) =>
            reservation.requestId === request._id &&
            reservation.buyerAgreementRevisionId === agreement._id &&
            (reservation.status === "active" ||
              reservation.status === "partly_consumed") &&
            reservation.expiresAt > Date.now(),
        )
      )
        return false;
    }
    return true;
  }
  const requiresClearedFunds = agreement.paymentTerms.some(
    (term) => term.trigger === "cleared_buyer_funds",
  );
  if (!requiresClearedFunds) return true;
  const required = calculatePilotAmountPesewas({
    quantityGrams: agreement.quantityGrams,
    rate: agreement.producePriceRate,
  });
  const transactions = await ctx.db
    .query("pilotPaymentTransactions")
    .withIndex("by_request_status", (q) =>
      q.eq("requestId", request._id).eq("status", "succeeded"),
    )
    .collect();
  return (
    transactions.reduce(
      (sum, transaction) => sum + transaction.amountPesewas,
      0,
    ) >= required
  );
}

async function evaluatePlan(
  ctx: QueryCtx | MutationCtx,
  plan: Doc<"pilotFulfilmentPlans">,
) {
  const [request, agreement, stops, issues] = await Promise.all([
    ctx.db.get(plan.requestId),
    ctx.db.get(plan.buyerAgreementRevisionId),
    planStops(ctx, plan._id),
    ctx.db
      .query("pilotIssues")
      .withIndex("by_request_status", (q) => q.eq("requestId", plan.requestId))
      .collect(),
  ]);
  assertAllowed(
    request !== null && agreement !== null,
    "Plan agreement was not found.",
  );
  const lotIds = [...new Set(stops.flatMap((stop) => stop.lotIds))];
  const lots: Doc<"pilotProcurementLots">[] = [];
  for (const lotId of lotIds) {
    const lot = await ctx.db.get(lotId);
    if (lot !== null) lots.push(lot);
  }
  const transporter =
    plan.transporterId === undefined
      ? null
      : await ctx.db.get(plan.transporterId);
  const driver =
    plan.driverUserId === undefined
      ? null
      : await ctx.db.get(plan.driverUserId);
  const driverEligible =
    transporter !== null &&
    driver !== null &&
    transporter.userId === driver._id &&
    transporter.status === "active" &&
    transporter.verificationStatus === "verified" &&
    driver.status === "active";
  return getPilotReadinessBlockers({
    plannedGrams: plan.plannedGrams,
    clearedGrams: lots
      .filter(
        (lot) =>
          lot.qualityStatus === "passed" &&
          lot.dispositionStatus === "allocated_to_plan",
      )
      .reduce((sum, lot) => sum + lot.clearedGrams, 0),
    agreementCurrent:
      request.currentAgreementRevisionId === agreement._id &&
      agreement.state === "acknowledged",
    agreementExpiresAt: agreement.expiresAt,
    now: Date.now(),
    collectionWindowStartAt: plan.collectionWindowStartAt,
    collectionWindowEndAt: plan.collectionWindowEndAt,
    deliveryWindowStartAt: plan.deliveryWindowStartAt,
    deliveryWindowEndAt: plan.deliveryWindowEndAt,
    agreementDeliveryWindowStartAt: agreement.deliveryWindowStartAt,
    agreementDeliveryWindowEndAt: agreement.deliveryWindowEndAt,
    driverAssigned:
      plan.driverUserId !== undefined && plan.transporterId !== undefined,
    driverEligible,
    ...(plan.vehicleCapacityGrams === undefined
      ? {}
      : { vehicleCapacityGrams: plan.vehicleCapacityGrams }),
    financialReleaseSatisfied: await financialReleaseSatisfied(
      ctx,
      request,
      agreement,
      lots,
    ),
    hasBlockingIssue: issues.some(
      (issue) => issue.status !== "resolved" && issue.status !== "closed",
    ),
  });
}

async function insertStops(
  ctx: MutationCtx,
  programmeId: Id<"pilotProgrammes">,
  planId: Id<"pilotFulfilmentPlans">,
  drafts: StopDraft[],
) {
  const now = Date.now();
  const ids: Id<"pilotFulfilmentStops">[] = [];
  let totalPlannedGrams = 0;
  for (const lotId of new Set(drafts.flatMap((stop) => stop.lotIds)))
    totalPlannedGrams += (await ctx.db.get(lotId))!.clearedGrams;
  for (const stop of drafts) {
    let plannedGrams = 0;
    for (const lotId of stop.lotIds)
      plannedGrams += (await ctx.db.get(lotId))!.clearedGrams;
    if (stop.stopType !== "collection") plannedGrams = totalPlannedGrams;
    ids.push(
      await ctx.db.insert("pilotFulfilmentStops", {
        programmeId,
        planId,
        sequence: stop.sequence,
        stopType: stop.stopType,
        location: stop.location,
        ...(stop.facilityId === undefined
          ? {}
          : { facilityId: stop.facilityId }),
        lotIds: stop.lotIds,
        plannedGrams,
        collectedGrams: 0,
        windowStartAt: stop.windowStartAt,
        windowEndAt: stop.windowEndAt,
        status: "planned",
        version: 0,
        createdAt: now,
        updatedAt: now,
      }),
    );
  }
  return ids;
}

async function emitPlanEvent(
  ctx: MutationCtx,
  plan: Doc<"pilotFulfilmentPlans">,
  eventName: string,
  actorUserId: Id<"users">,
  detail: string,
) {
  await ctx.db.insert("pilotActivityEvents", {
    programmeId: plan.programmeId,
    requestId: plan.requestId,
    entityType: "pilotFulfilmentPlans",
    entityId: plan._id,
    entityRevision: plan.version,
    eventName,
    actorUserId,
    recipientViews: [
      { audience: "pilot_ops", title: "Fulfilment plan updated", detail },
      { audience: "buyer", title: "Delivery plan updated", detail },
      ...(plan.driverUserId === undefined
        ? []
        : [
            {
              audience: "transporter" as const,
              targetId: plan.driverUserId,
              title: "Transport assignment updated",
              detail,
            },
          ]),
    ],
    createdAt: Date.now(),
  });
}

export const createPlan = mutation({
  args: {
    requestId: v.id("pilotBuyerRequests"),
    buyerAgreementRevisionId: v.id("pilotBuyerAgreementRevisions"),
    collectionWindowStartAt: v.number(),
    collectionWindowEndAt: v.number(),
    deliveryWindowStartAt: v.number(),
    deliveryWindowEndAt: v.number(),
    destination: location,
    stops: v.array(stopInput),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const principal = await requirePilotPrincipal(ctx);
    const request = await ctx.db.get(args.requestId);
    assertAllowed(request !== null, "Pilot request was not found.");
    await requirePlanManager(ctx, principal, request.programmeId);
    const receipt = await beginPilotIdempotency(ctx, {
      programmeId: request.programmeId,
      actorUserId: principal._id,
      operationName: "pilotFulfilment.createPlan",
      idempotencyKey: args.idempotencyKey,
      requestHash: JSON.stringify(args),
    });
    if (receipt.kind === "replay") {
      const plan = await ctx.db.get(
        replayEntityId<"pilotFulfilmentPlans">(
          receipt.receipt,
          "pilotFulfilmentPlans",
        ),
      );
      assertAllowed(plan !== null, "Plan replay was not found.");
      return planSummary(plan);
    }
    assertPilotWindow(
      args.collectionWindowStartAt,
      args.collectionWindowEndAt,
      "collectionWindow",
    );
    assertPilotWindow(
      args.deliveryWindowStartAt,
      args.deliveryWindowEndAt,
      "deliveryWindow",
    );
    assertPilotLocation(args.destination);
    const agreement = await ctx.db.get(args.buyerAgreementRevisionId);
    assertAllowed(
      agreement !== null &&
        request.status === "confirmed" &&
        request.currentAgreementRevisionId === agreement._id &&
        agreement.state === "acknowledged" &&
        agreement.expiresAt > Date.now(),
      "Plan requires the current acknowledged, unexpired agreement on a confirmed request.",
    );
    const existing = await ctx.db
      .query("pilotFulfilmentPlans")
      .withIndex("by_request", (q) => q.eq("requestId", request._id))
      .collect();
    assertAllowed(
      existing.every((plan) => plan.status === "cancelled"),
      "Request already has an active fulfilment plan.",
    );
    const checked = await validateStops(ctx, request, args.stops);
    assertAllowed(
      checked.plannedGrams === agreement.quantityGrams,
      "Planned lot quantity must equal the acknowledged agreement quantity.",
    );
    const now = Date.now();
    const planId = await ctx.db.insert("pilotFulfilmentPlans", {
      programmeId: request.programmeId,
      requestId: request._id,
      buyerAgreementRevisionId: agreement._id,
      status: "planning",
      plannedGrams: checked.plannedGrams,
      collectionWindowStartAt: args.collectionWindowStartAt,
      collectionWindowEndAt: args.collectionWindowEndAt,
      deliveryWindowStartAt: args.deliveryWindowStartAt,
      deliveryWindowEndAt: args.deliveryWindowEndAt,
      destination: args.destination,
      readinessBlockers: ["driver_not_assigned", "vehicle_capacity_shortfall"],
      cancellationState: "none",
      version: 0,
      createdAt: now,
      updatedAt: now,
    });
    const stopIds = await insertStops(
      ctx,
      request.programmeId,
      planId,
      checked.sorted,
    );
    for (const lot of checked.lots)
      await ctx.db.patch(lot._id, {
        dispositionStatus: "allocated_to_plan",
        version: lot.version + 1,
        updatedAt: now,
      });
    let plan = (await ctx.db.get(planId))!;
    const blockers = await evaluatePlan(ctx, plan);
    await ctx.db.patch(planId, { readinessBlockers: blockers });
    plan = (await ctx.db.get(planId))!;
    await emitPlanEvent(
      ctx,
      plan,
      "pilot.fulfilment.plan_created",
      principal._id,
      "Collection plan created.",
    );
    await completePilotIdempotency(ctx, receipt.receiptId, [
      { entityType: "pilotFulfilmentPlans", entityId: planId },
      ...stopIds.map((entityId) => ({
        entityType: "pilotFulfilmentStops" as const,
        entityId,
      })),
    ]);
    return planSummary(plan);
  },
});

export const updatePlan = mutation({
  args: {
    planId: v.id("pilotFulfilmentPlans"),
    collectionWindowStartAt: v.number(),
    collectionWindowEndAt: v.number(),
    deliveryWindowStartAt: v.number(),
    deliveryWindowEndAt: v.number(),
    destination: location,
    stops: v.array(stopInput),
    expectedVersion: v.number(),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const principal = await requirePilotPrincipal(ctx);
    const plan = await ctx.db.get(args.planId);
    assertAllowed(plan !== null, "Plan was not found.");
    await requirePlanManager(ctx, principal, plan.programmeId);
    const receipt = await beginPilotIdempotency(ctx, {
      programmeId: plan.programmeId,
      actorUserId: principal._id,
      operationName: "pilotFulfilment.updatePlan",
      idempotencyKey: args.idempotencyKey,
      requestHash: JSON.stringify(args),
    });
    if (receipt.kind === "replay") {
      const replayed = await ctx.db.get(
        replayEntityId<"pilotFulfilmentPlans">(
          receipt.receipt,
          "pilotFulfilmentPlans",
        ),
      );
      assertAllowed(replayed !== null, "Plan replay was not found.");
      return planSummary(replayed);
    }
    assertExpectedVersion(args.expectedVersion);
    assertAllowed(
      plan.version === args.expectedVersion &&
        (plan.status === "planning" || plan.status === "assigned"),
      "Only an unchanged, unstarted plan can be updated.",
    );
    assertPilotWindow(
      args.collectionWindowStartAt,
      args.collectionWindowEndAt,
      "collectionWindow",
    );
    assertPilotWindow(
      args.deliveryWindowStartAt,
      args.deliveryWindowEndAt,
      "deliveryWindow",
    );
    assertPilotLocation(args.destination);
    const [request, agreement, existingStops, custody] = await Promise.all([
      ctx.db.get(plan.requestId),
      ctx.db.get(plan.buyerAgreementRevisionId),
      planStops(ctx, plan._id),
      ctx.db
        .query("pilotCustodyEvents")
        .withIndex("by_plan_occurred_at", (q) => q.eq("planId", plan._id))
        .collect(),
    ]);
    assertAllowed(
      request !== null &&
        agreement !== null &&
        request.currentAgreementRevisionId === agreement._id &&
        agreement.state === "acknowledged" &&
        agreement.expiresAt > Date.now() &&
        custody.length === 0,
      "Plan cannot change after agreement expiry, supersession, or custody movement.",
    );
    const existingLotIds = new Set(
      existingStops.flatMap((stop) => stop.lotIds),
    );
    const checked = await validateStops(
      ctx,
      request,
      args.stops,
      existingLotIds,
    );
    assertAllowed(
      checked.plannedGrams === agreement.quantityGrams,
      "Updated lot quantity must equal the acknowledged agreement quantity.",
    );
    const nextLotIds = new Set(checked.lots.map((lot) => lot._id));
    const now = Date.now();
    for (const lotId of existingLotIds) {
      if (nextLotIds.has(lotId)) continue;
      const lot = await ctx.db.get(lotId);
      if (lot !== null)
        await ctx.db.patch(lot._id, {
          dispositionStatus: "available_for_plan",
          version: lot.version + 1,
          updatedAt: now,
        });
    }
    for (const stop of existingStops)
      await ctx.db.patch(stop._id, {
        status: "cancelled",
        version: stop.version + 1,
        updatedAt: now,
      });
    const stopIds = await insertStops(
      ctx,
      plan.programmeId,
      plan._id,
      checked.sorted,
    );
    for (const lot of checked.lots) {
      if (existingLotIds.has(lot._id)) continue;
      await ctx.db.patch(lot._id, {
        dispositionStatus: "allocated_to_plan",
        version: lot.version + 1,
        updatedAt: now,
      });
    }
    await ctx.db.patch(plan._id, {
      plannedGrams: checked.plannedGrams,
      collectionWindowStartAt: args.collectionWindowStartAt,
      collectionWindowEndAt: args.collectionWindowEndAt,
      deliveryWindowStartAt: args.deliveryWindowStartAt,
      deliveryWindowEndAt: args.deliveryWindowEndAt,
      destination: args.destination,
      status: plan.driverUserId === undefined ? "planning" : "assigned",
      version: plan.version + 1,
      updatedAt: now,
    });
    let updated = (await ctx.db.get(plan._id))!;
    const blockers = await evaluatePlan(ctx, updated);
    await ctx.db.patch(plan._id, { readinessBlockers: blockers });
    updated = (await ctx.db.get(plan._id))!;
    await emitPlanEvent(
      ctx,
      updated,
      "pilot.fulfilment.plan_created",
      principal._id,
      "Collection stops or delivery commitment changed under the current acknowledged agreement.",
    );
    await completePilotIdempotency(ctx, receipt.receiptId, [
      { entityType: "pilotFulfilmentPlans", entityId: plan._id },
      ...stopIds.map((entityId) => ({
        entityType: "pilotFulfilmentStops" as const,
        entityId,
      })),
    ]);
    return planSummary(updated);
  },
});

export const assignDriver = mutation({
  args: {
    planId: v.id("pilotFulfilmentPlans"),
    transporterId: v.id("transporterProfiles"),
    driverUserId: v.id("users"),
    vehicleRegistration: v.string(),
    vehicleCapacityGrams: v.number(),
    expectedVersion: v.number(),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const principal = await requirePilotPrincipal(ctx);
    const plan = await ctx.db.get(args.planId);
    assertAllowed(plan !== null, "Plan was not found.");
    await requirePlanManager(ctx, principal, plan.programmeId);
    const receipt = await beginPilotIdempotency(ctx, {
      programmeId: plan.programmeId,
      actorUserId: principal._id,
      operationName: "pilotFulfilment.assignDriver",
      idempotencyKey: args.idempotencyKey,
      requestHash: JSON.stringify(args),
    });
    if (receipt.kind === "replay") {
      const replayed = await ctx.db.get(
        replayEntityId<"pilotFulfilmentPlans">(
          receipt.receipt,
          "pilotFulfilmentPlans",
        ),
      );
      assertAllowed(replayed !== null, "Plan replay was not found.");
      return planSummary(replayed);
    }
    assertExpectedVersion(args.expectedVersion);
    assertPilotQuantityGrams(args.vehicleCapacityGrams, "vehicleCapacityGrams");
    const [transporter, driver] = await Promise.all([
      ctx.db.get(args.transporterId),
      ctx.db.get(args.driverUserId),
    ]);
    assertAllowed(
      plan.version === args.expectedVersion &&
        plan.status === "planning" &&
        transporter !== null &&
        driver !== null &&
        transporter.userId === driver._id &&
        transporter.status === "active" &&
        transporter.verificationStatus === "verified" &&
        driver.status === "active" &&
        args.vehicleRegistration.trim().length >= 3,
      "Driver assignment is stale, unverified, inactive, or incomplete.",
    );
    const now = Date.now();
    await ctx.db.patch(plan._id, {
      transporterId: transporter._id,
      driverUserId: driver._id,
      vehicleRegistration: args.vehicleRegistration.trim().toUpperCase(),
      vehicleCapacityGrams: args.vehicleCapacityGrams,
      status: "assigned",
      version: plan.version + 1,
      updatedAt: now,
    });
    let updated = (await ctx.db.get(plan._id))!;
    const blockers = await evaluatePlan(ctx, updated);
    await ctx.db.patch(plan._id, { readinessBlockers: blockers });
    updated = (await ctx.db.get(plan._id))!;
    await emitPlanEvent(
      ctx,
      updated,
      "pilot.fulfilment.driver_assigned",
      principal._id,
      "Verified driver assigned.",
    );
    await completePilotIdempotency(ctx, receipt.receiptId, [
      { entityType: "pilotFulfilmentPlans", entityId: plan._id },
    ]);
    return planSummary(updated);
  },
});

export const markReady = mutation({
  args: {
    planId: v.id("pilotFulfilmentPlans"),
    expectedVersion: v.number(),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const principal = await requirePilotPrincipal(ctx);
    const plan = await ctx.db.get(args.planId);
    assertAllowed(plan !== null, "Plan was not found.");
    await requirePlanManager(ctx, principal, plan.programmeId);
    const receipt = await beginPilotIdempotency(ctx, {
      programmeId: plan.programmeId,
      actorUserId: principal._id,
      operationName: "pilotFulfilment.markReady",
      idempotencyKey: args.idempotencyKey,
      requestHash: JSON.stringify(args),
    });
    if (receipt.kind === "replay") {
      const replayed = await ctx.db.get(
        replayEntityId<"pilotFulfilmentPlans">(
          receipt.receipt,
          "pilotFulfilmentPlans",
        ),
      );
      assertAllowed(replayed !== null, "Plan replay was not found.");
      return planSummary(replayed);
    }
    assertExpectedVersion(args.expectedVersion);
    assertAllowed(
      plan.version === args.expectedVersion &&
        (plan.status === "planning" || plan.status === "assigned"),
      "Plan changed or cannot be marked ready.",
    );
    const blockers = await evaluatePlan(ctx, plan);
    assertAllowed(
      blockers.length === 0,
      `Plan is blocked: ${blockers.join(", ")}.`,
    );
    await ctx.db.patch(plan._id, {
      status: "ready",
      readinessBlockers: [],
      version: plan.version + 1,
      updatedAt: Date.now(),
    });
    const updated = (await ctx.db.get(plan._id))!;
    await emitPlanEvent(
      ctx,
      updated,
      "pilot.fulfilment.ready",
      principal._id,
      "Plan passed current readiness checks.",
    );
    await completePilotIdempotency(ctx, receipt.receiptId, [
      { entityType: "pilotFulfilmentPlans", entityId: plan._id },
    ]);
    return planSummary(updated);
  },
});

async function validateLotEvidence(
  ctx: MutationCtx,
  principal: PilotPrincipal,
  lot: Doc<"pilotProcurementLots">,
  assetIds: Id<"uploadAssets">[],
  purposes: readonly string[],
) {
  assertAllowed(
    assetIds.length > 0 && new Set(assetIds).size === assetIds.length,
    "Completed evidence is required without duplicates.",
  );
  for (const assetId of assetIds) {
    const asset = await ctx.db.get(assetId);
    assertAllowed(
      asset !== null &&
        asset.ownerUserId === principal._id &&
        purposes.includes(asset.purpose) &&
        asset.accessLevel === "private" &&
        (asset.status === "uploaded" ||
          asset.status === "verified" ||
          asset.status === "attached") &&
        asset.pilotProgrammeId === lot.programmeId &&
        asset.relatedEntityType === "pilotProcurementLots" &&
        asset.relatedEntityId === lot._id,
      "Evidence must be private, completed, actor-owned, and staged against this lot.",
    );
  }
}

export const recordCustody = mutation({
  args: {
    planId: v.id("pilotFulfilmentPlans"),
    stopId: v.id("pilotFulfilmentStops"),
    lotId: v.id("pilotProcurementLots"),
    eventType: custodyEventType,
    grams: v.number(),
    evidenceUploadAssetIds: v.array(v.id("uploadAssets")),
    expectedPlanVersion: v.number(),
    expectedLotVersion: v.number(),
    occurredAt: v.number(),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const principal = await requirePilotPrincipal(ctx);
    const [plan, stop, lot] = await Promise.all([
      ctx.db.get(args.planId),
      ctx.db.get(args.stopId),
      ctx.db.get(args.lotId),
    ]);
    assertAllowed(
      plan !== null && stop !== null && lot !== null,
      "Custody record links were not found.",
    );
    const isDriver =
      principal.role === "transporter" && plan.driverUserId === principal._id;
    if (!isDriver)
      await requirePilotCapability(
        ctx,
        principal,
        plan.programmeId,
        "custody:record",
      );
    const receipt = await beginPilotIdempotency(ctx, {
      programmeId: plan.programmeId,
      actorUserId: principal._id,
      operationName: "pilotFulfilment.recordCustody",
      idempotencyKey: args.idempotencyKey,
      requestHash: JSON.stringify(args),
    });
    if (receipt.kind === "replay") {
      const event = await ctx.db.get(
        replayEntityId<"pilotCustodyEvents">(
          receipt.receipt,
          "pilotCustodyEvents",
        ),
      );
      assertAllowed(event !== null, "Custody replay was not found.");
      return event;
    }
    assertExpectedVersion(args.expectedPlanVersion);
    assertExpectedVersion(args.expectedLotVersion);
    assertPilotQuantityGrams(args.grams, "custodyGrams");
    const allStops = await planStops(ctx, plan._id);
    const lotIsPlanned = allStops.some((candidate) =>
      candidate.lotIds.includes(lot._id),
    );
    assertAllowed(
      plan.version === args.expectedPlanVersion &&
        lot.version === args.expectedLotVersion &&
        stop.planId === plan._id &&
        lotIsPlanned &&
        (args.eventType === "handed_over" || args.eventType === "delivered"
          ? stop.stopType === "destination"
          : stop.lotIds.includes(lot._id)) &&
        lot.dispositionStatus === "allocated_to_plan" &&
        args.grams === lot.clearedGrams &&
        Number.isSafeInteger(args.occurredAt) &&
        args.occurredAt <= Date.now(),
      "Custody action is stale, unassigned, or has a quantity mismatch.",
    );
    if (args.eventType === "collected")
      assertAllowed(
        plan.status === "ready" && stop.stopType === "collection",
        "Collection requires a ready plan and collection stop.",
      );
    if (
      args.eventType === "collected" &&
      lot.commercialMode === "kuapa_purchase"
    )
      assertAllowed(
        false,
        "Purchase collection must use pilotProcurement.acceptCollectionPurchase after KD-09 funding checks.",
      );
    const history = await ctx.db
      .query("pilotCustodyEvents")
      .withIndex("by_lot_occurred_at", (q) => q.eq("lotId", lot._id))
      .collect();
    const movement = history.filter((event) => event.planId === plan._id);
    assertAllowed(
      !movement.some((event) => event.eventType === args.eventType),
      "This custody milestone was already recorded.",
    );
    const has = (eventType: Doc<"pilotCustodyEvents">["eventType"]) =>
      movement.some((event) => event.eventType === eventType);
    if (args.eventType === "loaded")
      assertAllowed(has("collected"), "Load requires collection first.");
    if (args.eventType === "handed_over" || args.eventType === "delivered")
      assertAllowed(has("loaded"), "Delivery handover requires loading first.");
    await validateLotEvidence(
      ctx,
      principal,
      lot,
      args.evidenceUploadAssetIds,
      ["pilot_collection_evidence", "pilot_custody_evidence"],
    );
    const transporterId = plan.transporterId;
    assertAllowed(
      transporterId !== undefined,
      "Plan has no transporter assignment.",
    );
    const destinationMovement =
      args.eventType === "handed_over" || args.eventType === "delivered";
    const toKind = destinationMovement
      ? ("buyer" as const)
      : ("transporter" as const);
    const toId = destinationMovement
      ? String((await ctx.db.get(plan.requestId))!.buyerId)
      : String(transporterId);
    const now = Date.now();
    const eventId = await ctx.db.insert("pilotCustodyEvents", {
      programmeId: plan.programmeId,
      requestId: plan.requestId,
      lotId: lot._id,
      planId: plan._id,
      stopId: stop._id,
      eventType: args.eventType,
      grams: args.grams,
      fromCustodian: {
        kind: lot.currentCustodianKind,
        ...(lot.currentCustodianId === undefined
          ? {}
          : { id: lot.currentCustodianId }),
        displayNameSnapshot: lot.currentCustodianKind.replaceAll("_", " "),
      },
      toCustodian: {
        kind: toKind,
        id: toId,
        displayNameSnapshot: toKind,
      },
      location: stop.location,
      evidenceUploadAssetIds: args.evidenceUploadAssetIds,
      recordedByUserId: principal._id,
      occurredAt: args.occurredAt,
      createdAt: now,
    });
    await ctx.db.patch(lot._id, {
      currentCustodianKind: toKind,
      currentCustodianId: toId,
      currentLocation: stop.location,
      ...(args.eventType === "delivered"
        ? { dispositionStatus: "delivered" as const }
        : {}),
      version: lot.version + 1,
      updatedAt: now,
    });
    if (args.eventType === "collected")
      await ctx.db.patch(stop._id, {
        collectedGrams: stop.collectedGrams + args.grams,
        status:
          stop.collectedGrams + args.grams === stop.plannedGrams
            ? "completed"
            : "arrived",
        version: stop.version + 1,
        updatedAt: now,
      });
    if (args.eventType === "handed_over" || args.eventType === "delivered")
      await ctx.db.patch(stop._id, {
        collectedGrams:
          args.eventType === "delivered"
            ? Math.min(stop.plannedGrams, stop.collectedGrams + args.grams)
            : stop.collectedGrams,
        status:
          args.eventType === "delivered" &&
          stop.collectedGrams + args.grams >= stop.plannedGrams
            ? "completed"
            : "arrived",
        version: stop.version + 1,
        updatedAt: now,
      });
    const newStatus =
      args.eventType === "collected"
        ? "collecting"
        : args.eventType === "loaded"
          ? "in_transit"
          : plan.status;
    await ctx.db.patch(plan._id, {
      status: newStatus,
      version: plan.version + 1,
      updatedAt: now,
    });
    if (args.eventType === "delivered") {
      const stops = await planStops(ctx, plan._id);
      const lots: Id<"pilotProcurementLots">[] = [
        ...new Set(stops.flatMap((candidate) => candidate.lotIds)),
      ];
      let allDelivered = true;
      for (const lotId of lots) {
        const candidate = await ctx.db.get(lotId);
        if (candidate?.dispositionStatus !== "delivered") allDelivered = false;
      }
      if (allDelivered) {
        await ctx.db.patch(plan._id, { status: "delivered" });
        const request = await ctx.db.get(plan.requestId);
        if (
          request !== null &&
          (request.status === "confirmed" || request.status === "fulfilling")
        )
          await ctx.db.patch(request._id, {
            status: "delivered",
            deliveredAt: now,
            version: request.version + 1,
            updatedAt: now,
          });
        await ctx.db.insert("pilotActivityEvents", {
          programmeId: plan.programmeId,
          requestId: plan.requestId,
          entityType: "pilotFulfilmentPlans",
          entityId: plan._id,
          entityRevision: plan.version + 1,
          eventName: "pilot.delivery.recorded",
          actorUserId: principal._id,
          recipientViews: [
            {
              audience: "buyer",
              title: "Delivery arrival recorded",
              detail:
                "All planned lots arrived. Buyer acceptance remains separate.",
            },
            {
              audience: "pilot_ops",
              title: "Delivery arrival recorded",
              detail: "All planned lots arrived and await buyer acceptance.",
            },
          ],
          createdAt: now,
        });
      }
    } else if (args.eventType === "collected") {
      const request = await ctx.db.get(plan.requestId);
      if (request !== null && request.status === "confirmed")
        await ctx.db.patch(request._id, {
          status: "fulfilling",
          version: request.version + 1,
          updatedAt: now,
        });
    }
    const updatedPlan = (await ctx.db.get(plan._id))!;
    const updatedLot = (await ctx.db.get(lot._id))!;
    await ctx.db.insert("pilotActivityEvents", {
      programmeId: plan.programmeId,
      requestId: plan.requestId,
      entityType: "pilotCustodyEvents",
      entityId: eventId,
      eventName: "pilot.custody.recorded",
      actorUserId: principal._id,
      recipientViews: [
        {
          audience: "pilot_ops",
          title: "Custody recorded",
          detail: `${lot.lotCode}: ${args.eventType}.`,
        },
        {
          audience: "buyer",
          title: "Delivery movement recorded",
          detail: `${lot.lotCode}: ${args.eventType}.`,
        },
        {
          audience: "farmer",
          targetId: lot.farmerId,
          title: "Produce movement recorded",
          detail: `${lot.lotCode}: ${args.eventType}.`,
        },
      ],
      createdAt: now,
    });
    await completePilotIdempotency(ctx, receipt.receiptId, [
      { entityType: "pilotCustodyEvents", entityId: eventId },
      { entityType: "pilotFulfilmentPlans", entityId: plan._id },
      { entityType: "pilotProcurementLots", entityId: lot._id },
    ]);
    return {
      event: await ctx.db.get(eventId),
      plan: planSummary(updatedPlan),
      lot: updatedLot,
    };
  },
});

export const acceptDelivery = mutation({
  args: {
    requestId: v.id("pilotBuyerRequests"),
    planId: v.id("pilotFulfilmentPlans"),
    buyerAgreementRevisionId: v.id("pilotBuyerAgreementRevisions"),
    lines: v.array(acceptanceLine),
    acknowledgedAt: v.number(),
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
      operationName: "pilotFulfilment.acceptDelivery",
      idempotencyKey: args.idempotencyKey,
      requestHash: JSON.stringify(args),
    });
    if (receipt.kind === "replay") {
      const acceptance = await ctx.db.get(
        replayEntityId<"pilotBuyerAcceptances">(
          receipt.receipt,
          "pilotBuyerAcceptances",
        ),
      );
      assertAllowed(acceptance !== null, "Acceptance replay was not found.");
      return acceptance;
    }
    const [plan, agreement] = await Promise.all([
      ctx.db.get(args.planId),
      ctx.db.get(args.buyerAgreementRevisionId),
    ]);
    assertAllowed(
      plan !== null &&
        agreement !== null &&
        plan.requestId === request._id &&
        plan.status === "delivered" &&
        request.status === "delivered" &&
        request.currentAgreementRevisionId === agreement._id &&
        plan.buyerAgreementRevisionId === agreement._id,
      "Buyer acceptance requires delivered lots under the current agreement.",
    );
    assertAllowed(
      Number.isSafeInteger(args.acknowledgedAt) &&
        args.acknowledgedAt <= Date.now(),
      "Buyer acknowledgement time is invalid.",
    );
    assertAllowed(
      args.lines.length > 0 && args.lines.length <= 50,
      "Acceptance needs 1 to 50 lot lines.",
    );
    const targetIds = args.lines.map((line) => line.sublotId ?? line.lotId);
    assertAllowed(
      new Set(targetIds).size === targetIds.length,
      "Acceptance lines must identify each lot once.",
    );
    const stops = await planStops(ctx, plan._id);
    const plannedLotIds = [...new Set(stops.flatMap((stop) => stop.lotIds))];
    assertAllowed(
      plannedLotIds.length === targetIds.length &&
        plannedLotIds.every((lotId) => targetIds.includes(lotId)),
      "Buyer acceptance must account for every delivered plan lot exactly once.",
    );
    const previous = await ctx.db
      .query("pilotBuyerAcceptances")
      .withIndex("by_request_revision", (q) => q.eq("requestId", request._id))
      .collect();
    assertAllowed(
      previous.length === 0,
      "Delivery acceptance is immutable; use the issue workflow for corrections.",
    );
    const persistedLines: Doc<"pilotBuyerAcceptances">["lines"] = [];
    const issueIds: Id<"pilotIssues">[] = [];
    for (const line of args.lines) {
      const lot = await ctx.db.get(line.sublotId ?? line.lotId);
      assertAllowed(
        lot !== null &&
          lot.requestId === request._id &&
          lot.dispositionStatus === "delivered",
        "Acceptance line lot was not delivered for this request.",
      );
      if (line.sublotId !== undefined)
        assertAllowed(
          lot.parentLotId === line.lotId,
          "Acceptance sublot does not belong to the named lot.",
        );
      assertPilotQuantityGrams(line.deliveredGrams, "deliveredGrams");
      assertAllowed(
        Number.isSafeInteger(line.acceptedGrams) &&
          Number.isSafeInteger(line.rejectedGrams) &&
          line.acceptedGrams >= 0 &&
          line.rejectedGrams >= 0 &&
          line.deliveredGrams === lot.sourceGrams &&
          line.acceptedGrams + line.rejectedGrams === line.deliveredGrams &&
          (line.acceptedGrams === 0 || line.rejectedGrams === 0),
        "Acceptance quantities must reconcile; mixed outcomes require separately identified sublots.",
      );
      if (line.rejectedGrams > 0)
        assertAllowed(
          (line.reasonCode?.trim().length ?? 0) > 0 &&
            line.evidenceUploadAssetIds.length > 0,
          "Rejected delivery requires a contractual reason and evidence.",
        );
      if (line.evidenceUploadAssetIds.length > 0)
        await validateLotEvidence(
          ctx,
          principal,
          lot,
          line.evidenceUploadAssetIds,
          ["pilot_acceptance_evidence"],
        );
      if (lot.commercialMode === "kuapa_purchase")
        assertAllowed(
          lot.titleOwnerKind === "kuapa_dwaso",
          "Purchase lot acceptance is blocked until KD-09 records funded collection and Kuapa title.",
        );
      let issueId: Id<"pilotIssues"> | undefined;
      if (line.rejectedGrams > 0) {
        issueId = await ctx.db.insert("pilotIssues", {
          programmeId: request.programmeId,
          requestId: request._id,
          lotId: lot._id,
          planId: plan._id,
          issueType: "buyer_rejection",
          status: "open",
          summary: line.reasonCode!.trim(),
          responsibleCustodian: {
            kind: lot.currentCustodianKind,
            ...(lot.currentCustodianId === undefined
              ? {}
              : { id: lot.currentCustodianId }),
            displayNameSnapshot: lot.currentCustodianKind,
          },
          evidenceUploadAssetIds: line.evidenceUploadAssetIds,
          version: 0,
          createdByUserId: principal._id,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        issueIds.push(issueId);
      }
      await ctx.db.patch(lot._id, {
        ...(line.acceptedGrams > 0 && lot.commercialMode === "coordination"
          ? { titleOwnerKind: "buyer" as const, titleOwnerFarmerId: undefined }
          : {}),
        dispositionStatus: line.rejectedGrams > 0 ? "held" : "delivered",
        version: lot.version + 1,
        updatedAt: Date.now(),
      });
      persistedLines.push({
        lotId: line.lotId,
        ...(line.sublotId === undefined ? {} : { sublotId: line.sublotId }),
        deliveredGrams: line.deliveredGrams,
        acceptedGrams: line.acceptedGrams,
        rejectedGrams: line.rejectedGrams,
        ...(line.reasonCode === undefined
          ? {}
          : { reasonCode: line.reasonCode.trim() }),
        evidenceUploadAssetIds: line.evidenceUploadAssetIds,
        ...(issueId === undefined ? {} : { issueId }),
        discrepancyState: issueId === undefined ? "none" : "open",
      });
    }
    const now = Date.now();
    const acceptanceId = await ctx.db.insert("pilotBuyerAcceptances", {
      programmeId: request.programmeId,
      requestId: request._id,
      planId: plan._id,
      buyerAgreementRevisionId: agreement._id,
      revision: 1,
      lines: persistedLines,
      acknowledgedByBuyerUserId: principal._id,
      acknowledgedAt: args.acknowledgedAt,
      createdAt: now,
    });
    const rejected = persistedLines.reduce(
      (sum, line) => sum + line.rejectedGrams,
      0,
    );
    for (const issueId of issueIds) {
      const issue = await ctx.db.get(issueId);
      if (issue !== null)
        await ctx.db.patch(issueId, {
          acceptanceId,
          version: issue.version + 1,
          updatedAt: now,
        });
    }
    if (rejected > 0)
      await ctx.db.patch(request._id, {
        status: "disputed",
        version: request.version + 1,
        updatedAt: now,
      });
    await ctx.db.insert("pilotActivityEvents", {
      programmeId: request.programmeId,
      requestId: request._id,
      entityType: "pilotBuyerAcceptances",
      entityId: acceptanceId,
      eventName:
        rejected > 0 ? "pilot.delivery.rejected" : "pilot.delivery.accepted",
      actorUserId: principal._id,
      recipientViews: [
        {
          audience: "buyer",
          title: "Delivery acceptance recorded",
          detail: `${rejected}g rejected.`,
        },
        {
          audience: "pilot_ops",
          title: "Buyer acceptance recorded",
          detail: `${rejected}g rejected; ${issueIds.length} issue(s) opened.`,
        },
      ],
      createdAt: now,
    });
    await completePilotIdempotency(ctx, receipt.receiptId, [
      { entityType: "pilotBuyerAcceptances", entityId: acceptanceId },
      ...issueIds.map((entityId) => ({
        entityType: "pilotIssues" as const,
        entityId,
      })),
    ]);
    return {
      acceptance: await ctx.db.get(acceptanceId),
      issueIds,
      arrivalRecordedSeparately: true,
      paymentStatusChanged: false,
      financialPostingPending: true,
    };
  },
});

export const getPlan = query({
  args: { planId: v.id("pilotFulfilmentPlans") },
  handler: async (ctx, args) => {
    const principal = await requirePilotPrincipal(ctx);
    const plan = await ctx.db.get(args.planId);
    if (plan === null) return null;
    const request = await ctx.db.get(plan.requestId);
    assertAllowed(request !== null, "Plan request was not found.");
    const isDriver =
      principal.role === "transporter" && plan.driverUserId === principal._id;
    if (!isDriver) await requirePilotRequestRead(ctx, principal, request);
    const stops = await planStops(ctx, plan._id);
    let ownFarmerId: Id<"farmers"> | undefined;
    if (principal.role === "farmer") {
      const farmer = await ctx.db
        .query("farmers")
        .withIndex("by_user", (q) => q.eq("userId", principal._id))
        .unique();
      assertAllowed(farmer !== null, "Farmer profile was not found.");
      ownFarmerId = farmer._id;
    }
    const visibleStops = [];
    for (const stop of stops) {
      const lots = [];
      for (const lotId of stop.lotIds) {
        const lot = await ctx.db.get(lotId);
        if (
          lot === null ||
          (ownFarmerId !== undefined && lot.farmerId !== ownFarmerId)
        )
          continue;
        lots.push(
          projectPilotLotForPrincipal(
            principal,
            lot,
            lot.farmerId === ownFarmerId,
          ),
        );
      }
      if (ownFarmerId === undefined || lots.length > 0)
        visibleStops.push({
          stopId: stop._id,
          sequence: stop.sequence,
          stopType: stop.stopType,
          location: stop.location,
          plannedGrams: stop.plannedGrams,
          collectedGrams: stop.collectedGrams,
          windowStartAt: stop.windowStartAt,
          windowEndAt: stop.windowEndAt,
          status: stop.status,
          lots,
        });
    }
    assertAllowed(
      ownFarmerId === undefined || visibleStops.length > 0,
      "Farmer has no lot in this plan.",
    );
    return { plan: planSummary(plan), stops: visibleStops };
  },
});

export { evaluatePlan };
